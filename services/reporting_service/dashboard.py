from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from dubai_shared.auth import AuthUser
from dubai_shared.models import (
    CustomerCredit,
    Payment,
    Product,
    ProductVariant,
    Refund,
    ReturnItem,
    ReturnRecord,
    Sale,
    SaleItem,
    StoreSetting,
)
from dubai_shared.permissions import has_permission
from reporting_service.dashboard_policies import (
    DASHBOARD_CUSTOM_MAX_DAYS,
    average_basket_xaf,
    estimate_sale_margin_xaf,
    inclusive_day_span,
    is_low_stock,
    net_line_after_returns,
    resolve_dashboard_range,
)
from reporting_service.presenters import to_dashboard_payload

SALE_STATUSES = ("COMPLETED", "PARTIALLY_RETURNED", "RETURNED")


def _threshold(db: Session) -> int:
    setting = db.scalar(
        select(StoreSetting).where(StoreSetting.key == "stock.lowStockThreshold")
    )
    try:
        parsed = int(setting.value) if setting else 3
    except (TypeError, ValueError):
        parsed = 3
    return parsed if parsed >= 0 else 3


def _sum_payments(db: Session, start, end) -> int:
    value = db.scalar(
        select(func.coalesce(func.sum(Payment.amountXaf), 0)).where(
            Payment.paidAt >= start,
            Payment.paidAt < end,
            Payment.sale.has(cast(Sale.status, String).in_(SALE_STATUSES)),
        )
    )
    return int(value or 0)


def _sum_refunds(db: Session, start, end) -> int:
    value = db.scalar(
        select(func.coalesce(func.sum(Refund.amountXaf), 0)).where(
            Refund.refundedAt >= start,
            Refund.refundedAt < end,
        )
    )
    return int(value or 0)


def get_dashboard(db: Session, user: AuthUser, period: str, from_ymd: str | None, to_ymd: str | None):
    if period == "custom":
        if not from_ymd or not to_ymd:
            raise ValueError("custom-range")
        if from_ymd > to_ymd:
            raise ValueError("order")
        if inclusive_day_span(from_ymd, to_ymd) > DASHBOARD_CUSTOM_MAX_DAYS:
            raise ValueError("span")
    can_read_financials = has_permission(user.permissions, "reports.read")
    can_read_own_ca = not can_read_financials
    range_data = resolve_dashboard_range(period, from_ymd, to_ymd)
    range_data["period"] = period
    today = resolve_dashboard_range("today")
    month = resolve_dashboard_range("month")
    threshold = _threshold(db)

    sale_stmt = (
        select(Sale)
        .options(
            joinedload(Sale.soldBy),
            joinedload(Sale.customer),
            selectinload(Sale.items)
            .selectinload(SaleItem.variant)
            .joinedload(ProductVariant.product),
        )
        .where(
            cast(Sale.status, String).in_(SALE_STATUSES),
            Sale.completedAt >= range_data["from"],
            Sale.completedAt < range_data["toExclusive"],
        )
        .order_by(Sale.completedAt.desc())
        .limit(5000)
    )
    if can_read_own_ca:
        sale_stmt = sale_stmt.where(Sale.soldById == user.id)
    sales_in_period = db.scalars(sale_stmt).unique().all()

    recent_stmt = (
        select(Sale)
        .options(joinedload(Sale.soldBy), joinedload(Sale.customer))
        .where(
            cast(Sale.status, String).in_(SALE_STATUSES),
            Sale.completedAt >= range_data["from"],
            Sale.completedAt < range_data["toExclusive"],
        )
        .order_by(Sale.completedAt.desc())
        .limit(10)
    )
    if can_read_own_ca:
        recent_stmt = recent_stmt.where(Sale.soldById == user.id)
    recent_sales = db.scalars(recent_stmt).unique().all()

    low_stock_rows = db.scalars(
        select(ProductVariant)
        .options(joinedload(ProductVariant.product))
        .join(Product, Product.id == ProductVariant.productId)
        .where(
            ProductVariant.deletedAt.is_(None),
            cast(ProductVariant.status, String) == "ACTIVE",
            ProductVariant.quantityOnHand <= threshold,
            Product.deletedAt.is_(None),
            cast(Product.status, String) == "ACTIVE",
        )
        .order_by(ProductVariant.quantityOnHand.asc())
        .limit(20)
    ).all()

    sale_ids = [sale.id for sale in sales_in_period]
    sale_item_ids = [item.id for sale in sales_in_period for item in sale.items]

    refunds_by_sale: dict[str, int] = {}
    if sale_ids:
        refund_rows = db.execute(
            select(Refund.amountXaf, ReturnRecord.saleId)
            .join(ReturnRecord, ReturnRecord.id == Refund.returnId)
            .where(ReturnRecord.saleId.in_(sale_ids))
        ).all()
        for amount, sale_id in refund_rows:
            refunds_by_sale[sale_id] = refunds_by_sale.get(sale_id, 0) + int(amount)

    returned_by_item: dict[str, int] = {}
    if sale_item_ids:
        returned_rows = db.execute(
            select(ReturnItem.saleItemId, func.coalesce(func.sum(ReturnItem.quantity), 0))
            .join(ReturnRecord, ReturnRecord.id == ReturnItem.returnId)
            .where(
                ReturnItem.saleItemId.in_(sale_item_ids),
                cast(ReturnRecord.status, String) == "COMPLETED",
            )
            .group_by(ReturnItem.saleItemId)
        ).all()
        returned_by_item = {row[0]: int(row[1]) for row in returned_rows}

    revenue_xaf = 0
    margin_xaf = 0
    active_sale_count = 0
    product_agg: dict[str, dict] = {}
    seller_agg: dict[str, dict] = {}

    for sale in sales_in_period:
        refunded = refunds_by_sale.get(sale.id, 0)
        net_sale = int(sale.totalXaf) - refunded if int(sale.totalXaf) > refunded else 0
        if sale.status == "RETURNED" and net_sale <= 0:
            continue
        active_sale_count += 1
        revenue_xaf += net_sale
        if can_read_financials:
            margin_xaf += estimate_sale_margin_xaf(
                int(sale.totalXaf),
                refunded,
                [
                    {
                        "lineTotalXaf": int(item.lineTotalXaf),
                        "costPriceXaf": int(item.variant.costPriceXaf),
                        "saleQuantity": item.quantity,
                        "returnedQuantity": returned_by_item.get(item.id, 0),
                    }
                    for item in sale.items
                ],
            )
        seller = seller_agg.setdefault(
            sale.soldById,
            {
                "userId": sale.soldBy.id,
                "fullName": sale.soldBy.fullName,
                "saleCount": 0,
                "revenueXaf": 0,
            },
        )
        seller["saleCount"] += 1
        seller["revenueXaf"] += net_sale
        for item in sale.items:
            net_qty, net_line = net_line_after_returns(
                int(item.lineTotalXaf), item.quantity, returned_by_item.get(item.id, 0)
            )
            if net_qty <= 0:
                continue
            row = product_agg.setdefault(
                item.variantId,
                {
                    "variantId": item.variant.id,
                    "sku": item.variant.sku,
                    "name": f"{item.variant.product.name} — {item.variant.name}",
                    "quantity": 0,
                    "revenueXaf": 0,
                },
            )
            row["quantity"] += net_qty
            row["revenueXaf"] += net_line

    basket = average_basket_xaf(revenue_xaf, active_sale_count)
    if can_read_financials:
        ca_today = max(_sum_payments(db, today["from"], today["toExclusive"]) - _sum_refunds(db, today["from"], today["toExclusive"]), 0)
        ca_month = max(_sum_payments(db, month["from"], month["toExclusive"]) - _sum_refunds(db, month["from"], month["toExclusive"]), 0)
        credit_outstanding = int(
            db.scalar(
                select(func.coalesce(func.sum(CustomerCredit.remainingXaf), 0)).where(
                    cast(CustomerCredit.status, String).notin_(["PAID", "CANCELLED"])
                )
            )
            or 0
        )
        payment_rows = db.execute(
            select(
                Payment.method,
                func.coalesce(func.sum(Payment.amountXaf), 0),
                func.count(),
            )
            .where(
                Payment.paidAt >= range_data["from"],
                Payment.paidAt < range_data["toExclusive"],
                Payment.sale.has(cast(Sale.status, String).in_(SALE_STATUSES)),
            )
            .group_by(Payment.method)
        ).all()
        refunds_period = _sum_refunds(db, range_data["from"], range_data["toExclusive"])
        period_cash = max(
            _sum_payments(db, range_data["from"], range_data["toExclusive"]) - refunds_period,
            0,
        )
    else:
        ca_today = ca_month = credit_outstanding = refunds_period = 0
        payment_rows = []
        period_cash = revenue_xaf

    top_products = sorted(
        product_agg.values(), key=lambda row: (-row["quantity"], row["sku"])
    )[:10]
    sales_by_seller = sorted(
        seller_agg.values(),
        key=lambda row: (
            -row["saleCount"],
            -row["revenueXaf"] if can_read_financials else 0,
            row["fullName"],
        ),
    )

    return to_dashboard_payload(
        {
            "range": range_data,
            "canReadFinancials": can_read_financials,
            "canReadOwnCa": can_read_own_ca,
            "saleCount": active_sale_count,
            "revenueXaf": period_cash,
            "marginXaf": margin_xaf,
            "averageBasketXaf": average_basket_xaf(period_cash, active_sale_count)
            if can_read_financials
            else basket,
            "caTodayXaf": ca_today,
            "caMonthXaf": ca_month,
            "refundsPeriodXaf": refunds_period,
            "creditOutstandingXaf": credit_outstanding,
            "paymentsByMethod": [
                {"method": row[0], "amountXaf": int(row[1]), "count": int(row[2])}
                for row in payment_rows
            ],
            "lowStock": [
                {
                    "variantId": row.id,
                    "sku": row.sku,
                    "name": f"{row.product.name} — {row.name}",
                    "quantityOnHand": row.quantityOnHand,
                }
                for row in low_stock_rows
                if is_low_stock(row.quantityOnHand, threshold)
            ],
            "topProducts": top_products,
            "salesBySeller": sales_by_seller,
            "recentSales": [
                {
                    "id": sale.id,
                    "reference": sale.reference,
                    "totalXaf": int(sale.totalXaf),
                    "completedAt": sale.completedAt,
                    "soldByName": sale.soldBy.fullName,
                    "customerName": sale.customer.fullName if sale.customer else None,
                }
                for sale in recent_sales
            ],
            "lowStockThreshold": threshold,
            "ownCa": {
                "saleCount": active_sale_count,
                "revenueXaf": revenue_xaf,
                "averageBasketXaf": basket,
            }
            if can_read_own_ca
            else None,
        }
    )
