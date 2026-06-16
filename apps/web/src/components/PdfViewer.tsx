"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Layout,
  Layers,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface BoxArea {
  posX: number; // 0 to 100 (percentage)
  posY: number; // 0 to 100 (percentage)
  width: number; // 0 to 100 (percentage)
  height: number; // 0 to 100 (percentage)
}

interface PdfViewerProps {
  url: string;
  pageNumber?: number;
  onPageChange?: (page: number, total: number) => void;
  editable?: boolean;
  signatureArea?: BoxArea;
  qrArea?: BoxArea;
  onChangePlacement?: (sig: BoxArea, qr: BoxArea) => void;
  targetPage?: number;
  onTargetPageChange?: (page: number) => void;
  signatureImageUrl?: string;
}

export default function PdfViewer({
  url,
  pageNumber: externalPageNumber,
  onPageChange,
  editable = false,
  signatureArea,
  qrArea,
  onChangePlacement,
  targetPage = 1,
  onTargetPageChange,
  signatureImageUrl,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);

  const [pdf, setPdf] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [isPdfDarkMode, setIsPdfDarkMode] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<
    { width: number; height: number }[]
  >([]);

  // Drag & drop state
  const [activeDrag, setActiveDrag] = useState<
    "sig" | "qr" | "sig-resize" | "qr-resize" | null
  >(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // Load PDF
  useEffect(() => {
    if (!url) return;
    setLoading(true);

    // Only send Auth token to internal API routes (not direct MinIO links)
    const token = useAuthStore.getState().token;
    const isInternalApi =
      (!url.startsWith("http://") && !url.startsWith("https://")) ||
      url.includes("/api/");

    const loadingTask = pdfjs.getDocument({
      url,
      headers:
        token && isInternalApi
          ? { Authorization: `Bearer ${token}` }
          : undefined,
      withCredentials: false,
    } as any);

    loadingTask.promise.then(
      (loadedPdf) => {
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setLoading(false);
        if (onPageChange) onPageChange(1, loadedPdf.numPages);
      },
      (error) => {
        console.error("Error loading PDF:", error);
        setLoading(false);
      },
    );

    return () => {
      loadingTask.destroy();
    };
  }, [url]);

  // Render All Pages for Scroll Mode
  useEffect(() => {
    if (!pdf) return;

    const renderPages = async () => {
      const dims: { width: number; height: number }[] = [];

      for (let pNum = 1; pNum <= totalPages; pNum++) {
        const page = await pdf.getPage(pNum);
        const canvas = canvasesRef.current[pNum - 1];
        if (canvas) {
          const context = canvas.getContext("2d");
          if (context) {
            const viewport = page.getViewport({ scale: zoom });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            dims.push({ width: viewport.width, height: viewport.height });

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };
            await page.render(renderContext).promise;
          }
        }
      }
      setPageDimensions(dims);
    };

    renderPages();
  }, [pdf, totalPages, zoom]);

  const handleZoomIn = () => setZoom((z) => Math.min(2.0, z + 0.1));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.1));

  // Drag and resize handlers mapped to targetPage wrapper
  const handleMouseDown = (
    e: React.MouseEvent,
    type: "sig" | "qr" | "sig-resize" | "qr-resize",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag(type);

    const container = document.getElementById(
      `pdf-page-container-${targetPage}`,
    );
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (type === "sig" && signatureArea) {
      const boxX = (signatureArea.posX / 100) * rect.width;
      const boxY = (signatureArea.posY / 100) * rect.height;
      dragStartOffset.current = {
        x: e.clientX - rect.left - boxX,
        y: e.clientY - rect.top - boxY,
      };
    } else if (type === "qr" && qrArea) {
      const boxX = (qrArea.posX / 100) * rect.width;
      const boxY = (qrArea.posY / 100) * rect.height;
      dragStartOffset.current = {
        x: e.clientX - rect.left - boxX,
        y: e.clientY - rect.top - boxY,
      };
    } else {
      dragStartOffset.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag || !onChangePlacement) return;

    const container = document.getElementById(
      `pdf-page-container-${targetPage}`,
    );
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (activeDrag === "sig" && signatureArea) {
      let newX = ((currentX - dragStartOffset.current.x) / rect.width) * 100;
      let newY = ((currentY - dragStartOffset.current.y) / rect.height) * 100;

      newX = Math.max(0, Math.min(100 - signatureArea.width, newX));
      newY = Math.max(0, Math.min(100 - signatureArea.height, newY));

      onChangePlacement(
        { ...signatureArea, posX: newX, posY: newY },
        qrArea || { posX: 70, posY: 80, width: 15, height: 10 },
      );
    } else if (activeDrag === "qr" && qrArea) {
      let newX = ((currentX - dragStartOffset.current.x) / rect.width) * 100;
      let newY = ((currentY - dragStartOffset.current.y) / rect.height) * 100;

      newX = Math.max(0, Math.min(100 - qrArea.width, newX));
      newY = Math.max(0, Math.min(100 - qrArea.height, newY));

      onChangePlacement(
        signatureArea || { posX: 10, posY: 80, width: 25, height: 10 },
        { ...qrArea, posX: newX, posY: newY },
      );
    } else if (activeDrag === "sig-resize" && signatureArea) {
      const diffX =
        ((e.clientX - dragStartOffset.current.x) / rect.width) * 100;
      const diffY =
        ((e.clientY - dragStartOffset.current.y) / rect.height) * 100;

      let newW = Math.max(5, signatureArea.width + diffX);
      let newH = Math.max(3, signatureArea.height + diffY);

      newW = Math.min(100 - signatureArea.posX, newW);
      newH = Math.min(100 - signatureArea.posY, newH);

      dragStartOffset.current = { x: e.clientX, y: e.clientY };
      onChangePlacement(
        { ...signatureArea, width: newW, height: newH },
        qrArea || { posX: 70, posY: 80, width: 15, height: 10 },
      );
    } else if (activeDrag === "qr-resize" && qrArea) {
      const diffX =
        ((e.clientX - dragStartOffset.current.x) / rect.width) * 100;
      const diffY =
        ((e.clientY - dragStartOffset.current.y) / rect.height) * 100;

      let newW = Math.max(5, qrArea.width + diffX);
      let newH = Math.max(5, qrArea.height + diffY);

      newW = Math.min(100 - qrArea.posX, newW);
      newH = Math.min(100 - qrArea.posY, newH);

      dragStartOffset.current = { x: e.clientX, y: e.clientY };
      onChangePlacement(
        signatureArea || { posX: 10, posY: 80, width: 25, height: 10 },
        { ...qrArea, width: newW, height: newH },
      );
    }
  };

  const handleMouseUp = () => {
    setActiveDrag(null);
  };

  const handleJumpToPage = (pageNum: number) => {
    if (onTargetPageChange) {
      onTargetPageChange(pageNum);
    }
    const pageElement = document.getElementById(
      `pdf-page-container-${pageNum}`,
    );
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner p-4 w-full">
      {/* PDF Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full px-5 py-3 rounded-xl mb-4 shadow-sm">
        <div className="flex items-center space-x-3 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Layout className="h-4.5 w-4.5 text-blue-605" />
          <span>Multi-Page Scroll Mode</span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-850 rounded-xl p-0.5 border border-slate-200/50 dark:border-slate-750">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5 || loading}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-850 rounded-lg disabled:opacity-40 transition cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <ZoomOut className="h-4.5 w-4.5" />
            </button>
            <span className="text-xs font-bold px-2.5 text-slate-705 dark:text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 2.0 || loading}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-850 rounded-lg disabled:opacity-40 transition cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <ZoomIn className="h-4.5 w-4.5" />
            </button>
          </div>

          <button
            onClick={() => setIsPdfDarkMode(!isPdfDarkMode)}
            className="p-2 border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition cursor-pointer text-slate-700 dark:text-slate-300"
            title="Toggle PDF Dark Mode"
          >
            {isPdfDarkMode ? (
              <Sun className="h-4.5 w-4.5 text-amber-500" />
            ) : (
              <Moon className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace: Sidebar + Scroll Area */}
      <div
        className="flex w-full h-[65vh] gap-4"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Left Page Thumbnail Navigation */}
        {!loading && pdf && (
          <div className="w-[140px] shrink-0 border-r border-slate-200 dark:border-slate-800 pr-3 overflow-y-auto space-y-3.5 flex flex-col">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Daftar Halaman
            </label>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <div
                  key={pNum}
                  onClick={() => handleJumpToPage(pNum)}
                  className={`cursor-pointer rounded-xl p-2.5 border-2 text-center transition ${
                    pNum === targetPage
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-slate-200/50 dark:border-slate-800 hover:bg-slate-200/40 dark:hover:bg-slate-850/30"
                  }`}
                >
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 aspect-[1/1.41] rounded flex items-center justify-center text-xs font-black text-slate-400">
                    #{pNum}
                  </div>
                  <span className="block text-[9px] font-extrabold text-slate-550 dark:text-slate-400 mt-1">
                    Halaman {pNum}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Right scroll view area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto bg-slate-200 dark:bg-slate-950 p-4 rounded-xl flex flex-col items-center shadow-inner"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
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
              <span className="text-xs font-bold">Memuat dokumen PDF...</span>
            </div>
          )}

          {!loading &&
            pdf &&
            Array.from({ length: totalPages }).map((_, index) => {
              const pNum = index + 1;
              const dimensions = pageDimensions[index] || {
                width: 0,
                height: 0,
              };

              return (
                <div
                  key={pNum}
                  id={`pdf-page-container-${pNum}`}
                  className="relative bg-white select-none border border-slate-200 dark:border-slate-800 rounded-lg shadow-md mb-6 transition"
                  style={{
                    width: dimensions.width || "auto",
                    height: dimensions.height || "auto",
                  }}
                >
                  {/* PDF Page Canvas */}
                  <canvas
                    ref={(el) => {
                      canvasesRef.current[index] = el;
                    }}
                    className={`block rounded-lg shadow-sm ${
                      isPdfDarkMode
                        ? "filter invert(0.9) hue-rotate(180deg)"
                        : ""
                    }`}
                  />

                  {/* Floating Preview Layer on Target Page */}
                  {editable && dimensions.width > 0 && pNum === targetPage && (
                    <>
                      {/* Draggable Signature Placement Box */}
                      {signatureArea && (
                        <div
                          className="absolute border-2 border-blue-505 bg-blue-50/60 dark:bg-blue-950/20 cursor-move text-blue-700 flex flex-col justify-between p-1 rounded shadow-md select-none group bg-[radial-gradient(#3b82f6_1px,transparent_1px)] bg-[size:6px_6px] pointer-events-auto"
                          style={{
                            left: `${signatureArea.posX}%`,
                            top: `${signatureArea.posY}%`,
                            width: `${signatureArea.width}%`,
                            height: `${signatureArea.height}%`,
                            zIndex: 10,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, "sig")}
                        >
                          {signatureImageUrl ? (
                            <img
                              src={signatureImageUrl}
                              alt="Placement preview"
                              className="w-full h-full object-contain pointer-events-none select-none"
                            />
                          ) : (
                            <div className="flex flex-col justify-between h-full select-none">
                              <span className="text-[8px] font-black tracking-wider leading-none">
                                SIGNATURE
                              </span>
                              <span className="text-[6px] italic leading-none font-bold text-slate-505">
                                Place signature image here
                              </span>
                            </div>
                          )}

                          <div
                            className="absolute right-0 bottom-0 w-3.5 h-3.5 bg-blue-600 rounded-tl cursor-se-resize flex items-center justify-center opacity-70 hover:opacity-100"
                            onMouseDown={(e) =>
                              handleMouseDown(e, "sig-resize")
                            }
                          />
                        </div>
                      )}

                      {/* Draggable QR Code Placement Box */}
                      {qrArea && (
                        <div
                          className="absolute border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 cursor-move text-emerald-700 flex flex-col justify-between p-1 rounded shadow-md select-none group bg-[radial-gradient(#10b981_1px,transparent_1px)] bg-[size:6px_6px]"
                          style={{
                            left: `${qrArea.posX}%`,
                            top: `${qrArea.posY}%`,
                            width: `${qrArea.width}%`,
                            height: `${qrArea.height}%`,
                            zIndex: 10,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, "qr")}
                        >
                          <span className="text-[8px] font-black tracking-wider leading-none">
                            QR VERIFY
                          </span>

                          <div
                            className="absolute right-0 bottom-0 w-3.5 h-3.5 bg-emerald-600 rounded-tl cursor-se-resize flex items-center justify-center opacity-70 hover:opacity-100"
                            onMouseDown={(e) => handleMouseDown(e, "qr-resize")}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
