-- Wave C (999 returns): auditable mobile-money refund refs + exchange idempotency.

ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "operatorReference" TEXT;

ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "completionIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "returns_completionIdempotencyKey_key"
  ON "returns"("completionIdempotencyKey");
