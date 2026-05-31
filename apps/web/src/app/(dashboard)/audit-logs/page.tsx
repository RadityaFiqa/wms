'use client';

import React, { useState } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  Terminal,
  User,
} from 'lucide-react';

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;
  
  // Track expanded detail rows
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const { auditLogsData: logsData, isLoading } = useAuditLog({
    search,
    page,
    limit,
  });

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getActionColor = (action: string) => {
    if (action.includes('FAILED')) return 'bg-red-50 text-red-700 border-red-100';
    if (action.includes('SUCCESS') || action.includes('CREATE') || action.includes('REACTIVATE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
    if (action.includes('UPDATE') || action.includes('CHANGE')) {
      return 'bg-amber-50 text-amber-700 border-amber-100';
    }
    if (action.includes('DEACTIVATE')) return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const formatBrowser = (userAgent: string) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome') && userAgent.includes('Safari')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Postman')) return 'Postman';
    return 'Web Browser';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Audit Logs</h1>
        <p className="text-slate-500 mt-1">
          Catatan aktivitas sistem yang melacak setiap login, mutasi data, dan perubahan hak akses pengguna.
        </p>
      </div>

      {/* Search Filter Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cari Log</label>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan aksi, nama actor, atau target..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="w-10 px-6 py-4"></th>
                <th className="px-6 py-4">Aksi / Event</th>
                <th className="px-6 py-4">Aktor (Pelaku)</th>
                <th className="px-6 py-4">Target (Objek)</th>
                <th className="px-6 py-4">Metadata Akses</th>
                <th className="px-6 py-4">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : logsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Tidak ada catatan log aktivitas ditemukan.
                  </td>
                </tr>
              ) : (
                logsData?.data?.map((log: any) => {
                  const isExpanded = !!expandedRows[log.id];
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleRow(log.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getActionColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {log.actor ? (
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1 text-slate-400" />
                              {log.actor.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-italic">Sistem</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {log.target ? (
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1 text-slate-400" />
                              {log.target.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-800 font-semibold">{log.ipAddress || '127.0.0.1'}</div>
                          <div className="text-xs text-slate-400 mt-0.5" title={log.userAgent}>
                            {formatBrowser(log.userAgent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-slate-300" />
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Details Section */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/50 p-6 border-t border-b border-slate-100">
                            <div className="bg-slate-950 border border-slate-900 text-slate-300 rounded-xl p-4 font-mono text-xs shadow-inner">
                              <div className="flex items-center text-slate-400 font-bold border-b border-slate-800 pb-2 mb-3">
                                <Terminal className="h-4 w-4 mr-2" />
                                RAW METADATA / DATA MUTATIONS
                              </div>
                              <pre className="overflow-x-auto whitespace-pre-wrap">
                                {log.details 
                                  ? JSON.stringify(JSON.parse(log.details), null, 2) 
                                  : '// Tidak ada detail perubahan data (Authentication event)'
                                }
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {logsData?.meta && (
          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold text-center sm:text-left">
              Menampilkan {logsData.data.length} dari {logsData.meta.total} log
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="text-sm font-bold text-slate-700">{page} / {logsData.meta.totalPages}</span>
              <button
                disabled={page >= logsData.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
