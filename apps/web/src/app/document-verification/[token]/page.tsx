"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import {
  ShieldCheck,
  AlertOctagon,
  Download,
  FileText,
  Calendar,
  User,
  Layers,
  ShieldAlert,
  Hash,
} from "lucide-react";
import PdfViewer from "@/components/PdfViewer";

export default function DocumentVerificationPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await api.get(
          API_ROUTES.digitalSignature.verification.verify(token),
        );
        setResult(res.data);
      } catch (err: any) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <svg
          className="animate-spin h-10 w-10 text-blue-600 mb-3"
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
        <span className="text-sm font-semibold text-slate-500">
          Memproses sertifikat digital...
        </span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-8 shadow-2xl max-w-md w-full text-center space-y-5">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-red-550 shadow-md">
            <AlertOctagon className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-red-800 dark:text-red-300">
              Verifikasi Gagal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Token verifikasi dokumen tidak valid, kedaluwarsa, atau dokumen
              telah ditarik.
            </p>
          </div>
          <div className="bg-red-50/50 dark:bg-red-950/10 border border-dashed border-red-200 dark:border-red-900/40 rounded-xl p-4 text-xs font-bold text-red-700 dark:text-red-400">
            "Document verification failed."
          </div>
        </div>
      </div>
    );
  }

  const doc = result.document;
  const isDocValid = doc.verificationStatus === "VALID";
  const isDocRevoked = doc.verificationStatus === "REVOKED";
  const isDocInvalid = doc.verificationStatus === "INVALID";

  const signedDate = new Date(doc.signedDate).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Certificate Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          {/* Top banner */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-805 px-8 py-6 text-center space-y-4">
            {isDocValid ? (
              <>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-full w-18 h-18 flex items-center justify-center mx-auto text-emerald-500 shadow-sm">
                  <ShieldCheck className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    Sertifikat Autentisitas
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Digital Document Verification System
                  </p>
                </div>
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-dashed border-emerald-250 dark:border-emerald-900/40 rounded-xl px-6 py-3.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300 max-w-xl mx-auto shadow-inner leading-relaxed select-all">
                  "{result.message}"
                </div>
              </>
            ) : isDocRevoked ? (
              <>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 rounded-full w-18 h-18 flex items-center justify-center mx-auto text-amber-500 shadow-sm">
                  <ShieldAlert className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    Sertifikat Dicabut (Revoked)
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Digital Document Verification System
                  </p>
                </div>
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-dashed border-amber-250 dark:border-amber-900/40 rounded-xl px-6 py-3.5 text-xs font-extrabold text-amber-800 dark:text-amber-300 max-w-xl mx-auto shadow-inner leading-relaxed">
                  "Sertifikat tanda tangan dokumen ini telah dicabut."
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-105 dark:border-red-900/30 rounded-full w-18 h-18 flex items-center justify-center mx-auto text-red-500 shadow-sm animate-bounce">
                  <AlertOctagon className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-red-600 dark:text-red-400">
                    Integritas Validasi Gagal
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Digital Document Verification System
                  </p>
                </div>
                <div className="bg-red-50/70 dark:bg-red-950/20 border border-dashed border-red-250 dark:border-red-900/40 rounded-xl px-6 py-3.5 text-xs font-extrabold text-red-800 dark:text-red-300 max-w-xl mx-auto shadow-inner leading-relaxed">
                  "{result.message}"
                </div>
              </>
            )}
          </div>

          {/* Certificate Metadata Body */}
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: General Info */}
            <div className="space-y-4 text-xs font-medium">
              <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5">
                Detail Dokumen
              </span>

              <div className="space-y-3.5">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Judul Dokumen
                    </span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {doc.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Layers className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Kategori
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {doc.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Nomor Dokumen
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                      {doc.documentNumber}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Signature details */}
            <div className="space-y-4 text-xs font-medium">
              <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5">
                Detail Tanda Tangan
              </span>

              <div className="space-y-3.5">
                <div className="flex items-start space-x-3">
                  <User className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Ditandatangani Oleh
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {doc.signedBy}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Tanggal Tanda Tangan
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {signedDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  {isDocValid ? (
                    <>
                      <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                          Status Sertifikasi
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                          Authentic / Verified
                        </span>
                      </div>
                    </>
                  ) : isDocRevoked ? (
                    <>
                      <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                          Status Sertifikasi
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-100 text-amber-700">
                          Revoked / Dicabut
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertOctagon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                          Status Sertifikasi
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 border border-red-100 text-red-700">
                          Hash Mismatch / Invalid Integrity
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Hash Display */}
            <div className="col-span-1 md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 flex items-start space-x-3">
              <Hash className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="w-full">
                <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider mb-1">
                  SHA-256 Checksum Hash
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-205 dark:border-slate-850 rounded-xl block select-all break-all shadow-inner">
                  {doc.fileHash}
                </span>
              </div>
            </div>
          </div>

          {/* Download & View PDF Area */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-805 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-[10px] font-semibold text-slate-400">
              Token Verifikasi: {token}
            </span>

            <a
              href={doc.originalSignedPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer"
            >
              <Download className="h-4 w-4 mr-2" />
              Unduh Dokumen PDF Asli
            </a>
          </div>
        </div>

        {/* Embedded PDF Viewer Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="font-extrabold text-slate-805 dark:text-slate-100 text-sm flex items-center">
            <FileText className="h-5 w-5 mr-2 text-blue-550 shrink-0" />
            Dokumen PDF Bertanda Tangan Digital
          </h3>
          <PdfViewer url={doc.originalSignedPdf} />
        </div>
      </div>
    </div>
  );
}
