from catalog_service.policies import can_see_cost_price, stock_status_from_quantity, stock_status_label


def serialize_money(amount: int) -> str:
    return str(amount)


def to_product_list_item(product, user, low_threshold: int) -> dict:
    show_cost = can_see_cost_price(user.permissions)
    variants = [v for v in product.variants if v.deletedAt is None]
    quantity = sum(v.quantityOnHand for v in variants)
    stock_status = stock_status_from_quantity(quantity, low_threshold)
    primary = variants[0] if variants else None
    return {
        "id": product.id,
        "name": product.name,
        "brand": {"id": product.brand.id, "name": product.brand.name},
        "category": {"id": product.category.id, "name": product.category.name},
        "isSerialized": product.isSerialized,
        "status": product.status,
        "sku": primary.sku if primary else "",
        "sellingPriceXaf": serialize_money(primary.sellingPriceXaf) if primary else "0",
        "costPriceXaf": serialize_money(primary.costPriceXaf) if show_cost and primary else None,
        "quantityOnHand": quantity,
        "stockStatus": stock_status,
        "stockLabel": stock_status_label(stock_status),
        "variantCount": len(variants),
        "warrantyMonths": primary.warrantyMonths if primary else 0,
    }


def to_product_detail(product, user, low_threshold: int) -> dict:
    show_cost = can_see_cost_price(user.permissions)
    variants = [v for v in product.variants if v.deletedAt is None]
    quantity = sum(v.quantityOnHand for v in variants)
    stock_status = stock_status_from_quantity(quantity, low_threshold)
    return {
        "id": product.id,
        "name": product.name,
        "brand": {"id": product.brand.id, "name": product.brand.name},
        "category": {"id": product.category.id, "name": product.category.name},
        "isSerialized": product.isSerialized,
        "status": product.status,
        "quantityOnHand": quantity,
        "stockStatus": stock_status,
        "stockLabel": stock_status_label(stock_status),
        "variants": [
            {
                "id": variant.id,
                "sku": variant.sku,
                "barcode": variant.barcode,
                "name": variant.name,
                "sellingPriceXaf": serialize_money(variant.sellingPriceXaf),
                "costPriceXaf": serialize_money(variant.costPriceXaf) if show_cost else None,
                "warrantyMonths": variant.warrantyMonths,
                "status": variant.status,
                "quantityOnHand": variant.quantityOnHand,
                "serials": [
                    {
                        "id": serial.id,
                        "imei1": serial.imei1,
                        "imei2": serial.imei2,
                        "serialNumber": serial.serialNumber,
                        "status": serial.status,
                    }
                    for serial in variant.serials
                ],
            }
            for variant in variants
        ],
    }
