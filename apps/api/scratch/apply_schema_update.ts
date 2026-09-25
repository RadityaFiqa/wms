import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@100.103.204.118:5432/wms?schema=public';

const pool = new Pool({ connectionString });

async function main() {
  console.log('Applying schema updates to PostgreSQL...');

  // 1. Update OdooAccount
  await pool.query(`
    ALTER TABLE "OdooAccount" 
    ADD COLUMN IF NOT EXISTS "isNonCommodity" BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('Added isNonCommodity to OdooAccount');

  await pool.query(`
    DROP INDEX IF EXISTS "OdooAccount_warehouseId_key";
  `);
  console.log('Dropped old single-column unique index OdooAccount_warehouseId_key');

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "OdooAccount_warehouseId_isNonCommodity_key" 
    ON "OdooAccount"("warehouseId", "isNonCommodity");
  `);
  console.log('Created compound unique index on (warehouseId, isNonCommodity)');

  // 2. Create DocumentPurchaseOrder table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "DocumentPurchaseOrder" (
      "id" INTEGER NOT NULL,
      "uuid" TEXT NOT NULL,
      "warehouseId" INTEGER,
      "documentNumber" TEXT NOT NULL,
      "partner" TEXT,
      "partnerRef" TEXT,
      "amountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "amountUntaxed" DOUBLE PRECISION DEFAULT 0,
      "currencyName" TEXT,
      "state" TEXT NOT NULL,
      "dateOrder" TIMESTAMPTZ(3),
      "dateApprove" TIMESTAMPTZ(3),
      "datePlanned" TIMESTAMPTZ(3),
      "invoiceStatus" TEXT,
      "companyName" TEXT,
      "rawJson" JSONB NOT NULL,
      "lastSyncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "DocumentPurchaseOrder_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "DocumentPurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  console.log('Created DocumentPurchaseOrder table');

  // Indexes for DocumentPurchaseOrder
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DocumentPurchaseOrder_uuid_key" ON "DocumentPurchaseOrder"("uuid");
    CREATE INDEX IF NOT EXISTS "DocumentPurchaseOrder_uuid_idx" ON "DocumentPurchaseOrder"("uuid");
    CREATE INDEX IF NOT EXISTS "DocumentPurchaseOrder_documentNumber_idx" ON "DocumentPurchaseOrder"("documentNumber");
    CREATE INDEX IF NOT EXISTS "DocumentPurchaseOrder_warehouseId_idx" ON "DocumentPurchaseOrder"("warehouseId");
    CREATE INDEX IF NOT EXISTS "DocumentPurchaseOrder_state_idx" ON "DocumentPurchaseOrder"("state");
    CREATE INDEX IF NOT EXISTS "DocumentPurchaseOrder_dateOrder_idx" ON "DocumentPurchaseOrder"("dateOrder");
  `);
  console.log('Created indexes for DocumentPurchaseOrder');

  // 3. Create DocumentProductPurchaseOrder table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "DocumentProductPurchaseOrder" (
      "id" INTEGER NOT NULL,
      "uuid" TEXT NOT NULL,
      "documentPurchaseOrderId" INTEGER NOT NULL,
      "productName" TEXT NOT NULL,
      "productUom" TEXT,
      "productQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "priceUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "priceTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "budgetActivityName" TEXT,
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "DocumentProductPurchaseOrder_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "DocumentProductPurchaseOrder_documentPurchaseOrderId_fkey" FOREIGN KEY ("documentPurchaseOrderId") REFERENCES "DocumentPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  console.log('Created DocumentProductPurchaseOrder table');

  // Indexes for DocumentProductPurchaseOrder
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DocumentProductPurchaseOrder_uuid_key" ON "DocumentProductPurchaseOrder"("uuid");
    CREATE INDEX IF NOT EXISTS "DocumentProductPurchaseOrder_uuid_idx" ON "DocumentProductPurchaseOrder"("uuid");
    CREATE INDEX IF NOT EXISTS "DocumentProductPurchaseOrder_documentPurchaseOrderId_idx" ON "DocumentProductPurchaseOrder"("documentPurchaseOrderId");
  `);
  console.log('Created indexes for DocumentProductPurchaseOrder');

  console.log('Schema migration applied successfully without data loss!');
}

main().catch(console.error).finally(() => pool.end());
