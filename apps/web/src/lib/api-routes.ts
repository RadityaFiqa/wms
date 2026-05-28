export const API_ROUTES = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    changePassword: '/auth/change-password',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
  user: {
    list: '/users',
    detail: (uuid: string) => `/users/${uuid}`,
    create: '/users',
    update: (uuid: string) => `/users/${uuid}`,
    status: (uuid: string, action: 'activate' | 'deactivate') => `/users/${uuid}/${action}`,
    resetPassword: (uuid: string) => `/users/${uuid}/reset-password`,
  },
  role: {
    list: '/roles',
    update: (uuid: string) => `/roles/${uuid}`,
    permissions: '/roles/permissions',
  },
  warehouse: {
    list: '/warehouses',
  },
  storage: {
    upload: '/storage/upload',
  },
  gateOperations: {
    list: '/gate-operations',
    create: '/gate-operations',
    detail: (uuid: string) => `/gate-operations/${uuid}`,
  },
  gateVerifications: {
    verify: (operationUuid: string) => `/gate-verifications/${operationUuid}`,
  },
  odoo: {
    list: '/odoo-accounts',
    create: '/odoo-accounts',
    update: (uuid: string) => `/odoo-accounts/${uuid}`,
    delete: (uuid: string) => `/odoo-accounts/${uuid}`,
    status: (uuid: string, action: 'activate' | 'deactivate') => `/odoo-accounts/${uuid}/${action}`,
    testConnection: (uuid: string) => `/odoo-accounts/${uuid}/test-connection`,
    testConnectionRaw: '/odoo-accounts/test-connection-raw',
    refresh: (uuid: string) => `/odoo-accounts/${uuid}/refresh`,
  },
  auditLog: {
    list: '/audit-logs',
  },
  inventory: {
    list: '/inventory',
    products: '/inventory/products',
    detail: (uuid: string) => `/inventory/${uuid}`,
    sync: '/inventory/sync',
  },
};
export type ApiRoutes = typeof API_ROUTES;
