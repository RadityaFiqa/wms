"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function test() {
    try {
        console.log('Logging in as Satpam...');
        const loginRes = await axios_1.default.post('http://localhost:3000/auth/login', {
            email: 'satpam@wms.com',
            password: 'SatpamPassword123!',
        });
        const token = loginRes.data.accessToken;
        const warehouseUuid = loginRes.data.user.accessibleWarehouses[0]?.uuid;
        console.log('Login successful.');
        console.log('Token:', token ? 'Exists' : 'None');
        console.log('Warehouse UUID:', warehouseUuid);
        console.log('Fetching products...');
        const prodRes = await axios_1.default.get('http://localhost:3000/inventory/products', {
            headers: {
                Authorization: `Bearer ${token}`,
                'x-warehouse-id': warehouseUuid,
            },
        });
        console.log('Products status:', prodRes.status);
        console.log('Products fetched count:', prodRes.data.length);
    }
    catch (err) {
        console.error('Error during API request:');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
        else {
            console.error(err.message);
        }
    }
}
test();
//# sourceMappingURL=test-api.js.map