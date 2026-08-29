import type { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { writeAudit } from "@/lib/audit/write-audit";
import type { AuthUser } from "@/lib/auth/session";
import type {
  createSupplierSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
} from "@/modules/purchases/api/schemas";
import {
  createSupplier,
  findSupplierById,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
} from "@/modules/purchases/infrastructure/purchase-repository";
import { toSupplierListItem } from "@/modules/purchases/application/presenters";

type ListQuery = z.infer<typeof listSuppliersQuerySchema>;
type CreateInput = z.infer<typeof createSupplierSchema>;
type UpdateInput = z.infer<typeof updateSupplierSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listSuppliersUseCase(query: ListQuery) {
  const result = await listSuppliers(query);
  return {
    items: result.items.map(toSupplierListItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getSupplierUseCase(id: string) {
  const supplier = await findSupplierById(id);
  if (!supplier) {
    throw new AppError("NOT_FOUND", "Fournisseur introuvable.");
  }
  return {
    ...toSupplierListItem(supplier),
    purchaseOrders: supplier.purchaseOrders.map((order) => ({
      id: order.id,
      reference: order.reference,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      orderedAt: order.orderedAt?.toISOString() ?? null,
    })),
  };
}

export async function createSupplierUseCase(user: AuthUser, input: CreateInput) {
  const supplier = await createSupplier({
    name: input.name.trim(),
    phone: emptyToNull(input.phone),
    email: emptyToNull(input.email),
    address: emptyToNull(input.address),
  });
  await writeAudit({
    actorId: user.id,
    action: "supplier.create",
    entityType: "Supplier",
    entityId: supplier.id,
    after: { name: supplier.name },
  });
  return toSupplierListItem(supplier);
}

export async function updateSupplierUseCase(
  user: AuthUser,
  id: string,
  input: UpdateInput,
) {
  const existing = await findSupplierById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Fournisseur introuvable.");
  }
  const supplier = await updateSupplier(id, {
    name: input.name?.trim(),
    phone: input.phone !== undefined ? emptyToNull(input.phone) : undefined,
    email: input.email !== undefined ? emptyToNull(input.email) : undefined,
    address: input.address !== undefined ? emptyToNull(input.address) : undefined,
  });
  await writeAudit({
    actorId: user.id,
    action: "supplier.update",
    entityType: "Supplier",
    entityId: supplier.id,
    before: { name: existing.name },
    after: { name: supplier.name },
  });
  return toSupplierListItem(supplier);
}

export async function deactivateSupplierUseCase(user: AuthUser, id: string) {
  const existing = await findSupplierById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Fournisseur introuvable.");
  }
  await softDeleteSupplier(id);
  await writeAudit({
    actorId: user.id,
    action: "supplier.deactivate",
    entityType: "Supplier",
    entityId: id,
    before: { name: existing.name },
  });
  return { id, deactivated: true };
}
