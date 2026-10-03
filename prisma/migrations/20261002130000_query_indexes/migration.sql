-- DropIndex
DROP INDEX "CartItem_cartId_idx";

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "Product_stock_idx" ON "Product"("stock");

-- CreateIndex
CREATE INDEX "Product_ratingAvg_ratingCount_idx" ON "Product"("ratingAvg" DESC, "ratingCount" DESC);

