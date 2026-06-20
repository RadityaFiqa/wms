"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "../theme-provider";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  History,
  User,
  LogOut,
  Warehouse,
  Menu,
  X,
  Settings,
  Boxes,
  Truck,
  ClipboardCheck,
  FileText,
  Scale,
  Clipboard,
  BarChart3,
  FileCheck,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    token,
    isInitialized,
    logout,
    hasPermission,
    activeWarehouse,
    setActiveWarehouse,
  } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Dropdown states
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      if (!user || !token) {
        toast.error("Silakan login terlebih dahulu");
        router.push("/login");
      } else if (user.isFirstLogin && pathname !== "/profile") {
        toast.warning("Anda harus mengubah password bawaan terlebih dahulu");
        router.push("/profile?force_reset=true");
      }
    }
  }, [user, token, isInitialized, router, pathname]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      logout();
      toast.success("Berhasil keluar dari sistem");
      router.push("/login");
    }
  };

  // If not initialized or not logged in, show full-screen skeleton
  if (!isInitialized || !user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-sm font-semibold text-slate-500">
            Memuat Sesi WMS...
          </span>
        </div>
      </div>
    );
  }

  // Sidebar Links defined with permissions, grouped by business domain
  const menuGroups = [
    {
      title: "Overview",
      items: [
        {
          name: "Dashboard",
          href: "/",
          icon: LayoutDashboard,
          show: true,
        },
      ],
    },
    {
      title: "Inventory Management",
      items: [
        {
          name: "Inventory",
          href: "/inventory",
          icon: Boxes,
          show: hasPermission("read", "Inventory"),
        },
        {
          name: "Laporan Mutasi",
          href: "/reports",
          icon: BarChart3,
          show: hasPermission("read", "Report"),
        },
        {
          name: "Stock Opname",
          href: "/stock-opname",
          icon: Clipboard,
          show: hasPermission("read", "StockOpname"),
        },
        {
          name: "Rekonsiliasi ERP",
          href: "/reconciliation",
          icon: Scale,
          show: hasPermission("read", "Reconciliation"),
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          name: "Gate Operation",
          href: "/gate-operations",
          icon: Truck,
          show: hasPermission("read", "GateOperation"),
        },
        {
          name: "Verifikasi Gate",
          href: "/gate-verification",
          icon: ClipboardCheck,
          show: hasPermission("read", "GateVerification"),
        },
      ],
    },
    {
      title: "Document Management",
      items: [
        {
          name: "ERP Document",
          href: "/erp-documents",
          icon: FileText,
          show: hasPermission("read", "DocumentReference"),
        },
        {
          name: "Signed Document",
          href: "/signed-documents",
          icon: FileCheck,
          show: hasPermission("read", "SignedDocument"),
        },
      ],
    },
    {
      title: "Administration / Management",
      items: [
        {
          name: "User Management",
          href: "/users",
          icon: Users,
          show: hasPermission("read", "User"),
        },
        {
          name: "Roles & Permissions",
          href: "/roles",
          icon: ShieldCheck,
          show: hasPermission("read", "Role") && user?.role === "SUPER_ADMIN",
        },
        {
          name: "Master Data",
          href: "/warehouses",
          icon: Warehouse,
          show: user?.role === "SUPER_ADMIN",
        },
        {
          name: "Odoo Settings",
          href: "/odoo",
          icon: Settings,
          show: hasPermission("read", "OdooAccount"),
        },
        {
          name: "Audit Log",
          href: "/audit-logs",
          icon: History,
          show: hasPermission("read", "AuditLog"),
        },
      ],
    },
  ];

  const activeLinkClass = "bg-blue-600 text-white shadow-md";
  const inactiveLinkClass =
    "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100";

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Sidebar Header Logo */}
      <div className="flex items-center h-16 px-6 border-b border-slate-200 dark:border-slate-800">
        <Warehouse className="h-6 w-6 text-blue-600 mr-3" />
        <span className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-200">
          BULOG <span className="text-blue-600 text-sm font-bold">WMS</span>
        </span>
      </div>

      {/* User Card */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/65 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="font-bold text-slate-800 dark:text-slate-200 leading-tight">
          {user.name}
        </div>
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5 mb-3">
          {user.role}
        </div>

        {user.accessibleWarehouses && user.accessibleWarehouses.length > 0 ? (
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Gudang Aktif
            </label>
            <div className="relative">
              <select
                value={activeWarehouse?.uuid || ""}
                onChange={(e) => {
                  const selectedWh = user.accessibleWarehouses.find(
                    (w) => w.uuid === e.target.value,
                  );
                  if (selectedWh) {
                    setActiveWarehouse(selectedWh);
                    toast.success(`Pindah ke gudang: ${selectedWh.name}`);
                    setTimeout(() => window.location.reload(), 100);
                  }
                }}
                className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {user.accessibleWarehouses.map((wh) => (
                  <option key={wh.uuid} value={wh.uuid}>
                    {wh.name}
                  </option>
                ))}
              </select>
              <Warehouse className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-550 pointer-events-none" />
              <div className="absolute right-2.5 top-2.5 flex items-center pointer-events-none text-slate-500">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          user.warehouse && (
            <div className="flex items-center text-xs text-slate-500 mt-2">
              <Warehouse className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <span className="truncate">{user.warehouse.name}</span>
            </div>
          )
        )}
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) => item.show);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              <h4 className="px-4 text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {group.title}
              </h4>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-4 py-2.5 text-sm font-semibold rounded-xl transition duration-150 ${
                        isActive ? activeLinkClass : inactiveLinkClass
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        {sidebarContent}
      </aside>

      {/* Main content wrapper */}
      <div className="flex flex-col flex-1 w-full min-w-0 md:pl-64">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-200">
          <div className="flex items-center">
            {/* Hamburger menu button for mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center space-x-4">
            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left"
              >
                <div className="h-8.5 w-8.5 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-md animate-pulse-slow">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-450 dark:text-slate-405 mt-0.5">
                    {user.role}
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-[9999] text-sm animate-fade-in">
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                    <span className="inline-block text-[9px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 px-1.5 py-0.5 rounded mt-1.5">
                      {user.role}
                    </span>
                  </div>

                  {/* Dropdown Items */}
                  <div className="p-1 space-y-0.5">
                    <Link
                      href="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition"
                    >
                      <User className="h-4 w-4 mr-2.5 text-slate-450 dark:text-slate-500" />
                      Profil & Keamanan
                    </Link>

                    {/* Dark Mode Toggle Item */}
                    <button
                      onClick={toggleTheme}
                      className="flex w-full items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition text-left cursor-pointer"
                    >
                      <div className="flex items-center">
                        {theme === "dark" ? (
                          <>
                            <svg
                              className="h-4 w-4 mr-2.5 text-amber-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                              />
                            </svg>
                            <span>Mode Terang</span>
                          </>
                        ) : (
                          <>
                            <svg
                              className="h-4 w-4 mr-2.5 text-indigo-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                              />
                            </svg>
                            <span>Mode Malam</span>
                          </>
                        )}
                      </div>

                      {/* Switch representation */}
                      <div
                        className={`w-8.5 h-5 flex items-center rounded-full p-0.5 transition duration-300 ${theme === "dark" ? "bg-blue-600" : "bg-slate-350"}`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${theme === "dark" ? "translate-x-3.5" : "translate-x-0"}`}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Dropdown Logout */}
                  <div className="border-t border-slate-100 dark:border-slate-800/60 p-1 mt-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition text-left cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-2.5" />
                      Keluar Sistem
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Drawer (visible only when opened) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* Drawer Body */}
          <div className="relative flex flex-col w-full max-w-xs bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 animate-slide-in">
            {/* Close Button inside drawer */}
            <div className="absolute top-4 right-4 z-50">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 h-full">{sidebarContent}</div>
          </div>
        </div>
      )}
    </div>
  );
}
