export const API_ROUTES = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    me: "/auth/me",
    changePassword: "/auth/change-password",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
  },
  user: {
    list: "/users",
    detail: (uuid: string) => `/users/${uuid}`,
    create: "/users",
    update: (uuid: string) => `/users/${uuid}`,
    status: (uuid: string, action: "activate" | "deactivate") =>
      `/users/${uuid}/${action}`,
    resetPassword: (uuid: string) => `/users/${uuid}/reset-password`,
  },
  role: {
    list: "/roles",
    update: (uuid: string) => `/roles/${uuid}`,
    permissions: "/roles/permissions",
  },
  warehouse: {
    list: "/warehouses",
    create: "/warehouses",
    detail: (uuid: string) => `/warehouses/${uuid}`,
    update: (uuid: string) => `/warehouses/${uuid}`,
    delete: (uuid: string) => `/warehouses/${uuid}`,
  },
  storage: {
    upload: "/storage/upload",
  },
  gateOperations: {
    list: "/gate-operations",
    create: "/gate-operations",
    detail: (uuid: string) => `/gate-operations/${uuid}`,
    clientHistory: "/gate-operations/client-history",
  },
  gateVerifications: {
    verify: (operationUuid: string) => `/gate-operations/${operationUuid}/verify`,
    notesAttachments: (operationUuid: string) =>
      `/gate-operations/${operationUuid}/notes-attachments`,
    cancel: (operationUuid: string) =>
      `/gate-operations/${operationUuid}/cancel`,
    confirm: (operationUuid: string) =>
      `/gate-operations/${operationUuid}/confirm`,
    history: (operationUuid: string) =>
      `/gate-operations/${operationUuid}/history`,
  },
  erpDocumentReferences: {
    list: "/erp-document-references",
    detail: (uuid: string) => `/erp-document-references/${uuid}`,
    syncStatus: "/erp-document-references/sync/status",
    forceSync: (uuid: string) => `/erp-document-references/${uuid}/force-sync`,
    partners: "/erp-document-references/partners",
    realizationHistory: (uuid: string) =>
      `/erp-document-references/${uuid}/realization-history`,
    pendingPickup: "/erp-document-references/pending-pickup",
  },
  odoo: {
    list: "/odoo-accounts",
    create: "/odoo-accounts",
    update: (uuid: string) => `/odoo-accounts/${uuid}`,
    delete: (uuid: string) => `/odoo-accounts/${uuid}`,
    status: (uuid: string, action: "activate" | "deactivate") =>
      `/odoo-accounts/${uuid}/${action}`,
    testConnection: (uuid: string) => `/odoo-accounts/${uuid}/test-connection`,
    testConnectionRaw: "/odoo-accounts/test-connection-raw",
    refresh: (uuid: string) => `/odoo-accounts/${uuid}/refresh`,
    sync: "/odoo-accounts/sync",
  },
  auditLog: {
    list: "/audit-logs",
  },
  inventory: {
    list: "/inventory",
    products: "/inventory/products",
    detail: (uuid: string) => `/inventory/${uuid}`,
  },
  stackCards: {
    list: "/stack-cards",
    import: "/stack-cards/import",
    bulkDelete: "/stack-cards/bulk-delete",
    bulkPublish: "/stack-cards/bulk-publish",
    publishSnapshot: "/stack-cards/publish-snapshot",
    history: "/stack-cards/history",
    snapshotDates: "/stack-cards/snapshot-dates",
    locations: "/stack-cards/locations",
    updateSource: "/stack-cards/sources",
    detail: (uuid: string) => `/stack-cards/${uuid}`,
    update: (uuid: string) => `/stack-cards/${uuid}`,
    delete: (uuid: string) => `/stack-cards/${uuid}`,
    // Public unauthenticated routes
    publicList: "/public-stack-cards",
    publicSnapshotDates: "/public-stack-cards/snapshot-dates",
    publicLocations: "/public-stack-cards/locations",
    publicWarehouses: "/public-stack-cards/warehouses",
  },
  reconciliation: {
    list: "/reconciliation",
    detail: (uuid: string) => `/reconciliation/${uuid}`,
  },
  stockOpname: {
    list: "/stock-opname",
    detail: (uuid: string) => `/stock-opname/${uuid}`,
    create: "/stock-opname",
    update: (uuid: string) => `/stock-opname/${uuid}`,
    submit: (uuid: string) => `/stock-opname/${uuid}/submit`,
    countingSheet: (uuid: string) => `/stock-opname/${uuid}/counting-sheet/pdf`,
    exportPdf: (uuid: string) => `/stock-opname/${uuid}/export/pdf`,
  },
  reports: {
    stockMovement: "/reports/stock-movement",
    detail: "/reports/stock-movement/detail",
    exportPdf: "/reports/stock-movement/export/pdf",
    exportCsv: "/reports/stock-movement/export/csv",
  },
  digitalSignature: {
    categories: {
      list: "/document-categories",
      detail: (id: number) => `/document-categories/${id}`,
      create: "/document-categories",
      update: (id: number) => `/document-categories/${id}`,
      delete: (id: number) => `/document-categories/${id}`,
    },
    templates: {
      list: "/signature-templates",
      detail: (id: number) => `/signature-templates/${id}`,
      create: "/signature-templates",
      update: (id: number) => `/signature-templates/${id}`,
      delete: (id: number) => `/signature-templates/${id}`,
      setDefault: (id: number) => `/signature-templates/${id}/set-default`,
    },
    manualDocuments: {
      list: "/manual-documents",
      detail: (uuid: string) => `/manual-documents/${uuid}`,
      create: "/manual-documents",
      delete: (uuid: string) => `/manual-documents/${uuid}`,
    },
    signedDocuments: {
      list: "/signed-documents",
      detail: (uuid: string) => `/signed-documents/${uuid}`,
      download: (uuid: string) => `/signed-documents/${uuid}/download`,
      signErp: (uuid: string) => `/signed-documents/sign-erp/${uuid}`,
      signManual: (uuid: string) => `/signed-documents/sign-manual/${uuid}`,
      erpPreview: (uuid: string) => `/signed-documents/erp-preview/${uuid}`,
    },
    verification: {
      verify: (token: string) => `/document-verification/${token}`,
    },
  },
  documentGenerator: {
    templates: {
      list: "/templates",
      detail: (uuid: string) => `/templates/${uuid}`,
      create: "/templates",
      update: (uuid: string) => `/templates/${uuid}`,
      version: (uuid: string) => `/templates/${uuid}/version`,
      delete: (uuid: string) => `/templates/${uuid}`,
      assembly: (uuid: string) => `/templates/${uuid}/assembly`,
      placeholders: (uuid: string) => `/templates/${uuid}/placeholders`,
    },
    generate: "/document/generate",
    generated: {
      list: "/document/generated",
      detail: (uuid: string) => `/document/generated/${uuid}`,
      preview: (uuid: string) => `/document/generated/${uuid}/preview`,
      downloadDocx: (uuid: string) => `/document/generated/${uuid}/download/docx`,
      downloadPdf: (uuid: string) => `/document/generated/${uuid}/download/pdf`,
      delete: (uuid: string) => `/document/generated/${uuid}`,
    },
  },
};
export type ApiRoutes = typeof API_ROUTES;
