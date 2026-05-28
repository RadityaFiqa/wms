"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
async function main() {
    const client = new pg_1.Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/wms?schema=public' });
    await client.connect();
    const res = await client.query('SELECT COUNT(*) FROM "Product"');
    console.log('Product count:', res.rows[0].count);
    const products = await client.query('SELECT id, sku, name FROM "Product"');
    console.log('Products:', products.rows);
    await client.end();
}
main();
//# sourceMappingURL=count.js.map