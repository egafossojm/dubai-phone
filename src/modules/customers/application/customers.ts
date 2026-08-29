import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { writeAudit } from "@/lib/audit/write-audit";
import type { AuthUser } from "@/lib/auth/session";
import { throwIfUniqueConflict } from "@/lib/db/prisma-errors";
import {
  emptyToNull,
  normalizePhone,
} from "@/modules/customers/domain/policies";
import type {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "@/modules/customers/api/schemas";
import {
  createCustomer,
  findCustomerById,
  findCustomerByPhone,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
} from "@/modules/customers/infrastructure/customer-repository";
import {
  toCustomerDetail,
  toCustomerListItem,
} from "@/modules/customers/application/presenters";
import { refreshOpenCreditStatuses } from "@/modules/credit/application/refresh-status";

type ListQuery = z.infer<typeof listCustomersQuerySchema>;
type CreateInput = z.infer<typeof createCustomerSchema>;
type UpdateInput = z.infer<typeof updateCustomerSchema>;

export async function listCustomersUseCase(query: ListQuery) {
  await prisma.$transaction(async (tx) => {
    await refreshOpenCreditStatuses(tx);
  });
  const result = await listCustomers(query);
  return {
    items: result.items.map(toCustomerListItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getCustomerUseCase(id: string) {
  await prisma.$transaction(async (tx) => {
    await refreshOpenCreditStatuses(tx, { customerId: id });
  });
  const customer = await findCustomerById(id);
  if (!customer) {
    throw new AppError("NOT_FOUND", "Client introuvable.");
  }
  return toCustomerDetail(customer);
}

export async function createCustomerUseCase(
  user: AuthUser,
  input: CreateInput,
) {
  const phone = normalizePhone(input.phone);
  const existing = await findCustomerByPhone(phone);
  if (existing) {
    throw new AppError("CONFLICT", "Un client avec ce téléphone existe déjà.");
  }

  try {
    const customer = await createCustomer({
      fullName: input.fullName.trim(),
      phone,
      email: emptyToNull(input.email),
      address: emptyToNull(input.address),
      notes: emptyToNull(input.notes),
    });
    await writeAudit({
      actorId: user.id,
      action: "customer.create",
      entityType: "Customer",
      entityId: customer.id,
      after: { fullName: customer.fullName, phone: customer.phone },
    });
    return toCustomerListItem(customer);
  } catch (error) {
    throwIfUniqueConflict(error, {
      phone: "Un client avec ce téléphone existe déjà.",
    });
  }
}

export async function updateCustomerUseCase(
  user: AuthUser,
  id: string,
  input: UpdateInput,
) {
  const existing = await findCustomerById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Client introuvable.");
  }

  const phone =
    input.phone !== undefined ? normalizePhone(input.phone) : undefined;
  if (phone && phone !== existing.phone) {
    const conflict = await findCustomerByPhone(phone);
    if (conflict) {
      throw new AppError("CONFLICT", "Un client avec ce téléphone existe déjà.");
    }
  }

  try {
    const customer = await updateCustomer(id, {
      fullName: input.fullName?.trim(),
      phone,
      email: input.email !== undefined ? emptyToNull(input.email) : undefined,
      address:
        input.address !== undefined ? emptyToNull(input.address) : undefined,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : undefined,
    });
    await writeAudit({
      actorId: user.id,
      action: "customer.update",
      entityType: "Customer",
      entityId: id,
      before: { fullName: existing.fullName, phone: existing.phone },
      after: { fullName: customer.fullName, phone: customer.phone },
    });
    return toCustomerListItem(customer);
  } catch (error) {
    throwIfUniqueConflict(error, {
      phone: "Un client avec ce téléphone existe déjà.",
    });
  }
}

export async function deactivateCustomerUseCase(user: AuthUser, id: string) {
  const existing = await findCustomerById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Client introuvable.");
  }
  const openCredits = existing.credits.filter(
    (credit) => credit.status !== "PAID" && credit.status !== "CANCELLED",
  );
  if (openCredits.length > 0) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Impossible de désactiver un client avec un crédit ouvert.",
    );
  }
  await softDeleteCustomer(id);
  await writeAudit({
    actorId: user.id,
    action: "customer.deactivate",
    entityType: "Customer",
    entityId: id,
    before: { fullName: existing.fullName },
  });
  return { id, deactivated: true };
}
