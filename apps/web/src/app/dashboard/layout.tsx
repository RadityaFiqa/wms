'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
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
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, isInitialized, logout, hasPermission } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      if (!user || !token) {
        toast.error('Silakan login terlebih dahulu');
        router.push('/login');
      } else if (user.isFirstLogin && pathname !== '/dashboard/profile') {
        toast.warning('Anda harus mengubah password bawaan terlebih dahulu');
        router.push('/dashboard/profile?force_reset=true');
      }
    }
  }, [user, token, isInitialized, router, pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      logout();
      toast.success('Berhasil keluar dari sistem');
      router.push('/login');
    }
  };

  // If not initialized or not logged in, show full-screen skeleton
  if (!isInitialized || !user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold text-slate-500">Memuat Sesi WMS...</span>
        </div>
      </div>
    );
  }

  // Sidebar Links defined with permissions
  const menuItems = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'Manajemen User',
      href: '/dashboard/users',
      icon: Users,
      show: hasPermission('read', 'User'),
    },
    {
      name: 'Hak Akses & Role',
      href: '/dashboard/roles',
      icon: ShieldCheck,
      show: hasPermission('read', 'Role'),
    },
    {
      name: 'Audit Logs',
      href: '/dashboard/audit-logs',
      icon: History,
      show: hasPermission('read', 'AuditLog'),
    },
    {
      name: 'Konfigurasi Odoo',
      href: '/dashboard/odoo',
      icon: Settings,
      show: hasPermission('read', 'OdooAccount'),
    },
    {
      name: 'Profil & Security',
      href: '/dashboard/profile',
      icon: User,
      show: true,
    },
  ];

  const activeLinkClass = 'bg-blue-600 text-white shadow-md';
  const inactiveLinkClass = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Sidebar Header Logo */}
      <div className="flex items-center h-16 px-6 border-b border-slate-200">
        <Warehouse className="h-6 w-6 text-blue-600 mr-3" />
        <span className="text-xl font-black tracking-tight text-slate-800">
          BULOG <span className="text-blue-600 text-sm font-bold">WMS</span>
        </span>
      </div>

      {/* User Card */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <div className="font-bold text-slate-800 leading-tight">{user.name}</div>
        <div className="text-xs font-semibold text-blue-600 mt-0.5">{user.role}</div>
        {user.warehouse && (
          <div className="flex items-center text-xs text-slate-500 mt-2">
            <Warehouse className="h-3.5 w-3.5 mr-1 text-slate-400" />
            <span className="truncate">{user.warehouse.name}</span>
          </div>
        )}
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition duration-150 ${
                  isActive ? activeLinkClass : inactiveLinkClass
                }`}
              >
                <Icon className="h-5 w-5 mr-3 shrink-0" />
                {item.name}
              </Link>
            );
          })}
      </nav>

      {/* Logout button at footer */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex w-full items-center px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition duration-150"
        >
          <LogOut className="h-5 w-5 mr-3 shrink-0" />
          Keluar Sistem
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        {sidebarContent}
      </aside>

      {/* Main content wrapper */}
      <div className="flex flex-col flex-1 w-full min-w-0 md:pl-64">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center">
            {/* Hamburger menu button for mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="hidden md:block text-sm font-bold text-slate-500 tracking-wider uppercase">
              WMS Portal Panel
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-full border border-blue-100">
              Bulog Server
            </span>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
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
          <div className="relative flex flex-col w-full max-w-xs bg-white animate-slide-in">
            {/* Close Button inside drawer */}
            <div className="absolute top-4 right-4 z-50">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
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
