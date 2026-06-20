/*
  Warnings:

  - You are about to drop the `GateDocumentReference` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GateDocumentReference" DROP CONSTRAINT "GateDocumentReference_erpDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "GateDocumentReference" DROP CONSTRAINT "GateDocumentReference_erpDocumentItemId_fkey";

-- DropForeignKey
ALTER TABLE "GateDocumentReference" DROP CONSTRAINT "GateDocumentReference_gateItemId_fkey";

-- DropForeignKey
ALTER TABLE "GateDocumentReference" DROP CONSTRAINT "GateDocumentReference_gateOperationId_fkey";

-- DropTable
DROP TABLE "GateDocumentReference";
