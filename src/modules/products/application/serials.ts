import { AppError } from "@/lib/errors/app-error";
import { assertSerialsAreRecordedAtReceipt } from "@/modules/products/domain/policies";
import { findProductById } from "@/modules/products/infrastructure/product-repository";

export async function registerSerialUseCase(
  _user: { id: string },
  productId: string,
): Promise<never> {
  const product = await findProductById(productId);
  if (!product) {
    throw new AppError("NOT_FOUND", "Produit introuvable.");
  }
  assertSerialsAreRecordedAtReceipt();
}
