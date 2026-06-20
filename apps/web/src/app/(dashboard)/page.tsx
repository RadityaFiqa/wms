"use client";

import React from "react";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ArrowUpRight,
  LayoutDashboard,
  FileCheck,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const pathname = usePathname();
  const { user, hasPermission } = useAuthStore();

  // Define module groups by business domain with icons, descriptions, and permission checks
  const moduleGroups = [
    {
      title: "Overview",
      description: "Ringkasan dasbor dan informasi status pergudangan.",
      modules: [
        {
          name: "Dashboard",
          description: "Kembali ke dasbor utama untuk melihat ringkasan status pergudangan.",
          href: "/",
          icon: LayoutDashboard,
          color: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
          btnText: "Buka Dasbor",
          show: true,
          priority: false,
        },
      ],
    },
    {
      title: "Inventory Management",
      description: "Kelola stok barang, mutasi persediaan, stock opname, dan sinkronisasi ERP.",
      modules: [
        {
          name: "Inventory",
          description: "Lihat status persediaan barang, detail quants lokasi",
          href: "/inventory",
          icon: Boxes,
          color: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
          btnText: "Lihat Stok",
          show: hasPermission("read", "Inventory"),
          priority: true,
        },
        {
          name: "Laporan Mutasi",
          description: "Unduh data masuk, keluar, stok persediaan harian, dan drill-down transaksi terkait.",
          href: "/reports",
          icon: BarChart3,
          color: "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30",
          btnText: "Buka Laporan",
          show: hasPermission("read", "Report"),
          priority: true,
        },
        {
          name: "Stock Opname",
          description: "Mulai perhitungan fisik berkala, catat selisih tumpukan, dan simpan laporan counting.",
          href: "/stock-opname",
          icon: Clipboard,
          color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
          btnText: "Mulai Counting",
          show: hasPermission("read", "StockOpname"),
          priority: true,
        },
        {
          name: "Rekonsiliasi ERP",
          description: "Pantau perbedaan kuantitas stok antara sistem ERP dengan pergerakan gate fisik.",
          href: "/reconciliation",
          icon: Scale,
          color: "text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30",
          btnText: "Rekonsiliasi",
          show: hasPermission("read", "Reconciliation"),
          priority: true,
        },
      ],
    },
    {
      title: "Operations",
      description: "Kelola proses keluar masuk kendaraan logistik di gerbang gudang.",
      modules: [
        {
          name: "Gate Operation",
          description: "Pendaftaran cargo masuk dan keluar gerbang, pencatatan plat nomor, dan supir truk.",
          href: "/gate-operations",
          icon: Truck,
          color: "text-sky-600 bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30",
          btnText: "Kelola Gate",
          show: hasPermission("read", "GateOperation"),
          priority: false,
        },
        {
          name: "Verifikasi Gate",
          description: "Audit dan verifikasi muatan truk masuk/keluar, dan tautkan to referensi ERP transfer.",
          href: "/gate-verification",
          icon: ClipboardCheck,
          color: "text-teal-600 bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/30",
          btnText: "Verifikasi",
          show: hasPermission("read", "GateVerification"),
          priority: false,
        },
      ],
    },
    {
      title: "Document Management",
      description: "Kelola dokumen referensi ERP dan dokumen yang telah ditandatangani secara digital.",
      modules: [
        {
          name: "ERP Document",
          description: "Sinkronisasi daftar PO, SO, dan Surat Jalan resmi untuk pencocokan cargo.",
          href: "/erp-documents",
          icon: FileText,
          color: "text-violet-600 bg-violet-50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/30",
          btnText: "Dokumen ERP",
          show: hasPermission("read", "DocumentReference"),
          priority: false,
        },
        {
          name: "Signed Document",
          description: "Lihat dan kelola dokumen pengiriman yang telah ditandatangani secara elektronik (digital signature).",
          href: "/signed-documents",
          icon: FileCheck,
          color: "text-cyan-600 bg-cyan-50 border-cyan-100 dark:bg-cyan-950/20 dark:border-cyan-900/30",
          btnText: "Dokumen TTD",
          show: hasPermission("read", "SignedDocument"),
          priority: false,
        },
      ],
    },
    {
      title: "Administration / Management",
      description: "Kelola data master, konfigurasi sistem, audit log, dan perizinan user.",
      modules: [
        {
          name: "User Management",
          description: "Kelola akun staf gudang, atur status aktif, dan batasi akses gudang tertentu.",
          href: "/users",
          icon: Users,
          color: "text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30",
          btnText: "Daftar User",
          show: hasPermission("read", "User"),
          priority: false,
        },
        {
          name: "Roles & Permissions",
          description: "Atur matriks perizinan CASL (create, read, update, delete) per tingkat otoritas.",
          href: "/roles",
          icon: ShieldCheck,
          color: "text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
          btnText: "Atur Akses",
          show: hasPermission("read", "Role") && user?.role === "SUPER_ADMIN",
          priority: false,
        },
        {
          name: "Master Data",
          description: "Kelola data master gudang aktif, kapasitas tampung, serta detail koordinat.",
          href: "/warehouses",
          icon: Warehouse,
          color: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30",
          btnText: "Kelola Gudang",
          show: user?.role === "SUPER_ADMIN",
          priority: false,
        },
        {
          name: "Settings",
          description: "Atur parameter sinkronisasi API, host endpoint ERP Odoo, dan credentials.",
          href: "/odoo",
          icon: Settings,
          color: "text-zinc-700 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-800",
          btnText: "Atur Odoo",
          show: hasPermission("read", "OdooAccount"),
          priority: false,
        },
        {
          name: "Audit Log",
          description: "Pantau log aktivitas mutasi database dan aksi keamanan para pengguna sistem.",
          href: "/audit-logs",
          icon: History,
          color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800",
          btnText: "Jejak Audit",
          show: hasPermission("read", "AuditLog"),
          priority: false,
        },
      ],
    },
  ];

  // Calculate total visible modules
  const totalVisibleCount = moduleGroups.reduce(
    (count, group) => count + group.modules.filter((m) => m.show).length,
    0
  );

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block bg-blue-500/30 text-blue-100 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
            Dashboard Utama
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Halo, {user?.name}!
          </h1>
          <p className="mt-3 text-blue-100 text-sm md:text-base leading-relaxed">
            Selamat datang di WMS BULOG. Anda masuk dengan wewenang{" "}
            <strong className="text-white bg-white/10 px-2 py-0.5 rounded-md text-xs">
              {user?.role}
            </strong>
            . Silakan pilih salah satu modul di bawah ini untuk memulai
            pekerjaan Anda.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
          <Warehouse className="h-64 w-64 md:h-80 md:w-80" />
        </div>
      </div>

      {/* Grouped Business Domains of Module Cards */}
      <div className="space-y-10">
        {totalVisibleCount === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-medium">
            Anda tidak memiliki izin untuk mengakses modul apapun. Silakan
            hubungi Administrator.
          </div>
        ) : (
          moduleGroups.map((group) => {
            const visibleGroupModules = group.modules.filter((m) => m.show);
            if (visibleGroupModules.length === 0) return null;

            return (
              <div key={group.title} className="space-y-5">
                {/* Domain Header */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                    {group.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-3.5">
                    {group.description}
                  </p>
                </div>

                {/* Section Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {visibleGroupModules.map((mod) => {
                    const Icon = mod.icon;
                    const isActive =
                      pathname === mod.href ||
                      (mod.href !== "/" && pathname.startsWith(mod.href + "/"));

                    const cardClasses = isActive
                      ? "group bg-blue-600 dark:bg-blue-600 border-blue-600 text-white shadow-md scale-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 outline-none"
                      : "group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-blue-600 focus-visible:bg-blue-600 dark:hover:bg-blue-600 dark:focus-visible:bg-blue-600 hover:border-blue-600 focus-visible:border-blue-600 hover:text-white focus-visible:text-white hover:shadow-lg focus-visible:shadow-lg hover:scale-[1.03] focus-visible:scale-[1.03] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-200";

                    const iconWrapperClasses = isActive
                      ? "bg-white/20 border-white/30 text-white"
                      : `group-hover:bg-white/20 group-focus-visible:bg-white/20 group-hover:border-white/30 group-focus-visible:border-white/30 group-hover:text-white group-focus-visible:text-white transition-all ${mod.color}`;

                    const titleClasses = isActive
                      ? "text-white"
                      : "text-slate-800 dark:text-slate-200 group-hover:text-white group-focus-visible:text-white transition-colors";

                    const descClasses = isActive
                      ? "text-blue-100"
                      : "text-slate-500 dark:text-slate-450 leading-relaxed line-clamp-3 group-hover:text-blue-100 group-focus-visible:text-blue-100 transition-colors";

                    const buttonClasses = isActive
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-800/80 group-hover:bg-white/20 group-focus-visible:bg-white/20 group-hover:text-white group-focus-visible:text-white group-hover:border-white/30 group-focus-visible:border-white/30 transition-all";

                    return (
                      <Link
                        key={mod.name}
                        href={mod.href}
                        role="link"
                        aria-label={`Buka modul ${mod.name}`}
                        className={`${cardClasses} rounded-2xl p-5 flex flex-col justify-between cursor-pointer`}
                      >
                        <div className="space-y-4">
                          {/* Module Icon */}
                          <div
                            className={`p-3 rounded-xl border w-fit shrink-0 ${iconWrapperClasses}`}
                          >
                            <Icon className="h-6 w-6" />
                          </div>

                          {/* Name & Description */}
                          <div className="space-y-1.5">
                            <h3
                              className={`font-bold flex items-center gap-1.5 text-base ${titleClasses}`}
                            >
                              {mod.name}
                              {mod.priority && (
                                <span
                                  className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    isActive
                                      ? "bg-white/20 border-white/30 text-white"
                                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 group-hover:bg-white/20 group-hover:border-white/30 group-hover:text-white"
                                  }`}
                                >
                                  Utama
                                </span>
                              )}
                            </h3>
                            <p
                              className={`text-xs leading-relaxed line-clamp-3 ${descClasses}`}
                            >
                              {mod.description}
                            </p>
                          </div>
                        </div>

                        {/* Visual Action Indicator (No nested Link) */}
                        <div
                          className={`mt-6 flex items-center justify-between w-full font-bold text-xs py-2 px-3 rounded-xl border ${buttonClasses}`}
                        >
                          <span>{mod.btnText}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
