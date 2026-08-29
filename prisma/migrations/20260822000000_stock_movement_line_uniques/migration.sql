-- Wave A (999): prevent duplicate stock movements per sale/return line.
-- PostgreSQL UNIQUE allows multiple NULLs, so optional FKs remain valid.

CREATE UNIQUE INDEX "stock_movements_saleItemId_key" ON "stock_movements"("saleItemId");
CREATE UNIQUE INDEX "stock_movements_returnItemId_key" ON "stock_movements"("returnItemId");
