import re

from dubai_shared.errors import AppError
from dubai_shared.money import parse_xaf

IMEI_PATTERN = re.compile(r"^\d{14,16}$")
SERIAL_PATTERN = re.compile(r"^[A-Za-z0-9-]{4,40}$")
SKU_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,47}$")


def normalize_sku(value: str) -> str:
    sku = value.strip().upper()
    if not SKU_PATTERN.match(sku):
        raise AppError(
            "VALIDATION_ERROR",
            "Le SKU doit contenir 2 à 48 caractères (lettres, chiffres, tiret, point).",
        )
    return sku


def parse_xaf_amount(value, label: str, minimum: int = 0) -> int:
    try:
        return parse_xaf(value, label, minimum)
    except ValueError as error:
        raise AppError("VALIDATION_ERROR", str(error)) from error


def assert_selling_price(selling: int, cost: int) -> None:
    if selling <= 0:
        raise AppError(
            "VALIDATION_ERROR",
            "Le prix de vente TTC doit être supérieur à 0 FCFA.",
        )
    if cost < 0:
        raise AppError("VALIDATION_ERROR", "Le coût d'achat ne peut pas être négatif.")


def stock_status_from_quantity(quantity: int, low_threshold: int) -> str:
    if quantity <= 0:
        return "OUT_OF_STOCK"
    if quantity <= low_threshold:
        return "LOW_STOCK"
    return "IN_STOCK"


def stock_status_label(status: str) -> str:
    return {
        "LOW_STOCK": "Stock faible",
        "OUT_OF_STOCK": "Rupture",
        "IN_STOCK": "En stock",
    }.get(status, status)


def can_see_cost_price(permissions: list[str]) -> bool:
    return (
        "products.create" in permissions
        or "products.update" in permissions
        or "purchases.read" in permissions
    )


def can_change_product_prices(permissions: list[str]) -> bool:
    return "products.delete" in permissions
