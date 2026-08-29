-- Wave J (999 / prompt 008): soft-deleted customers may free their phone number.

DROP INDEX IF EXISTS "customers_phone_key";

CREATE UNIQUE INDEX "customers_phone_active_key"
ON "customers"("phone")
WHERE "deletedAt" IS NULL;

-- Trace installment splits for each credit payment.
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amountXaf" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");
CREATE INDEX "payment_allocations_installmentId_idx" ON "payment_allocations"("installmentId");

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_installmentId_fkey"
  FOREIGN KEY ("installmentId") REFERENCES "installments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
