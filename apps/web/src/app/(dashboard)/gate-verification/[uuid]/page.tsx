"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateGateVerificationSchema } from "@bulog-wms/schema";
import {
  useGate,
  useGateOperationDetail,
  useGateVerificationHistory,
} from "@/hooks/useGate";
import { useAuthStore } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
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
  Clock,
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
  Search,
  Edit,
} from "lucide-react";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { AddCargoItemDrawer } from "@/components/AddCargoItemDrawer";

import { DocumentReferenceSelector } from "@/components/DocumentReferenceSelector";
import { DocumentReferenceHistoryDrawer } from "@/components/DocumentReferenceHistoryDrawer";

const getProductDetails = (item: any) => {
  if (!item) return { sku: "-", name: "-", uom: "-" };

  const sku = item.sku || item.inventory?.sku || item.product?.sku;
  const name = item.name || item.inventory?.name || item.product?.name;
  const uom = item.uom || item.inventory?.uom || item.product?.uom;

  if (!sku || !name || !uom) {
    console.warn(
      "Warning: Product details mapping failed or incomplete for item:",
      item,
    );
  }

  return {
    sku: sku || "-",
    name: name || "-",
    uom: uom || "-",
  };
};

export default function GateVerificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotesDocsSubmitting, setIsNotesDocsSubmitting] = useState(false);

  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(
    null,
  );
  const [isAddCargoOpen, setIsAddCargoOpen] = useState(false);
  const [editingCargoItem, setEditingCargoItem] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const {
    gateOperation,
    isLoading: detailLoading,
    refresh: refreshDetail,
  } = useGateOperationDetail(uuid);
  const {
    verifyGateOperation,
    cancelGateVerification,
    confirmGateVerification,
    updateNotesAttachments,
    addCargoItem,
    deleteCargoItem,
    updateCargoItem,
  } = useGate();
  const { user } = useAuthStore();
  const isAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "WAREHOUSE_ADMIN";
  const isReadOnly =
    gateOperation?.status === "VERIFIED" ||
    gateOperation?.status === "CANCELED";
  const isNotesDocsReadOnly = isReadOnly;

  // 1. Verification history timeline hook
  const { data: timelineHistory, refresh: refreshTimeline } = useGateVerificationHistory(uuid);

  // Redirect to gate operation details if already verified/canceled
  useEffect(() => {
    if (gateOperation && (gateOperation.status === "VERIFIED" || gateOperation.status === "CANCELED")) {
      router.replace(`/gate-operations/${uuid}`);
    }
  }, [gateOperation, uuid, router]);

  // Unique references computed from gateOperation.references list
  const uniqueReferences = React.useMemo(() => {
    if (!gateOperation?.references) return [];
    const docs = gateOperation.references.map((r: any) => r.erpDocument?.documentNumber).filter(Boolean);
    return Array.from(new Set(docs)) as string[];
  }, [gateOperation]);

  // 2. Memos for confirmation validation
  const isConfirmEnabled = React.useMemo(() => {
    if (!gateOperation) return false;

    // Document reference must be selected
    if (!gateOperation.documentReferenceId) return false;

    // All cargo items must have location and stack selected
    const hasMissingLocationOrStack = gateOperation.products?.some(
      (p: any) => !p.locationId || !p.quantId
    );
    if (hasMissingLocationOrStack) return false;

    return true;
  }, [gateOperation]);


  const confirmationRequirements = React.useMemo(() => {
    if (!gateOperation) return [];
    const reqs = [];

    if (!gateOperation.documentReferenceId) {
      reqs.push("Dokumen referensi ERP harus dipilih.");
    }

    const hasMissingLocationOrStack = gateOperation.products?.some(
      (p: any) => !p.locationId || !p.quantId
    );
    if (hasMissingLocationOrStack) {
      reqs.push("Semua barang muatan harus memiliki lokasi dan tumpukan (stack) yang dipilih.");
    }

    return reqs;
  }, [gateOperation]);


  const handleConfirmVerification = async () => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin mengonfirmasi verifikasi ini? Gate verifikasi tidak dapat diubah lagi setelah ini.",
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Mengonfirmasi verifikasi...");
    try {
      await confirmGateVerification(uuid);
      toast.success(
        "Verifikasi berhasil dikonfirmasi!",
        { id: toastId },
      );
      refreshDetail();
      refreshTimeline();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal mengonfirmasi verifikasi.",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case "PENDING":
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case "VERIFIED":
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
            Verified
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Rejected
          </span>
        );
      case "CANCELED":
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
    getValues,
    formState: { errors, isDirty },
    watch,
  } = useForm({
    resolver: zodResolver(CreateGateVerificationSchema),
    defaultValues: {
      status: "PENDING" as any,
      notes: "",
      attachmentPaths: [] as string[],
      products: [] as {
        productId: number;
        quantity: number;
        quantId?: number | null;
        locationId?: number | null;
      }[],
      documentReferenceId: null as number | null,
    },
  });

  // Intercept window close / reload if form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // Intercept browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (isDirty) {
        const confirmLeave = window.confirm(
          "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?"
        );
        if (!confirmLeave) {
          window.history.pushState(null, "", window.location.pathname);
        }
      }
    };
    
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "products",
  });



  // Local state for adding/editing products step-by-step
  const [tempProduct, setTempProduct] = useState<{
    id: number;
    name: string;
    sku: string;
    uom?: string;
  } | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  const [productDetailsMap, setProductDetailsMap] = useState<
    Record<number, { name: string; sku: string; uom?: string }>
  >({});

  const handleAddItem = () => {
    if (!tempProduct) {
      toast.error("Silakan pilih produk terlebih dahulu.");
      return;
    }
    if (tempQuantity < 0 || isNaN(tempQuantity)) {
      toast.error("Jumlah kuantitas tidak boleh negatif.");
      return;
    }

    // Check if already added
    const isAlreadyAdded = fields.some((f) => f.productId === tempProduct.id);
    if (isAlreadyAdded) {
      toast.error(
        "Produk tersebut sudah ada dalam daftar. Silakan ubah kuantitasnya langsung di tabel.",
      );
      return;
    }

    append({ productId: tempProduct.id, quantity: tempQuantity });
    setProductDetailsMap((prev) => ({
      ...prev,
      [tempProduct.id]: tempProduct,
    }));

    setTempProduct(null);
    setTempQuantity(1);
    toast.success("Barang ditambahkan ke daftar.");
  };

  // Pre-populate products list and verification details when gateOperation is loaded
  useEffect(() => {
    if (gateOperation) {
      // Map products directly since there is no separate verification table anymore
      const items =
        gateOperation.products?.map((gp: any) => ({
          productId: gp.productId,
          quantity: gp.quantity,
          quantId: gp.quantId || null,
          locationId: gp.locationId || null,
        })) || [];

      // Populate productDetailsMap cache
      const detailsCache: Record<number, any> = {};
      const sourceItems = gateOperation.products || [];
      sourceItems.forEach((item: any) => {
        const prod = item.product || item.inventory || item;
        if (prod) {
          detailsCache[item.productId] = prod;
        }
      });
      setProductDetailsMap(detailsCache);

      reset({
        status: gateOperation.status || "PENDING",
        notes: gateOperation.verificationNotes || "",
        attachmentPaths:
          gateOperation.attachments?.map(
            (a: any) => a.filePath,
          ) || [],
        products: items,
        documentReferenceId: gateOperation.documentReferenceId || null,
      });
    }
  }, [gateOperation, reset]);

  const handleSaveNotesAttachments = async () => {
    const values = getValues();
    const notesValue = values.notes;
    const attachmentPathsValue = values.attachmentPaths;

    setIsNotesDocsSubmitting(true);
    const toastId = toast.loading("Menyimpan catatan & dokumen pendukung...");
    try {
      await updateNotesAttachments(uuid, {
        notes: notesValue ?? undefined,
        attachmentPaths: attachmentPathsValue,
      });
      toast.success("Catatan & dokumen pendukung berhasil disimpan.", { id: toastId });
      
      // Reset react-hook-form defaultValues for these fields to clear isDirty warning
      reset({
        ...values,
        notes: notesValue,
        attachmentPaths: attachmentPathsValue,
      });

      refreshDetail();
      refreshTimeline();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal menyimpan catatan & dokumen.",
        { id: toastId },
      );
    } finally {
      setIsNotesDocsSubmitting(false);
    }
  };

  const onSubmit = async (data: any) => {
    // Validate products list
    if (data.products && data.products.length > 0) {
      const invalidProductId = data.products.some(
        (p: any) => !p.productId || p.productId <= 0,
      );
      if (invalidProductId) {
        toast.error(
          "Silakan pilih produk yang valid untuk semua baris tambahan.",
        );
        return;
      }

      const invalidProduct = data.products.some(
        (p: any) => p.quantity < 0 || isNaN(p.quantity),
      );
      if (invalidProduct) {
        toast.error("Jumlah kuantitas barang tidak boleh negatif atau kosong.");
        return;
      }
    }

    const cleanedProducts = (data.products || []).map((p: any) => {
      const originalItem = gateOperation.products?.find(
        (gp: any) =>
          gp.productId === p.productId &&
          (gp.quantId || null) === (p.quantId || null) &&
          (gp.locationId || null) === (p.locationId || null),
      );
      return {
        productId: Number(p.productId),
        quantity: originalItem ? Number(originalItem.quantity) : 0,
        quantId: p.quantId || null,
        locationId: p.locationId || null,
      };
    });

    const payload = {
      ...data,
      products: cleanedProducts,
    };

    setIsSubmitting(true);
    const toastId = toast.loading("Memproses verifikasi...");
    try {
      await verifyGateOperation(uuid, payload);
      toast.success(`Data gerbang berhasil disimpan.`, { id: toastId });
      reset(data);
      refreshDetail();
      refreshTimeline();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal memproses verifikasi.",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelVerification = async () => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin membatalkan verifikasi ini? Status akan diubah menjadi DIBATALKAN.",
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Membatalkan verifikasi...");
    try {
      await cancelGateVerification(uuid);
      toast.success("Verifikasi berhasil dibatalkan.", { id: toastId });
      router.push("/gate-verification");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal membatalkan verifikasi.",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCargo = async (cargoItemUuid: string) => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menghapus barang muatan ini dari verifikasi kendaraan?",
      )
    ) {
      return;
    }

    const toastId = toast.loading("Menghapus barang muatan...");
    try {
      await deleteCargoItem(cargoItemUuid, uuid);
      toast.success("Barang muatan berhasil dihapus!", { id: toastId });
      refreshDetail();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal menghapus barang muatan.",
        { id: toastId },
      );
    } finally {
      toast.dismiss(toastId);
    }
  };

  if (detailLoading) {
    return (
      <div className="flex justify-center items-center py-24">
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
    );
  }

  if (!gateOperation) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4 max-w-lg mx-auto">
        <Info className="h-12 w-12 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">
          Data Tidak Ditemukan
        </h3>
        <p className="text-sm text-slate-500">
          Data gate operation tidak ditemukan atau sudah diverifikasi.
        </p>
        <button
          type="button"
          onClick={() => router.push("/gate-verification")}
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
            onClick={() => router.push("/gate-verification")}
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
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {getStatusBadge(gateOperation.status || "PENDING")}
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start"
      >
        {/* Row 1: Bukti Foto Satpam & Laporan Satpam */}
        {/* Bukti Foto Satpam */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <ImageIcon className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Bukti Foto
          </h3>

          {gateOperation.attachments && gateOperation.attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {gateOperation.attachments.map((attach: any, idx: number) => (
                <div
                  key={idx}
                  className="space-y-2 group cursor-pointer"
                  onClick={() => setSelectedZoomImage(attach.url)}
                >
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
              <span className="text-xs">
                Tidak ada foto kendaraan terlampir.
              </span>
            </div>
          )}
        </div>

        {/* Laporan Satpam */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Laporan (Gate In/Out)
          </h3>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  Tipe Gerbang
                </span>
                <span className="text-sm font-semibold text-slate-850 mt-1 block">
                  {gateOperation.cardType === "IN"
                    ? "📥 Masuk (Gate IN)"
                    : "📤 Keluar (Gate OUT)"}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  Plat Nomor
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-1 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded-md inline-block">
                  {gateOperation.licensePlate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  Driver
                </span>
                <span className="text-sm font-bold text-slate-850 mt-1 block flex items-center">
                  <User className="h-4 w-4 mr-1.5 text-slate-400 font-semibold" />
                  {gateOperation.driverName}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  No. Telp Driver
                </span>
                <span className="text-sm font-semibold text-slate-700 mt-1 block">
                  {gateOperation.driverPhone || "-"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  Client Partner
                </span>
                <span className="text-sm font-bold text-slate-850 mt-1 block">
                  {gateOperation.clientPartner ||
                    gateOperation.documentReference?.partnerName ||
                    "-"}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  Tanggal Masuk
                </span>
                <span className="text-sm font-semibold text-slate-700 mt-1 block flex items-center">
                  <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                  {new Date(gateOperation.createdAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Dokumen Referensi ERP (Editable)
              </label>
              <Controller
                control={control}
                name="documentReferenceId"
                render={({ field }) => (
                  <DocumentReferenceSelector
                    value={field.value ?? null}
                    cardType={gateOperation.cardType as "IN" | "OUT"}
                    gateOperationUuid={gateOperation.uuid}
                    onChange={async (docRef: any) => {
                      const newId = docRef ? docRef.id : null;
                      field.onChange(newId);

                      const toastId = toast.loading(
                        "Mengubah dokumen referensi ERP...",
                      );
                      try {
                        await verifyGateOperation(uuid, {
                          status: watch("status"),
                          notes: watch("notes"),
                          documentReferenceId: newId,
                        });
                        toast.success(
                          "Dokumen referensi ERP berhasil diubah.",
                          { id: toastId },
                        );
                        refreshDetail();
                        refreshTimeline();
                      } catch (err: any) {
                        toast.error(
                          err.response?.data?.message ||
                            "Gagal mengubah dokumen referensi.",
                          { id: toastId },
                        );
                      }
                    }}
                    disabled={isReadOnly}
                  />
                )}
              />
              {gateOperation.documentReference && (
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="text-blue-600 hover:text-blue-750 font-bold text-xs mt-2 flex items-center hover:underline cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Lihat Riwayat Dokumen
                </button>
              )}
            </div>

            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block">
                Keterangan Reporter
              </span>
              <p className="text-slate-650 bg-slate-50 border border-slate-150 rounded-lg p-3 mt-1.5 italic leading-normal text-xs font-medium">
                {gateOperation.notes || "Tidak ada catatan."}
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
            {timelineHistory && timelineHistory.length > 0 ? (
              timelineHistory.map((log: any) => {
                const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString("id-ID") : "-";
                const actorName = log.actor?.name || "System";
                
                let title = log.action;
                let description = "";
                let colorClass = "bg-blue-500";
                
                switch (log.action) {
                  case 'GATE_OPERATION_CREATE':
                    title = "Registrasi Kendaraan (Gate IN/OUT)";
                    colorClass = "bg-emerald-500";
                    description = `Mencatat kendaraan ${log.details?.licensePlate || ""} dengan driver ${log.details?.driverName || ""}. ${log.details?.notes ? `Catatan: "${log.details.notes}"` : ""}`;
                    break;
                  case 'GATE_OPERATION_VERIFY':
                    title = "Simpan Hasil Verifikasi";
                    colorClass = "bg-blue-500";
                    description = `Menyimpan data verifikasi. ${log.details?.notes ? `Catatan: "${log.details.notes}"` : ""}`;
                    break;
                  case 'GATE_OPERATION_NOTES_ATTACHMENTS_UPDATE':
                    title = "Simpan Catatan & Dokumen";
                    colorClass = "bg-indigo-500";
                    description = `Memperbarui catatan verifikasi & dokumen pendukung. ${log.details?.notes ? `Catatan: "${log.details.notes}"` : ""}`;
                    break;
                  case 'GATE_OPERATION_CANCEL':
                    title = "Verifikasi Dibatalkan";
                    colorClass = "bg-red-500";
                    description = `Verifikasi dibatalkan oleh auditor.`;
                    break;
                  case 'GATE_OPERATION_CONFIRM':
                    title = "Verifikasi Dikonfirmasi (CONFIRM)";
                    colorClass = "bg-emerald-600";
                    description = `Verifikasi telah selesai dikonfirmasi..`;
                    break;
                  case 'GATE_OPERATION_ASSIGN_REFERENCES':
                    title = "Tautkan Referensi ERP";
                    colorClass = "bg-indigo-500";
                    const assignList = log.details?.assignments?.map((a: any) => `item ERP #${a.erpDocumentItemId} (${a.assignedQuantity} Unit)`).join(", ");
                    description = `Menautkan referensi dokumen ERP ke barang muatan: ${assignList || ""}`;
                    break;
                  case 'GATE_OPERATION_UNASSIGN_REFERENCE':
                    title = "Lepas Referensi ERP";
                    colorClass = "bg-amber-500";
                    description = `Melepas referensi ERP ${log.details?.previousReference || ""} dari barang muatan.`;
                    break;
                  case 'GATE_OPERATION_CARGO_ADD':
                    title = "Tambah Barang Muatan";
                    colorClass = "bg-purple-500";
                    description = `Menambahkan barang muatan baru. Qty: ${log.details?.quantity || 0}`;
                    break;
                  case 'GATE_OPERATION_CARGO_UPDATE':
                    title = "Ubah Barang Muatan";
                    colorClass = "bg-sky-500";
                    description = `Mengubah informasi barang muatan. Qty Baru: ${log.details?.quantity || 0}`;
                    break;
                  case 'GATE_OPERATION_CARGO_DELETE':
                    title = "Hapus Barang Muatan";
                    colorClass = "bg-rose-500";
                    description = `Menghapus barang muatan dari daftar verifikasi.`;
                    break;
                }

                return (
                  <div key={log.uuid} className="relative animate-fade-in">
                    <div className={`absolute -left-[31px] top-1 border-4 border-white h-4.5 w-4.5 rounded-full shadow-sm ${colorClass}`} />
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {title}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">
                      {description}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                      <span>Oleh: <strong className="text-slate-700">{actorName}</strong></span>
                      <span>Waktu: <strong className="text-slate-700">{dateStr}</strong></span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 italic py-2">Memuat riwayat verifikasi...</p>
            )}
          </div>
        </div>

        {/* Row 2: Barang Muatan */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 md:col-span-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <Boxes className="h-5 w-5 mr-2 text-indigo-500 shrink-0" />
              Barang Muatan
            </h3>
            {isAdmin && !isReadOnly && (
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
                    <th className="px-4 py-3 text-right">Cargo Qty</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 text-xs text-slate-750">
                  {fields.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-400 italic"
                      >
                        Belum ada barang dalam daftar verifikasi.
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, index) => {
                      const fQuantId = (field as any).quantId || null;
                      const fLocId = (field as any).locationId || null;

                      const productInfo = productDetailsMap[field.productId];
                      const productDetails = getProductDetails(productInfo);

                      const originalItem = gateOperation.products?.find(
                        (gp: any) =>
                          gp.productId === field.productId &&
                          (gp.quantId || null) === fQuantId &&
                          (gp.locationId || null) === fLocId,
                      );
                      const originalDetails = getProductDetails(originalItem);
                      const docItem = gateOperation.documentReference?.items?.find(
                        (di: any) => di.inventoryId === field.productId,
                      );
                      const erpQty = docItem ? (docItem.productQty || docItem.quantity) : 0;
                      const locLabel =
                        originalItem?.location?.displayName || null;
                      const quantLabel = originalItem?.quant?.lotName || null;
                      return (
                        <tr
                          key={field.id}
                          className="hover:bg-slate-50/30 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {productDetails.name}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center mt-1">
                              <span className="text-[10px] text-slate-400 font-mono">
                                SKU: {productDetails.sku}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                UOM: {productDetails.uom}
                              </span>
                              {locLabel && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                  📍 {locLabel}
                                </span>
                              )}
                              {quantLabel && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                  📦 Tumpukan: {quantLabel}
                                </span>
                              )}
                              {originalItem && !isReadOnly && (!locLabel || !quantLabel) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  ⚠️ Pilih Lokasi & Tumpukan
                                </span>
                              )}
                            </div>


                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5 font-extrabold text-blue-700 bg-blue-50/10 px-2.5 py-1 rounded-lg border border-blue-100/50 inline-flex">
                              <span>
                                {originalItem
                                  ? originalItem.quantity.toLocaleString("id-ID")
                                  : "0"}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {productDetails.uom}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isReadOnly && originalItem && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCargoItem(originalItem);
                                    setIsAddCargoOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                                  title="Edit Barang Muatan"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                  Edit
                                </button>
                              )}
                              {isAdmin && !isReadOnly && originalItem && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteCargo(originalItem.uuid)
                                  }
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
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Catatan Admin */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-slate-400 shrink-0" />
                Catatan Verifikasi
              </h3>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Catatan Verifikasi / Keterangan Admin (Opsional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Masukkan rincian hasil verifikasi fisik barang, plat nomor, driver, dan kesesuaian data..."
                  {...register("notes")}
                  disabled={isNotesDocsReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-550 transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {errors.notes && (
                  <p className="text-xs text-red-500 mt-1 font-semibold">
                    {errors.notes.message}
                  </p>
                )}
              </div>
            </div>

            {/* Dokumen Pendukung */}
            <div className="space-y-4">
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
                    initialAttachments={
                      gateOperation.attachments || []
                    }
                    label="Unggah Dokumen Pendukung / Surat Jalan (Multiple)"
                    disabled={isNotesDocsReadOnly}
                  />
                )}
              />
            </div>
          </div>

          {/* Action button for Notes and Documents */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveNotesAttachments}
              disabled={isNotesDocsSubmitting || isNotesDocsReadOnly}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-lg shadow-md active:scale-[0.98] transition text-sm cursor-pointer animate-fade-in"
            >
              {isNotesDocsSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Catatan & Dokumen
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          {confirmationRequirements.length > 0 && !isReadOnly && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-2 shadow-xs">
              <div className="font-extrabold flex items-center text-amber-900">
                <Info className="h-4 w-4 mr-2 text-amber-600 shrink-0" />
                Persyaratan Konfirmasi (CONFIRM) Belum Terpenuhi:
              </div>
              <ul className="list-disc pl-5 space-y-1 font-semibold text-amber-800/90">
                {confirmationRequirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.push("/gate-verification")}
                disabled={isSubmitting}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer text-center"
              >
                Kembali
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleCancelVerification}
                  disabled={isSubmitting}
                  className="border border-red-600 hover:bg-red-50 text-red-600 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-40 cursor-pointer text-center flex items-center justify-center active:scale-[0.98]"
                >
                  <XCircle className="h-4.5 w-4.5 mr-1.5" />
                  Batalkan Verifikasi
                </button>
              )}
            </div>

            {!isReadOnly && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleConfirmVerification}
                  disabled={isSubmitting || !isConfirmEnabled}
                  title={confirmationRequirements.join("\n")}
                  className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] transition text-sm cursor-pointer"
                >
                  <ShieldCheck className="h-4.5 w-4.5 mr-1.5" />
                  Konfirmasi (CONFIRM)
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Document History Drawer */}
      <DocumentReferenceHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        docRefUuid={gateOperation.documentReference?.uuid}
        documentNumber={gateOperation.documentReference?.documentNumber}
        preloadedHistory={gateOperation.documentHistory}
      />


      {/* Add Cargo Item Drawer */}
      <AddCargoItemDrawer
        isOpen={isAddCargoOpen}
        onClose={() => {
          setIsAddCargoOpen(false);
          setEditingCargoItem(null);
        }}
        cardType={gateOperation?.cardType || "IN"}
        editData={
          editingCargoItem
            ? {
                productId: editingCargoItem.productId,
                quantity: editingCargoItem.quantity,
                locationId: editingCargoItem.locationId,
                quantId: editingCargoItem.quantId,
                name: getProductDetails(editingCargoItem).name,
                sku: getProductDetails(editingCargoItem).sku,
                uom: getProductDetails(editingCargoItem).uom,
                uuid:
                  editingCargoItem.product?.uuid ||
                  editingCargoItem.inventory?.uuid,
              }
            : null
        }
        documentReferenceItems={gateOperation?.documentHistory?.summary || undefined}
        onAdd={async (data) => {
          if (editingCargoItem) {
            const toastId = toast.loading(
              "Mengubah lokasi & tumpukan barang...",
            );
            try {
              await updateCargoItem(editingCargoItem.uuid, uuid, {
                quantId: data.quantId,
                locationId: data.locationId,
                quantity: data.quantity,
              });
              toast.success("Pilihan lokasi & tumpukan berhasil disimpan!", {
                id: toastId,
              });
              refreshDetail();
              refreshTimeline();
            } catch (err: any) {
              toast.error(
                err.response?.data?.message ||
                  "Gagal mengubah lokasi & tumpukan.",
                { id: toastId },
              );
              throw err;
            }
          } else {
            const toastId = toast.loading("Menambahkan barang muatan...");
            try {
              await addCargoItem(uuid, {
                productId: data.productId,
                quantity: data.quantity,
                quantId: data.quantId,
                locationId: data.locationId,
              });
              toast.success("Barang muatan berhasil ditambahkan!", {
                id: toastId,
              });
              refreshDetail();
              refreshTimeline();
            } catch (err: any) {
              toast.error(
                err.response?.data?.message ||
                  "Gagal menambahkan barang muatan.",
                { id: toastId },
              );
              throw err;
            }
          }
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
