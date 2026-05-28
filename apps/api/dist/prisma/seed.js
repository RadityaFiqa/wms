"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const bcrypt = __importStar(require("bcrypt"));
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Seeding database...');
    const warehouse = await prisma.warehouse.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            name: 'Jakarta Central Warehouse',
            location: 'Kawasan Industri Pulogadung, Jakarta Timur',
            capacity: 10000.0,
        },
    });
    console.log('Seeded warehouse:', warehouse.name);
    const permissionsData = [
        { action: 'manage', subject: 'all' },
        { action: 'create', subject: 'User' },
        { action: 'read', subject: 'User' },
        { action: 'update', subject: 'User' },
        { action: 'delete', subject: 'User' },
        { action: 'create', subject: 'Warehouse' },
        { action: 'read', subject: 'Warehouse' },
        { action: 'update', subject: 'Warehouse' },
        { action: 'delete', subject: 'Warehouse' },
        { action: 'create', subject: 'Inventory' },
        { action: 'read', subject: 'Inventory' },
        { action: 'update', subject: 'Inventory' },
        { action: 'delete', subject: 'Inventory' },
        { action: 'create', subject: 'Order' },
        { action: 'read', subject: 'Order' },
        { action: 'update', subject: 'Order' },
        { action: 'delete', subject: 'Order' },
        { action: 'read', subject: 'AuditLog' },
        { action: 'create', subject: 'OdooAccount' },
        { action: 'read', subject: 'OdooAccount' },
        { action: 'update', subject: 'OdooAccount' },
        { action: 'delete', subject: 'OdooAccount' },
        { action: 'create', subject: 'GateOperation' },
        { action: 'read', subject: 'GateOperation' },
        { action: 'update', subject: 'GateOperation' },
        { action: 'delete', subject: 'GateOperation' },
        { action: 'create', subject: 'GateVerification' },
        { action: 'read', subject: 'GateVerification' },
        { action: 'create', subject: 'FileAttachment' },
        { action: 'read', subject: 'FileAttachment' },
    ];
    const permissions = {};
    for (const perm of permissionsData) {
        const created = await prisma.permission.upsert({
            where: { id: permissionsData.indexOf(perm) + 1 },
            update: {},
            create: perm,
        });
        permissions[`${perm.action}:${perm.subject}`] = created;
    }
    console.log('Seeded permissions count:', Object.keys(permissions).length);
    const roles = [
        {
            id: 1,
            name: 'SUPER_ADMIN',
            description: 'Super Administrator with full access to all system features',
            permissionKeys: ['manage:all'],
        },
        {
            id: 2,
            name: 'WAREHOUSE_ADMIN',
            description: 'Warehouse Manager overseeing warehouse operations, inventory, and staff list',
            permissionKeys: [
                'read:User',
                'manage:Warehouse',
                'manage:Inventory',
                'read:Order',
                'read:AuditLog',
                'create:OdooAccount',
                'read:OdooAccount',
                'update:OdooAccount',
                'delete:OdooAccount',
                'read:GateOperation',
                'update:GateOperation',
                'create:GateVerification',
                'read:GateVerification',
                'create:FileAttachment',
                'read:FileAttachment',
            ],
        },
        {
            id: 3,
            name: 'OPERATOR',
            description: 'Operator executing warehouse movements, scanning, and updating inventory status',
            permissionKeys: [
                'read:Warehouse',
                'create:Inventory',
                'read:Inventory',
                'update:Inventory',
                'read:Order',
                'update:Order',
            ],
        },
        {
            id: 4,
            name: 'CHECKER',
            description: 'Checker verifying received or dispatched items matching orders',
            permissionKeys: [
                'read:Warehouse',
                'read:Inventory',
                'read:Order',
                'update:Order',
            ],
        },
        {
            id: 5,
            name: 'SUPERVISOR',
            description: 'Supervisor reviewing operations and managing orders dispatching',
            permissionKeys: [
                'read:Warehouse',
                'read:Inventory',
                'manage:Order',
                'read:User',
            ],
        },
        {
            id: 6,
            name: 'AUDITOR',
            description: 'Auditor reviewing logs, tracking status history and reporting',
            permissionKeys: [
                'read:Warehouse',
                'read:Inventory',
                'read:Order',
                'read:AuditLog',
            ],
        },
        {
            id: 7,
            name: 'SATPAM',
            description: 'Satpam registering inbound/outbound vehicle gate operations',
            permissionKeys: [
                'read:Warehouse',
                'create:GateOperation',
                'read:GateOperation',
                'create:FileAttachment',
                'read:FileAttachment',
            ],
        },
    ];
    for (const roleData of roles) {
        const { permissionKeys, ...rolePayload } = roleData;
        const role = await prisma.role.upsert({
            where: { id: rolePayload.id },
            update: { description: rolePayload.description },
            create: rolePayload,
        });
        for (const key of permissionKeys) {
            const perm = permissions[key];
            if (perm) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: role.id,
                            permissionId: perm.id,
                        },
                    },
                    update: {},
                    create: {
                        roleId: role.id,
                        permissionId: perm.id,
                    },
                });
            }
        }
        console.log(`Seeded role: ${role.name} with permissions`);
    }
    const adminEmail = 'admin@wms.com';
    const adminPassword = 'SuperAdmin123!';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            name: 'Super Admin',
            email: adminEmail,
            password: hashedPassword,
            isActive: true,
            isFirstLogin: false,
            roleId: 1,
            warehouseId: 1,
        },
    });
    console.log('Seeded Super Admin user:', adminUser.email);
    const satpamEmail = 'satpam@wms.com';
    const satpamPassword = 'SatpamPassword123!';
    const hashedSatpamPassword = await bcrypt.hash(satpamPassword, 10);
    const satpamUser = await prisma.user.upsert({
        where: { email: satpamEmail },
        update: {},
        create: {
            name: 'Satpam WMS',
            email: satpamEmail,
            password: hashedSatpamPassword,
            isActive: true,
            isFirstLogin: false,
            roleId: 7,
            warehouseId: 1,
        },
    });
    console.log('Seeded Satpam user:', satpamUser.email);
    await prisma.userWarehouseAccess.upsert({
        where: {
            userId_warehouseId: {
                userId: satpamUser.id,
                warehouseId: 1,
            },
        },
        update: {},
        create: {
            userId: satpamUser.id,
            warehouseId: 1,
        },
    });
    console.log('Seeded UserWarehouseAccess for Satpam');
    await prisma.userWarehouseAccess.upsert({
        where: {
            userId_warehouseId: {
                userId: adminUser.id,
                warehouseId: 1,
            },
        },
        update: {},
        create: {
            userId: adminUser.id,
            warehouseId: 1,
        },
    });
    console.log('Seeded UserWarehouseAccess for Super Admin');
    const productsCount = await prisma.product.count();
    if (productsCount === 0) {
        const mockProducts = [
            { sku: 'BRS-PREM-10K', name: 'Beras Premium Bulog 10kg', category: 'Beras', price: 145000, uom: 'Kg' },
            { sku: 'BRS-MED-5K', name: 'Beras Medium Bulog 5kg', category: 'Beras', price: 65000, uom: 'Kg' },
            { sku: 'MYK-GORENG-1L', name: 'Minyak Goreng Kita 1L', category: 'Minyak', price: 14000, uom: 'Liter' },
            { sku: 'GULA-PASIR-1K', name: 'Gula Pasir Maniskita 1kg', category: 'Gula', price: 16000, uom: 'Kg' },
        ];
        for (const prod of mockProducts) {
            await prisma.product.create({
                data: prod,
            });
        }
        console.log('Seeded default mock products.');
    }
    console.log('Seeding completed successfully!');
}
main()
    .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=seed.js.map