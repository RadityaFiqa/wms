"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChangePasswordSchema } from "@bulog-wms/schema";
import type { ChangePasswordInput } from "@bulog-wms/schema";
import { useAuth } from "@/hooks/useAuth";
import { useDigitalSignature } from "@/hooks/useDigitalSignature";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldAlert,
  KeyRound,
  User2,
  Warehouse,
  Mail,
  PenTool,
  Upload,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

function UserSignatureCard() {
  const {
    userSignatures,
    activeSignature,
    uploadSignature,
    activateSignature,
    deleteSignature,
    userSignaturesLoading,
  } = useDigitalSignature();

  const [uploading, setUploading] = useState(false);

  const rasterizeSvgToPng = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width || 500;
          canvas.height = img.height || 300;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context tidak didukung."));
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Gagal konversi SVG ke PNG."));
          }, "image/png");
        };
        img.onerror = () => reject(new Error("Gagal memproses file SVG."));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Gagal membaca file."));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format file tidak didukung. Hanya PNG, JPG, JPEG, dan SVG.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Mengunggah tanda tangan...");

    try {
      if (file.type === "image/svg+xml") {
        const pngBlob = await rasterizeSvgToPng(file);
        await uploadSignature(pngBlob, "signature.png");
      } else {
        await uploadSignature(file, file.name);
      }
      toast.success("Tanda tangan baru berhasil diunggah!", { id: toastId });
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Gagal mengunggah tanda tangan.";
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus gambar tanda tangan ini?")) return;
    try {
      await deleteSignature(id);
      toast.success("Tanda tangan berhasil dihapus.");
    } catch (err: any) {
      toast.error("Gagal menghapus tanda tangan.");
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await activateSignature(id);
      toast.success("Tanda tangan berhasil disetel sebagai aktif.");
    } catch (err: any) {
      toast.error("Gagal menyetel tanda tangan aktif.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
        <PenTool className="h-5 w-5 mr-2 text-blue-600" />
        Tanda Tangan Digital
      </h3>

      {/* Active Signature Preview */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Tanda Tangan Aktif
        </label>

        {activeSignature ? (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative group overflow-hidden flex items-center justify-center min-h-[120px] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:10px_10px]">
            <img
              src={activeSignature.fileUrl}
              alt="Active Signature"
              className="max-h-[100px] object-contain select-none pointer-events-none"
            />
            <span className="absolute top-2.5 right-2.5 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
              <CheckCircle className="h-2.5 w-2.5 mr-1" />
              Aktif
            </span>
          </div>
        ) : (
          <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-xl p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-amber-800">
              Belum Ada Tanda Tangan Aktif
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              Silakan unggah gambar tanda tangan Anda di bawah ini.
            </p>
          </div>
        )}
      </div>

      {/* File Upload Box */}
      <div className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition relative">
        <input
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/svg+xml"
          onChange={handleFileUpload}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-700">
          Pilih / Unggah Tanda Tangan Baru
        </p>
        <p className="text-[9px] text-slate-400 mt-1">
          Format: PNG (transparan disukai), SVG, JPG (Max 2MB)
        </p>
      </div>

      {/* Other Signatures List */}
      {userSignatures && userSignatures.length > 1 && (
        <div className="space-y-3 pt-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Koleksi Tanda Tangan
          </label>
          <div className="grid grid-cols-2 gap-3">
            {userSignatures.map((sig: any) => {
              if (sig.id === activeSignature?.id) return null;
              return (
                <div
                  key={sig.id}
                  className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 relative group flex flex-col items-center justify-center hover:bg-slate-50 transition min-h-[90px] bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] bg-[size:8px_8px]"
                >
                  <img
                    src={sig.fileUrl}
                    alt="Signature collection"
                    className="max-h-[50px] object-contain mb-2"
                  />
                  <div className="flex space-x-2 w-full justify-between pt-1.5 border-t border-slate-100">
                    <button
                      onClick={() => handleActivate(sig.id)}
                      className="text-[9px] text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Aktifkan
                    </button>
                    <button
                      onClick={() => handleDelete(sig.id)}
                      className="text-[9px] text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, changePassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isForceReset, setIsForceReset] = useState(false);

  useEffect(() => {
    setIsForceReset(
      searchParams.get("force_reset") === "true" || !!user?.isFirstLogin,
    );
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
      toast.success(
        response?.message ||
          "Password berhasil diperbarui. Silakan login ulang.",
      );

      logout();
      router.push("/login");
    } catch (error: any) {
      const errMsg =
        error.response?.data?.message || "Gagal mengubah password.";
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          Profil & Keamanan
        </h1>
        <p className="text-slate-500 mt-1">
          Kelola data profil dan ganti kata sandi WMS Anda.
        </p>
      </div>

      {/* Force Password Reset Alert Banner */}
      {isForceReset && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start space-x-3 shadow-sm">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-800">
              Wajib Ganti Password
            </h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Ini adalah login pertama Anda atau password Anda baru saja direset
              oleh Administrator. Demi keamanan, Anda **wajib mengganti password
              bawaan** Anda sebelum diizinkan mengakses fitur WMS lainnya.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: User Profile & Signature Cards */}
        <div className="space-y-6 lg:col-span-1">
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Email
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Warehouse className="h-5 w-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Gudang Ditugaskan
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    {user?.warehouse?.name || "Semua Gudang (Super)"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Signature Card */}
          <UserSignatureCard />
        </div>

        {/* Change Password Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4 mb-6">
            <KeyRound className="h-6 w-6 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-800">
              Form Ganti Password
            </h3>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label
                htmlFor="oldPassword"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Password Lama / Sementara
              </label>
              <input
                id="oldPassword"
                type="password"
                placeholder="Masukkan password saat ini"
                {...register("oldPassword")}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
              />
              {errors.oldPassword && (
                <p className="text-xs text-red-505 mt-1">
                  {errors.oldPassword.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Password Baru
                </label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="Password minimal 6 karakter"
                  {...register("newPassword")}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                />
                {errors.newPassword && (
                  <p className="text-xs text-red-505 mt-1">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmNewPassword"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Konfirmasi Password Baru
                </label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="Ulangi password baru"
                  {...register("confirmNewPassword")}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                />
                {errors.confirmNewPassword && (
                  <p className="text-xs text-red-505 mt-1">
                    {errors.confirmNewPassword.message}
                  </p>
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
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                ) : (
                  "Perbarui Kata Sandi"
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
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
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
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
