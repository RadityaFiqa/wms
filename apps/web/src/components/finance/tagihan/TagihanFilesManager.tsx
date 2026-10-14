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

export function TagihanFilesManager({
  tagihanUuid,
  files,
  onFilesChange,
  stagedFiles = [],
  onStagedFilesChange,
  readOnly = false,
}: TagihanFilesManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileUuid, setDeletingFileUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
          Format: PDF, Gambar (JPG, PNG), Excel, Docx (Maks. 5MB)
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
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc"
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
              {!readOnly && tagihanUuid && (
                <button
                  type="button"
                  disabled={deletingFileUuid === file.uuid}
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
        {stagedFiles.map((file, idx) => (
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

            <button
              type="button"
              onClick={() => handleRemoveStaged(idx)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {files.length === 0 && stagedFiles.length === 0 && (
          <p className="text-xs text-center py-4 text-slate-400 dark:text-slate-500">
            Belum ada dokumen pendukung yang dilampirkan.
          </p>
        )}
      </div>
    </div>
  );
}
