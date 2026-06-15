import React, { useState, useEffect, useMemo } from 'react';
import { X, Boxes, MapPin, Layers, Info, Check, AlertTriangle, Loader2, Package } from 'lucide-react';
import Select, { components } from 'react-select';
import { ProductSelector } from './ProductSelector';
import { globalSelectStyles } from '@/lib/react-select';
import { useInventoryDetail, useWarehouseLocations } from '@/hooks/useInventory';

interface AddCargoItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: 'IN' | 'OUT';
  onAdd: (data: {
    productId: number;
    quantity: number;
    quantId?: number | null;
    locationId?: number | null;
    productData: any;
  }) => void | Promise<void>;
  editData?: {
    productId: number;
    quantity: number;
    locationId?: number | null;
    quantId?: number | null;
    name: string;
    sku: string;
    uom: string;
    uuid?: string;
  } | null;
}

export function AddCargoItemDrawer({ isOpen, onClose, cardType, onAdd, editData }: AddCargoItemDrawerProps) {
  // 1. Component State
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
    sku: string;
    uom?: string;
    uuid?: string;
  } | null>(null);

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedQuantId, setSelectedQuantId] = useState<number | null>(null);
  const [selectedStack, setSelectedStack] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2. Data Fetching
  const { locations: allWarehouseLocations } = useWarehouseLocations();
  const { detailData: productDetail, isLoading: isDetailLoading } = useInventoryDetail(
    selectedProduct?.uuid || undefined
  );

  // Reset state when drawer is opened/closed or editData changes
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setSelectedProduct({
          id: editData.productId,
          name: editData.name,
          sku: editData.sku,
          uom: editData.uom,
          uuid: editData.uuid,
        });
        setSelectedLocationId(editData.locationId || null);
        setSelectedQuantId(editData.quantId || null);
        setQuantity(editData.quantity);
      } else {
        setSelectedProduct(null);
        setSelectedLocationId(null);
        setSelectedQuantId(null);
        setSelectedStack(null);
        setQuantity(1);
      }
      setIsSubmitting(false);
    }
  }, [isOpen, editData]);

  // Group locations & filter out those with 0 stock (for OUT)
  const groupedLocations = useMemo(() => {
    if (!productDetail || !productDetail.locations) return [];
    return productDetail.locations
      .map((loc: any) => ({
        ...loc,
        quants: loc.quants.filter((q: any) => q.availableQuantity > 0),
      }))
      .filter((loc: any) => loc.quants.length > 0);
  }, [productDetail]);

  // Find location display name
  const selectedLocationName = useMemo(() => {
    if (!selectedLocationId) return null;
    return (
      groupedLocations.find((l: any) => l.locationId === selectedLocationId)
        ?.locationDisplayName || null
    );
  }, [selectedLocationId, groupedLocations]);

  // Options for IN & OUT (Grouped locations and quants)
  const selectOptions = useMemo(() => {
    return groupedLocations.map((loc: any) => ({
      label: loc.locationDisplayName || loc.displayName || 'Lokasi Tanpa Nama',
      options: loc.quants.map((q: any, idx: number) => ({
        value: q.uuid,
        label: q.lotName || '-',
        quant: q,
        location: loc,
        uom: selectedProduct?.uom || 'Unit',
        isLast: idx === loc.quants.length - 1,
      })),
    }));
  }, [groupedLocations, selectedProduct]);

  // Selected Option for both IN & OUT
  const selectedOption = useMemo(() => {
    if (!selectedQuantId) return null;
    // Find the correct option in selectOptions
    for (const group of selectOptions) {
      const found = group.options.find((opt: any) => opt.quant.id === selectedQuantId);
      if (found) return found;
    }
    return null;
  }, [selectedQuantId, selectOptions]);

  // Synchronize selected stack details when selectedOption changes
  useEffect(() => {
    if (selectedOption) {
      setSelectedStack(selectedOption.quant);
      setSelectedLocationId(selectedOption.location.locationId);
    }
  }, [selectedOption]);

  // Custom Search / Filter for React Select
  const customFilterOption = (
    option: { label: string; value: string; data: any },
    rawInput: string
  ) => {
    const input = rawInput.toLowerCase().trim();
    if (!input) return true;

    // Search Lot Name
    const lotName = (option.data.label || '').toLowerCase();
    if (lotName.includes(input)) return true;

    // Search Location Name
    const locationName = (option.data.location?.locationDisplayName || option.data.location?.displayName || '').toLowerCase();
    if (locationName.includes(input)) return true;

    return false;
  };

  // Custom Option rendering for React Select (Tree View)
  const CustomOption = (props: any) => {
    const { data } = props;
    const connector = data.isLast ? '└─' : '├─';
    const subConnector = data.isLast ? '   ' : '│  ';
    return (
      <components.Option {...props}>
        <div className="flex flex-col text-xs font-semibold pl-2 py-0.5 text-inherit">
          <div className="flex items-center space-x-1.5 text-inherit">
            <span className="text-inherit opacity-60 font-mono text-[11px] select-none">{connector}</span>
            <span className="font-bold font-mono truncate text-inherit">{data.label}</span>
          </div>
          <div className="text-[10px] text-inherit opacity-75 font-medium pl-5 mt-0.5">
            <span className="font-mono text-inherit opacity-60 text-[10px] select-none mr-1.5">{subConnector}</span>
            Available: {data.quant.availableQuantity.toLocaleString('id-ID')} {data.uom || 'Unit'}
          </div>
        </div>
      </components.Option>
    );
  };

  // Custom Group Heading formatting
  const formatGroupLabel = (data: any) => (
    <div className="flex items-center space-x-1.5 text-inherit font-extrabold text-[11px] py-1 border-b border-slate-100/50">
      <MapPin className="h-3.5 w-3.5 text-[var(--accent-foreground)] shrink-0" />
      <span>{data.label}</span>
    </div>
  );

  // Quantity validations
  const validationError = useMemo(() => {
    if (!selectedQuantId) return null;

    if (quantity <= 0 || isNaN(quantity)) {
      return 'Jumlah kuantitas harus lebih besar dari 0.';
    }

    if (selectedStack) {
      if (quantity > selectedStack.availableQuantity) {
        return `Kuantitas melebihi stok tersedia di tumpukan (Maks: ${selectedStack.availableQuantity}).`;
      }
    }

    return null;
  }, [quantity, selectedStack, selectedQuantId]);

  const isValid = selectedProduct && !!selectedQuantId && !validationError;

  const handleAddSubmit = async () => {
    if (!isValid || !selectedProduct) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        productId: selectedProduct.id,
        quantity,
        quantId: selectedQuantId,
        locationId: selectedLocationId,
        productData: {
          id: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          uom: selectedProduct.uom || 'Unit',
          locLabel: selectedLocationName,
          quantLabel: selectedStack?.lotName || null,
          quantId: selectedQuantId,
          quantUuid: selectedStack?.uuid || null,
          locationId: selectedLocationId,
          locationDisplayName: selectedLocationName,
          lotName: selectedStack?.lotName || null,
          availableQuantity: selectedStack?.availableQuantity || null,
          secondaryUnitQty: selectedStack?.secondaryUnitQty || null,
        },
      });
      onClose();
    } catch (err) {
      // Errors handled by parent component / hooks
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div className="relative w-full max-w-md bg-slate-50 h-full shadow-2xl flex flex-col z-10 animate-slide-in-right border-l border-slate-200">
        
        {/* Drawer Header */}
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center">
              <Boxes className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
              Tambah Barang Muatan
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Alur pemuatan cepat {cardType === 'IN' ? 'Gate IN (Masuk)' : 'Gate OUT (Keluar)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* STEP 1: Select Product */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Produk / Barang</h4>
            </div>
            {editData ? (
              <div className="p-3 bg-slate-50 border border-slate-250 rounded-lg">
                <span className="text-[10px] text-slate-400 font-mono block">SKU: {selectedProduct?.sku}</span>
                <span className="text-xs font-black text-slate-800">{selectedProduct?.name}</span>
              </div>
            ) : (
              <ProductSelector
                value={selectedProduct?.id || 0}
                onChange={(id, productData) => {
                  if (productData) {
                    setSelectedProduct({
                      id: productData.id,
                      name: productData.name,
                      sku: productData.sku,
                      uom: productData.uom,
                      uuid: productData.uuid,
                    });
                  } else {
                    setSelectedProduct(null);
                  }
                  // Reset step 2 & 3
                  setSelectedLocationId(null);
                  setSelectedQuantId(null);
                  setSelectedStack(null);
                  setQuantity(1);
                }}
              />
            )}
          </div>

          {/* STEP 2: Select Location & Stack */}
          <div className={`bg-white border rounded-xl p-4 space-y-3 shadow-xs transition ${
            selectedProduct ? 'border-slate-200 opacity-100' : 'border-slate-150 opacity-60'
          }`}>
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${
                selectedProduct ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
              }`}>2</span>
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Pilih Lokasi & Tumpukan</h4>
            </div>

            {!selectedProduct ? (
              <p className="text-[11px] text-slate-400 italic font-medium">Pilih produk terlebih dahulu.</p>
            ) : isDetailLoading ? (
              <div className="flex items-center space-x-2 text-slate-500 py-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">Memuat info lokasi...</span>
              </div>
            ) : groupedLocations.length === 0 ? (
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg flex items-start space-x-2 text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold leading-normal">Produk tidak tersedia di lokasi manapun dalam gudang ini (Stok: 0).</span>
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  options={selectOptions}
                  value={selectedOption}
                  onChange={(option: any) => {
                    if (option) {
                      setSelectedQuantId(option.quant.id);
                      setSelectedLocationId(option.location.locationId);
                      setSelectedStack(option.quant);
                    } else {
                      setSelectedQuantId(null);
                      setSelectedLocationId(null);
                      setSelectedStack(null);
                    }
                    setQuantity(1);
                  }}
                  placeholder="-- Pilih Lokasi & Tumpukan (Quant) --"
                  isSearchable
                  filterOption={customFilterOption}
                  components={{ Option: CustomOption }}
                  formatGroupLabel={formatGroupLabel}
                  styles={globalSelectStyles}
                  noOptionsMessage={() => "Tidak ada lokasi atau tumpukan aktif"}
                />
              </div>
            )}
          </div>

                    {/* STOCK SUMMARY CARD */}
          {selectedProduct && selectedStack && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-750 rounded-2xl p-5 shadow-lg border border-blue-500/10 text-white space-y-3.5 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-black tracking-tight">Ringkasan Barang Terpilih</h4>
                  <p className="text-[10px] text-blue-200 font-mono mt-0.5">SKU: {selectedProduct.sku}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-white/20 text-white select-none">
                  Ready
                </span>
              </div>

              <div className="space-y-1.5 font-semibold text-blue-100 text-xs border-t border-white/10 pt-3">
                <div className="flex justify-between items-start">
                  <span className="text-blue-200 w-28 shrink-0">Produk</span>
                  <span className="text-blue-300 mr-2 shrink-0">:</span>
                  <span className="text-white font-black flex-1 text-right truncate">
                    {selectedProduct.name}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-blue-200 w-28 shrink-0">Lokasi</span>
                  <span className="text-blue-300 mr-2 shrink-0">:</span>
                  <span className="text-white font-black flex-1 text-right truncate">
                    {selectedLocationName || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-blue-200 w-28 shrink-0">Lot/Tumpukan</span>
                  <span className="text-blue-300 mr-2 shrink-0">:</span>
                  <span className="text-white font-black flex-1 text-right truncate font-mono">
                    {selectedStack.lotName || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-start border-t border-white/10 pt-1.5 mt-1">
                  <span className="text-blue-200 w-28 shrink-0">Qty Tersedia</span>
                  <span className="text-blue-300 mr-2 shrink-0">:</span>
                  <span className="text-amber-300 font-black flex-1 text-right text-sm">
                    {selectedStack.availableQuantity.toLocaleString('id-ID')} {selectedProduct.uom || 'Unit'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Input Quantity */}
          <div className={`bg-white border rounded-xl p-4 space-y-3 shadow-xs transition ${
            selectedQuantId ? 'border-slate-200 opacity-100' : 'border-slate-150 opacity-60'
          }`}>
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${
                selectedQuantId ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-550'
              }`}>3</span>
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Tentukan Jumlah (Qty)</h4>
            </div>

            {!selectedQuantId ? (
              <p className="text-[11px] text-slate-400 italic font-medium">Pilih lokasi & tumpukan terlebih dahulu.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="Masukkan kuantitas..."
                        value={quantity}
                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-bold h-[38px]"
                      />
                  </div>
                  <div className="w-24 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-center font-extrabold text-slate-600 h-[38px] flex items-center justify-center">
                    {selectedProduct?.uom || 'Unit'}
                  </div>
                </div>

                {/* Real-time Validation Message */}
                {validationError ? (
                  <div className="text-[11px] font-semibold text-red-650 flex items-center">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1 shrink-0" />
                    {validationError}
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-green-700 flex items-center">
                    <Check className="h-3.5 w-3.5 mr-1 shrink-0" />
                    {selectedStack
                      ? `Kuantitas valid (Tersedia: ${selectedStack.availableQuantity} ${selectedProduct?.uom || 'Unit'})`
                      : 'Kuantitas input valid.'}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition disabled:opacity-40 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleAddSubmit}
            disabled={!isValid || isSubmitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs shadow-md transition cursor-pointer flex items-center"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Tambah Barang
          </button>
        </div>

      </div>
    </div>
  );
}
