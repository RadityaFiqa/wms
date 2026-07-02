"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import {
  usePublicWarehouses,
  usePublicStackCards,
  usePublicStackCardDates,
  usePublicStackCardLocations,
} from "@/hooks/useStackCard";
import { useTheme } from "../theme-provider";
import {
  Warehouse as WarehouseIcon,
  MapPin,
  Calendar,
  Layers,
  Tag,
  Box,
  Scale,
  Printer,
  ChevronLeft,
  ChevronRight,
  Info,
  LogIn,
  LayoutDashboard,
  Moon,
  Sun,
  Search,
} from "lucide-react";

// Main Page wrapper with Suspense to handle useSearchParams in Next.js static builds
export default function KartuTumpukanPublicPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="font-semibold text-sm">Memuat aplikasi...</p>
          </div>
        </div>
      }
    >
      <KartuTumpukanContent />
    </Suspense>
  );
}

function KartuTumpukanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const locationParam = searchParams.get("location") || "";

  // Date selection state
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Search/Filters inside the location
  const [search, setSearch] = useState<string>("");

  // Pagination & Sorting
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [sortField, setSortField] = useState<string>("placementDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch available dates for the selected location (unauthenticated)
  const { dates: publishedDates, isLoading: datesLoading } = usePublicStackCardDates(
    undefined,
    locationParam || undefined
  );

  // Set default date when publishedDates load
  useEffect(() => {
    if (publishedDates && publishedDates.length > 0) {
      const firstDate = publishedDates[0].split("T")[0];
      setSelectedDate(firstDate);
    } else {
      setSelectedDate("");
    }
  }, [publishedDates, locationParam]);

  // Fetch stack cards data strictly for this location
  const { stackCardData, isLoading: dataLoading } = usePublicStackCards(undefined, {
    locationName: locationParam,
    snapshotDate: selectedDate,
    search: search,
    page,
    limit,
  });

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Helper formatter for Date: "dd MMMM yyyy"
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "long",
        year: "numeric",
      };
      return date.toLocaleDateString("id-ID", options);
    } catch (e) {
      return dateStr;
    }
  };

  // Helper formatter for Number: "1.000"
  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString("id-ID");
  };

  // Render Treatment Execution Date
  const renderTreatmentDate = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === "-" || dateStr === "") {
      return <span className="text-slate-450 dark:text-slate-500">-</span>;
    }
    return (
      <span className="font-semibold text-slate-700 dark:text-slate-300">
        {formatDate(dateStr)}
      </span>
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Selection Screen: If location query param is missing
  if (!locationParam) {
    return <LocationSelectionScreen theme={theme} toggleTheme={toggleTheme} token={token} user={user} />;
  }

  const stackCards = stackCardData?.data || [];
  const totalItems = stackCardData?.total || 0;
  const totalPages = stackCardData?.totalPages || 0;
  const summary = stackCardData?.summary || {
    totalSkus: 0,
    totalLots: 0,
    totalQuantity: 0,
    totalQuantum: 0,
  };

  // Resolve warehouse name from the first item returned
  const resolvedWarehouseName = stackCards[0]?.warehouse?.name || "";

  // Sort Stack Cards Client-side for preview accuracy
  const sortedStackCards = [...stackCards].sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "expiredDate" || sortField === "placementDate") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    if (typeof aVal === "string") {
      return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-200">
      {/* Public Header Navbar (Hidden on Print) */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-xs print:hidden">
        <div className="flex items-center">
          <WarehouseIcon className="h-6 w-6 text-blue-600 mr-2.5" />
          <span className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">
            BULOG <span className="text-blue-600 text-xs font-bold font-sans lowercase">WMS</span>
          </span>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-3" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Kartu Tumpukan
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Ubah tema"
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {token ? (
            <Link
              href="/"
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-md transition cursor-pointer text-xs"
            >
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer text-xs"
            >
              <LogIn className="h-4 w-4 mr-1.5 text-slate-500" />
              Masuk Aplikasi
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10 space-y-6 print:p-0 print:max-w-none">
        
        {/* Simple Header Section (Optimized for Screen & Print) */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4 print:border-slate-300">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 print:hidden">
              <Link href="/kartu-tumpukan" className="hover:text-blue-600">Pilih Lokasi</Link>
              <span>/</span>
              <span className="text-blue-600">Kartu Tumpukan</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-lg print:hidden">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight print:text-2xl print:font-bold">
                  {locationParam}
                </h1>
                {resolvedWarehouseName && (
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-450 flex items-center mt-1">
                    <WarehouseIcon className="h-4 w-4 mr-1.5 text-slate-400 print:hidden" />
                    Gudang: {resolvedWarehouseName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Area: Print button and Timestamp */}
          <div className="flex flex-col items-end space-y-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center h-10 bg-slate-800 hover:bg-slate-750 text-white font-bold px-4 rounded-xl shadow-xs transition cursor-pointer text-xs print:hidden"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </button>
            {selectedDate && (
              <span className="text-xs font-bold text-slate-500 dark:text-slate-450 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg flex items-center">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                Terakhir diperbarui pada: <strong className="ml-1 text-slate-800 dark:text-slate-200">{formatDate(selectedDate)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 2 Metric Summary Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
          {/* Total Kuantitas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center space-x-4 print:border-slate-300 print:shadow-none">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl shrink-0 print:hidden">
              <Box className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                TOTAL KUANTITAS
              </span>
              <strong className="text-2xl font-black text-slate-850 dark:text-slate-100 print:text-xl">
                {formatNumber(summary.totalQuantity)} <span className="text-xs font-semibold text-slate-450 dark:text-slate-500">{stackCards[0]?.uom || "Pack"}</span>
              </strong>
            </div>
          </div>

          {/* Total Kuantum */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center space-x-4 print:border-slate-300 print:shadow-none">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 print:hidden">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">
                TOTAL KUANTUM
              </span>
              <strong className="text-2xl font-black text-slate-850 dark:text-slate-100 print:text-xl">
                {formatNumber(summary.totalQuantum)} <span className="text-xs font-semibold text-slate-450 dark:text-slate-550">Kg</span>
              </strong>
            </div>
          </div>
        </div>

        {/* Clean, Focus-oriented Data Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col print:border-slate-300 print:shadow-none print:rounded-none">
          {/* Inner Search/Filter Panel (Hidden on Print) */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 print:hidden">
            <div className="relative max-w-sm w-full">
              <input
                type="text"
                placeholder="Cari produk, SKU, atau Lot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {formatNumber(totalItems)} Baris Data
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print:text-[10px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider print:bg-slate-100 print:border-slate-300">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent max-w-[450px] min-w-[250px]" onClick={() => handleSort("productName")}>
                    Produk {sortField === "productName" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("sku")}>
                    SKU {sortField === "sku" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("lot")}>
                    Lot {sortField === "lot" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("shelfLife")}>
                    Umur Simpan (Bulan) {sortField === "shelfLife" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("expiredDate")}>
                    Expired Date / Best Before {sortField === "expiredDate" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("placementDate")}>
                    Tanggal Penempatan {sortField === "placementDate" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("quantity")}>
                    Kuantitas {sortField === "quantity" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 print:hover:bg-transparent" onClick={() => handleSort("quantum")}>
                    Kuantum {sortField === "quantum" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-3 px-4">UoM</th>
                  <th className="py-3 px-4 text-center">Spraying</th>
                  <th className="py-3 px-4 text-center">Fumigasi</th>
                  <th className="py-3 px-4 text-center">Fogging</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                {dataLoading ? (
                  <tr>
                    <td colSpan={14} className="py-10 text-center text-xs font-semibold text-slate-400">
                      <svg className="animate-spin h-5 w-5 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Memuat data kartu tumpukan...
                    </td>
                  </tr>
                ) : sortedStackCards.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-10 text-center text-xs font-semibold text-slate-400">
                      <Info className="h-6 w-6 text-slate-350 dark:text-slate-650 mx-auto mb-2" />
                      Tidak ada data tumpukan untuk lokasi dan tanggal terpilih.
                    </td>
                  </tr>
                ) : (
                  sortedStackCards.map((row: any, index: number) => {
                    const numberIndex = (page - 1) * limit + index + 1;
                    return (
                      <tr
                        key={row.uuid}
                        className="text-slate-700 dark:text-slate-355 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 print:hover:bg-transparent print:text-[10px]"
                      >
                        <td className="py-3 px-4 text-center font-bold text-slate-400">{numberIndex}</td>
                        <td className="py-3 px-4 font-bold text-slate-850 dark:text-slate-100 max-w-[450px] min-w-[250px] break-words whitespace-normal" title={row.productName}>
                          {row.productName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{row.sku}</td>
                        <td className="py-3 px-4 font-semibold">{row.lot}</td>
                        <td className="py-3 px-4 text-center font-semibold">{row.shelfLife}</td>
                        <td className="py-3 px-4 font-semibold">{formatDate(row.expiredDate)}</td>
                        <td className="py-3 px-4 font-semibold">{formatDate(row.placementDate)}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-850 dark:text-slate-100">
                          {formatNumber(row.quantity)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-850 dark:text-slate-100">
                          {formatNumber(row.quantum)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-semibold">{row.uom}</td>
                        <td className="py-3 px-4 text-center font-semibold">{renderTreatmentDate(row.spraying)}</td>
                        <td className="py-3 px-4 text-center font-semibold">{renderTreatmentDate(row.fumigasi)}</td>
                        <td className="py-3 px-4 text-center font-semibold">{renderTreatmentDate(row.fogging)}</td>
                        <td className="py-3 px-4 italic text-slate-400 max-w-xs truncate" title={row.keterangan || ""}>
                          {row.keterangan || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination (Hidden on Print) */}
          {sortedStackCards.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 px-5 py-3.5 flex items-center justify-between print:hidden">
              <span className="text-xs font-semibold text-slate-500">
                Menampilkan <span className="text-slate-800 dark:text-slate-250">{(page - 1) * limit + 1}</span> -{" "}
                <span className="text-slate-800 dark:text-slate-250">
                  {Math.min(page * limit, totalItems)}
                </span>{" "}
                dari <span className="text-slate-800 dark:text-slate-250">{totalItems}</span> data
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition text-xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="text-xs font-bold text-slate-600 dark:text-slate-350">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition text-xs"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="ml-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-semibold rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {[5, 10, 20, 50].map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      Tampilkan {pageSize}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Print-specific style tag */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 15mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            font-size: 10px !important;
          }
          header, .print\:hidden, button, input, select {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
          table {
            border: 1px solid #cbd5e1 !important;
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            color: black !important;
            word-break: break-word !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
          
          /* Column widths proportional */
          th:nth-child(1), td:nth-child(1) { width: 3% !important; text-align: center !important; } /* No */
          th:nth-child(2), td:nth-child(2) { width: 22% !important; } /* Produk */
          th:nth-child(3), td:nth-child(3) { width: 10% !important; } /* SKU */
          th:nth-child(4), td:nth-child(4) { width: 12% !important; } /* Lot */
          th:nth-child(5), td:nth-child(5) { width: 6% !important; text-align: center !important; } /* Umur Simpan */
          th:nth-child(6), td:nth-child(6) { width: 9% !important; } /* Expired Date */
          th:nth-child(7), td:nth-child(7) { width: 9% !important; } /* Tanggal Penempatan */
          th:nth-child(8), td:nth-child(8) { width: 6% !important; text-align: right !important; } /* Kuantitas */
          th:nth-child(9), td:nth-child(9) { width: 6% !important; text-align: right !important; } /* Kuantum */
          th:nth-child(10), td:nth-child(10) { width: 5% !important; } /* UoM */
          th:nth-child(11), td:nth-child(11) { width: 6% !important; text-align: center !important; } /* Spraying */
          th:nth-child(12), td:nth-child(12) { width: 6% !important; text-align: center !important; } /* Fumigasi */
          th:nth-child(13), td:nth-child(13) { width: 6% !important; text-align: center !important; } /* Fogging */
          th:nth-child(14), td:nth-child(14) { width: 12% !important; } /* Keterangan */
        }
      `}</style>
    </div>
  );
}

// Sub-component: Location selection interface when query param is missing
interface LocationSelectionScreenProps {
  theme: string;
  toggleTheme: () => void;
  token: string | null;
  user: any;
}

function LocationSelectionScreen({ theme, toggleTheme, token, user }: LocationSelectionScreenProps) {
  const router = useRouter();
  const [selectedWarehouseUuid, setSelectedWarehouseUuid] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Get active warehouses list
  const { warehouses, isLoading: warehousesLoading } = usePublicWarehouses();

  // Load locations for the selected warehouse
  const { locations, isLoading: locationsLoading } = usePublicStackCardLocations(selectedWarehouseUuid);

  // Set default warehouse
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && !selectedWarehouseUuid) {
      setSelectedWarehouseUuid(warehouses[0].uuid);
    }
  }, [warehouses, selectedWarehouseUuid]);

  const handleSelectLocation = (loc: string) => {
    router.push(`/kartu-tumpukan?location=${encodeURIComponent(loc)}`);
  };

  // Filter locations based on input query
  const filteredLocations = locations.filter((loc) =>
    loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-200">
      <header className="h-16 flex items-center justify-between px-6 md:px-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="flex items-center">
          <WarehouseIcon className="h-6 w-6 text-blue-600 mr-2.5" />
          <span className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">
            BULOG <span className="text-blue-600 text-xs font-bold font-sans lowercase">WMS</span>
          </span>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-3" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Kartu Tumpukan
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {token ? (
            <Link
              href="/"
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-md transition cursor-pointer text-xs"
            >
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer text-xs"
            >
              <LogIn className="h-4 w-4 mr-1.5 text-slate-500" />
              Masuk Aplikasi
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              Pilih Lokasi Kartu Tumpukan
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-450">
              Silakan pilih gudang dan lokasi tumpukan untuk menampilkan laporan kartu tumpukan.
            </p>
          </div>

          <div className="space-y-4">
            {/* Warehouse Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                Gudang
              </label>
              <div className="relative">
                <select
                  value={selectedWarehouseUuid}
                  onChange={(e) => setSelectedWarehouseUuid(e.target.value)}
                  disabled={warehousesLoading}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-750 dark:text-slate-250 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {warehouses.length === 0 ? (
                    <option>Memuat gudang...</option>
                  ) : (
                    warehouses.map((wh) => (
                      <option key={wh.uuid} value={wh.uuid}>
                        {wh.name} ({wh.code})
                      </option>
                    ))
                  )}
                </select>
                <WarehouseIcon className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
              </div>
            </div>

            {/* Location Filter Query */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                Cari Lokasi / Tumpukan
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama lokasi tumpukan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-750 dark:text-slate-250 rounded-xl focus:outline-none focus:border-blue-500"
                />
                <MapPin className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
              </div>
            </div>

            {/* Locations List */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                Daftar Lokasi Terbit ({filteredLocations.length})
              </span>
              
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-[240px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/30 dark:bg-slate-900/50">
                {locationsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                    <svg className="animate-spin h-5 w-5 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Memuat daftar lokasi...
                  </div>
                ) : filteredLocations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                    Tidak ada lokasi tumpukan terbit untuk kriteria ini.
                  </div>
                ) : (
                  filteredLocations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-250 hover:bg-blue-50/50 dark:hover:bg-slate-800 flex items-center justify-between transition group cursor-pointer"
                    >
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-slate-400 group-hover:text-blue-500" />
                        {loc}
                      </span>
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
                        Buka Kartu
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
