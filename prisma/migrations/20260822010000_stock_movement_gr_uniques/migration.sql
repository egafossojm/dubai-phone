-- Wave E (999): one purchase-receipt movement per non-serialized GR line.
-- Serialized receipts still allow several movements on the same GR item
-- (one row per physical unit / serial).

CREATE UNIQUE INDEX "stock_movements_goodsReceiptItemId_nonserial_key"
ON "stock_movements" ("goodsReceiptItemId")
WHERE "type" = 'PURCHASE_RECEIPT'
  AND "goodsReceiptItemId" IS NOT NULL
  AND "productSerialId" IS NULL;

CREATE UNIQUE INDEX "stock_movements_goodsReceiptItemId_serial_key"
ON "stock_movements" ("goodsReceiptItemId", "productSerialId")
WHERE "type" = 'PURCHASE_RECEIPT'
  AND "goodsReceiptItemId" IS NOT NULL
  AND "productSerialId" IS NOT NULL;
