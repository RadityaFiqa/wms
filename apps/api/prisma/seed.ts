import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 1 },
    update: {
      code: 'JKT-01',
      type: 'CENTRAL',
      address: 'Kawasan Industri Pulogadung, Jakarta Timur',
      isActive: true,
      odooReference: 'WH-JKT',
    },
    create: {
      id: 1,
      name: 'Jakarta Central Warehouse',
      location: 'Kawasan Industri Pulogadung, Jakarta Timur',
      code: 'JKT-01',
      type: 'CENTRAL',
      address: 'Kawasan Industri Pulogadung, Jakarta Timur',
      isActive: true,
      capacity: 10000.0,
      odooReference: 'WH-JKT',
    },
  });
  console.log('Seeded warehouse:', warehouse.name);

  // 2. Create Permissions
  const permissionsData = [
    // Global Management
    { action: 'manage', subject: 'all' },
    // User CRUD
    { action: 'create', subject: 'User' },
    { action: 'read', subject: 'User' },
    { action: 'update', subject: 'User' },
    { action: 'delete', subject: 'User' },
    // Warehouse CRUD
    { action: 'create', subject: 'Warehouse' },
    { action: 'read', subject: 'Warehouse' },
    { action: 'update', subject: 'Warehouse' },
    { action: 'delete', subject: 'Warehouse' },
    // Inventory CRUD
    { action: 'create', subject: 'Inventory' },
    { action: 'read', subject: 'Inventory' },
    { action: 'update', subject: 'Inventory' },
    { action: 'delete', subject: 'Inventory' },
    // Order CRUD
    { action: 'create', subject: 'Order' },
    { action: 'read', subject: 'Order' },
    { action: 'update', subject: 'Order' },
    { action: 'delete', subject: 'Order' },
    // Audit Log Read
    { action: 'read', subject: 'AuditLog' },
    // OdooAccount Config
    { action: 'create', subject: 'OdooAccount' },
    { action: 'read', subject: 'OdooAccount' },
    { action: 'update', subject: 'OdooAccount' },
    { action: 'delete', subject: 'OdooAccount' },
    // Gate Operation
    { action: 'create', subject: 'GateOperation' },
    { action: 'read', subject: 'GateOperation' },
    { action: 'update', subject: 'GateOperation' },
    { action: 'delete', subject: 'GateOperation' },
    // Gate Verification
    { action: 'create', subject: 'GateVerification' },
    { action: 'read', subject: 'GateVerification' },
    // File Attachment
    { action: 'create', subject: 'FileAttachment' },
    { action: 'read', subject: 'FileAttachment' },
    // Document Reference
    { action: 'create', subject: 'DocumentReference' },
    { action: 'read', subject: 'DocumentReference' },
    { action: 'update', subject: 'DocumentReference' },
    { action: 'delete', subject: 'DocumentReference' },
    // Role & Permission Read-only Access
    { action: 'create', subject: 'Role' },
    { action: 'read', subject: 'Role' },
    { action: 'update', subject: 'Role' },
    { action: 'delete', subject: 'Role' },
    { action: 'read', subject: 'Permission' },
    // Stock Opname
    { action: 'create', subject: 'StockOpname' },
    { action: 'read', subject: 'StockOpname' },
    { action: 'update', subject: 'StockOpname' },
    { action: 'delete', subject: 'StockOpname' },
    // Reconciliation
    { action: 'read', subject: 'Reconciliation' },
    // Reporting
    { action: 'read', subject: 'Report' },
  ];

  const permissions: Record<string, any> = {};
  for (const perm of permissionsData) {
    const created = await prisma.permission.upsert({
      where: { id: permissionsData.indexOf(perm) + 1 },
      update: {},
      create: perm,
    });
    permissions[`${perm.action}:${perm.subject}`] = created;
  }
  console.log('Seeded permissions count:', Object.keys(permissions).length);

  // 3. Create Roles
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
        'read:Warehouse',
        'manage:Inventory',
        'read:Order',
        'read:AuditLog',
        'read:GateOperation',
        'update:GateOperation',
        'create:GateVerification',
        'read:GateVerification',
        'create:FileAttachment',
        'read:FileAttachment',
        'create:DocumentReference',
        'read:DocumentReference',
        'update:DocumentReference',
        'delete:DocumentReference',
        'read:Role',
        'read:Permission',
        'create:StockOpname',
        'read:StockOpname',
        'update:StockOpname',
        'delete:StockOpname',
        'read:Reconciliation',
        'read:Report',
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
        'read:StockOpname',
        'update:StockOpname',
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

    // Link Role to Permissions
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

  // 4. Create Default Super Admin User
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
      roleId: 1, // SUPER_ADMIN
      warehouseId: 1, // Jakarta Central Warehouse
    },
  });

  console.log('Seeded Super Admin user:', adminUser.email);

  // 5. Create Default Satpam User
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
      roleId: 7, // SATPAM
      warehouseId: 1, // Jakarta Central Warehouse
    },
  });
  console.log('Seeded Satpam user:', satpamUser.email);

  // Link Satpam to Warehouse 1 access
  await prisma.warehouseAccess.upsert({
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
  console.log('Seeded WarehouseAccess for Satpam');

  // Link Super Admin to Warehouse 1 access
  await prisma.warehouseAccess.upsert({
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
  console.log('Seeded WarehouseAccess for Super Admin');

  // Seed default products if none exist
  const productsCount = await prisma.product.count();
  if (productsCount === 0) {
    const mockProducts = [
      { id: 9001, sku: 'BRS-PREM-10K', name: 'Beras Premium Bulog 10kg', category: 'Beras', price: 145000, uom: 'Kg' },
      { id: 9002, sku: 'BRS-MED-5K', name: 'Beras Medium Bulog 5kg', category: 'Beras', price: 65000, uom: 'Kg' },
      { id: 9003, sku: 'MYK-GORENG-1L', name: 'Minyak Goreng Kita 1L', category: 'Minyak', price: 14000, uom: 'Liter' },
      { id: 9004, sku: 'GULA-PASIR-1K', name: 'Gula Pasir Maniskita 1kg', category: 'Gula', price: 16000, uom: 'Kg' },
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
