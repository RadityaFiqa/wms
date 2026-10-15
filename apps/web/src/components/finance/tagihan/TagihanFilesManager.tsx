"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Download,
  Trash2,
  Loader2,
  FileCheck,
  Paperclip,
  Eye,
  X,
  FileQuestion,
  RefreshCw,
} from "lucide-react";
import { uploadTagihanFile, deleteTagihanFile } from "@/hooks/useTagihan";

interface TagihanFileItem {
  uuid: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt?: string;
  downloadUrl?: string | null;
  uploadedBy?: { name: string } | null;
}

interface TagihanFilesManagerProps {
  tagihanUuid?: string | null; // null if on Create page before submit
  files: TagihanFileItem[];
  onFilesChange?: (updatedFiles: TagihanFileItem[]) => void;
  // For staging local files before creation
  stagedFiles?: File[];
  onStagedFilesChange?: (files: File[]) => void;
  readOnly?: boolean;
}

interface PreviewState {
  url: string;
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
  canDownload: boolean;
}

export function TagihanFilesManager({
  tagihanUuid,
  files,
  onFilesChange,
  stagedFiles = [],
  onStagedFilesChange,
  readOnly = false,
}: TagihanFilesManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const targetReplaceFileUuidRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [replacingFileUuid, setReplacingFileUuid] = useState<string | null>(null);
  const [deletingFileUuid, setDeletingFileUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File preview modal state
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isImageFile = (fileName: string, mime?: string) => {
    if (mime && mime.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|gif|svg)$/i.test(fileName);
  };

  const isPdfFile = (fileName: string, mime?: string) => {
    if (mime === "application/pdf") return true;
    return /\.pdf$/i.test(fileName);
  };

  const handleOpenPreview = (
    url: string,
    fileName: string,
    mimeType?: string,
    canDownload: boolean = true,
  ) => {
    setPreview({
      url,
      fileName,
      isImage: isImageFile(fileName, mimeType),
      isPdf: isPdfFile(fileName, mimeType),
      canDownload,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setError(null);

    // If we have existing tagihanUuid, upload to API directly
    if (tagihanUuid) {
      setIsUploading(true);
      try {
        for (let i = 0; i < selected.length; i++) {
          const file = selected[i];
          const uploaded = await uploadTagihanFile(tagihanUuid, file);
          if (onFilesChange) {
            onFilesChange([...files, uploaded]);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || "Gagal mengunggah file.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } else {
      // Create mode staging
      if (onStagedFilesChange) {
        const newFiles = [...stagedFiles];
        for (let i = 0; i < selected.length; i++) {
          newFiles.push(selected[i]);
        }
        onStagedFilesChange(newFiles);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteUploaded = async (fileUuid: string) => {
    if (!tagihanUuid) return;
    if (!confirm("Apakah Anda yakin ingin menghapus file lampiran ini?")) return;

    setDeletingFileUuid(fileUuid);
    try {
      await deleteTagihanFile(tagihanUuid, fileUuid);
      if (onFilesChange) {
        onFilesChange(files.filter((f) => f.uuid !== fileUuid));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menghapus file.");
    } finally {
      setDeletingFileUuid(null);
    }
  };

  const handleRemoveStaged = (index: number) => {
    if (onStagedFilesChange) {
      onStagedFilesChange(stagedFiles.filter((_, idx) => idx !== index));
    }
  };

  const handleTriggerReplace = (fileUuid: string) => {
    targetReplaceFileUuidRef.current = fileUuid;
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const oldFileUuid = targetReplaceFileUuidRef.current;
    if (!file || !oldFileUuid || !tagihanUuid) return;

    setError(null);
    setReplacingFileUuid(oldFileUuid);
    try {
      const uploaded = await uploadTagihanFile(tagihanUuid, file);
      await deleteTagihanFile(tagihanUuid, oldFileUuid);
      if (onFilesChange) {
        onFilesChange([...files.filter((f) => f.uuid !== oldFileUuid), uploaded]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal mengganti file.");
    } finally {
      setReplacingFileUuid(null);
      targetReplaceFileUuidRef.current = null;
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4.5 w-4.5 text-blue-600" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Dokumen Pendukung / Supporting Files
          </h4>
        </div>
        <span className="text-xs text-slate-400">
          Format: PDF, Gambar (JPG, PNG, WebP), Excel, Docx (Maks. 5MB)
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Upload Dropzone */}
      {!readOnly && (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc"
          />
          <input
            type="file"
            ref={replaceInputRef}
            onChange={handleReplaceFileChange}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-850/50 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Mengunggah file lampiran...
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-slate-400 group-hover:text-blue-500" />
                <div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    Klik untuk memilih file
                  </span>
                  <span className="text-xs text-slate-500"> atau seret file ke sini</span>
                </div>
              </>
            )}
          </button>
        </div>
      )}

      {/* Files List */}
      <div className="space-y-2">
        {/* Uploaded files from API */}
        {files.map((file) => (
          <div
            key={file.uuid}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {file.fileName}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatFileSize(file.fileSize)}
                  {file.uploadedBy ? ` • Diunggah oleh: ${file.uploadedBy.name}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Preview Button */}
              {file.downloadUrl && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPreview(file.downloadUrl!, file.fileName, file.mimeType, true)
                  }
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 transition cursor-pointer"
                  title="Preview File"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}

              {/* Download Button */}
              {file.downloadUrl && (
                <a
                  href={file.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={file.fileName}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-300 transition"
                  title="Unduh File"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}

              {/* Replace Button */}
              {!readOnly && tagihanUuid && (
                <button
                  type="button"
                  disabled={replacingFileUuid === file.uuid || deletingFileUuid === file.uuid}
                  onClick={() => handleTriggerReplace(file.uuid)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-300 transition cursor-pointer"
                  title="Ganti File (Unggah file baru menggantikan file ini)"
                >
                  {replacingFileUuid === file.uuid ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
              )}

              {/* Delete Button */}
              {!readOnly && tagihanUuid && (
                <button
                  type="button"
                  disabled={deletingFileUuid === file.uuid || replacingFileUuid === file.uuid}
                  onClick={() => handleDeleteUploaded(file.uuid)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:border-red-300 transition cursor-pointer"
                  title="Hapus File"
                >
                  {deletingFileUuid === file.uuid ? (
                    <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Staged files before creation */}
        {stagedFiles.map((file, idx) => {
          const stagedUrl = URL.createObjectURL(file);
          return (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 shrink-0">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {formatFileSize(file.size)} • Siap diunggah saat simpan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenPreview(stagedUrl, file.name, file.type, false)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 transition cursor-pointer"
                  title="Preview File Lokal"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveStaged(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                  title="Hapus dari daftar staged"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}

        {files.length === 0 && stagedFiles.length === 0 && (
          <p className="text-xs text-center py-4 text-slate-400 dark:text-slate-500">
            Belum ada dokumen pendukung yang dilampirkan.
          </p>
        )}
      </div>

      {/* Preview Modal Dialog */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/60">
              <div className="flex items-center gap-2.5 truncate pr-4">
                <FileText className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                  {preview.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {preview.canDownload && (
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    download={preview.fileName}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 rounded-lg transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/60 dark:bg-slate-950/60 min-h-[400px]">
              {preview.isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview.url}
                  alt={preview.fileName}
                  className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                />
              ) : preview.isPdf ? (
                <iframe
                  src={preview.url}
                  className="w-full h-[75vh] rounded-xl border border-slate-200 dark:border-slate-800 shadow-md bg-white"
                  title={preview.fileName}
                />
              ) : (
                <div className="p-8 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md">
                  <FileQuestion className="h-12 w-12 text-slate-400 mx-auto" />
                  <div>
                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Preview Tidak Tersedia
                    </h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Format file ini tidak mendukung preview langsung di browser. Silakan
                      unduh file untuk melihat isinya.
                    </p>
                  </div>
                  {preview.canDownload && (
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noreferrer"
                      download={preview.fileName}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md"
                    >
                      <Download className="h-4 w-4" />
                      Unduh File
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

