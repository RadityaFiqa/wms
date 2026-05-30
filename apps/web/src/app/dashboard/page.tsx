'use client';

import React from 'react';
import { useAuthStore } from '@/store/auth';
import { Warehouse, Users, ShieldAlert, BarChart3 } from 'lucide-react';

export default function DashboardOverviewPage() {
  const { user } = useAuthStore();

  const stats: any[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Selamat datang kembali di Warehouse Management System Perum Bulog.</p>
      </div>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <h2 className="text-2xl font-bold">Halo, {user?.name}!</h2>
          <p className="mt-2 text-blue-100 text-sm leading-relaxed">
            Anda masuk sebagai <strong className="text-white">{user?.role}</strong>. Gunakan sidebar menu untuk mengelola inventory, melihat audit logs, atau melakukan manajemen user sesuai dengan hak akses Anda.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
          <Warehouse className="h-64 w-64" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center space-x-4">
              <div className={`p-3 rounded-lg border ${stat.color} shrink-0`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.name}</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5 truncate">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
