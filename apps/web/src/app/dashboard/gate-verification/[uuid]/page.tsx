'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGateVerificationSchema } from '@bulog-wms/schema';
import { useGate, useGateOperationDetail } from '@/hooks/useGate';
import { useProducts } from '@/hooks/useInventory';
import { toast } from 'sonner';
import {
  ShieldCheck,
  ArrowLeft,
  Calendar,
  User,
  Truck,
  Upload,
  Save,
  Loader2,
  FileText,
  Boxes,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';

export default function GateVerificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { gateOperation, isLoading: detailLoading } = useGateOperationDetail(uuid);
  const { uploadFile, verifyGateOperation } = useGate();
  const { products: systemProducts, isLoading: productsLoading, error: productsError } = useProducts();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(CreateGateVerificationSchema),
    defaultValues: {
      status: 'VERIFIED' as 'VERIFIED' | 'REJECTED',
      notes: '',
      attachmentPath: '',
      products: [] as { productId: number; quantity: number }[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  // Pre-populate products list when gateOperation is loaded
  useEffect(() => {
    if (gateOperation && gateOperation.products) {
      const items = gateOperation.products.map((p: any) => ({
        productId: p.productId,
        quantity: p.quantity,
      }));
      reset({
        status: 'VERIFIED',
        notes: '',
        attachmentPath: '',
        products: items,
      });
    }
  }, [gateOperation, reset]);

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Mengunggah berkas lampiran...');
    try {
      const response = await uploadFile(file);
      setValue('attachmentPath', response.filePath);
      setUploadedUrl(response.url);
      setUploadedName(response.fileName);
      toast.success('Lampiran berhasil diunggah.', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah lampiran.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAuditAction = async (statusValue: 'VERIFIED' | 'REJECTED') => {
    setValue('status', statusValue);
    
    // Explicit trigger of submit via react-hook-form
    handleSubmit(onSubmit)();
  };

  const onSubmit = async (data: any) => {
    if (data.products && data.products.length > 0) {
      // Validate that all products have selected product (productId > 0)
      const invalidProductId = data.products.some((p: any) => !p.productId || p.productId <= 0);
      if (invalidProductId) {
        toast.error('Silakan pilih produk yang valid untuk semua baris tambahan.');
        return;
      }

      // Validate that all products have selected quantities >= 0
      const invalidProduct = data.products.some((p: any) => p.quantity < 0 || isNaN(p.quantity));
      if (invalidProduct) {
        toast.error('Jumlah kuantitas barang tidak boleh negatif atau kosong.');
        return;
      }
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Memproses audit verifikasi...');
    try {
      await verifyGateOperation(uuid, data);
      toast.success(`Data gerbang berhasil diverifikasi dengan status: ${data.status}.`, { id: toastId });
      router.push('/dashboard/gate-verification');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memproses verifikasi.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (detailLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!gateOperation) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4 max-w-lg mx-auto">
        <Info className="h-12 w-12 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Data Tidak Ditemukan</h3>
        <p className="text-sm text-slate-500">
          Data gate operation tidak ditemukan atau sudah diverifikasi.
        </p>
        <button
          onClick={() => router.push('/dashboard/gate-verification')}
          className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition"
        >
          Kembali ke Antrean
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.push('/dashboard/gate-verification')}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
            <ShieldCheck className="h-6 w-6 text-blue-600 mr-2 shrink-0" />
            Audit & Verifikasi Kendaraan
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 font-mono">
            {gateOperation.opNumber} | Driver: {gateOperation.driverName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left Side: Satpam Logs & Vehicle Photo (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center">
              <Truck className="h-4.5 w-4.5 mr-2 text-blue-500" />
              Laporan Satpam (Gate In/Out)
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block">Tipe Gerbang</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {gateOperation.cardType === 'IN' ? '📥 Masuk (Gate IN)' : '📤 Keluar (Gate OUT)'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block">Plat Nomor</span>
                  <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">
                    {gateOperation.licensePlate}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Driver</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block flex items-center">
                  <User className="h-3.5 w-3.5 mr-1 text-slate-400" />
                  {gateOperation.driverName}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Tanggal Masuk</span>
                <span className="text-sm font-semibold text-slate-700 mt-0.5 block flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                  {new Date(gateOperation.createdAt).toLocaleString('id-ID')}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block font-semibold">Keterangan Satpam</span>
                <p className="text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-1 italic">
                  {gateOperation.notes || 'Tidak ada catatan.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              Bukti Foto Satpam
            </h3>
            {gateOperation.vehiclePhoto?.url ? (
              <div className="space-y-2">
                <div className="w-full h-[180px] bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gateOperation.vehiclePhoto.url}
                    alt="Foto Kendaraan Satpam"
                    className="w-full h-full object-cover"
                  />
                </div>
                <a
                  href={gateOperation.vehiclePhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center text-xs font-bold text-blue-600 hover:text-blue-500 py-1 transition cursor-pointer"
                >
                  Buka Gambar Asli
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                Foto kendaraan tidak terlampir.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Form and Items Audit (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
              <Boxes className="h-5 w-5 mr-2 text-indigo-500 shrink-0" />
              Audit Produk & Kuantitas Barang
            </h3>

            {fields.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm italic">
                Belum ada komoditas/barang logistik dalam audit ini.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-3 text-xs text-blue-800 leading-relaxed flex items-start">
                  <Info className="h-4 w-4 mr-2 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    Sesuaikan jumlah kuantitas barang berdasarkan hasil audit/penghitungan fisik Anda di gudang. Masukkan angka yang sesuai.
                  </span>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const originalItem = gateOperation.products && gateOperation.products[index];
                    const isNewItem = !originalItem;
                    const selectedProdId = watch(`products.${index}.productId`);
                    const selectedSystemProduct = systemProducts?.find((p: any) => p.id === selectedProdId);

                    return (
                      <div key={field.id} className="flex gap-4 items-start bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex-1 space-y-2">
                          {isNewItem ? (
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Pilih Produk Tambahan
                              </label>
                              <select
                                {...register(`products.${index}.productId`, { valueAsNumber: true })}
                                className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer font-semibold"
                              >
                                <option value="0">-- Pilih Produk --</option>
                                {systemProducts?.map((p: any) => (
                                  <option key={p.id} value={p.id}>
                                    [{p.sku}] {p.name} ({p.uom || 'Unit'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {originalItem?.product?.name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                SKU: {originalItem?.product?.sku}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 font-semibold">
                                Jumlah awal: <strong className="text-slate-800 font-bold">{originalItem?.quantity}</strong> {originalItem?.product?.uom || 'Unit'}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="w-40">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Qty Audit
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              step="any"
                              {...register(`products.${index}.quantity`, { valueAsNumber: true })}
                              className="w-full bg-white border border-slate-250 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-right font-bold"
                            />
                            <span className="text-xs text-slate-550 font-bold shrink-0">
                              {isNewItem ? (selectedSystemProduct?.uom || 'Unit') : (originalItem?.product?.uom || 'Unit')}
                            </span>
                          </div>
                        </div>

                        <div className="self-end pb-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 transition cursor-pointer"
                            title="Hapus Barang"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {productsError && (
              <p className="text-xs text-red-550 font-semibold mt-2">
                ⚠️ Gagal memuat data produk lengkap: {productsError.message}
              </p>
            )}

            <button
              type="button"
              disabled={productsLoading}
              onClick={() => append({ productId: 0, quantity: 1 })}
              className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200/50 transition cursor-pointer disabled:opacity-50"
            >
              {productsLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              Tambah Barang
            </button>
          </div>

          {/* Verification Notes & File Uploader */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-slate-400 shrink-0" />
              Laporan Hasil Audit & Lampiran
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Catatan Verifikasi / Audit (Wajib)
              </label>
              <textarea
                rows={3}
                placeholder="Masukkan rincian hasil verifikasi fisik barang, plat nomor, driver, dan kesesuaian data..."
                {...register('notes')}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-medium"
              />
              {errors.notes && (
                <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Lampiran Bukti Audit (Opsional)
              </label>
              <div className="flex gap-4 items-center">
                <label className="flex items-center bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition cursor-pointer">
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5 text-blue-500" />
                      Mengunggah...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                      Unggah Bukti Audit (PDF/Foto)
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>

                {uploadedName && (
                  <span className="text-xs text-slate-500 font-semibold truncate max-w-xs flex items-center">
                    📄 {uploadedName}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 justify-end">
              <button
                type="button"
                onClick={() => router.push('/dashboard/gate-verification')}
                disabled={isSubmitting}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer text-center"
              >
                Kembali
              </button>

              <button
                type="button"
                onClick={() => handleAuditAction('REJECTED')}
                disabled={isSubmitting || isUploading}
                className="flex items-center justify-center bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-lg shadow-md hover:shadow-red-500/10 active:scale-[0.98] transition text-sm cursor-pointer"
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Tolak Audit (Reject)
              </button>

              <button
                type="button"
                onClick={() => handleAuditAction('VERIFIED')}
                disabled={isSubmitting || isUploading}
                className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-lg shadow-md hover:shadow-emerald-500/10 active:scale-[0.98] transition text-sm cursor-pointer"
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Lolos Audit (Approve)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
