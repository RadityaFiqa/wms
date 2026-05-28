'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGateOperationSchema } from '@bulog-wms/schema';
import { useGate } from '@/hooks/useGate';
import { useProducts } from '@/hooks/useInventory';
import { toast } from 'sonner';
import {
  Truck,
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  Loader2,
  Boxes,
} from 'lucide-react';

export default function CreateGateOperationPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasProducts, setHasProducts] = useState(false);

  const { uploadFile, createGateOperation } = useGate();
  
  // Load products list from database
  const { products, isLoading: productsLoading, error: productsError } = useProducts();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(CreateGateOperationSchema),
    defaultValues: {
      cardType: 'IN',
      driverName: '',
      licensePlate: '',
      notes: '',
      vehiclePhotoPath: '',
      products: [] as { productId: number; quantity: number }[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const watchPhotoPath = watch('vehiclePhotoPath');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Mengunggah foto kendaraan...');
    try {
      const response = await uploadFile(file);
      setValue('vehiclePhotoPath', response.filePath);
      setUploadedUrl(response.url);
      toast.success('Foto kendaraan berhasil diunggah.', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah foto.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: any) => {
    if (!data.vehiclePhotoPath) {
      toast.error('Foto bukti kendaraan wajib diunggah.');
      return;
    }

    if (hasProducts && (!data.products || data.products.length === 0)) {
      toast.error('Silakan tambah minimal satu barang atau hilangkan opsi membawa barang.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Menyimpan data gerbang...');
    try {
      // Clean products if toggle is off
      const payload = {
        ...data,
        products: hasProducts ? data.products : [],
      };
      await createGateOperation(payload);
      toast.success('Data kendaraan masuk/keluar berhasil dicatat.', { id: toastId });
      router.push('/dashboard/gate-operations');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto append first row when product toggle turns on and array is empty
  useEffect(() => {
    if (hasProducts && fields.length === 0) {
      append({ productId: 0, quantity: 1 });
    }
  }, [hasProducts, fields.length, append]);

  // Products list resolved directly from useProducts hook

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.push('/dashboard/gate-operations')}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
            <Truck className="h-6 w-6 text-blue-600 mr-2 shrink-0" />
            Catat Operasi Gerbang
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Form pencatatan log masuk dan keluar gerbang kendaraan WMS.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm md:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 pb-3 border-b border-slate-100">
              Informasi Kendaraan & Driver
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipe Gerbang (Card Type)
                </label>
                <select
                  {...register('cardType')}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm cursor-pointer font-medium"
                >
                  <option value="IN">📥 Masuk (Gate IN)</option>
                  <option value="OUT">📤 Keluar (Gate OUT)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Plat Nomor Kendaraan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: B 1234 ABC"
                  {...register('licensePlate')}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-mono uppercase font-bold"
                />
                {errors.licensePlate && (
                  <p className="text-xs text-red-500 mt-1">{errors.licensePlate.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nama Driver
              </label>
              <input
                type="text"
                placeholder="Masukkan nama lengkap driver"
                {...register('driverName')}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-semibold"
              />
              {errors.driverName && (
                <p className="text-xs text-red-500 mt-1">{errors.driverName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Keterangan / Notes
              </label>
              <textarea
                rows={3}
                placeholder="Masukkan catatan tambahan (opsional)"
                {...register('notes')}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm"
              />
            </div>
          </div>

          {/* Upload Photo Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 pb-3 border-b border-slate-100 mb-4">
                Foto Bukti Kendaraan
              </h3>

              <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 transition flex flex-col items-center justify-center min-h-[160px] text-center bg-slate-50/50">
                {isUploading ? (
                  <div className="space-y-2 py-4">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
                    <p className="text-xs text-slate-500 font-semibold">Mengunggah file...</p>
                  </div>
                ) : uploadedUrl ? (
                  <div className="relative group w-full h-[150px] rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedUrl}
                      alt="Preview Kendaraan"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <label className="bg-white/95 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-white transition cursor-pointer">
                        Ganti Foto
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer space-y-2 py-4 w-full flex flex-col items-center">
                    <div className="h-10 w-10 bg-blue-50 border border-blue-100 text-blue-500 rounded-lg flex items-center justify-center">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Pilih Foto Kendaraan</p>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, atau JPEG maks 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {errors.vehiclePhotoPath && (
                <p className="text-xs text-red-500 mt-2 text-center">{errors.vehiclePhotoPath.message}</p>
              )}
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-500 leading-normal">
              ⚠️ <strong>Perhatian</strong>: Foto kendaraan harus memperlihatkan plat nomor dengan jelas sebagai bukti verifikasi logistik.
            </div>
          </div>
        </div>

        {/* Optional Products Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Daftar Barang Logistik</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Catat komoditas/produk yang dibawa oleh kendaraan jika ada.
              </p>
            </div>
            
            <label className="inline-flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasProducts}
                onChange={(e) => setHasProducts(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 cursor-pointer"
              />
              <span className="text-sm font-bold text-slate-700">Membawa Barang Logistik?</span>
            </label>
          </div>

          {hasProducts && (
            <div className="space-y-4">
               {productsLoading ? (
                <div className="text-center py-6 text-xs text-slate-400">Memuat data produk...</div>
              ) : productsError ? (
                <div className="text-center py-6 text-xs text-red-600 font-semibold">
                  ⚠️ Gagal memuat data produk: {productsError.response?.data?.message || productsError.message || 'Koneksi bermasalah'}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-6 text-xs text-amber-600 font-semibold">
                  ⚠️ Tidak ada produk terdaftar di sistem.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-4 items-start bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Pilih Produk
                          </label>
                          <select
                            {...register(`products.${index}.productId`, { valueAsNumber: true })}
                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="0">-- Pilih Produk --</option>
                            {products.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                [{p.sku}] {p.name} ({p.uom || 'Unit'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-32">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Jumlah (Qty)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Qty"
                            {...register(`products.${index}.quantity`, { valueAsNumber: true })}
                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-right"
                          />
                        </div>

                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="mt-6 p-2 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 transition cursor-pointer"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => append({ productId: 0, quantity: 1 })}
                    className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200/50 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Tambah Barang
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push('/dashboard/gate-operations')}
            disabled={isSubmitting}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer"
          >
            Batal
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition text-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Simpan Log Gerbang
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
