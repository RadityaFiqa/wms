import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@100.103.204.118:5432/wms?schema=public';

const pool = new Pool({ connectionString });

async function main() {
  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'OdooAccount';
  `);
  console.log('OdooAccount indexes:', indexes.rows);
}

main().catch(console.error).finally(() => pool.end());
