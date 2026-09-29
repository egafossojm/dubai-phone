from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from catalog_service.policies import (
    assert_selling_price,
    can_change_product_prices,
    normalize_sku,
    parse_xaf_amount,
)
from catalog_service.presenters import to_product_detail, to_product_list_item
from dubai_shared.audit import write_audit
from dubai_shared.auth import AuthUser, db_session, require_permission
from dubai_shared.errors import AppError
from dubai_shared.http import ok
from dubai_shared.models import Brand, Category, Product, ProductVariant, StoreSetting

router = APIRouter()

PRODUCT_LOAD = (
    joinedload(Product.brand),
    joinedload(Product.category),
    selectinload(Product.variants).selectinload(ProductVariant.serials),
)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _low_stock_threshold(db: Session) -> int:
    setting = db.scalar(
        select(StoreSetting).where(StoreSetting.key == "stock.lowStockThreshold")
    )
    try:
        parsed = int(setting.value) if setting else 3
    except (TypeError, ValueError):
        parsed = 3
    return parsed if parsed >= 0 else 3


def _load_product(db: Session, product_id: str) -> Product | None:
    return db.scalar(
        select(Product)
        .options(*PRODUCT_LOAD)
        .where(Product.id == product_id, Product.deletedAt.is_(None))
    )


def _barcode_or_null(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class CatalogNameBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class VariantCreateBody(BaseModel):
    sku: str
    barcode: str | None = None
    name: str = Field(min_length=1, max_length=80)
    sellingPriceXaf: int | str
    costPriceXaf: int | str = 0
    warrantyMonths: int = 0


class ProductCreateBody(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    brandId: str
    categoryId: str
    isSerialized: bool
    status: str | None = None
    variant: VariantCreateBody


class ProductUpdateBody(BaseModel):
    name: str | None = None
    brandId: str | None = None
    categoryId: str | None = None
    isSerialized: bool | None = None
    status: str | None = None


class VariantUpdateBody(BaseModel):
    sku: str | None = None
    barcode: str | None = None
    name: str | None = None
    sellingPriceXaf: int | str | None = None
    costPriceXaf: int | str | None = None
    warrantyMonths: int | None = None
    status: str | None = None


@router.get("/api/brands")
def list_brands(
    db: Session = Depends(db_session),
    _user: AuthUser = Depends(require_permission("products.read")),
):
    rows = db.scalars(
        select(Brand).where(Brand.deletedAt.is_(None)).order_by(Brand.name.asc())
    ).all()
    return ok({"brands": [{"id": row.id, "name": row.name} for row in rows]})


@router.post("/api/brands")
def create_brand(
    payload: CatalogNameBody,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.create")),
):
    name = payload.name.strip()
    existing = db.scalar(
        select(Brand).where(
            func.lower(Brand.name) == name.lower(), Brand.deletedAt.is_(None)
        )
    )
    if existing:
        raise AppError("CONFLICT", "Cette marque existe déjà.")
    now = _now()
    brand = Brand(
        id=str(uuid4()),
        name=name,
        deletedAt=None,
        createdAt=now,
        updatedAt=now,
    )
    db.add(brand)
    db.flush()
    write_audit(
        db,
        actor_id=user.id,
        action="brand.create",
        entity_type="Brand",
        entity_id=brand.id,
        after={"name": brand.name},
    )
    return ok({"id": brand.id, "name": brand.name}, 201)


@router.get("/api/categories")
def list_categories(
    db: Session = Depends(db_session),
    _user: AuthUser = Depends(require_permission("products.read")),
):
    rows = db.scalars(
        select(Category).where(Category.deletedAt.is_(None)).order_by(Category.name.asc())
    ).all()
    return ok({"categories": [{"id": row.id, "name": row.name} for row in rows]})


@router.post("/api/categories")
def create_category(
    payload: CatalogNameBody,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.create")),
):
    name = payload.name.strip()
    existing = db.scalar(
        select(Category).where(
            func.lower(Category.name) == name.lower(), Category.deletedAt.is_(None)
        )
    )
    if existing:
        raise AppError("CONFLICT", "Cette catégorie existe déjà.")
    now = _now()
    category = Category(
        id=str(uuid4()),
        name=name,
        deletedAt=None,
        createdAt=now,
        updatedAt=now,
    )
    db.add(category)
    db.flush()
    write_audit(
        db,
        actor_id=user.id,
        action="category.create",
        entity_type="Category",
        entity_id=category.id,
        after={"name": category.name},
    )
    return ok({"id": category.id, "name": category.name}, 201)


@router.get("/api/products")
def list_products(
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.read")),
    q: str | None = None,
    brandId: str | None = None,
    categoryId: str | None = None,
    status: str | None = None,
    serialized: str | None = None,
    stock: str | None = None,
    sort: str | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    stmt = (
        select(Product)
        .options(*PRODUCT_LOAD)
        .where(Product.deletedAt.is_(None))
    )
    if brandId:
        stmt = stmt.where(Product.brandId == brandId)
    if categoryId:
        stmt = stmt.where(Product.categoryId == categoryId)
    if status:
        stmt = stmt.where(Product.status == status)
    if serialized == "true":
        stmt = stmt.where(Product.isSerialized.is_(True))
    elif serialized == "false":
        stmt = stmt.where(Product.isSerialized.is_(False))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(pattern),
                Product.variants.any(ProductVariant.sku.ilike(pattern)),
                Product.variants.any(ProductVariant.barcode.ilike(pattern)),
            )
        )
    products = db.scalars(stmt.order_by(Product.name.asc())).unique().all()
    threshold = _low_stock_threshold(db)
    items = [to_product_list_item(product, user, threshold) for product in products]
    if stock:
        items = [item for item in items if item["stockStatus"] == stock]
    by_id = {product.id: product for product in products}
    if sort == "recent":
        items.sort(key=lambda item: by_id[item["id"]].createdAt.timestamp(), reverse=True)
    elif sort == "price":
        items.sort(key=lambda item: int(item["sellingPriceXaf"]), reverse=True)
    start = (page - 1) * pageSize
    paged = items[start : start + pageSize]
    return ok(
        {
            "items": paged,
            "page": page,
            "pageSize": pageSize,
            "total": len(items),
            "lowStockThreshold": threshold,
        }
    )


@router.post("/api/products")
def create_product(
    payload: ProductCreateBody,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.create")),
):
    if not can_change_product_prices(user.permissions):
        raise AppError(
            "AUTHORIZATION_ERROR",
            "Seuls le manager ou l'administrateur peuvent définir les prix à la création.",
        )
    brand = db.scalar(
        select(Brand).where(Brand.id == payload.brandId, Brand.deletedAt.is_(None))
    )
    if not brand:
        raise AppError("NOT_FOUND", "Marque introuvable.")
    category = db.scalar(
        select(Category).where(
            Category.id == payload.categoryId, Category.deletedAt.is_(None)
        )
    )
    if not category:
        raise AppError("NOT_FOUND", "Catégorie introuvable.")
    selling = parse_xaf_amount(payload.variant.sellingPriceXaf, "Prix de vente")
    cost = parse_xaf_amount(payload.variant.costPriceXaf, "Coût d'achat")
    assert_selling_price(selling, cost)
    now = _now()
    product = Product(
        id=str(uuid4()),
        name=payload.name.strip(),
        brandId=payload.brandId,
        categoryId=payload.categoryId,
        isSerialized=payload.isSerialized,
        status=payload.status or "ACTIVE",
        deletedAt=None,
        createdAt=now,
        updatedAt=now,
    )
    variant = ProductVariant(
        id=str(uuid4()),
        productId=product.id,
        sku=normalize_sku(payload.variant.sku),
        barcode=_barcode_or_null(payload.variant.barcode),
        name=payload.variant.name.strip(),
        sellingPriceXaf=selling,
        costPriceXaf=cost,
        warrantyMonths=payload.variant.warrantyMonths,
        status="ACTIVE",
        quantityOnHand=0,
        deletedAt=None,
        createdAt=now,
        updatedAt=now,
    )
    db.add(product)
    db.add(variant)
    try:
        db.flush()
    except IntegrityError as error:
        raise AppError("CONFLICT", "Ce SKU existe déjà.") from error
    write_audit(
        db,
        actor_id=user.id,
        action="product.create",
        entity_type="Product",
        entity_id=product.id,
        after={
            "name": product.name,
            "sku": variant.sku,
            "sellingPriceXaf": str(selling),
            "isSerialized": product.isSerialized,
        },
    )
    loaded = _load_product(db, product.id)
    return ok(to_product_detail(loaded, user, _low_stock_threshold(db)), 201)


@router.get("/api/products/{product_id}")
def get_product(
    product_id: str,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.read")),
):
    product = _load_product(db, product_id)
    if not product:
        raise AppError("NOT_FOUND", "Produit introuvable.")
    return ok(to_product_detail(product, user, _low_stock_threshold(db)))


@router.patch("/api/products/{product_id}")
def update_product(
    product_id: str,
    payload: ProductUpdateBody,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.update")),
):
    product = _load_product(db, product_id)
    if not product:
        raise AppError("NOT_FOUND", "Produit introuvable.")
    if payload.brandId:
        brand = db.scalar(
            select(Brand).where(Brand.id == payload.brandId, Brand.deletedAt.is_(None))
        )
        if not brand:
            raise AppError("NOT_FOUND", "Marque introuvable.")
    if payload.categoryId:
        category = db.scalar(
            select(Category).where(
                Category.id == payload.categoryId, Category.deletedAt.is_(None)
            )
        )
        if not category:
            raise AppError("NOT_FOUND", "Catégorie introuvable.")
    if payload.isSerialized is False and product.isSerialized:
        has_serials = any(variant.serials for variant in product.variants)
        if has_serials:
            raise AppError(
                "BUSINESS_RULE_ERROR",
                "Impossible de désactiver le suivi sérialisé : des IMEI / séries sont déjà enregistrés.",
            )
    if product.status == "INACTIVE" and payload.status is not None:
        raise AppError(
            "AUTHORIZATION_ERROR",
            "Pour réactiver un produit, utilisez l'action Réactiver.",
        )
    before = {
        "name": product.name,
        "status": product.status,
        "isSerialized": product.isSerialized,
    }
    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.brandId is not None:
        product.brandId = payload.brandId
    if payload.categoryId is not None:
        product.categoryId = payload.categoryId
    if payload.isSerialized is not None:
        product.isSerialized = payload.isSerialized
    if payload.status is not None:
        product.status = payload.status
    product.updatedAt = _now()
    db.flush()
    write_audit(
        db,
        actor_id=user.id,
        action="product.update",
        entity_type="Product",
        entity_id=product_id,
        before=before,
        after={
            "name": product.name,
            "status": product.status,
            "isSerialized": product.isSerialized,
        },
    )
    loaded = _load_product(db, product_id)
    return ok(to_product_detail(loaded, user, _low_stock_threshold(db)))


@router.delete("/api/products/{product_id}")
def deactivate_product(
    product_id: str,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.delete")),
):
    product = _load_product(db, product_id)
    if not product:
        raise AppError("NOT_FOUND", "Produit introuvable.")
    before_status = product.status
    product.status = "INACTIVE"
    product.updatedAt = _now()
    db.flush()
    write_audit(
        db,
        actor_id=user.id,
        action="product.deactivate",
        entity_type="Product",
        entity_id=product_id,
        before={"status": before_status},
        after={"status": "INACTIVE"},
    )
    loaded = _load_product(db, product_id)
    return ok(to_product_detail(loaded, user, _low_stock_threshold(db)))


@router.post("/api/products/{product_id}/reactivate")
def reactivate_product(
    product_id: str,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.delete")),
):
    product = _load_product(db, product_id)
    if not product:
        raise AppError("NOT_FOUND", "Produit introuvable.")
    before_status = product.status
    product.status = "ACTIVE"
    product.updatedAt = _now()
    db.flush()
    write_audit(
        db,
        actor_id=user.id,
        action="product.reactivate",
        entity_type="Product",
        entity_id=product_id,
        before={"status": before_status},
        after={"status": "ACTIVE"},
    )
    loaded = _load_product(db, product_id)
    return ok(to_product_detail(loaded, user, _low_stock_threshold(db)))


@router.post("/api/products/{product_id}/serials")
def register_serial(
    product_id: str,
    db: Session = Depends(db_session),
    _user: AuthUser = Depends(require_permission("products.update")),
):
    product = _load_product(db, product_id)
    if not product:
        raise AppError("NOT_FOUND", "Produit introuvable.")
    raise AppError(
        "BUSINESS_RULE_ERROR",
        "Les IMEI et numéros de série s'enregistrent à la réception de stock, pas dans le catalogue.",
    )


@router.post("/api/products/{product_id}/variants")
def add_variant(
    product_id: str,
    payload: VariantCreateBody,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.update")),
):
    if not can_change_product_prices(user.permissions):
        raise AppError(
            "AUTHORIZATION_ERROR",
            "Seuls le manager ou l'administrateur peuvent définir les prix à la création.",
        )
    product = _load_product(db, product_id)
    if not product:
        raise AppError("NOT_FOUND", "Produit introuvable.")
    selling = parse_xaf_amount(payload.sellingPriceXaf, "Prix de vente")
    cost = parse_xaf_amount(payload.costPriceXaf, "Coût d'achat")
    assert_selling_price(selling, cost)
    now = _now()
    variant = ProductVariant(
        id=str(uuid4()),
        productId=product_id,
        sku=normalize_sku(payload.sku),
        barcode=_barcode_or_null(payload.barcode),
        name=payload.name.strip(),
        sellingPriceXaf=selling,
        costPriceXaf=cost,
        warrantyMonths=payload.warrantyMonths,
        status="ACTIVE",
        quantityOnHand=0,
        deletedAt=None,
        createdAt=now,
        updatedAt=now,
    )
    db.add(variant)
    try:
        db.flush()
    except IntegrityError as error:
        raise AppError("CONFLICT", "Ce SKU existe déjà.") from error
    write_audit(
        db,
        actor_id=user.id,
        action="product.variant.create",
        entity_type="ProductVariant",
        entity_id=variant.id,
        after={"sku": variant.sku, "sellingPriceXaf": str(selling)},
    )
    loaded = _load_product(db, product_id)
    return ok(to_product_detail(loaded, user, _low_stock_threshold(db)), 201)


@router.patch("/api/products/variants/{variant_id}")
def update_variant(
    variant_id: str,
    payload: VariantUpdateBody,
    db: Session = Depends(db_session),
    user: AuthUser = Depends(require_permission("products.update")),
):
    variant = db.scalar(
        select(ProductVariant)
        .options(joinedload(ProductVariant.product))
        .where(ProductVariant.id == variant_id, ProductVariant.deletedAt.is_(None))
    )
    if not variant or variant.product.deletedAt is not None:
        raise AppError("NOT_FOUND", "Variante introuvable.")
    selling = (
        parse_xaf_amount(payload.sellingPriceXaf, "Prix de vente")
        if payload.sellingPriceXaf is not None
        else int(variant.sellingPriceXaf)
    )
    cost = (
        parse_xaf_amount(payload.costPriceXaf, "Coût d'achat")
        if payload.costPriceXaf is not None
        else int(variant.costPriceXaf)
    )
    assert_selling_price(selling, cost)
    price_changed = selling != int(variant.sellingPriceXaf) or cost != int(
        variant.costPriceXaf
    )
    if price_changed and not can_change_product_prices(user.permissions):
        raise AppError(
            "AUTHORIZATION_ERROR",
            "Seuls le manager ou l'administrateur peuvent modifier les prix.",
        )
    before = {
        "sellingPriceXaf": str(variant.sellingPriceXaf),
        "costPriceXaf": str(variant.costPriceXaf),
        "sku": variant.sku,
    }
    if payload.sku:
        variant.sku = normalize_sku(payload.sku)
    if payload.barcode is not None:
        variant.barcode = _barcode_or_null(payload.barcode)
    if payload.name is not None:
        variant.name = payload.name.strip()
    if payload.sellingPriceXaf is not None:
        variant.sellingPriceXaf = selling
    if payload.costPriceXaf is not None:
        variant.costPriceXaf = cost
    if payload.warrantyMonths is not None:
        variant.warrantyMonths = payload.warrantyMonths
    if payload.status is not None:
        variant.status = payload.status
    variant.updatedAt = _now()
    try:
        db.flush()
    except IntegrityError as error:
        raise AppError("CONFLICT", "Ce SKU existe déjà.") from error
    write_audit(
        db,
        actor_id=user.id,
        action="product.price_change" if price_changed else "product.variant.update",
        entity_type="ProductVariant",
        entity_id=variant_id,
        before=before,
        after={
            "sellingPriceXaf": str(selling),
            "costPriceXaf": str(cost),
            "sku": variant.sku,
        },
    )
    loaded = _load_product(db, variant.productId)
    return ok(to_product_detail(loaded, user, _low_stock_threshold(db)))
