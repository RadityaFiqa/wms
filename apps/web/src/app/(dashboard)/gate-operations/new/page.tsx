"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateGateOperationSchema } from "@bulog-wms/schema";
import { useGate } from "@/hooks/useGate";
import { toast } from "sonner";
import {
  Truck,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Boxes,
  Edit,
  FileText,
} from "lucide-react";
import CreatableSelect from "react-select/creatable";
import { globalSelectStyles } from "@/lib/react-select";
import { useErpPartners } from "@/hooks/useErpDocuments";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { AddCargoItemDrawer } from "@/components/AddCargoItemDrawer";
import { DocumentReferenceSelector } from "@/components/DocumentReferenceSelector";
import { DocumentReferenceHistoryDrawer } from "@/components/DocumentReferenceHistoryDrawer";

export default function CreateGateOperationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drawer open state and edit state
  const [isAddCargoOpen, setIsAddCargoOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const [selectedDocRefUuid, setSelectedDocRefUuid] = useState<string | null>(null);
  const [selectedDocRefNumber, setSelectedDocRefNumber] = useState<string>("");
  const [isDocHistoryOpen, setIsDocHistoryOpen] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<
    Array<{
      id: number;
      uuid: string;
      documentNumber: string;
      origin?: string;
      partnerName?: string;
      driver?: string;
      plateNumber?: string;
      items?: any[];
      summary?: any[];
      referenceQty: number;
      realizedQty: number;
      remainingQty: number;
    }>
  >([]);

  const { createGateOperation } = useGate();
  const { partners: erpPartners, isLoading: isLoadingPartners } =
    useErpPartners();

  const [historySuggestions, setHistorySuggestions] = useState<
    { licensePlate: string; driverName: string; driverPhone: string }[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handlePartnerChange = async (partnerName: string | null) => {
    setValue("clientPartner", partnerName);
    if (!partnerName) {
      setHistorySuggestions([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const { api } = await import("@/lib/axios");
      const res = await api.get(`/gate-operations/client-history`, {
        params: { clientPartner: partnerName },
      });
      setHistorySuggestions(res.data || []);
    } catch (err) {
      console.error("Failed to load client history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

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
      cardType: "IN",
      documentReferenceId: null as number | null,
      documentReferenceIds: [] as number[],
      driverName: "",
      licensePlate: "",
      clientPartner: null as string | null,
      driverPhone: "",
      notes: "",
      attachmentPaths: [] as string[],
      products: [] as {
        productId: number;
        quantity: number;
        quantId?: number | null;
        locationId?: number | null;
        documentReferenceId?: number | null;
      }[],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "products",
  });

  const watchCardType = watch("cardType");
  const watchAttachmentPaths = watch("attachmentPaths");

  const [productDetailsMap, setProductDetailsMap] = useState<
    Record<
      string,
      {
        name: string;
        sku: string;
        uom?: string;
        uuid?: string;
        quantLabel?: string | null;
        locLabel?: string | null;
        docNumber?: string | null;
      }
    >
  >({});

  const totalReferenceQty = useMemo(
    () => attachedDocs.reduce((sum, d) => sum + (d.referenceQty || 0), 0),
    [attachedDocs],
  );
  const totalRealizedQty = useMemo(
    () => attachedDocs.reduce((sum, d) => sum + (d.realizedQty || 0), 0),
    [attachedDocs],
  );
  const totalRemainingQty = useMemo(
    () => attachedDocs.reduce((sum, d) => sum + (d.remainingQty || 0), 0),
    [attachedDocs],
  );

  const handleAddDocument = async (docRef: any) => {
    if (!docRef) return;
    if (attachedDocs.some((d) => d.id === docRef.id)) {
      toast.error("Dokumen referensi ini sudah ditambahkan.");
      return;
    }

    const toastId = toast.loading("Memuat dokumen referensi ERP...");
    try {
      const { api } = await import("@/lib/axios");
      const [res, historyRes] = await Promise.all([
        api.get(`/erp-document-references/${docRef.uuid}`),
        api.get(`/erp-document-references/${docRef.uuid}/realization-history`),
      ]);
      const fullDoc = res.data;
      const historyData = historyRes.data;
      const summary = historyData?.summary || [];
      const refQty =
        summary.reduce((s: number, i: any) => s + (i.erpQty || 0), 0) ||
        (fullDoc.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0);
      const realQty = summary.reduce(
        (s: number, i: any) => s + (i.realizedQty || 0),
        0,
      );
      const remQty =
        summary.reduce((s: number, i: any) => s + (i.remainingQty || 0), 0) ||
        (refQty - realQty);

      const newDocEntry = {
        id: fullDoc.id,
        uuid: fullDoc.uuid,
        documentNumber: fullDoc.documentNumber,
        origin: fullDoc.origin,
        partnerName: fullDoc.partnerName,
        driver: fullDoc.driver,
        plateNumber: fullDoc.plateNumber,
        items: fullDoc.items || [],
        summary,
        referenceQty: refQty,
        realizedQty: realQty,
        remainingQty: remQty,
      };

      const updatedDocs = [...attachedDocs, newDocEntry];
      setAttachedDocs(updatedDocs);
      setValue("documentReferenceIds", updatedDocs.map((d) => d.id));
      setValue("documentReferenceId", updatedDocs[0]?.id || null);

      if (!watch("driverName") && fullDoc.driver) {
        setValue("driverName", fullDoc.driver);
      }
      if (!watch("licensePlate") && fullDoc.plateNumber) {
        setValue("licensePlate", fullDoc.plateNumber);
      }
      if (!watch("clientPartner") && fullDoc.partnerName) {
        setValue("clientPartner", fullDoc.partnerName);
        handlePartnerChange(fullDoc.partnerName);
      }

      if (fullDoc.items && fullDoc.items.length > 0) {
        const newProducts = fullDoc.items.map((item: any) => {
          const histItem = summary.find(
            (s: any) => s.productId === item.inventoryId,
          );
          const remainingQty = histItem ? histItem.remainingQty : item.quantity;
          return {
            productId: item.inventoryId,
            quantity: remainingQty,
            quantId: null,
            locationId: null,
            documentReferenceId: fullDoc.id,
          };
        });

        newProducts.forEach((np: any) => append(np));

        setProductDetailsMap((prev) => {
          const updated = { ...prev };
          fullDoc.items.forEach((item: any) => {
            const itemKey = `${item.inventoryId}-null-null`;
            updated[itemKey] = {
              name: item.inventoryName || item.productName || "-",
              sku: item.inventorySku || "-",
              uom: item.inventoryUom || item.uom || "-",
              uuid: item.inventoryUuid,
              quantLabel: null,
              locLabel: null,
              docNumber: fullDoc.documentNumber,
            };
          });
          return updated;
        });
      }

      toast.success(
        `Dokumen ${fullDoc.documentNumber} berhasil ditambahkan (${fullDoc.items?.length || 0} item).`,
        { id: toastId },
      );
    } catch (err: any) {
      toast.error("Gagal memuat dokumen referensi ERP.", { id: toastId });
    }
  };

  const handleRemoveDocument = (docId: number) => {
    const docToRemove = attachedDocs.find((d) => d.id === docId);
    if (!docToRemove) return;
    const nextDocs = attachedDocs.filter((d) => d.id !== docId);
    setAttachedDocs(nextDocs);
    setValue("documentReferenceIds", nextDocs.map((d) => d.id));
    setValue("documentReferenceId", nextDocs[0]?.id || null);

    const currentProds = watch("products") || [];
    const remainingProds = currentProds.filter(
      (p: any) => p.documentReferenceId !== docId,
    );
    setValue("products", remainingProds);
    toast.success(`Dokumen ${docToRemove.documentNumber} dilepas.`);
  };

  const handleAddCargo = (data: {
    productId: number;
    quantity: number;
    quantId?: number | null;
    locationId?: number | null;
    documentReferenceId?: number | null;
    productData: any;
  }) => {
    const docNumber =
      attachedDocs.find((d) => d.id === data.documentReferenceId)?.documentNumber ||
      null;

    if (editIndex !== null) {
      update(editIndex, {
        productId: data.productId,
        quantity: data.quantity,
        quantId: data.quantId || null,
        locationId: data.locationId || null,
        documentReferenceId: data.documentReferenceId || null,
      } as any);

      const itemKey = `${data.productId}-${data.quantId || "null"}-${data.locationId || "null"}`;
      setProductDetailsMap((prev) => ({
        ...prev,
        [itemKey]: {
          name: data.productData.name,
          sku: data.productData.sku,
          uom: data.productData.uom,
          uuid: data.productData.uuid,
          quantLabel: data.productData.quantLabel,
          locLabel: data.productData.locLabel,
          docNumber,
        },
      }));

      toast.success("Pilihan lokasi dan tumpukan berhasil disimpan.");
      setEditIndex(null);
      return;
    }

    const isAlreadyAdded = fields.some(
      (f) =>
        f.productId === data.productId &&
        (f as any).quantId === (data.quantId || null) &&
        (f as any).locationId === (data.locationId || null) &&
        (f as any).documentReferenceId === (data.documentReferenceId || null),
    );
    if (isAlreadyAdded) {
      toast.error(
        "Barang dengan dokumen, tumpukan, dan lokasi yang sama sudah ada dalam daftar.",
      );
      return;
    }

    const itemKey = `${data.productId}-${data.quantId || "null"}-${data.locationId || "null"}`;

    append({
      productId: data.productId,
      quantity: data.quantity,
      quantId: data.quantId || null,
      locationId: data.locationId || null,
      documentReferenceId: data.documentReferenceId || null,
    } as any);

    setProductDetailsMap((prev) => ({
      ...prev,
      [itemKey]: {
        name: data.productData.name,
        sku: data.productData.sku,
        uom: data.productData.uom,
        uuid: data.productData.uuid,
        quantLabel: data.productData.quantLabel,
        locLabel: data.productData.locLabel,
        docNumber,
      },
    }));

    toast.success("Barang ditambahkan ke daftar.");
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Menyimpan data gerbang...");
    try {
      const payload = {
        ...data,
        documentReferenceIds: attachedDocs.map((d) => d.id),
        documentReferenceId: attachedDocs[0]?.id || null,
        products: data.products.filter(
          (p: any) => p.productId > 0 && p.quantity > 0,
        ),
      };
      const result = await createGateOperation(payload);
      toast.success("Data kendaraan masuk/keluar berhasil dicatat.", {
        id: toastId,
      });
      router.push(`/gate-operations/${result.uuid}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan data.", {
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const editData =
    editIndex !== null
      ? {
          productId: fields[editIndex].productId,
          quantity: fields[editIndex].quantity,
          locationId: (fields[editIndex] as any).locationId,
          quantId: (fields[editIndex] as any).quantId,
          documentReferenceId: (fields[editIndex] as any).documentReferenceId,
          ...(() => {
            const itemKey = `${fields[editIndex].productId}-${(fields[editIndex] as any).quantId || "null"}-${(fields[editIndex] as any).locationId || "null"}`;
            const details = productDetailsMap[itemKey];
            return {
              name: details?.name || "",
              sku: details?.sku || "",
              uom: details?.uom || "Unit",
              uuid: details?.uuid,
            };
          })(),
        }
      : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => router.push("/gate-operations")}
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
              ⚠️ <strong>Perhatian</strong>: Pastikan Anda mengambil foto plat
              nomor dan kondisi muatan kendaraan dengan jelas sebagai bukti
              validasi audit logistik.
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
                  onClick={() => setValue("cardType", "IN")}
                  className={`p-4 border-2 rounded-xl text-center flex flex-col items-center justify-center transition cursor-pointer ${
                    watchCardType === "IN"
                      ? "border-blue-500 bg-blue-50/50 text-blue-700 font-bold"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="text-2xl mb-1">📥</span>
                  <span className="text-sm font-bold">Gate IN (Masuk)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValue("cardType", "OUT")}
                  className={`p-4 border-2 rounded-xl text-center flex flex-col items-center justify-center transition cursor-pointer ${
                    watchCardType === "OUT"
                      ? "border-purple-500 bg-purple-50/50 text-purple-700 font-bold"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="text-2xl mb-1">📤</span>
                  <span className="text-sm font-bold">Gate OUT (Keluar)</span>
                </button>
              </div>
            </div>

            {/* Dokumen Referensi ERP (Multiple) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-slate-700">
                  Dokumen Referensi ERP (Dapat lebih dari 1)
                </label>
                {attachedDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocRefUuid(attachedDocs[0]?.uuid || null);
                      setSelectedDocRefNumber(attachedDocs[0]?.documentNumber || "");
                      setIsDocHistoryOpen(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-500 font-bold hover:underline transition flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Lihat Riwayat Dokumen
                  </button>
                )}
              </div>

              {/* Selector to add an additional document */}
              <DocumentReferenceSelector
                value={null}
                cardType={watchCardType as "IN" | "OUT"}
                onChange={(doc: any) => {
                  if (doc) handleAddDocument(doc);
                }}
                error={errors.documentReferenceId?.message}
              />

              {/* Summary Metrics Banner if documents attached */}
              {attachedDocs.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Ringkasan Kuota ({attachedDocs.length} Dokumen Terhubung)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white border border-blue-100 rounded-lg p-2">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        Total Referensi
                      </div>
                      <div className="text-sm font-black text-slate-800">
                        {totalReferenceQty.toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="bg-white border border-blue-100 rounded-lg p-2">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        Total Realisasi
                      </div>
                      <div className="text-sm font-black text-blue-700">
                        {totalRealizedQty.toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="bg-white border border-blue-100 rounded-lg p-2">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        Total Sisa Kuota
                      </div>
                      <div className="text-sm font-black text-emerald-700">
                        {totalRemainingQty.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* List of attached documents */}
              {attachedDocs.length > 0 && (
                <div className="space-y-2">
                  {attachedDocs.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                            #{idx + 1}
                          </span>
                          {doc.documentNumber}
                          {doc.origin && (
                            <span className="text-slate-400 font-sans text-[11px]">
                              ({doc.origin})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Partner: {doc.partnerName || "-"} • Sisa Kuota:{" "}
                          <span className="font-bold text-emerald-700">
                            {doc.remainingQty.toLocaleString("id-ID")}
                          </span>{" "}
                          / {doc.referenceQty.toLocaleString("id-ID")} Unit
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDocRefUuid(doc.uuid);
                            setSelectedDocRefNumber(doc.documentNumber);
                            setIsDocHistoryOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                          title="Lihat Riwayat Dokumen"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(doc.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 transition cursor-pointer"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Client Partner Searchable/Creatable Select */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Client Partner / Vendor / Customer (Opsional)
              </label>
              <Controller
                control={control}
                name="clientPartner"
                render={({ field }) => {
                  const partnerOptions = (erpPartners || []).map((p) => ({
                    value: p,
                    label: p,
                  }));
                  const currentValue = field.value
                    ? { value: field.value, label: field.value }
                    : null;

                  return (
                    <CreatableSelect
                      isClearable
                      placeholder="Pilih atau ketik nama partner..."
                      value={currentValue}
                      onChange={(opt: any) => {
                        const val = opt ? opt.value : null;
                        field.onChange(val);
                        handlePartnerChange(val);
                      }}
                      onCreateOption={(inputValue) => {
                        field.onChange(inputValue);
                        handlePartnerChange(inputValue);
                      }}
                      options={partnerOptions}
                      isLoading={isLoadingPartners}
                      formatCreateLabel={(inputValue) =>
                        `Tambah partner "${inputValue}"`
                      }
                      noOptionsMessage={() =>
                        "Ketik nama partner baru atau pilih dari daftar"
                      }
                      styles={globalSelectStyles}
                      className="text-sm"
                      classNamePrefix="react-select"
                    />
                  );
                }}
              />
              {errors.clientPartner && (
                <p className="text-xs text-red-500 mt-1">
                  {(errors.clientPartner as any).message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nomor Kendaraan (Wajib)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: B 1234 ABC"
                  {...register("licensePlate")}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-mono uppercase font-bold"
                />
                {errors.licensePlate && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.licensePlate.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nama Driver (Wajib)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap driver"
                  {...register("driverName")}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-semibold"
                />
                {errors.driverName && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.driverName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  No. Telp Driver (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nomor telepon driver"
                  {...register("driverPhone")}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-semibold"
                />
                {errors.driverPhone && (
                  <p className="text-xs text-red-500 mt-1">
                    {(errors.driverPhone as any).message}
                  </p>
                )}
              </div>

              {historySuggestions.length > 0 && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Pilih Saran Driver & Plat Nomor (Riwayat)
                  </label>
                  <select
                    onChange={(e) => {
                      const idx = e.target.value;
                      if (idx !== "") {
                        const sug = historySuggestions[parseInt(idx, 10)];
                        setValue("driverName", sug.driverName);
                        setValue("licensePlate", sug.licensePlate);
                        setValue("driverPhone", sug.driverPhone || "");
                        toast.success(`Mengisi driver: ${sug.driverName}`);
                      }
                    }}
                    value=""
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-semibold cursor-pointer"
                  >
                    <option value="">-- Pilih dari riwayat --</option>
                    {historySuggestions.map((sug, idx) => (
                      <option key={idx} value={idx}>
                        {sug.driverName} - {sug.licensePlate}{" "}
                        {sug.driverPhone ? `(${sug.driverPhone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Keterangan / Notes (Wajib)
              </label>
              <textarea
                rows={3}
                placeholder="Masukkan keterangan logistik, alasan masuk, atau rincian muatan..."
                {...register("notes")}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition text-sm font-medium"
              />
              {errors.notes && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.notes.message}
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Commodities Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Boxes className="h-5 w-5 mr-2 text-blue-600" />
                Daftar Barang
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Catat barang/komoditas yang dibawa oleh kendaraan.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddCargoOpen(true)}
              className="inline-flex items-center bg-blue-600 hover:bg-blue-550 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm active:scale-[0.98] transition cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5 shrink-0" />
              Tambah Barang Muatan
            </button>
          </div>

          <div className="space-y-6">
            {/* Already Added Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-55 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Nama Produk</th>
                    <th className="px-4 py-3">Dokumen Ref</th>
                    <th className="px-4 py-3 text-right">Kuantitas</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 text-xs text-slate-755">
                  {fields.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-400 italic"
                      >
                        Belum ada barang yang ditambahkan. Silakan klik "Tambah
                        Barang Muatan" di atas.
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, index) => {
                      const itemKey = `${field.productId}-${(field as any).quantId || "null"}-${(field as any).locationId || "null"}`;
                      const productInfo = productDetailsMap[itemKey] || {
                        name: "-",
                        sku: "-",
                        uom: "-",
                      };
                      return (
                        <tr
                          key={field.id}
                          className="hover:bg-slate-50/30 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">
                              {productInfo.name}
                            </div>
                            <div className="flex flex-wrap gap-2 items-center mt-1">
                              <span className="text-[10px] text-slate-400 font-mono">
                                SKU: {productInfo.sku}
                              </span>
                              {!productInfo.locLabel ||
                              !productInfo.quantLabel ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditIndex(index);
                                    setIsAddCargoOpen(true);
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer text-[10px] font-bold"
                                >
                                  ⚠️ Pilih Lokasi & Tumpukan
                                </button>
                              ) : (
                                <>
                                  {productInfo.locLabel && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                      📍 {productInfo.locLabel}
                                    </span>
                                  )}
                                  {productInfo.quantLabel && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      📦 Tumpukan: {productInfo.quantLabel}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditIndex(index);
                                      setIsAddCargoOpen(true);
                                    }}
                                    className="text-[10px] text-blue-600 hover:underline font-bold ml-1 cursor-pointer"
                                  >
                                    Ubah
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {(() => {
                              const docId = (field as any).documentReferenceId;
                              const matchedDoc = attachedDocs.find(
                                (d) => d.id === docId,
                              );
                              const docNum =
                                matchedDoc?.documentNumber ||
                                productInfo.docNumber;
                              return docNum ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                  {docNum}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">
                                  -
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                            {field.quantity} {productInfo.uom || "Unit"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditIndex(index);
                                  setIsAddCargoOpen(true);
                                }}
                                className="inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                                title="Edit Barang"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 transition cursor-pointer flex items-center justify-center"
                                title="Hapus Barang"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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

        {/* Action Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push("/gate-operations")}
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

      <AddCargoItemDrawer
        isOpen={isAddCargoOpen}
        onClose={() => {
          setIsAddCargoOpen(false);
          setEditIndex(null);
        }}
        cardType={watchCardType as "IN" | "OUT"}
        onAdd={handleAddCargo}
        editData={editData}
        attachedDocuments={attachedDocs}
        documentReferenceItems={attachedDocs.flatMap((d) => d.items || [])}
      />

      <DocumentReferenceHistoryDrawer
        isOpen={isDocHistoryOpen}
        onClose={() => setIsDocHistoryOpen(false)}
        docRefUuid={selectedDocRefUuid}
        documentNumber={selectedDocRefNumber}
        documents={attachedDocs}
      />
    </div>
  );
}
