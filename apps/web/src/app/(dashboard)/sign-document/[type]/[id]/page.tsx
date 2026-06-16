"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useDigitalSignature } from "@/hooks/useDigitalSignature";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSignature,
  Settings,
  FolderOpen,
  CheckCircle,
  FileText,
  Clock,
  Sparkles,
  Undo2,
  AlertTriangle,
  PenTool,
} from "lucide-react";
import Link from "next/link";
import PdfViewer from "@/components/PdfViewer";
import CreatableSelect from "react-select/creatable";

export default function SignDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const type = params.type as "erp" | "manual";
  const idStr = params.id as string;

  const {
    categories,
    templates,
    activeSignature,
    signErpDocument,
    signManualDocument,
  } = useDigitalSignature();

  // Document states
  const [docTitle, setDocTitle] = useState("Memuat dokumen...");
  const [docNumber, setDocNumber] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(true);

  // Placement parameters
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [targetPage, setTargetPage] = useState(1);
  const [sigArea, setSigArea] = useState({
    posX: 10,
    posY: 80,
    width: 25,
    height: 10,
  });
  const [qrArea, setQrArea] = useState({
    posX: 70,
    posY: 80,
    width: 15,
    height: 10,
  });
  const [isSignaturePlaced, setIsSignaturePlaced] = useState(false);
  const [signing, setSigning] = useState(false);

  // Load document details
  useEffect(() => {
    if (!idStr) return;

    const loadDocDetails = async () => {
      setLoadingDoc(true);
      try {
        if (type === "erp") {
          const res = await api.get(
            API_ROUTES.erpDocumentReferences.detail(idStr),
          );
          setDocTitle(`ERP Document Reference: ${res.data.documentNumber}`);
          setDocNumber(res.data.documentNumber);

          const baseUrl = api.defaults.baseURL || "";
          setPdfUrl(
            `${baseUrl}${API_ROUTES.digitalSignature.signedDocuments.erpPreview(idStr)}`,
          );
        } else {
          const res = await api.get(
            API_ROUTES.digitalSignature.manualDocuments.detail(idStr),
          );
          setDocTitle(res.data.title);
          setDocNumber("MANUAL-DOC");
          setPdfUrl(res.data.fileUrl);

          if (res.data.categoryId) {
            setSelectedCategoryId(String(res.data.categoryId));
          }
        }
      } catch (err: any) {
        toast.error("Gagal memuat detail dokumen target.");
      } finally {
        setLoadingDoc(false);
      }
    };

    loadDocDetails();
  }, [type, idStr]);

  // Apply default template layout automatically if active signature is available
  useEffect(() => {
    if (!templates || templates.length === 0) return;

    const defaultTpl = templates.find((t: any) => t.isDefault && t.isActive);
    if (defaultTpl) {
      setSelectedTemplateId(String(defaultTpl.id));
      applyTemplate(defaultTpl);
      setIsSignaturePlaced(true);
    }
  }, [templates]);

  const applyTemplate = (tpl: any) => {
    setTargetPage(tpl.pageNumber);
    setSigArea({
      posX: tpl.posX,
      posY: tpl.posY,
      width: tpl.width,
      height: tpl.height,
    });
    setQrArea({
      posX: tpl.qrPosX,
      posY: tpl.qrPosY,
      width: tpl.qrWidth,
      height: tpl.qrHeight,
    });
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tplId = e.target.value;
    setSelectedTemplateId(tplId);

    if (tplId) {
      const selected = templates.find((t: any) => String(t.id) === tplId);
      if (selected) {
        applyTemplate(selected);
        setIsSignaturePlaced(true);
        toast.success(`Mengaplikasikan letak template: ${selected.name}`);
      }
    }
  };

  const handlePlaceSignature = () => {
    if (!activeSignature) {
      toast.error("Anda tidak memiliki tanda tangan aktif.");
      return;
    }
    setIsSignaturePlaced(true);
    toast.success(
      "Tanda tangan diletakkan pada PDF! Seret dan atur ukurannya.",
    );
  };

  const handleResetPosition = () => {
    // Reset to defaults
    setSigArea({ posX: 10, posY: 80, width: 25, height: 10 });
    setQrArea({ posX: 70, posY: 80, width: 15, height: 10 });
    setIsSignaturePlaced(false);
    setSelectedTemplateId("");
    toast.success("Posisi tanda tangan direset.");
  };

  const handleConfirmSign = async () => {
    if (!activeSignature) {
      toast.error("Gagal: Anda belum mengunggah gambar tanda tangan aktif.");
      return;
    }
    if (!selectedCategoryId) {
      toast.error("Kategori dokumen wajib dipilih.");
      return;
    }
    if (!isSignaturePlaced) {
      toast.error(
        "Tanda tangan harus ditempatkan terlebih dahulu pada dokumen PDF.",
      );
      return;
    }

    setSigning(true);
    const toastId = toast.loading(
      "Memproses tanda tangan digital & enkripsi PDF...",
    );

    try {
      const parsedCatId = /^\d+$/.test(selectedCategoryId)
        ? parseInt(selectedCategoryId, 10)
        : selectedCategoryId;
      const payload = {
        templateId: selectedTemplateId
          ? parseInt(selectedTemplateId, 10)
          : null,
        categoryId: parsedCatId,
        pageNumber: targetPage,
        posX: sigArea.posX,
        posY: sigArea.posY,
        width: sigArea.width,
        height: sigArea.height,
        qrPosX: qrArea.posX,
        qrPosY: qrArea.posY,
        qrWidth: qrArea.width,
        qrHeight: qrArea.height,
      };

      if (type === "erp") {
        await signErpDocument(idStr, payload);
      } else {
        await signManualDocument(idStr, payload);
      }

      toast.success("Dokumen berhasil ditandatangani secara digital!", {
        id: toastId,
      });
      router.push("/signed-documents");
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Gagal menandatangani dokumen.";
      toast.error(msg, { id: toastId });
    } finally {
      setSigning(false);
    }
  };

  if (loadingDoc || !pdfUrl) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-4">
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
        <span className="text-xs font-bold text-slate-500">
          Menyiapkan workspace tanda tangan...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-550 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
              <FileSignature className="h-6 w-6 text-blue-600 mr-2" />
              Workspace Tanda Tangan Digital
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[500px]">
              Menandatangani:{" "}
              <span className="font-bold text-slate-850 dark:text-slate-200 font-mono">
                {docNumber}
              </span>{" "}
              - {docTitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left column: PDF Viewer Workspace (lg:col-span-3) */}
        <div className="lg:col-span-3">
          <PdfViewer
            url={pdfUrl}
            pageNumber={targetPage}
            editable={true}
            signatureArea={isSignaturePlaced ? sigArea : undefined}
            qrArea={qrArea}
            onChangePlacement={(sig, qr) => {
              setSigArea(sig);
              setQrArea(qr);
            }}
            targetPage={targetPage}
            onTargetPageChange={(page) => setTargetPage(page)}
            signatureImageUrl={activeSignature?.fileUrl}
          />
        </div>

        {/* Right column: Form Configuration Controls (lg:col-span-1) */}
        <div className="space-y-6 lg:sticky lg:top-20">
          {/* Active Signature Image Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-805 dark:text-slate-100 text-sm border-b border-slate-100 dark:border-slate-805 pb-2 flex items-center">
              <PenTool className="h-4.5 w-4.5 mr-2 text-blue-500" />
              Tanda Tangan Pengguna
            </h3>

            {activeSignature ? (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center min-h-[90px] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:8px_8px]">
                  <img
                    src={activeSignature.fileUrl}
                    alt="User active signature"
                    className="max-h-[70px] object-contain"
                  />
                </div>
                {!isSignaturePlaced ? (
                  <button
                    onClick={handlePlaceSignature}
                    className="w-full bg-blue-650 hover:bg-blue-600 text-white font-bold py-2 rounded-xl text-xs active:scale-[0.98] transition cursor-pointer"
                  >
                    Place Signature (Tempel Tanda Tangan)
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <span className="flex-1 bg-emerald-50 text-emerald-705 border border-emerald-100 text-center font-bold py-2 rounded-xl text-[10px] flex items-center justify-center">
                      Placed / Ditempel
                    </span>
                    <button
                      onClick={handleResetPosition}
                      className="px-3 border border-red-200 text-red-650 hover:bg-red-50 rounded-xl transition cursor-pointer flex items-center justify-center"
                      title="Undo Placement"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-dashed border-amber-300 rounded-xl p-4 text-center space-y-2">
                <AlertTriangle className="h-6 w-6 text-amber-505 mx-auto" />
                <p className="text-xs font-bold text-amber-800">
                  Tanda Tangan Belum Unggah
                </p>
                <p className="text-[10px] text-amber-600 leading-relaxed">
                  Silakan unggah gambar tanda tangan Anda di profil Anda
                  terlebih dahulu.
                </p>
                <Link
                  href="/profile"
                  className="inline-block text-[10px] font-bold text-blue-600 hover:underline mt-1"
                >
                  Pergi Ke Profil &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Configuration Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm border-b border-slate-100 dark:border-slate-805 pb-2 flex items-center">
              <Settings className="h-4.5 w-4.5 mr-2 text-blue-505" />
              Konfigurasi Letak
            </h3>

            {/* Template Selector */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-wider">
                Pilih Template Tata Letak
              </label>
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-750 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
              >
                <option value="">Custom Placement (Pilih Bebas)</option>
                {templates
                  ?.filter((t: any) => t.isActive)
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Halaman {t.pageNumber})
                    </option>
                  ))}
              </select>
            </div>

            {/* Category Selector */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-wider">
                Kategori Dokumen *
              </label>
              {type === "manual" ? (
                <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl px-3 py-2 text-xs">
                  {categories?.find(
                    (c: any) => String(c.id) === selectedCategoryId,
                  )?.name || "Kategori Manual"}
                </div>
              ) : (
                <CreatableSelect
                  unstyled
                  placeholder="Pilih atau Buat Kategori..."
                  options={
                    categories?.map((cat: any) => ({
                      value: String(cat.id),
                      label: cat.name,
                    })) || []
                  }
                  value={
                    categories
                      ?.map((cat: any) => ({
                        value: String(cat.id),
                        label: cat.name,
                      }))
                      .find((opt: any) => opt.value === selectedCategoryId) ||
                    (selectedCategoryId
                      ? { value: selectedCategoryId, label: selectedCategoryId }
                      : null)
                  }
                  onChange={(newValue: any) => {
                    setSelectedCategoryId(newValue ? newValue.value : "");
                  }}
                  classNames={{
                    control: ({ isFocused }) =>
                      `w-full bg-slate-50 dark:bg-slate-800 border ${
                        isFocused
                          ? "border-blue-500 ring-1 ring-blue-500"
                          : "border-slate-200 dark:border-slate-700"
                      } text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs transition`,
                    menu: () =>
                      "mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-50 absolute w-full",
                    option: ({ isFocused, isSelected }) =>
                      `px-3 py-2 text-xs cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : isFocused
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            : "text-slate-700 dark:text-slate-300"
                      }`,
                    singleValue: () =>
                      "text-slate-800 dark:text-slate-100 text-xs",
                    placeholder: () =>
                      "text-slate-400 dark:text-slate-500 text-xs",
                    input: () => "text-slate-800 dark:text-slate-100 text-xs",
                    noOptionsMessage: () =>
                      "text-slate-500 dark:text-slate-400 p-2 text-center text-xs",
                  }}
                />
              )}
            </div>

            {/* Coordinates Display Panel */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3.5 space-y-2 text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider block mb-1">
                Koordinat Terpilih
              </span>

              <div className="flex justify-between border-b border-slate-200/40 dark:border-slate-800 pb-1">
                <span>Halaman Target:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  Halaman #{targetPage}
                </strong>
              </div>

              {isSignaturePlaced ? (
                <div>
                  <span className="font-bold text-blue-600 text-[9px] tracking-wide block">
                    Tanda Tangan Box:
                  </span>
                  <div className="flex justify-between mt-0.5 font-mono">
                    <span>
                      Pos: X={Math.round(sigArea.posX)}%, Y=
                      {Math.round(sigArea.posY)}%
                    </span>
                    <span>
                      Size: {Math.round(sigArea.width)}x
                      {Math.round(sigArea.height)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-red-500 text-[9px] italic">
                  Tanda tangan belum diletakkan.
                </div>
              )}

              <div>
                <span className="font-bold text-emerald-600 text-[9px] tracking-wide block">
                  QR Code Box:
                </span>
                <div className="flex justify-between mt-0.5 font-mono">
                  <span>
                    Pos: X={Math.round(qrArea.posX)}%, Y=
                    {Math.round(qrArea.posY)}%
                  </span>
                  <span>
                    Size: {Math.round(qrArea.width)}x{Math.round(qrArea.height)}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleConfirmSign}
                disabled={
                  signing ||
                  !selectedCategoryId ||
                  !isSignaturePlaced ||
                  !activeSignature
                }
                className="w-full bg-emerald-605 hover:bg-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold px-4 py-3 rounded-xl shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98] transition cursor-pointer text-xs flex items-center justify-center"
              >
                {signing ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin h-4 w-4 mr-2 text-white"
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
                    Memproses Tanda Tangan...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Sparkles className="h-4 w-4 mr-1.5 animate-pulse" />
                    Konfirmasi Tanda Tangan
                  </span>
                )}
              </button>

              <button
                onClick={() => router.back()}
                disabled={signing}
                className="w-full border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-550 font-bold px-4 py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
