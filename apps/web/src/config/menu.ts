import {
  Boxes,
  Truck,
  ClipboardCheck,
  FileText,
  Warehouse,
  Users,
  ShieldCheck,
  History,
  Settings,
  Scale,
  Clipboard,
  BarChart3,
  LayoutDashboard,
  FileCheck,
  ClipboardList,
} from "lucide-react";

export interface MenuItem {
  name: string;
  href: string;
  icon: any;
  description?: string;
  color?: string;
  btnText?: string;
  priority?: boolean;
  permissionSubject?: string;
  permissionAction?: string;
  superAdminOnly?: boolean;
}

export interface MenuGroup {
  title: string;
  description?: string;
  items: MenuItem[];
}

export const menuGroups: MenuGroup[] = [
  {
    title: "Overview",
    description: "Ringkasan dasbor dan informasi status pergudangan.",
    items: [
      {
        name: "Dashboard",
        description: "Kembali ke dasbor utama untuk melihat ringkasan status pergudangan.",
        href: "/",
        icon: LayoutDashboard,
        color: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-955/20 dark:border-blue-900/30",
        btnText: "Buka Dasbor",
        priority: false,
      },
    ],
  },
  {
    title: "Inventory Management",
    description: "Kelola stok barang, mutasi persediaan, stock opname, dan sinkronisasi ERP.",
    items: [
      {
        name: "Inventory",
        description: "Lihat status persediaan barang, detail quants lokasi",
        href: "/inventory",
        icon: Boxes,
        color: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
        btnText: "Lihat Stok",
        permissionSubject: "Inventory",
        permissionAction: "read",
        priority: true,
      },
      {
        name: "Laporan Mutasi",
        description: "Unduh data masuk, keluar, stok persediaan harian, dan drill-down transaksi terkait.",
        href: "/reports",
        icon: BarChart3,
        color: "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30",
        btnText: "Buka Laporan",
        permissionSubject: "Report",
        permissionAction: "read",
        priority: true,
      },
      {
        name: "Stock Opname",
        description: "Mulai perhitungan fisik berkala, catat selisih tumpukan, dan simpan laporan counting.",
        href: "/stock-opname",
        icon: Clipboard,
        color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
        btnText: "Mulai Counting",
        permissionSubject: "StockOpname",
        permissionAction: "read",
        priority: true,
      },
      {
        name: "Rekonsiliasi ERP",
        description: "Pantau perbedaan kuantitas stok antara sistem ERP dengan pergerakan gate fisik.",
        href: "/reconciliation",
        icon: Scale,
        color: "text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30",
        btnText: "Rekonsiliasi",
        permissionSubject: "Reconciliation",
        permissionAction: "read",
        priority: true,
      },
    ],
  },
  {
    title: "Operations",
    description: "Kelola proses keluar masuk kendaraan logistik di gerbang gudang.",
    items: [
      {
        name: "Pending Operation",
        description: "Monitor daftar produk yang belum selesai diambil dari gudang dan sisa realisasi dokumen ERP.",
        href: "/pending-operations",
        icon: ClipboardList,
        color: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30",
        btnText: "Buka Pending",
        permissionSubject: "DocumentReference",
        permissionAction: "read",
        priority: true,
      },
      {
        name: "Gate Operation",
        description: "Pendaftaran cargo masuk dan keluar gerbang, pencatatan plat nomor, dan supir truk.",
        href: "/gate-operations",
        icon: Truck,
        color: "text-sky-600 bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30",
        btnText: "Kelola Gate",
        permissionSubject: "GateOperation",
        permissionAction: "read",
        priority: false,
      },
      {
        name: "Verifikasi Gate",
        description: "Audit dan verifikasi muatan truk masuk/keluar, dan tautkan to referensi ERP transfer.",
        href: "/gate-verification",
        icon: ClipboardCheck,
        color: "text-teal-600 bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/30",
        btnText: "Verifikasi",
        permissionSubject: "GateVerification",
        permissionAction: "read",
        priority: false,
      },
    ],
  },
  {
    title: "Document Management",
    description: "Kelola dokumen referensi ERP dan dokumen yang telah ditandatangani secara digital.",
    items: [
      {
        name: "ERP Document",
        description: "Sinkronisasi daftar PO, SO, dan Surat Jalan resmi untuk pencocokan cargo.",
        href: "/erp-documents",
        icon: FileText,
        color: "text-violet-600 bg-violet-50 border-violet-100 dark:bg-violet-955/20 dark:border-violet-900/30",
        btnText: "Dokumen ERP",
        permissionSubject: "DocumentReference",
        permissionAction: "read",
        priority: false,
      },
      {
        name: "Signed Document",
        description: "Lihat dan kelola dokumen pengiriman yang telah ditandatangani secara elektronik (digital signature).",
        href: "/signed-documents",
        icon: FileCheck,
        color: "text-cyan-600 bg-cyan-50 border-cyan-100 dark:bg-cyan-950/20 dark:border-cyan-900/30",
        btnText: "Dokumen TTD",
        permissionSubject: "SignedDocument",
        permissionAction: "read",
        priority: false,
      },
    ],
  },
  {
    title: "Administration / Management",
    description: "Kelola data master, konfigurasi sistem, audit log, dan perizinan user.",
    items: [
      {
        name: "User Management",
        description: "Kelola akun staf gudang, atur status aktif, dan batasi akses gudang tertentu.",
        href: "/users",
        icon: Users,
        color: "text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-955/20 dark:border-purple-900/30",
        btnText: "Daftar User",
        permissionSubject: "User",
        permissionAction: "read",
        priority: false,
      },
      {
        name: "Roles & Permissions",
        description: "Atur matriks perizinan CASL (create, read, update, delete) per tingkat otoritas.",
        href: "/roles",
        icon: ShieldCheck,
        color: "text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-955/20 dark:border-emerald-900/30",
        btnText: "Atur Akses",
        permissionSubject: "Role",
        permissionAction: "read",
        superAdminOnly: true,
        priority: false,
      },
      {
        name: "Master Data",
        description: "Kelola data master gudang aktif, kapasitas tampung, serta detail koordinat.",
        href: "/warehouses",
        icon: Warehouse,
        color: "text-indigo-650 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30",
        btnText: "Kelola Gudang",
        superAdminOnly: true,
        priority: false,
      },
      {
        name: "Odoo Settings",
        description: "Atur parameter sinkronisasi API, host endpoint ERP Odoo, dan credentials.",
        href: "/odoo",
        icon: Settings,
        color: "text-zinc-700 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-800",
        btnText: "Atur Odoo",
        permissionSubject: "OdooAccount",
        permissionAction: "read",
        priority: false,
      },
      {
        name: "Audit Log",
        description: "Pantau log aktivitas mutasi database dan aksi keamanan para pengguna sistem.",
        href: "/audit-logs",
        icon: History,
        color: "text-slate-600 bg-slate-50 border-slate-205 dark:bg-slate-900/30 dark:border-slate-800",
        btnText: "Jejak Audit",
        permissionSubject: "AuditLog",
        permissionAction: "read",
        priority: false,
      },
    ],
  },
];
