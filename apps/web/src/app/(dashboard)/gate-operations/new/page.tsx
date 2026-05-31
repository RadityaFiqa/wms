'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGateOperationSchema } from '@bulog-wms/schema';
import { useGate } from '@/hooks/useGate';
import { toast } from 'sonner';
import {
  Truck,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Boxes,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AttachmentUploader } from '@/components/AttachmentUploader';
import { ProductSelector } from '@/components/ProductSelector';

export default function CreateGateOperationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Products section collapsible state (default collapsed/closed)
  const [isProductsExpanded, setIsProductsExpanded] = useState(false);

  const { createGateOperation } = useGate();

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
      attachmentPaths: [] as string[],
      products: [] as { productId: number; quantity: number }[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const watchCardType = watch('cardType');
  const watchAttachmentPaths = watch('attachmentPaths');

  // Local state for adding products step-by-step
  const [tempProduct, setTempProduct] = useState<{ id: number; name: string; sku: string; uom?: string } | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  const [productDetailsMap, setProductDetailsMap] = useState<Record<number, { name: string; sku: string; uom?: string }>>({});

  const handleAddItem = () => {
    if (!tempProduct) {
      toast.error('Silakan pilih produk terlebih dahulu.');
      return;
    }
    if (tempQuantity <= 0 || isNaN(tempQuantity)) {
      toast.error('Jumlah kuantitas harus lebih besar dari 0.');
      return;
    }
    
    // Check if already added
    const isAlreadyAdded = fields.some((f) => f.productId === tempProduct.id);
    if (isAlreadyAdded) {
      toast.error('Produk tersebut sudah ada dalam daftar. Silakan hapus produk yang sudah ada jika ingin mengganti kuantitasnya.');
      return;
    }

    append({ productId: tempProduct.id, quantity: tempQuantity });
    setProductDetailsMap((prev) => ({
      ...prev,
      [tempProduct.id]: tempProduct,
    }));

    setTempProduct(null);
    setTempQuantity(1);
    toast.success('Barang ditambahkan ke daftar.');
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const toastId = toast.loading('Menyimpan data gerbang...');
    try {
      // Clean products if toggle/section is not expanded
      const payload = {
        ...data,
        products: isProductsExpanded ? data.products.filter((p: any) => p.productId > 0) : [],
      };
      await createGateOperation(payload);
      toast.success('Data kendaraan masuk/keluar berhasil dicatat.', { id: toastId });
      router.push('/gate-operations');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => router.push('/gate-operations')}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
            <Truck className="h-6 w-6 text-blue-606 mr-2 shrink-0" />
            Catat Operasi Gerbang
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Form pencatatan log masuk dan keluar gerbang kendaraan WMS.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Multiple Attachments Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between md:col-span-1">
            <Controller
              control={control}
              name="attachmentPaths"
              render={({ field }) => (
                <AttachmentUploader
                  value={field.value || []}
                  onChange={field.onChange}
                  label="Foto Bukti Kendaraan (Multiple)"
                />
              )}
            />

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-500 leading-normal">
              ⚠️ <strong>Perhatian</strong>: Pastikan Anda mengambil foto plat nomor dan kondisi muatan kendaraan dengan jelas sebagai bukti validasi audit logistik.
            </div>
          </div>
          {/* Main Info Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm md:col-span-1 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 pb-3 border-b border-slate-100">
              Informasi Kendaraan & Driver
            </h3>

            {/* Card Type Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Tipe Gerbang (Card Type)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setValue('cardType', 'IN')}
                  className={`p-4 border-2 rounded-xl text-center flex flex-col items-center justify-center transition cursor-pointer ${
                    watchCardType === 'IN'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-2xl mb-1">📥</span>
                  <span className="text-sm font-bold">Gate IN (Masuk)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValue('cardType', 'OUT')}
                  className={`p-4 border-2 rounded-xl text-center flex flex-col items-center justify-center transition cursor-pointer ${
                    watchCardType === 'OUT'
                      ? 'border-purple-500 bg-purple-50/50 text-purple-700 font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-2xl mb-1">📤</span>
                  <span className="text-sm font-bold">Gate OUT (Keluar)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Plat Nomor Kendaraan (Wajib)
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

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nama Driver (Wajib)
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
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Keterangan / Notes (Wajib)
              </label>
              <textarea
                rows={3}
                placeholder="Masukkan keterangan logistik, alasan masuk, atau rincian muatan..."
                {...register('notes')}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-medium"
              />
              {errors.notes && (
                <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Commodities Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <button
            type="button"
            onClick={() => setIsProductsExpanded(!isProductsExpanded)}
            className="w-full flex items-center justify-between border-b border-slate-100 pb-4 text-left cursor-pointer"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Boxes className="h-5 w-5 mr-2 text-blue-600" />
                Daftar Barang
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Catat barang/komoditas yang dibawa oleh kendaraan.
              </p>
            </div>
            
            <div className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition">
              <span className="text-xs font-semibold">
                {isProductsExpanded ? 'Sembunyikan' : 'Tampilkan & Input Barang'}
              </span>
              {isProductsExpanded ? (
                <ChevronUp className="h-5 w-5 shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0" />
              )}
            </div>
          </button>

          {isProductsExpanded && (
            <div className="space-y-6 animate-fade-in">
              {/* Product Add Selector Input Area */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tambah Barang Baru</h4>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Pilih Produk
                    </label>
                    <ProductSelector
                      value={tempProduct?.id || 0}
                      onChange={(id, productData) => {
                        if (productData) {
                          setTempProduct({
                            id: productData.id,
                            name: productData.name,
                            sku: productData.sku,
                            uom: productData.uom,
                          });
                        } else {
                          setTempProduct(null);
                        }
                      }}
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Jumlah (Qty)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-right font-bold"
                      placeholder="Kuantitas"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-550 text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center justify-center shrink-0 h-[38px] cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Tambah
                  </button>
                </div>
              </div>

              {/* Already Added Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Nama Produk</th>
                      <th className="px-4 py-3 text-right">Kuantitas</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {fields.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">
                          Belum ada barang yang ditambahkan. Silakan pilih dan tambah barang di atas.
                        </td>
                      </tr>
                    ) : (
                      fields.map((field, index) => {
                        const productInfo = productDetailsMap[field.productId] || { name: 'Memuat...', sku: '...' };
                        return (
                          <tr key={field.id} className="hover:bg-slate-50/30 transition">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800">{productInfo.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {productInfo.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                              {field.quantity} {productInfo.uom || 'Unit'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 transition cursor-pointer"
                                title="Hapus Barang"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push('/gate-operations')}
            disabled={isSubmitting}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer"
          >
            Batal
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
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
