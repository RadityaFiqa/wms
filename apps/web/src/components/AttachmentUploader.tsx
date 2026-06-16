import React, { useState, useEffect, useCallback } from "react";
import { Upload, X, FileText, Loader2, Image as ImageIcon } from "lucide-react";
import { useGate } from "@/hooks/useGate";
import { toast } from "sonner";

interface Attachment {
  filePath: string;
  url: string;
  fileName: string;
}

interface AttachmentUploaderProps {
  value: string[];
  onChange: (paths: string[]) => void;
  initialAttachments?: Attachment[];
  label?: string;
  accept?: string;
  disabled?: boolean;
}

export function AttachmentUploader({
  value,
  onChange,
  initialAttachments = [],
  label = "Unggah Lampiran/Foto Bukti",
  accept = "image/*,application/pdf",
  disabled = false,
}: AttachmentUploaderProps) {
  const { uploadFile } = useGate();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Local list to store attachment details (including url and filename) for display
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Sync with initialAttachments once loaded
  useEffect(() => {
    if (initialAttachments && initialAttachments.length > 0) {
      setAttachments(initialAttachments);
    }
  }, [initialAttachments]);

  const processFile = useCallback(
    async (file: File) => {
      if (disabled) return;
      setIsUploading(true);
      const toastId = toast.loading(`Mengunggah ${file.name}...`);
      try {
        const response = await uploadFile(file);
        const newAttachment: Attachment = {
          filePath: response.filePath,
          url: response.url,
          fileName: response.fileName,
        };

        const updatedAttachments = [...attachments, newAttachment];
        setAttachments(updatedAttachments);
        onChange(updatedAttachments.map((a) => a.filePath));
        toast.success(`${file.name} berhasil diunggah.`, { id: toastId });
      } catch (err: any) {
        toast.error(
          err.response?.data?.message || `Gagal mengunggah ${file.name}.`,
          { id: toastId },
        );
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFile, attachments, onChange, disabled],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i]);
    }
    // Reset input
    e.target.value = "";
  };

  const handleDrag = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await processFile(files[i]);
      }
    }
  };

  const handleRemove = (filePathToRemove: string) => {
    if (disabled) return;
    const updatedAttachments = attachments.filter(
      (a) => a.filePath !== filePathToRemove,
    );
    setAttachments(updatedAttachments);
    onChange(updatedAttachments.map((a) => a.filePath));
    toast.success("Lampiran dihapus.");
  };

  const isImage = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext || "");
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="block text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}

      {/* Drag & Drop Area */}
      {!disabled && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition min-h-[140px] flex flex-col items-center justify-center bg-slate-50/50 ${
            isDragActive
              ? "border-blue-500 bg-blue-50/20"
              : "border-slate-200 hover:border-blue-400"
          }`}
        >
          <input
            type="file"
            multiple
            accept={accept}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />

          <div className="space-y-2 pointer-events-none flex flex-col items-center">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center border transition ${
                isDragActive
                  ? "bg-blue-100 border-blue-200 text-blue-600"
                  : "bg-blue-50 border-blue-100 text-blue-500"
              }`}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">
                {isUploading
                  ? "Sedang mengunggah..."
                  : "Pilih file atau seret ke sini"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                PNG, JPG, JPEG, atau PDF maks 5MB per file
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files Grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-2">
          {attachments.map((attach, index) => {
            const isImg = isImage(attach.fileName);
            return (
              <div
                key={index}
                className="relative group border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm h-48 sm:h-56 w-full flex flex-col justify-center items-center p-2 text-center transition duration-200 hover:shadow-md"
              >
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attach.url}
                    alt={attach.fileName}
                    className="min-w-64 w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="h-12 w-12 text-blue-500 mb-2" />
                    <span className="text-xs font-bold text-slate-600 truncate max-w-[200px] px-1">
                      {attach.fileName}
                    </span>
                  </div>
                )}

                {/* Hover Delete Overlay */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                  <a
                    href={attach.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-lg text-sm font-bold shadow-md transition active:scale-95"
                  >
                    Buka File
                  </a>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(attach.filePath)}
                      className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg shadow-md transition cursor-pointer active:scale-95"
                      title="Hapus"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
