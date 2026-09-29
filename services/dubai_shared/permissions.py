ALL_PERMISSION_CODES = [
    "dashboard.read",
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "sales.read",
    "sales.create",
    "sales.cancel",
    "sales.refund",
    "inventory.read",
    "inventory.adjust",
    "purchases.read",
    "purchases.create",
    "purchases.receive",
    "customers.read",
    "customers.create",
    "credit.read",
    "credit.payment",
    "reports.read",
    "users.read",
    "users.create",
    "users.update",
    "audit.read",
    "settings.write",
    "permissions.write",
]


def has_permission(granted: list[str], required: str) -> bool:
    return required in granted
