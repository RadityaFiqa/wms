"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import CreatableSelect from "react-select/creatable";
import { globalSelectStyles } from "@/lib/react-select";
import { useErpPartners } from "@/hooks/useErpDocuments";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { AddCargoItemDrawer } from "@/components/AddCargoItemDrawer";
import { DocumentReferenceSelector } from "@/components/DocumentReferenceSelector";

export default function CreateGateOperationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drawer open state and edit state
  const [isAddCargoOpen, setIsAddCargoOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

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
      }
    >
  >({});

  const handleDocRefChange = async (docRef: any) => {
    if (!docRef) {
      setValue("documentReferenceId", null);
      setValue("products", []);
      setProductDetailsMap({});
      return;
    }

    setValue("documentReferenceId", docRef.id);

    if (docRef.driver) {
      setValue("driverName", docRef.driver);
    }
    if (docRef.plateNumber) {
      setValue("licensePlate", docRef.plateNumber);
    }
    if (docRef.partnerName) {
      setValue("clientPartner", docRef.partnerName);
      handlePartnerChange(docRef.partnerName);
    }

    const toastId = toast.loading(
      "Memuat item barang dari dokumen referensi ERP...",
    );
    try {
      const { api } = await import("@/lib/axios");
      const res = await api.get(`/erp-document-references/${docRef.uuid}`);
      const fullDoc = res.data;
      if (fullDoc && fullDoc.items && fullDoc.items.length > 0) {
        const newProducts = fullDoc.items.map((item: any) => ({
          productId: item.inventoryId,
          quantity: item.quantity,
          quantId: null,
          locationId: null,
        }));

        setValue("products", newProducts);

        const newMap: Record<string, any> = {};
        fullDoc.items.forEach((item: any) => {
          const itemKey = `${item.inventoryId}-null-null`;
          newMap[itemKey] = {
            name: item.inventoryName || item.productName || "-",
            sku: item.inventorySku || "-",
            uom: item.inventoryUom || item.uom || "-",
            uuid: item.inventoryUuid,
            quantLabel: null,
            locLabel: null,
          };
        });

        setProductDetailsMap(newMap);
        toast.success(
          `Berhasil memuat ${fullDoc.items.length} item barang dari dokumen ERP.`,
          { id: toastId },
        );
      } else {
        toast.error("Dokumen ERP tidak memiliki item barang.", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Gagal mengambil item barang dari dokumen ERP.", {
        id: toastId,
      });
    }
  };

  const handleAddCargo = (data: {
    productId: number;
    quantity: number;
    quantId?: number | null;
    locationId?: number | null;
    productData: any;
  }) => {
    if (editIndex !== null) {
      update(editIndex, {
        productId: data.productId,
        quantity: data.quantity,
        quantId: data.quantId || null,
        locationId: data.locationId || null,
      });

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
        (f as any).locationId === (data.locationId || null),
    );
    if (isAlreadyAdded) {
      toast.error(
        "Barang dengan tumpukan dan lokasi yang sama sudah ada dalam daftar.",
      );
      return;
    }

    const itemKey = `${data.productId}-${data.quantId || "null"}-${data.locationId || "null"}`;

    append({
      productId: data.productId,
      quantity: data.quantity,
      quantId: data.quantId || null,
      locationId: data.locationId || null,
    });

    setProductDetailsMap((prev) => ({
      ...prev,
      [itemKey]: {
        name: data.productData.name,
        sku: data.productData.sku,
        uom: data.productData.uom,
        uuid: data.productData.uuid,
        quantLabel: data.productData.quantLabel,
        locLabel: data.productData.locLabel,
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
        products: data.products.filter((p: any) => p.productId > 0),
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

            {/* Dokumen Referensi Autocomplete Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Dokumen Referensi ERP (Opsional)
              </label>
              <Controller
                control={control}
                name="documentReferenceId"
                render={({ field }) => (
                  <DocumentReferenceSelector
                    value={field.value ?? null}
                    cardType={watchCardType as "IN" | "OUT"}
                    onChange={handleDocRefChange}
                    error={errors.documentReferenceId?.message}
                  />
                )}
              />
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
                    <th className="px-4 py-3 text-right">Kuantitas</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 text-xs text-slate-755">
                  {fields.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
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
      />
    </div>
  );
}
