from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column("email", String, unique=True)
    fullName: Mapped[str] = mapped_column("fullName", String)
    passwordHash: Mapped[str] = mapped_column("passwordHash", String)
    status: Mapped[str] = mapped_column(String)
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    roles: Mapped[list["UserRole"]] = relationship(back_populates="user")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    maxDiscountBps: Mapped[int] = mapped_column("maxDiscountBps", Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    users: Mapped[list["UserRole"]] = relationship(back_populates="role")
    permissions: Mapped[list["RolePermission"]] = relationship(back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)

    roles: Mapped[list["RolePermission"]] = relationship(back_populates="permission")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("userId", "roleId"),)

    userId: Mapped[str] = mapped_column("userId", ForeignKey("users.id"), primary_key=True)
    roleId: Mapped[str] = mapped_column("roleId", ForeignKey("roles.id"), primary_key=True)
    assignedAt: Mapped[datetime] = mapped_column("assignedAt", DateTime)

    user: Mapped[User] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship(back_populates="users")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    roleId: Mapped[str] = mapped_column("roleId", ForeignKey("roles.id"), primary_key=True)
    permissionId: Mapped[str] = mapped_column(
        "permissionId", ForeignKey("permissions.id"), primary_key=True
    )
    assignedAt: Mapped[datetime] = mapped_column("assignedAt", DateTime)

    role: Mapped[Role] = relationship(back_populates="permissions")
    permission: Mapped[Permission] = relationship(back_populates="roles")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    tokenHash: Mapped[str] = mapped_column("tokenHash", String, unique=True)
    expiresAt: Mapped[datetime] = mapped_column("expiresAt", DateTime)
    revokedAt: Mapped[datetime | None] = mapped_column("revokedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)

    user: Mapped[User] = relationship(back_populates="sessions")


class StoreSetting(Base):
    __tablename__ = "store_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    key: Mapped[str] = mapped_column(String, unique=True)
    value: Mapped[str] = mapped_column(Text)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    actorId: Mapped[str | None] = mapped_column("actorId", String)
    action: Mapped[str] = mapped_column(String)
    entityType: Mapped[str] = mapped_column("entityType", String)
    entityId: Mapped[str] = mapped_column("entityId", String)
    beforeJson: Mapped[str | None] = mapped_column("beforeJson", Text)
    afterJson: Mapped[str | None] = mapped_column("afterJson", Text)
    reason: Mapped[str | None] = mapped_column(String)
    requestId: Mapped[str | None] = mapped_column("requestId", String)
    ipAddress: Mapped[str | None] = mapped_column("ipAddress", String)
    userAgent: Mapped[str | None] = mapped_column("userAgent", String)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    brandId: Mapped[str] = mapped_column("brandId", ForeignKey("brands.id"))
    categoryId: Mapped[str] = mapped_column("categoryId", ForeignKey("categories.id"))
    isSerialized: Mapped[bool] = mapped_column("isSerialized", Boolean)
    status: Mapped[str] = mapped_column(String)
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    brand: Mapped[Brand] = relationship(back_populates="products")
    category: Mapped[Category] = relationship(back_populates="products")
    variants: Mapped[list["ProductVariant"]] = relationship(back_populates="product")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    productId: Mapped[str] = mapped_column("productId", ForeignKey("products.id"))
    sku: Mapped[str] = mapped_column(String, unique=True)
    barcode: Mapped[str | None] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    sellingPriceXaf: Mapped[int] = mapped_column("sellingPriceXaf", BigInteger)
    costPriceXaf: Mapped[int] = mapped_column("costPriceXaf", BigInteger)
    warrantyMonths: Mapped[int] = mapped_column("warrantyMonths", Integer)
    status: Mapped[str] = mapped_column(String)
    quantityOnHand: Mapped[int] = mapped_column("quantityOnHand", Integer)
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    product: Mapped[Product] = relationship(back_populates="variants")
    serials: Mapped[list["ProductSerial"]] = relationship(back_populates="variant")


class ProductSerial(Base):
    __tablename__ = "product_serials"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    variantId: Mapped[str] = mapped_column("variantId", ForeignKey("product_variants.id"))
    imei1: Mapped[str | None] = mapped_column(String)
    imei2: Mapped[str | None] = mapped_column(String)
    serialNumber: Mapped[str | None] = mapped_column("serialNumber", String)
    status: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updatedAt: Mapped[datetime] = mapped_column("updatedAt", DateTime)

    variant: Mapped[ProductVariant] = relationship(back_populates="serials")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    fullName: Mapped[str] = mapped_column("fullName", String)
    deletedAt: Mapped[datetime | None] = mapped_column("deletedAt", DateTime)


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    reference: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    customerId: Mapped[str | None] = mapped_column("customerId", String)
    soldById: Mapped[str] = mapped_column("soldById", String)
    totalXaf: Mapped[int] = mapped_column("totalXaf", BigInteger)
    completedAt: Mapped[datetime | None] = mapped_column("completedAt", DateTime)

    customer: Mapped[Customer | None] = relationship(
        foreign_keys=[customerId],
        primaryjoin="Sale.customerId==Customer.id",
        viewonly=True,
    )
    soldBy: Mapped[User] = relationship(
        foreign_keys=[soldById],
        primaryjoin="Sale.soldById==User.id",
        viewonly=True,
    )
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale")
    payments: Mapped[list["Payment"]] = relationship(back_populates="sale")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    saleId: Mapped[str] = mapped_column("saleId", ForeignKey("sales.id"))
    variantId: Mapped[str] = mapped_column("variantId", ForeignKey("product_variants.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    lineTotalXaf: Mapped[int] = mapped_column("lineTotalXaf", BigInteger)

    sale: Mapped[Sale] = relationship(back_populates="items")
    variant: Mapped[ProductVariant] = relationship()


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    method: Mapped[str] = mapped_column(String)
    amountXaf: Mapped[int] = mapped_column("amountXaf", BigInteger)
    saleId: Mapped[str | None] = mapped_column("saleId", ForeignKey("sales.id"))
    paidAt: Mapped[datetime] = mapped_column("paidAt", DateTime)

    sale: Mapped[Sale | None] = relationship(back_populates="payments")


class ReturnRecord(Base):
    __tablename__ = "returns"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    saleId: Mapped[str] = mapped_column("saleId", ForeignKey("sales.id"))
    status: Mapped[str] = mapped_column(String)

    items: Mapped[list["ReturnItem"]] = relationship(back_populates="return_record")
    refunds: Mapped[list["Refund"]] = relationship(back_populates="return_record")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    returnId: Mapped[str] = mapped_column("returnId", ForeignKey("returns.id"))
    saleItemId: Mapped[str] = mapped_column("saleItemId", ForeignKey("sale_items.id"))
    quantity: Mapped[int] = mapped_column(Integer)

    return_record: Mapped[ReturnRecord] = relationship(back_populates="items")


class Refund(Base):
    __tablename__ = "refunds"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    returnId: Mapped[str] = mapped_column("returnId", ForeignKey("returns.id"))
    amountXaf: Mapped[int] = mapped_column("amountXaf", BigInteger)
    refundedAt: Mapped[datetime] = mapped_column("refundedAt", DateTime)

    return_record: Mapped[ReturnRecord] = relationship(back_populates="refunds")


class CustomerCredit(Base):
    __tablename__ = "customer_credits"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    remainingXaf: Mapped[int] = mapped_column("remainingXaf", BigInteger)
    status: Mapped[str] = mapped_column(String)

