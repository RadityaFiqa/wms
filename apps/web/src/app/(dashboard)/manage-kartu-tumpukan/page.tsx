"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import {
  useStackCards,
  useStackCardDates,
  useStackCardLocations,
  useStackCardHistory,
  useStackCardActions,
} from "@/hooks/useStackCard";
import { useWarehouseLocations } from "@/hooks/useInventory";
import { parseCSV, validateAndMapCSV, CSVRowData } from "@/lib/csv";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  MapPin,
  Calendar,
  Layers,
  Tag,
  Box,
  Scale,
  Settings,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Edit,
  Plus,
  ArrowLeft,
  History,
  Check,
  X,
  FileText,
  User,
  Clock,
  RefreshCw,
  AlertCircle,
  Info,
} from "lucide-react";

export default function StackCardManagePage() {
  const { user, activeWarehouse, hasPermission } = useAuthStore();
  const {
    importStackCards,
    updateStackCard,
    deleteStackCard,
    bulkDeleteStackCards,
    bulkPublishStackCards,
    publishSnapshotDate,
  } = useStackCardActions();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"data" | "history">("data");

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [publishStatus, setPublishStatus] = useState<string>("all"); // all, true, false
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = search; // We will use simple state or debouncing

  // Pagination & Sorting
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [sortField, setSortField] = useState<string>("placementDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected row UUIDs for bulk actions
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  
  // Single row actions target
  const [selectedRow, setSelectedRow] = useState<any>(null);
  
  // CSV Upload specific state
  const [uploadSnapshotDate, setUploadSnapshotDate] = useState<string>("");
  const [uploadLocation, setUploadLocation] = useState<string>("");
  const [uploadActionType, setUploadActionType] = useState<"REPLACE" | "APPEND">("REPLACE");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<CSVRowData[]>([]);
  const [parsingErrors, setParsingErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Fetch warehouse locations (metadata from ERP/quants)
  const { locations: systemLocations } = useWarehouseLocations();

  // Get available dates and locations for the selected warehouse (include draft ones)
  const { dates: allDates, refreshDates } = useStackCardDates(false);
  const { locations: allLocations, refreshLocations } = useStackCardLocations(false);

  // Fetch history logs
  const { historyData: uploadLogs, refreshHistory } = useStackCardHistory();

  // Fetch stack cards data (draft + published)
  const { stackCardData, isLoading: dataLoading, refresh: refreshCards } = useStackCards({
    search: debouncedSearch,
    page,
    limit,
    locationName: selectedLocation,
    snapshotDate: selectedDate,
    isPublished: publishStatus === "all" ? undefined : publishStatus,
  });

  // Check write permissions
  const canManage = hasPermission("update", "Inventory");

  // Format date to Indonesian locale "dd MMM yyyy"
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
      };
      return date.toLocaleDateString("id-ID", options);
    } catch (e) {
      return dateStr;
    }
  };

  // Format Number with thousands separator
  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString("id-ID");
  };

  // Set default date when allDates changes
  useEffect(() => {
    if (allDates && allDates.length > 0 && !selectedDate) {
      setSelectedDate(allDates[0].split("T")[0]);
    }
  }, [allDates, selectedDate]);

  // Set initial upload snapshot date to today's date local
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setUploadSnapshotDate(today);
  }, [isUploadModalOpen]);

  // Download template CSV
  const handleDownloadTemplate = () => {
    const headers = [
      "No",
      "Produk",
      "SKU",
      "Lot",
      "Umur Simpan (Bulan)",
      "Expired Date / Best Before",
      "Tanggal Penempatan",
      "Lokasi",
      "Kuantitas",
      "Kuantum",
      "UoM",
      "Spraying",
      "Fumigasi",
      "Fogging",
      "Keterangan",
    ];

    const sampleRow = [
      "1",
      "BERAS MEDIUM HASIL GILING 25% POLOS 50 KG PSO DN",
      "B0010193Z",
      "LT9078146/03/2026/17010",
      "3",
      "06 March 2029",
      "06 March 2026",
      "GBB 01/A01.1.1",
      "1200",
      "60000",
      "Pack 50 KG",
      "28 May 2026",
      "19 March 2026",
      "-",
      "Kondisi beras baik",
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), sampleRow.join(",")].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template-kartu-tumpukan.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Handle CSV file selection and parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadFile(null);
      setParsedPreview([]);
      setParsingErrors([]);
      return;
    }

    setUploadFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rawRows = parseCSV(text);
      const { validRows, errors } = validateAndMapCSV(rawRows);

      if (errors.length > 0) {
        setParsingErrors(errors);
        setParsedPreview([]);
      } else {
        setParsingErrors([]);
        setParsedPreview(validRows);
      }
    };
    reader.onerror = () => {
      setParsingErrors(["Gagal membaca file CSV."]);
    };
    reader.readAsText(file);
  };

  // Handle CSV import confirm
  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0 || !uploadSnapshotDate || !uploadLocation || !uploadFile) {
      toast.error("Mohon lengkapi seluruh konfigurasi upload.");
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading("Sedang mengimpor data kartu tumpukan...");
    try {
      // Overwrite the locationName inside parsed rows with the target location configuration if not matching
      const mappedRows = parsedPreview.map((row) => ({
        ...row,
        locationName: uploadLocation, // force upload location from the dropdown/input
      }));

      await importStackCards({
        snapshotDate: uploadSnapshotDate,
        locationName: uploadLocation,
        actionType: uploadActionType,
        filename: uploadFile.name,
        rows: mappedRows,
      });

      toast.success("Data kartu tumpukan berhasil diimpor.", { id: toastId });
      setIsUploadModalOpen(false);
      // Clean states
      setUploadFile(null);
      setParsedPreview([]);
      setParsingErrors([]);
      
      // Refresh lists
      refreshCards();
      refreshDates();
      refreshLocations();
      refreshHistory();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal mengimpor data kartu tumpukan.", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  // Publish specific snapshot date page level action
  const handlePublishSnapshotDate = async (publish: boolean) => {
    if (!selectedDate) {
      toast.error("Mohon pilih tanggal snapshot terlebih dahulu.");
      return;
    }

    const label = publish ? "mempublikasikan" : "membatalkan publikasi";
    const toastId = toast.loading(`Sedang ${label} snapshot...`);
    try {
      await publishSnapshotDate(selectedDate, publish);
      toast.success(`Berhasil ${label} seluruh data snapshot ${formatDate(selectedDate)}.`, { id: toastId });
      refreshCards();
    } catch (e: any) {
      toast.error(`Gagal memperbarui status publikasi snapshot.`, { id: toastId });
    }
  };

  // Individual Actions: Publish single row
  const togglePublishSingle = async (row: any) => {
    const nextStatus = !row.isPublished;
    const toastId = toast.loading("Mengubah status publikasi...");
    try {
      await updateStackCard(row.uuid, {
        productName: row.productName,
        sku: row.sku,
        lot: row.lot,
        shelfLife: row.shelfLife,
        expiredDate: row.expiredDate,
        placementDate: row.placementDate,
        locationName: row.locationName,
        quantity: row.quantity,
        quantum: row.quantum,
        uom: row.uom,
        spraying: row.spraying,
        fumigasi: row.fumigasi,
        fogging: row.fogging,
        keterangan: row.keterangan,
        isPublished: nextStatus,
      });
      toast.success("Status publikasi berhasil diperbarui.", { id: toastId });
      refreshCards();
    } catch (e) {
      toast.error("Gagal memperbarui status publikasi.", { id: toastId });
    }
  };

  // Individual Actions: Delete single row
  const handleDeleteRow = async () => {
    if (!selectedRow) return;
    const toastId = toast.loading("Menghapus data...");
    try {
      await deleteStackCard(selectedRow.uuid);
      toast.success("Data berhasil dihapus.", { id: toastId });
      setIsDeleteConfirmOpen(false);
      setSelectedRow(null);
      refreshCards();
      refreshDates();
      refreshLocations();
    } catch (e) {
      toast.error("Gagal menghapus data.", { id: toastId });
    }
  };

  // Bulk actions handlers
  const handleBulkDelete = async () => {
    if (selectedUuids.length === 0) return;
    if (confirm(`Apakah Anda yakin ingin menghapus ${selectedUuids.length} data terpilih?`)) {
      const toastId = toast.loading("Sedang menghapus data...");
      try {
        await bulkDeleteStackCards(selectedUuids);
        toast.success(`Berhasil menghapus ${selectedUuids.length} data.`, { id: toastId });
        setSelectedUuids([]);
        refreshCards();
        refreshDates();
        refreshLocations();
      } catch (e) {
        toast.error("Gagal menghapus data secara bulk.", { id: toastId });
      }
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedUuids.length === 0) return;
    const label = publish ? "mempublikasikan" : "membatalkan publikasi";
    const toastId = toast.loading(`Sedang ${label} data terpilih...`);
    try {
      await bulkPublishStackCards(selectedUuids, publish);
      toast.success(`Berhasil memperbarui status ${selectedUuids.length} data.`, { id: toastId });
      setSelectedUuids([]);
      refreshCards();
    } catch (e) {
      toast.error("Gagal memperbarui status publikasi bulk.", { id: toastId });
    }
  };

  // Checkbox handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUuids(sortedStackCards.map((row: any) => row.uuid));
    } else {
      setSelectedUuids([]);
    }
  };

  const handleSelectRow = (uuid: string) => {
    setSelectedUuids((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    );
  };

  // Row edit handler
  const handleOpenEdit = (row: any) => {
    setSelectedRow({
      ...row,
      expiredDate: row.expiredDate ? row.expiredDate.split("T")[0] : "",
      placementDate: row.placementDate ? row.placementDate.split("T")[0] : "",
      spraying: row.spraying && row.spraying !== "-" ? row.spraying.split("T")[0] : "",
      fumigasi: row.fumigasi && row.fumigasi !== "-" ? row.fumigasi.split("T")[0] : "",
      fogging: row.fogging && row.fogging !== "-" ? row.fogging.split("T")[0] : "",
    });
    setIsEditModalOpen(true);
  };

  // Submit edit row
  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow) return;

    const toastId = toast.loading("Sedang menyimpan perubahan...");
    try {
      await updateStackCard(selectedRow.uuid, {
        productName: selectedRow.productName,
        sku: selectedRow.sku,
        lot: selectedRow.lot,
        shelfLife: parseInt(selectedRow.shelfLife, 10) || 0,
        expiredDate: selectedRow.expiredDate || null,
        placementDate: selectedRow.placementDate,
        locationName: selectedRow.locationName,
        quantity: parseFloat(selectedRow.quantity) || 0,
        quantum: parseFloat(selectedRow.quantum) || 0,
        uom: selectedRow.uom,
        spraying: selectedRow.spraying || null,
        fumigasi: selectedRow.fumigasi || null,
        fogging: selectedRow.fogging || null,
        keterangan: selectedRow.keterangan || null,
      });

      toast.success("Perubahan data berhasil disimpan.", { id: toastId });
      setIsEditModalOpen(false);
      setSelectedRow(null);
      refreshCards();
      refreshDates();
      refreshLocations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan perubahan.", { id: toastId });
    }
  };

  // Sort tables
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const stackCards = stackCardData?.data || [];
  const totalItems = stackCardData?.total || 0;
  const totalPages = stackCardData?.totalPages || 0;

  // Sorting
  const sortedStackCards = [...stackCards].sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "expiredDate" || sortField === "placementDate" || sortField === "snapshotDate") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    if (typeof aVal === "string") {
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <XCircle className="h-16 w-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md mt-2">
          Anda tidak memiliki izin (permission) untuk mengelola data kartu tumpukan di gudang ini.
        </p>
        <Link href="/kartu-tumpukan" className="mt-4 text-blue-600 font-bold hover:underline">
          Kembali ke Detail Kartu Tumpukan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <span>Gudang</span>
            <span>/</span>
            <span>Kartu Tumpukan</span>
            <span>/</span>
            <span className="text-blue-600">Manage</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              href="/kartu-tumpukan"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              Manage Data Kartu Tumpukan
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 ml-9 text-sm">
            Halaman administrator untuk mengunggah, mempublikasikan, dan mengaudit data kartu tumpukan untuk gudang:{" "}
            <span className="font-semibold text-blue-600">{activeWarehouse?.name}</span>.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-350 font-bold px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer text-sm"
          >
            <Download className="h-4 w-4 mr-2 text-slate-550" />
            Template CSV
          </button>
          
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-md transition cursor-pointer text-sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-5">
        <button
          onClick={() => setActiveTab("data")}
          className={`pb-3.5 font-bold text-sm border-b-2 transition cursor-pointer ${
            activeTab === "data"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-650"
          }`}
        >
          <div className="flex items-center">
            <Layers className="h-4 w-4 mr-2" />
            Data Kartu Tumpukan
          </div>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3.5 font-bold text-sm border-b-2 transition cursor-pointer ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-650"
          }`}
        >
          <div className="flex items-center">
            <History className="h-4 w-4 mr-2" />
            Riwayat Upload
          </div>
        </button>
      </div>

      {/* Conditional rendering based on tab */}
      {activeTab === "data" ? (
        <>
          {/* Filters and publishing actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Snapshot Date Select Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tanggal Snapshot
                </label>
                <div className="relative">
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-750 dark:text-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    {allDates.length === 0 ? (
                      <option value="">Belum ada data snapshot</option>
                    ) : (
                      allDates.map((dateStr) => {
                        const formatted = dateStr.split("T")[0];
                        return (
                          <option key={dateStr} value={formatted}>
                            {formatDate(dateStr)}
                          </option>
                        );
                      })
                    )}
                  </select>
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Location Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Lokasi / Tumpukan
                </label>
                <div className="relative">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-750 dark:text-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="">Semua Lokasi / Tumpukan</option>
                    {allLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Status Publish Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status Publish
                </label>
                <div className="relative">
                  <select
                    value={publishStatus}
                    onChange={(e) => setPublishStatus(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-750 dark:text-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="all">Semua Status</option>
                    <option value="true">Published</option>
                    <option value="false">Draft (Unpublished)</option>
                  </select>
                  <Settings className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Search bar */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Cari Produk / SKU / Lot
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ketik kata kunci..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-750 dark:text-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Publishing controls for the selected snapshot date */}
            {selectedDate && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl space-y-3 sm:space-y-0 text-xs">
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-350 font-semibold">
                  <Info className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Publishing Kontrol untuk snapshot tanggal:{" "}
                    <strong className="text-blue-600 dark:text-blue-400">{formatDate(selectedDate)}</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <button
                    onClick={() => handlePublishSnapshotDate(false)}
                    className="bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 dark:text-slate-350 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750 font-bold px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer text-xs"
                  >
                    Unpublish Semua
                  </button>
                  <button
                    onClick={() => handlePublishSnapshotDate(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer text-xs"
                  >
                    Publish Semua
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk actions options bar */}
          {selectedUuids.length > 0 && (
            <div className="flex items-center justify-between p-3.5 bg-slate-850 dark:bg-slate-900 border border-slate-750 rounded-xl text-white text-xs font-semibold animate-fade-in shadow-lg">
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="h-4 w-4 text-blue-400" />
                <span>Terpilih {selectedUuids.length} data baris kartu tumpukan</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => handleBulkPublish(false)}
                  className="bg-slate-750 hover:bg-slate-700 text-white border border-slate-650 px-3 py-1.5 rounded-lg cursor-pointer transition font-bold"
                >
                  Draft (Unpublish)
                </button>
                <button
                  onClick={() => handleBulkPublish(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition font-bold"
                >
                  Publish
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition font-bold flex items-center"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Hapus
                </button>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-455 uppercase tracking-wider sticky top-0 z-1">
                    <th className="py-3.5 px-4 text-center w-12">
                      <input
                        type="checkbox"
                        checked={sortedStackCards.length > 0 && selectedUuids.length === sortedStackCards.length}
                        onChange={handleSelectAll}
                        className="cursor-pointer h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-3.5 px-3 text-center w-12">No</th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("productName")}>
                      Produk {sortField === "productName" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("sku")}>
                      SKU {sortField === "sku" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("lot")}>
                      Lot {sortField === "lot" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("shelfLife")}>
                      Umur Simpan (Bln) {sortField === "shelfLife" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("expiredDate")}>
                      Expired Date {sortField === "expiredDate" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("placementDate")}>
                      Penempatan {sortField === "placementDate" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("locationName")}>
                      Lokasi {sortField === "locationName" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("quantity")}>
                      Qty {sortField === "quantity" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750" onClick={() => handleSort("quantum")}>
                      Kuantum {sortField === "quantum" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-3.5 px-4">UoM</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={14} className="py-10 text-center font-semibold text-slate-455">
                        <svg className="animate-spin h-5 w-5 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Memuat data kartu tumpukan...
                      </td>
                    </tr>
                  ) : sortedStackCards.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-10 text-center font-semibold text-slate-400">
                        <Info className="h-6 w-6 text-slate-350 dark:text-slate-650 mx-auto mb-1.5" />
                        Tidak ada data kartu tumpukan yang cocok.
                      </td>
                    </tr>
                  ) : (
                    sortedStackCards.map((row: any, index: number) => {
                      const isSelected = selectedUuids.includes(row.uuid);
                      const numberIndex = (page - 1) * limit + index + 1;
                      
                      return (
                        <tr
                          key={row.uuid}
                          className={`text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition duration-75 ${
                            isSelected ? "bg-blue-50/25 dark:bg-blue-950/15" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectRow(row.uuid)}
                              className="cursor-pointer h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-400">{numberIndex}</td>
                          <td className="py-3 px-4 font-bold">{row.productName}</td>
                          <td className="py-3 px-4 font-mono font-bold tracking-tight text-slate-500 dark:text-slate-455">
                            {row.sku}
                          </td>
                          <td className="py-3 px-4 font-semibold">{row.lot}</td>
                          <td className="py-3 px-4 text-center font-semibold">{row.shelfLife}</td>
                          <td className="py-3 px-4 font-semibold">{row.expiredDate ? formatDate(row.expiredDate) : "-"}</td>
                          <td className="py-3 px-4 font-semibold">{formatDate(row.placementDate)}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                              {row.locationName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100">
                            {formatNumber(row.quantity)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100">
                            {formatNumber(row.quantum)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-500">{row.uom}</td>
                          
                          {/* Publish Status Badge */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => togglePublishSingle(row)}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                                row.isPublished
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                                  : "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/40"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${row.isPublished ? "bg-emerald-500" : "bg-amber-500"}`} />
                              {row.isPublished ? "Published" : "Draft"}
                            </button>
                          </td>

                          {/* Edit / Delete Buttons */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => handleOpenEdit(row)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded transition cursor-pointer"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRow(row);
                                  setIsDeleteConfirmOpen(true);
                                }}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/25 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded transition cursor-pointer"
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

            {/* Pagination footer */}
            {sortedStackCards.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 px-5 py-3.5 flex items-center justify-between">
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
        </>
      ) : (
        /* Upload History Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-455 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Nama Berkas (Filename)</th>
                  <th className="py-3.5 px-5">Target Lokasi</th>
                  <th className="py-3.5 px-5 text-center">Tanggal Snapshot</th>
                  <th className="py-3.5 px-5 text-center">Jumlah Baris</th>
                  <th className="py-3.5 px-5 text-center">Aksi Impor</th>
                  <th className="py-3.5 px-5">Diunggah Oleh</th>
                  <th className="py-3.5 px-5">Waktu Unggah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {uploadLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center font-semibold text-slate-400">
                      <Clock className="h-6 w-6 text-slate-350 dark:text-slate-650 mx-auto mb-1.5" />
                      Belum ada riwayat aktivitas import CSV untuk gudang ini.
                    </td>
                  </tr>
                ) : (
                  uploadLogs.map((log: any) => (
                    <tr
                      key={log.uuid}
                      className="text-slate-700 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-850/40"
                    >
                      <td className="py-3.5 px-5 font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                        <FileText className="h-4.5 w-4.5 text-blue-500 mr-2 shrink-0" />
                        {log.filename}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                          {log.locationName}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center font-bold">{formatDate(log.snapshotDate)}</td>
                      <td className="py-3.5 px-5 text-center font-black text-blue-600 dark:text-blue-400">
                        {log.rowCount} baris
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            log.actionType === "REPLACE"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                          }`}
                        >
                          {log.actionType}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center">
                          <User className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
                          {log.uploadedBy?.name || "System"}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-450 dark:text-slate-500 font-medium">
                        {new Date(log.uploadedAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <Upload className="h-5.5 w-5.5 text-blue-600" />
                <h3 className="text-lg font-extrabold text-slate-850 dark:text-slate-100">
                  Unggah CSV Kartu Tumpukan
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition cursor-pointer"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Snapshot Date Select */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Tanggal Snapshot <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={uploadSnapshotDate}
                    onChange={(e) => setUploadSnapshotDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Location Input / Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Lokasi target (CSV per lokasi) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    {/* Combobox behavior or custom input with datalist */}
                    <input
                      list="upload-locations-list"
                      type="text"
                      required
                      placeholder="Ketik atau pilih lokasi..."
                      value={uploadLocation}
                      onChange={(e) => setUploadLocation(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="upload-locations-list">
                      {systemLocations.map((loc) => (
                        <option key={loc.id} value={loc.displayName} />
                      ))}
                    </datalist>
                    <MapPin className="absolute right-2.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Upload action type: replace / append */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Aksi Impor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={uploadActionType}
                    onChange={(e) => setUploadActionType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="REPLACE">REPLACE (Ganti data lama)</option>
                    <option value="APPEND">APPEND (Tambahkan data)</option>
                  </select>
                </div>
              </div>

              {/* CSV File Input */}
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center bg-slate-50/50 dark:bg-slate-900/40 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {uploadFile ? uploadFile.name : "Seret file CSV di sini atau Klik untuk memilih"}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Maksimal file 5MB. Hanya mendukung ekstensi berkas .csv
                </p>
              </div>

              {/* CSV formatting helper info */}
              <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-900/20 rounded-xl flex items-start space-x-2 text-[11px] text-slate-500 leading-normal">
                <AlertCircle className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Penting:</strong> Kolom CSV harus sesuai dengan template. Format tanggal penempatan dan expired menggunakan <strong>DD MMM YYYY</strong> (contoh: <code>06 March 2026</code> atau <code>06 Mar 2026</code>). Lokasi baris data akan disesuaikan dengan isian form Lokasi target di atas.
                </span>
              </div>

              {/* Errors Panel */}
              {parsingErrors.length > 0 && (
                <div className="bg-rose-50/60 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center space-x-1.5 text-rose-800 dark:text-rose-400 font-bold">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>Ditemukan {parsingErrors.length} kesalahan validasi CSV:</span>
                  </div>
                  <ul className="list-disc pl-5 text-rose-700 dark:text-rose-455 font-mono text-[10px] space-y-1">
                    {parsingErrors.slice(0, 30).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parsingErrors.length > 30 && <li>...dan {parsingErrors.length - 30} baris kesalahan lainnya.</li>}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {parsedPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
                    <span className="flex items-center">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-500 mr-1.5" />
                      Preview Data ({parsedPreview.length} baris terdeteksi)
                    </span>
                  </div>
                  
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-450 uppercase">
                          <th className="py-2 px-3 text-center">No</th>
                          <th className="py-2 px-3">Produk</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Lot</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Kuantum</th>
                          <th className="py-2 px-3">UoM</th>
                          <th className="py-2 px-3">Penempatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                        {parsedPreview.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 text-center font-bold text-slate-400">{i + 1}</td>
                            <td className="py-2 px-3 font-semibold truncate max-w-xs">{row.productName}</td>
                            <td className="py-2 px-3 font-mono font-bold">{row.sku}</td>
                            <td className="py-2 px-3">{row.lot}</td>
                            <td className="py-2 px-3 text-right font-black">{formatNumber(row.quantity)}</td>
                            <td className="py-2 px-3 text-right font-black">{formatNumber(row.quantum)}</td>
                            <td className="py-2 px-3">{row.uom}</td>
                            <td className="py-2 px-3">{formatDate(row.placementDate)}</td>
                          </tr>
                        ))}
                        {parsedPreview.length > 5 && (
                          <tr className="bg-slate-50/50 dark:bg-slate-800/10 italic text-slate-400">
                            <td colSpan={8} className="py-2 px-3 text-center font-semibold">
                              ...dan {parsedPreview.length - 5} baris data preview lainnya.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end space-x-2.5 bg-slate-50/50 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:text-slate-350 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
              >
                Batal
              </button>
              
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || parsedPreview.length === 0 || !uploadSnapshotDate || !uploadLocation}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-sm flex items-center"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Sedang Mengimpor...
                  </>
                ) : (
                  "Konfirmasi Import"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl animate-scale-in text-xs">
            <form onSubmit={handleConfirmEdit}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100">
                  Ubah Data Kartu Tumpukan
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedRow(null);
                  }}
                  className="p-1 hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-500 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Name */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Nama Produk
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedRow.productName}
                      onChange={(e) => setSelectedRow({ ...selectedRow, productName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* SKU */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      SKU
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedRow.sku}
                      onChange={(e) => setSelectedRow({ ...selectedRow, sku: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Lot */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Lot
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedRow.lot}
                      onChange={(e) => setSelectedRow({ ...selectedRow, lot: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Umur Simpan */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Umur Simpan (Bulan)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={selectedRow.shelfLife}
                      onChange={(e) => setSelectedRow({ ...selectedRow, shelfLife: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Expired Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Expired Date
                    </label>
                    <input
                      type="date"
                      value={selectedRow.expiredDate}
                      onChange={(e) => setSelectedRow({ ...selectedRow, expiredDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Placement Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tanggal Penempatan
                    </label>
                    <input
                      type="date"
                      required
                      value={selectedRow.placementDate}
                      onChange={(e) => setSelectedRow({ ...selectedRow, placementDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Location Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Lokasi / Tumpukan
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedRow.locationName}
                      onChange={(e) => setSelectedRow({ ...selectedRow, locationName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Kuantitas
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={selectedRow.quantity}
                      onChange={(e) => setSelectedRow({ ...selectedRow, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Quantum */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Kuantum
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={selectedRow.quantum}
                      onChange={(e) => setSelectedRow({ ...selectedRow, quantum: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* UoM */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      UoM
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedRow.uom}
                      onChange={(e) => setSelectedRow({ ...selectedRow, uom: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Spraying Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tanggal Spraying
                    </label>
                    <input
                      type="date"
                      value={selectedRow.spraying}
                      onChange={(e) => setSelectedRow({ ...selectedRow, spraying: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Fumigasi Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tanggal Fumigasi
                    </label>
                    <input
                      type="date"
                      value={selectedRow.fumigasi}
                      onChange={(e) => setSelectedRow({ ...selectedRow, fumigasi: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Fogging Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tanggal Fogging
                    </label>
                    <input
                      type="date"
                      value={selectedRow.fogging}
                      onChange={(e) => setSelectedRow({ ...selectedRow, fogging: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Keterangan */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Keterangan
                    </label>
                    <textarea
                      value={selectedRow.keterangan || ""}
                      onChange={(e) => setSelectedRow({ ...selectedRow, keterangan: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg focus:outline-none focus:border-blue-500 min-h-16"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end space-x-2.5 bg-slate-50/50 dark:bg-slate-900/30">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedRow(null);
                  }}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:text-slate-350 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer text-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM DIALOG */}
      {isDeleteConfirmOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-scale-in text-center text-xs">
            <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100 mb-2">
              Hapus Data Kartu Tumpukan
            </h3>
            <p className="text-slate-500 mb-5 leading-relaxed">
              Apakah Anda yakin ingin menghapus data kartu tumpukan untuk lot{" "}
              <strong className="text-slate-700 dark:text-slate-300 font-bold">{selectedRow.lot}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-center space-x-3.5">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setSelectedRow(null);
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:text-slate-350 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750 font-bold px-4 py-2 rounded-lg shadow-xs cursor-pointer text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteRow}
                className="bg-rose-650 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg shadow-xs cursor-pointer text-xs transition"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
