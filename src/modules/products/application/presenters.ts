import type { Product, ProductVariant, ProductSerial, Brand, Category } from "@prisma/client";
import type { AuthUser } from "@/lib/auth/session";
import { canSeeCostPrice, stockStatusFromQuantity, stockStatusLabel } from "@/modules/products/domain/policies";

type ProductWithRelations = Product & {
  brand: Brand;
  category: Category;
  variants: Array<
    ProductVariant & {
      serials: ProductSerial[];
    }
  >;
};

export function serializeMoney(amount: bigint): string {
  return amount.toString();
}

export function toProductListItem(
  product: ProductWithRelations,
  user: AuthUser,
  lowThreshold: number,
) {
  const showCost = canSeeCostPrice(user.permissions);
  const quantityOnHand = product.variants.reduce(
    (sum, variant) => sum + variant.quantityOnHand,
    0,
  );
  const stockStatus = stockStatusFromQuantity(quantityOnHand, lowThreshold);
  const primary = product.variants[0];

  return {
    id: product.id,
    name: product.name,
    brand: { id: product.brand.id, name: product.brand.name },
    category: { id: product.category.id, name: product.category.name },
    isSerialized: product.isSerialized,
    status: product.status,
    sku: primary?.sku ?? "",
    sellingPriceXaf: primary ? serializeMoney(primary.sellingPriceXaf) : "0",
    costPriceXaf: showCost && primary ? serializeMoney(primary.costPriceXaf) : null,
    quantityOnHand,
    stockStatus,
    stockLabel: stockStatusLabel(stockStatus),
    variantCount: product.variants.length,
    warrantyMonths: primary?.warrantyMonths ?? 0,
  };
}

export function toProductDetail(
  product: ProductWithRelations,
  user: AuthUser,
  lowThreshold: number,
) {
  const showCost = canSeeCostPrice(user.permissions);
  const quantityOnHand = product.variants.reduce(
    (sum, variant) => sum + variant.quantityOnHand,
    0,
  );
  const stockStatus = stockStatusFromQuantity(quantityOnHand, lowThreshold);

  return {
    id: product.id,
    name: product.name,
    brand: { id: product.brand.id, name: product.brand.name },
    category: { id: product.category.id, name: product.category.name },
    isSerialized: product.isSerialized,
    status: product.status,
    quantityOnHand,
    stockStatus,
    stockLabel: stockStatusLabel(stockStatus),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      name: variant.name,
      sellingPriceXaf: serializeMoney(variant.sellingPriceXaf),
      costPriceXaf: showCost ? serializeMoney(variant.costPriceXaf) : null,
      warrantyMonths: variant.warrantyMonths,
      status: variant.status,
      quantityOnHand: variant.quantityOnHand,
      serials: variant.serials.map((serial) => ({
        id: serial.id,
        imei1: serial.imei1,
        imei2: serial.imei2,
        serialNumber: serial.serialNumber,
        status: serial.status,
      })),
    })),
  };
}
