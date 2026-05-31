'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGateVerificationSchema } from '@bulog-wms/schema';
import { useGate, useGateOperationDetail, useAvailableReferences } from '@/hooks/useGate';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import {
  ShieldCheck,
  ArrowLeft,
  Calendar,
  User,
  Truck,
  Save,
  Loader2,
  FileText,
  Boxes,
  ExternalLink,
  Plus,
  Trash2,
  Info,
  Image as ImageIcon,
  Link2,
  Upload,
  X,
  XCircle,
  CheckCircle2,
  Clock,
  Search,
} from 'lucide-react';
import { AttachmentUploader } from '@/components/AttachmentUploader';
import { ProductSelector } from '@/components/ProductSelector';
import { ERPReferenceSelector } from '@/components/ERPReferenceSelector';

export default function GateVerificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItemToAssign, setSelectedItemToAssign] = useState<{
    gateItemId: number;
    productId: number;
    productName: string;
    qtyGate: number;
  } | null>(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const [isAddCargoOpen, setIsAddCargoOpen] = useState(false);

  const { gateOperation, isLoading: detailLoading, refresh: refreshDetail } = useGateOperationDetail(uuid);
  const { verifyGateOperation, cancelGateVerification, unassignReference, addCargoItem, deleteCargoItem } = useGate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'WAREHOUSE_ADMIN';

  const handleUnassignReference = async (referenceUuid: string, docNumber: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin melepas referensi ${docNumber} dari barang ini?`)) {
      return;
    }

    const toastId = toast.loading('Melepas referensi ERP...');
    try {
      await unassignReference(referenceUuid, uuid);
      toast.success(`Referensi ${docNumber} berhasil dilepas!`, { id: toastId });
      refreshDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal melepas referensi ERP.', { id: toastId });
    }
  };

  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending (0% assigned)
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-750 border border-blue-200">
            Partial Assigned
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
            Completed
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {statusValue}
          </span>
        );
    }
  };

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
      status: 'PENDING' as any,
      notes: '',
      attachmentPaths: [] as string[],
      products: [] as { productId: number; quantity: number }[],
      poReferences: [] as string[],
      soReferences: [] as string[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const poRefs = watch('poReferences') || [];
  const soRefs = watch('soReferences') || [];

  // Local state for adding/editing products step-by-step
  const [tempProduct, setTempProduct] = useState<{ id: number; name: string; sku: string; uom?: string } | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  const [productDetailsMap, setProductDetailsMap] = useState<Record<number, { name: string; sku: string; uom?: string }>>({});

  const handleAddItem = () => {
    if (!tempProduct) {
      toast.error('Silakan pilih produk terlebih dahulu.');
      return;
    }
    if (tempQuantity < 0 || isNaN(tempQuantity)) {
      toast.error('Jumlah kuantitas tidak boleh negatif.');
      return;
    }

    // Check if already added
    const isAlreadyAdded = fields.some((f) => f.productId === tempProduct.id);
    if (isAlreadyAdded) {
      toast.error('Produk tersebut sudah ada dalam daftar. Silakan ubah kuantitasnya langsung di tabel.');
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

  // Pre-populate products list and verification details when gateOperation is loaded
  useEffect(() => {
    if (gateOperation) {
      // Map products to verified quantities (sum of assignments), defaulting to 0
      const items = gateOperation.products?.map((gp: any) => {
        const vp = gateOperation.verification?.products?.find((p: any) => p.productId === gp.productId);
        return {
          productId: gp.productId,
          quantity: vp ? vp.quantity : 0,
        };
      }) || [];

      // Populate productDetailsMap cache
      const detailsCache: Record<number, any> = {};
      const sourceItems = gateOperation.products || [];
      sourceItems.forEach((item: any) => {
        if (item.product) {
          detailsCache[item.productId] = item.product;
        }
      });
      setProductDetailsMap(detailsCache);

      reset({
        status: gateOperation.verification?.status || gateOperation.status || 'PENDING',
        notes: gateOperation.verification?.notes || '',
        attachmentPaths: gateOperation.verification?.attachments?.map((a: any) => a.filePath) || [],
        products: items,
        poReferences: gateOperation.poReferences || [],
        soReferences: gateOperation.soReferences || [],
      });
    }
  }, [gateOperation, reset]);

  const onSubmit = async (data: any) => {
    // Validate products list
    if (data.products && data.products.length > 0) {
      const invalidProductId = data.products.some((p: any) => !p.productId || p.productId <= 0);
      if (invalidProductId) {
        toast.error('Silakan pilih produk yang valid untuk semua baris tambahan.');
        return;
      }

      const invalidProduct = data.products.some((p: any) => p.quantity < 0 || isNaN(p.quantity));
      if (invalidProduct) {
        toast.error('Jumlah kuantitas barang tidak boleh negatif atau kosong.');
        return;
      }
    }

    const cleanedProducts = (data.products || []).map((p: any) => ({
      productId: Number(p.productId),
      quantity: isNaN(Number(p.quantity)) || p.quantity === '' || p.quantity === null ? 0 : Number(p.quantity),
    }));

    const payload = {
      ...data,
      products: cleanedProducts,
    };

    setIsSubmitting(true);
    const toastId = toast.loading('Memproses verifikasi...');
    try {
      await verifyGateOperation(uuid, payload);
      toast.success(`Data gerbang berhasil diverifikasi.`, { id: toastId });
      router.push('/gate-verification');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memproses verifikasi.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelVerification = async () => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan verifikasi ini? Status akan diubah menjadi DIBATALKAN.')) {
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading('Membatalkan verifikasi...');
    try {
      await cancelGateVerification(uuid);
      toast.success('Verifikasi berhasil dibatalkan.', { id: toastId });
      router.push('/gate-verification');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan verifikasi.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCargo = async (cargoItemUuid: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus barang muatan ini dari verifikasi kendaraan?')) {
      return;
    }

    const toastId = toast.loading('Menghapus barang muatan...');
    try {
      await deleteCargoItem(cargoItemUuid, uuid);
      toast.success('Barang muatan berhasil dihapus!', { id: toastId });
      refreshDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus barang muatan.', { id: toastId });
    } finally {
      toast.dismiss(toastId);
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
          type="button"
          onClick={() => router.push('/gate-verification')}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => router.push('/gate-verification')}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
              <ShieldCheck className="h-6 w-6 text-blue-600 mr-2 shrink-0" />
              Verifikasi Kendaraan
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-slate-500 text-xs font-mono">
                {gateOperation.opNumber} | Driver: {gateOperation.driverName}
              </span>
              <span className="text-slate-300">|</span>
              {/* Linked References badge */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Referensi ERP:</span>
                {gateOperation.cardType === 'IN' ? (
                  <div className="flex flex-wrap gap-1">
                    {poRefs.length > 0 ? (
                      poRefs.map((ref: string) => (
                        <span key={ref} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-[10px] font-bold font-mono">
                          {ref}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-450 italic font-semibold">Tidak ada PO</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {soRefs.length > 0 ? (
                      soRefs.map((ref: string) => (
                        <span key={ref} className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-700 rounded text-[10px] font-bold font-mono">
                          {ref}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-450 italic font-semibold">Tidak ada SO</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {getStatusBadge(gateOperation.status || 'PENDING')}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Row 1: Bukti Foto Satpam & Laporan Satpam */}
        {/* Bukti Foto Satpam */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <ImageIcon className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Bukti Foto Satpam
          </h3>

          {gateOperation.attachments && gateOperation.attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {gateOperation.attachments.map((attach: any, idx: number) => (
                <div key={idx} className="space-y-2 group cursor-pointer" onClick={() => setSelectedZoomImage(attach.url)}>
                  <div className="w-full h-[150px] bg-slate-105 border border-slate-200 rounded-lg overflow-hidden relative group-hover:opacity-90 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attach.url}
                      alt={`Foto Bukti ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-[10px] text-center font-bold text-slate-500 hover:text-blue-600 transition flex items-center justify-center">
                    <span>Buka Preview {idx + 1}</span>
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[150px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
              <span className="text-xs">Tidak ada foto kendaraan terlampir.</span>
            </div>
          )}
        </div>

        {/* Laporan Satpam */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Laporan Satpam (Gate In/Out)
          </h3>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Tipe Gerbang</span>
                <span className="text-sm font-semibold text-slate-850 mt-1 block">
                  {gateOperation.cardType === 'IN' ? '📥 Masuk (Gate IN)' : '📤 Keluar (Gate OUT)'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Plat Nomor</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-1 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded-md inline-block">
                  {gateOperation.licensePlate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Driver</span>
                <span className="text-sm font-bold text-slate-850 mt-1 block flex items-center">
                  <User className="h-4 w-4 mr-1.5 text-slate-400 font-semibold" />
                  {gateOperation.driverName}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Tanggal Masuk</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 block flex items-center">
                  <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                  {new Date(gateOperation.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block">Keterangan Satpam</span>
              <p className="text-slate-650 bg-slate-50 border border-slate-150 rounded-lg p-3 mt-1.5 italic leading-normal text-xs font-medium">
                {gateOperation.notes || 'Tidak ada catatan.'}
              </p>
            </div>
          </div>
        </div>

        {/* Riwayat Progres & Status Verifikasi Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-4">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Riwayat Progres & Status Verifikasi
          </h3>

          <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
            {/* Step 1: Registration */}
            <div className="relative">
              <div className="absolute -left-[31px] top-1 bg-emerald-500 border-4 border-white h-4.5 w-4.5 rounded-full shadow-sm" />
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Langkah 1: Registrasi Gerbang</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">Registrasi Kendaraan Selesai</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                <span>Oleh: <strong className="text-slate-700">{gateOperation.createdByUser?.name || 'Satpam'}</strong></span>
                <span>Waktu: <strong className="text-slate-700">{new Date(gateOperation.createdAt).toLocaleString('id-ID')}</strong></span>
              </div>
              {gateOperation.notes && (
                <p className="text-xs text-slate-550 italic bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-1.5 max-w-xl">
                  Catatan: {gateOperation.notes}
                </p>
              )}
            </div>

            {/* Step 2: Verification Status */}
            <div className="relative">
              <div className={`absolute -left-[31px] top-1 border-4 border-white h-4.5 w-4.5 rounded-full shadow-sm ${
                gateOperation.verification 
                  ? (gateOperation.verification.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500') 
                  : 'bg-amber-450 animate-pulse'
              }`} />
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Langkah 2: Audit & Verifikasi Realisasi</div>
              {gateOperation.verification ? (
                <>
                  <div className="text-sm font-semibold text-slate-800 mt-1 flex items-center">
                    Status:&nbsp;{getStatusBadge(gateOperation.verification.status)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                    <span>Oleh: <strong className="text-slate-700">{gateOperation.verification.verifiedBy?.name || 'Verifier'}</strong></span>
                    <span>Waktu: <strong className="text-slate-700">{new Date(gateOperation.verification.verifiedAt).toLocaleString('id-ID')}</strong></span>
                  </div>
                  {gateOperation.verification.notes && (
                    <p className="text-xs text-slate-550 italic bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-1.5 max-w-xl">
                      Catatan: {gateOperation.verification.notes}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-slate-800 mt-1">Menunggu Verifikasi (Pending)</div>
                  <p className="text-xs text-slate-450 mt-1">
                    Kendaraan sedang mengantre untuk dilakukan pengecekan realisasi dokumen ERP oleh Auditor/Admin Gudang.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Barang Muatan */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 md:col-span-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <Boxes className="h-5 w-5 mr-2 text-indigo-500 shrink-0" />
              Barang Muatan
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAddCargoOpen(true)}
                className="inline-flex items-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm active:scale-[0.98] transition cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1.5 shrink-0" />
                Tambah Barang Muatan
              </button>
            )}
          </div>

          <div className="space-y-6">
            {/* List/Table of Products */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-55 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Nama Produk</th>
                    <th className="px-4 py-3 text-right">Qty Awal (Satpam)</th>
                    <th className="px-4 py-3 text-right">Qty Realisasi ERP</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 text-xs text-slate-750">
                  {fields.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                        Belum ada barang dalam daftar verifikasi.
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, index) => {
                      const productInfo = productDetailsMap[field.productId] || { name: 'Memuat...', sku: '...' };
                      const originalItem = gateOperation.products?.find((gp: any) => gp.productId === field.productId);
                      return (
                        <tr key={field.id} className="hover:bg-slate-50/30 transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{productInfo.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {productInfo.sku}</div>
                            
                            {/* Linked References list */}
                            {gateOperation.verification?.references
                              ?.filter((ref: any) => ref.gateItemId === originalItem?.id)
                              ?.map((ref: any) => (
                                <div key={ref.uuid} className="flex items-center space-x-2 mt-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg p-1.5 max-w-md">
                                  <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="font-semibold font-mono text-slate-700">{ref.erpDocument?.documentNumber}</span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-slate-600 font-bold">Qty: {ref.assignedQuantity} Unit</span>
                                  <span className="flex-grow" />
                                  <button
                                    type="button"
                                    onClick={() => handleUnassignReference(ref.uuid, ref.erpDocument?.documentNumber)}
                                    className="text-red-650 hover:text-red-750 font-bold text-[10px] uppercase hover:underline ml-2"
                                  >
                                    Lepas
                                  </button>
                                </div>
                              ))
                            }
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-500">
                            {originalItem ? `${originalItem.quantity.toLocaleString('id-ID')} ${originalItem.product?.uom || 'Unit'}` : '0 Unit'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5 font-extrabold text-blue-700 bg-blue-50/10 px-2.5 py-1 rounded-lg border border-blue-100/50 inline-flex">
                              <span>{field.quantity.toLocaleString('id-ID')}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{productInfo.uom || 'Unit'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedItemToAssign({
                                  gateItemId: originalItem?.id || 0,
                                  productId: field.productId,
                                  productName: productInfo.name,
                                  qtyGate: originalItem?.quantity || 0,
                                })}
                                className="inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                              >
                                <Link2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                Assign Reference
                              </button>
                              {isAdmin && originalItem && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCargo(originalItem.uuid)}
                                  className="inline-flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                                  title="Hapus Barang Muatan"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                  Hapus
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Row 3: Catatan Admin & Dokumen Pendukung */}
        {/* Catatan Admin */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-slate-400 shrink-0" />
            Catatan Verifikasi
          </h3>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Catatan Verifikasi / Keterangan Admin (Wajib)
            </label>
            <textarea
              rows={4}
              placeholder="Masukkan rincian hasil verifikasi fisik barang, plat nomor, driver, dan kesesuaian data..."
              {...register('notes')}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-medium"
            />
            {errors.notes && (
              <p className="text-xs text-red-500 mt-1 font-semibold">{errors.notes.message}</p>
            )}
          </div>
        </div>

        {/* Dokumen Pendukung */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <Upload className="h-5 w-5 mr-2 text-blue-550 shrink-0" />
            Dokumen Pendukung
          </h3>

          <Controller
            control={control}
            name="attachmentPaths"
            render={({ field }) => (
              <AttachmentUploader
                value={field.value || []}
                onChange={field.onChange}
                initialAttachments={gateOperation.verification?.attachments || []}
                label="Unggah Dokumen Pendukung / Surat Jalan (Multiple)"
              />
            )}
          />
        </div>

        {/* Footer Actions */}
        <div className="md:col-span-4 flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200 rounded-xl p-4 shadow-sm gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.push('/gate-verification')}
              disabled={isSubmitting}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer text-center"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleCancelVerification}
              disabled={isSubmitting}
              className="border border-red-250 hover:bg-red-50 text-red-650 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer text-center flex items-center justify-center"
            >
              <XCircle className="h-4.5 w-4.5 mr-1.5" />
              Batalkan Verifikasi
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-lg shadow-md hover:shadow-blue-500/10 active:scale-[0.98] transition text-sm cursor-pointer"
          >
            <Save className="h-4 w-4 mr-2" />
            Simpan Hasil Verifikasi
          </button>
        </div>
      </form>

      {/* Assign Reference Drawer */}
      {selectedItemToAssign && (
        <AssignReferenceDrawer
          isOpen={!!selectedItemToAssign}
          onClose={() => setSelectedItemToAssign(null)}
          operationUuid={uuid}
          gateItemId={selectedItemToAssign.gateItemId}
          productId={selectedItemToAssign.productId}
          productName={selectedItemToAssign.productName}
          qtyGate={selectedItemToAssign.qtyGate}
          onSaved={() => {
            refreshDetail();
          }}
        />
      )}

      {/* Add Cargo Item Modal */}
      <AddCargoItemModal
        isOpen={isAddCargoOpen}
        onClose={() => setIsAddCargoOpen(false)}
        operationUuid={uuid}
        onSaved={() => {
          refreshDetail();
        }}
      />

      {/* Zoom Modal Overlay */}
      {selectedZoomImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setSelectedZoomImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border border-white/10 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedZoomImage} 
              alt="Zoomed Preview" 
              className="max-w-full max-h-[80vh] object-contain"
            />
            <button 
              type="button"
              onClick={() => setSelectedZoomImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full border border-white/20 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Drawer Component at the bottom
function AssignReferenceDrawer({
  isOpen,
  onClose,
  operationUuid,
  gateItemId,
  productId,
  productName,
  qtyGate,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  operationUuid: string;
  gateItemId: number;
  productId: number;
  productName: string;
  qtyGate: number;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: references, isLoading } = useAvailableReferences(operationUuid, productId, gateItemId);
  const { assignReferences } = useGate();
  const [assignedQuantities, setAssignedQuantities] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (references) {
      const initial: Record<number, number> = {};
      references.forEach((ref) => {
        if (ref.currentAssignedQty > 0) {
          initial[ref.erpDocumentItemId] = ref.currentAssignedQty;
        }
      });
      setAssignedQuantities(initial);
    }
  }, [references]);

  if (!isOpen) return null;

  const handleQtyChange = (itemId: number, val: number, maxVal: number) => {
    const updated = { ...assignedQuantities };
    if (val <= 0 || isNaN(val)) {
      delete updated[itemId];
    } else {
      updated[itemId] = Math.min(val, maxVal);
    }
    setAssignedQuantities(updated);
  };

  const filteredReferences = references?.filter((ref) =>
    ref.documentNumber.toLowerCase().includes(search.toLowerCase()) ||
    ref.partnerName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalAssigned = Object.values(assignedQuantities).reduce((sum, val) => sum + val, 0);
  const isOverGateQty = totalAssigned > qtyGate;

  const handleSave = async () => {
    if (isOverGateQty) {
      toast.error(`Total assignment (${totalAssigned}) melebihi Qty Gate (${qtyGate}).`);
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Menyimpan assignment referensi ERP...');
    try {
      const assignmentsPayload = Object.entries(assignedQuantities).map(([itemIdStr, qty]) => ({
        erpDocumentItemId: Number(itemIdStr),
        assignedQuantity: qty,
      }));

      await assignReferences(operationUuid, {
        gateItemId,
        assignments: assignmentsPayload,
      });

      toast.success('Referensi ERP berhasil ditautkan!', { id: toastId });
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan assignment.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in-right">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">Assign Referensi ERP</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {productName} (Qty Gate: {qtyGate})
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Dokumen atau Partner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition font-medium"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
          ) : filteredReferences.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Tidak ada referensi dokumen ERP yang cocok atau tersedia.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReferences.map((ref) => {
                const maxAvailable = ref.remainingQty + ref.currentAssignedQty;
                const currentVal = assignedQuantities[ref.erpDocumentItemId] || '';
                return (
                  <div key={ref.erpDocumentItemId} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 hover:border-slate-300 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800 text-xs font-mono">{ref.documentNumber}</div>
                        <div className="text-[10px] text-slate-450 font-bold mt-0.5">Partner: {ref.partnerName}</div>
                        {ref.scheduledDate && (
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(ref.scheduledDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining</span>
                        <span className="text-xs font-black text-slate-600">{ref.remainingQty} Unit</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned Quantity:</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={maxAvailable}
                          placeholder="0"
                          value={currentVal}
                          onChange={(e) => handleQtyChange(ref.erpDocumentItemId, parseFloat(e.target.value), maxAvailable)}
                          className="w-20 bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-2 py-1 text-xs text-right font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition"
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase w-10 text-left">Unit</span>
                      </div>
                    </div>
                    {Number(currentVal) > maxAvailable && (
                      <p className="text-[10px] text-red-500 text-right font-semibold">
                        Maksimal kuantitas tersedia adalah {maxAvailable}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2 text-xs font-medium text-slate-650">
          <div className="flex justify-between">
            <span>Total Assigned:</span>
            <span className={`font-bold ${isOverGateQty ? 'text-red-650' : 'text-blue-700'}`}>
              {totalAssigned} / {qtyGate} Unit
            </span>
          </div>
          {isOverGateQty && (
            <p className="text-[10px] text-red-500 font-semibold text-right">
              Peringatan: Total assignment tidak boleh melebihi Qty Gate ({qtyGate})!
            </p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition disabled:opacity-40 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isOverGateQty}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md transition disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal component for adding new cargo item
function AddCargoItemModal({
  isOpen,
  onClose,
  operationUuid,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  operationUuid: string;
  onSaved: () => void;
}) {
  const { addCargoItem } = useGate();
  const [newCargoProduct, setNewCargoProduct] = useState<number>(0);
  const [newCargoProductObj, setNewCargoProductObj] = useState<any>(null);
  const [newCargoQty, setNewCargoQty] = useState<number>(1);
  const [newCargoNotes, setNewCargoNotes] = useState<string>('');
  const [isAddingCargo, setIsAddingCargo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewCargoProduct(0);
      setNewCargoProductObj(null);
      setNewCargoQty(1);
      setNewCargoNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newCargoProduct || newCargoProduct <= 0) {
      toast.error('Silakan pilih produk terlebih dahulu.');
      return;
    }
    if (newCargoQty <= 0 || isNaN(newCargoQty)) {
      toast.error('Kuantitas harus lebih besar dari 0.');
      return;
    }

    setIsAddingCargo(true);
    const toastId = toast.loading('Menambahkan barang muatan...');
    try {
      await addCargoItem(operationUuid, {
        productId: newCargoProduct,
        quantity: newCargoQty,
        notes: newCargoNotes || undefined,
      });
      toast.success('Barang muatan berhasil ditambahkan!');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan barang muatan.');
    } finally {
      setIsAddingCargo(false);
      toast.dismiss(toastId);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl flex flex-col z-10 animate-scale-in overflow-hidden border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">Tambah Barang Muatan</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Tambahkan barang muatan baru ke kendaraan ini.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs font-medium text-slate-700">
          {/* Product Select */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Produk / Barang <span className="text-red-500">*</span>
            </label>
            <ProductSelector 
              value={newCargoProduct} 
              onChange={(val, prod) => { 
                setNewCargoProduct(val); 
                setNewCargoProductObj(prod); 
              }} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="0"
                value={newCargoQty === 0 ? '' : newCargoQty}
                onChange={(e) => setNewCargoQty(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* UOM */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Unit of Measure (UOM)
              </label>
              <input
                type="text"
                disabled
                value={newCargoProductObj?.uom || 'Unit'}
                className="w-full bg-slate-100 border border-slate-200 text-slate-550 rounded-lg px-3 py-2 text-xs font-bold cursor-not-allowed"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Keterangan (Opsional)
            </label>
            <textarea
              rows={3}
              placeholder="Masukkan keterangan tambahan jika diperlukan..."
              value={newCargoNotes}
              onChange={(e) => setNewCargoNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-xs font-medium"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isAddingCargo}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition disabled:opacity-40 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isAddingCargo}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md transition disabled:opacity-40 cursor-pointer"
          >
            {isAddingCargo ? 'Menyimpan...' : 'Simpan Barang'}
          </button>
        </div>
      </div>
    </div>
  );
}
