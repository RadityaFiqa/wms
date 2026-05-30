'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { useRole } from '@/hooks/useRole';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { ShieldCheck, Edit3, Settings, Lock, Check } from 'lucide-react';

export default function RoleManagementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<any>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      toast.error('Anda tidak memiliki akses ke halaman Hak Akses & Role.');
    }
  }, [user, router]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { roles, rolesLoading, permissions, updateRole } = useRole();

  const handleOpenEdit = (role: any) => {
    setSelectedRole(role);
    const linkedIds = role.permissions.map((rp: any) => rp.permission.id);
    setSelectedPermissionIds(linkedIds);
    setIsEditOpen(true);
  };

  const handleTogglePermission = (id: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleSavePermissions = async () => {
    setIsLoading(true);
    try {
      await updateRole(selectedRole.uuid, {
        description: selectedRole.description,
        permissionIds: selectedPermissionIds,
      });
      toast.success(`Izin akses untuk role ${selectedRole.name} berhasil diperbarui.`);
      setIsEditOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan perubahan.');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'manage':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'create':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'read':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'update':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'delete':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Hak Akses & Role</h1>
        <p className="text-slate-500 mt-1">
          Konfigurasi pembagian hak akses (*Permission*) untuk setiap peran pengguna (*Role*) di sistem WMS.
        </p>
      </div>

      {/* Role Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rolesLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-pulse h-48"></div>
          ))
        ) : (
          roles?.map((role: any) => (
            <div
              key={role.id}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-blue-300 transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{role.name}</h3>
                  </div>
                  
                  {role.name !== 'SUPER_ADMIN' && (
                    <button
                      onClick={() => handleOpenEdit(role)}
                      className="opacity-0 group-hover:opacity-100 flex items-center text-xs text-blue-600 hover:text-blue-500 font-bold bg-blue-50/50 hover:bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg transition"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Configure
                    </button>
                  )}
                  {role.name === 'SUPER_ADMIN' && (
                    <span className="flex items-center text-xs text-slate-400 font-semibold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                      <Lock className="h-3.5 w-3.5 mr-1" />
                      Locked
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{role.description || 'Tidak ada deskripsi'}</p>
              </div>

              {/* Permissions list summary */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Permissions ({role.permissions.length})
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {role.name === 'SUPER_ADMIN' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-100">
                      ALL_PRIVILEGES (manage:all)
                    </span>
                  ) : role.permissions.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Belum ada izin akses</span>
                  ) : (
                    role.permissions.map((rp: any) => (
                      <span
                        key={rp.permission.id}
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${getActionBadgeColor(
                          rp.permission.action
                        )}`}
                      >
                        {rp.permission.action}:{rp.permission.subject}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- CONFIGURE PERMISSIONS MODAL --- */}
      {isEditOpen && selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-zoom-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Konfigurasi Izin Akses</h3>
                <p className="text-xs text-slate-500 mt-0.5">Role: <strong className="text-slate-700">{selectedRole.name}</strong></p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
              >
                &times;
              </button>
            </div>

            {/* Scrollable list of permissions */}
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm font-semibold text-slate-600">Pilih izin akses yang ingin diberikan ke role ini:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {permissions?.map((perm: any) => {
                  const isChecked = selectedPermissionIds.includes(perm.id);
                  return (
                    <div
                      key={perm.id}
                      onClick={() => handleTogglePermission(perm.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${getActionBadgeColor(
                            perm.action
                          )}`}
                        >
                          {perm.action}
                        </span>
                        <span className="text-sm font-bold text-slate-700">{perm.subject}</span>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 p-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm transition"
              >
                Batal
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={isLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-blue-500/10 transition flex items-center"
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
