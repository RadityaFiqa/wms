import React, { useState } from "react";
import Select from "react-select";
import { useProducts, useInventoryDetail } from "@/hooks/useInventory";
import { useDebounce } from "@/hooks/useDebounce";
import { globalSelectStyles } from "@/lib/react-select";

interface Product {
  uuid: string;
  sku: string;
  name: string;
  uom?: string;
}

interface ProductSearchSelectProps {
  value: string;
  onValueChange: (uuid: string) => void;
  warehouseId?: string; // Standardized in component signature, but active warehouse is determined by backend auth/headers
  placeholder?: string;
  clearable?: boolean;
  error?: string;
}

interface SelectOption {
  value: string;
  label: string;
  product: Product;
}

export function ProductSearchSelect({
  value,
  onValueChange,
  placeholder = "Cari kode atau nama produk...",
  clearable = true,
  error,
}: ProductSearchSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const debouncedSearch = useDebounce(inputValue, 300);

  const { products, isLoading } = useProducts({
    search: debouncedSearch || undefined,
    selectedUuid: value || undefined,
  });

  const { detailData } = useInventoryDetail(value || undefined);

  // Determine selected product details on the fly to avoid useEffect/setState cascades
  const selectedProduct =
    (detailData && detailData.uuid === value)
      ? (detailData as Product)
      : ((products as Product[] || []).find((p) => p.uuid === value) || null);

  const optionsMap = new Map<string, SelectOption>();

  // Prepend the selected product first to keep its display label correct
  if (selectedProduct) {
    optionsMap.set(selectedProduct.uuid, {
      value: selectedProduct.uuid,
      label: `[${selectedProduct.sku}] ${selectedProduct.name}`,
      product: selectedProduct,
    });
  }

  // Add all other products from search results
  (products as Product[] || []).forEach((p) => {
    optionsMap.set(p.uuid, {
      value: p.uuid,
      label: `[${p.sku}] ${p.name}`,
      product: p,
    });
  });

  const options = Array.from(optionsMap.values());
  const selectedOption = options.find((opt) => opt.value === value) || null;

  return (
    <div className="w-full">
      <Select
        value={selectedOption}
        onInputChange={(val) => setInputValue(val)}
        onChange={(opt: unknown) => {
          const selectedOpt = opt as SelectOption | null;
          onValueChange(selectedOpt ? selectedOpt.value : "");
        }}
        options={options}
        isLoading={isLoading}
        placeholder={placeholder}
        isClearable={clearable}
        isSearchable
        noOptionsMessage={() =>
          isLoading ? "Memuat..." : "Produk tidak ditemukan"
        }
        className="text-sm"
        classNamePrefix="react-select"
        styles={globalSelectStyles}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
