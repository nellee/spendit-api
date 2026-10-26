-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "isRepeating" BOOLEAN NOT NULL DEFAULT false;
