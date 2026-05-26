'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema } from '@bulog-wms/schema';
import type { LoginInput } from '@bulog-wms/schema';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { user, token, setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  // If user is already logged in, redirect them
  useEffect(() => {
    if (user && token) {
      if (user.isFirstLogin) {
        router.push('/dashboard/profile?force_reset=true');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, token, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', data);
      const { accessToken, user } = response.data;
      
      setAuth(user, accessToken);
      toast.success(`Selamat datang kembali, ${user.name}!`);

      if (user.isFirstLogin) {
        router.push('/dashboard/profile?force_reset=true');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Login gagal. Periksa koneksi Anda.';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 px-4">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60"></div>
      
      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur-xl"></div>
        
        {/* Card content */}
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              BULOG <span className="text-blue-500">WMS</span>
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Warehouse Management System Portal
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-2">
                Alamat Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="nama@bulog.co.id"
                {...register('email')}
                className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-600"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-sm font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs text-blue-500 hover:text-blue-400 font-medium transition duration-200"
                >
                  Lupa Password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                placeholder="Masukkan password"
                {...register('password')}
                className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-600"
              />
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition duration-200"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Masuk ke Sistem'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
