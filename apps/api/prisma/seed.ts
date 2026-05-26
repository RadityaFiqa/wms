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
    update: {},
    create: {
      id: 1,
      name: 'Jakarta Central Warehouse',
      location: 'Kawasan Industri Pulogadung, Jakarta Timur',
      capacity: 10000.0,
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
        'manage:Warehouse',
        'manage:Inventory',
        'read:Order',
        'read:AuditLog',
        'create:OdooAccount',
        'read:OdooAccount',
        'update:OdooAccount',
        'delete:OdooAccount',
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
