-- Wave K (999 / prompt 009): one SALE stock movement per serialized device.

CREATE UNIQUE INDEX "stock_movements_sale_productSerialId_key"
ON "stock_movements" ("productSerialId")
WHERE "type" = 'SALE'
  AND "productSerialId" IS NOT NULL;

-- Bind CompleteSale idempotent replays to a canonical payload hash.
ALTER TABLE "sales" ADD COLUMN "payloadFingerprint" TEXT;
