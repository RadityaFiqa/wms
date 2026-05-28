'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema } from '@bulog-wms/schema';
import type { ChangePasswordInput } from '@bulog-wms/schema';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldAlert, KeyRound, User2, Warehouse, Mail } from 'lucide-react';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, changePassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isForceReset, setIsForceReset] = useState(false);

  useEffect(() => {
    setIsForceReset(searchParams.get('force_reset') === 'true' || !!user?.isFirstLogin);
  }, [searchParams, user]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    setIsLoading(true);
    try {
      const response = await changePassword(data);
      toast.success(response?.message || 'Password berhasil diperbarui. Silakan login ulang.');
      
      logout();
      router.push('/login');
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Gagal mengubah password.';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Profil & Keamanan</h1>
        <p className="text-slate-500 mt-1">Kelola data profil dan ganti kata sandi WMS Anda.</p>
      </div>

      {/* Force Password Reset Alert Banner */}
      {isForceReset && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start space-x-3 shadow-sm">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-800">Wajib Ganti Password</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Ini adalah login pertama Anda atau password Anda baru saja direset oleh Administrator. Demi keamanan, Anda **wajib mengganti password bawaan** Anda sebelum diizinkan mengakses fitur WMS lainnya.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* User Profile Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
            <div className="h-20 w-20 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <User2 className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{user?.name}</h3>
            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-full border border-blue-100 mt-1.5">
              {user?.role}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                <p className="text-sm font-semibold text-slate-700">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Warehouse className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gudang Ditugaskan</p>
                <p className="text-sm font-semibold text-slate-700">{user?.warehouse?.name || 'Semua Gudang (Super)'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4 mb-6">
            <KeyRound className="h-6 w-6 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-800">Form Ganti Password</h3>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="oldPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                Password Lama / Sementara
              </label>
              <input
                id="oldPassword"
                type="password"
                placeholder="Masukkan password saat ini"
                {...register('oldPassword')}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
              />
              {errors.oldPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.oldPassword.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                  Password Baru
                </label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="Password minimal 6 karakter"
                  {...register('newPassword')}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                />
                {errors.newPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmNewPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                  Konfirmasi Password Baru
                </label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="Ulangi password baru"
                  {...register('confirmNewPassword')}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                />
                {errors.confirmNewPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirmNewPassword.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg shadow-lg active:scale-[0.98] transition duration-200 text-sm"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Perbarui Kata Sandi'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
