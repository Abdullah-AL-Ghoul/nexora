-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "perUserLimit" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

