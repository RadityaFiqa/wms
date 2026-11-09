"use client";

import Select from "react-select";
import type { FlowTrendResponse } from "@bulog-wms/schema";
import { globalSelectStyles } from "@/lib/react-select";
import { formatProductName } from "@/components/analytics/format";

type ProductOption = { value: string; label: string; sku: string };

interface ProductFilterSelectProps {
  /** Products with movement in the selected range */
  options: FlowTrendResponse["skuOptions"];
  value: string;
  onChange: (productUuid: string) => void;
  isLoading?: boolean;
}

/** Searchable product filter, grouped per commodity; only lists products that moved in the range */
export default function ProductFilterSelect({ options, value, onChange, isLoading }: ProductFilterSelectProps) {
  const byCategory = new Map<string, ProductOption[]>();
  for (const o of options) {
    const list = byCategory.get(o.category) || [];
    list.push({ value: o.productUuid, label: formatProductName(o.name), sku: o.sku });
    byCategory.set(o.category, list);
  }
  const groups = Array.from(byCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, list]) => ({ label, options: list.sort((a, b) => a.label.localeCompare(b.label)) }));
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value) ?? null;

  return (
    <Select<ProductOption, false>
      inputId="analytics-product-filter"
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? "")}
      options={groups}
      isClearable
      isSearchable
      isLoading={isLoading}
      placeholder="Semua produk"
      noOptionsMessage={() => "Tidak ada produk yang bergerak di rentang ini"}
      filterOption={(opt, input) => {
        const q = input.toLowerCase();
        return opt.data.label.toLowerCase().includes(q) || opt.data.sku.toLowerCase().includes(q);
      }}
      formatOptionLabel={(opt, { context }) =>
        context === "value" ? (
          <span className="truncate">{opt.label}</span>
        ) : (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{opt.label}</div>
            <div className="text-[11px] opacity-60">{opt.sku}</div>
          </div>
        )
      }
      className="text-sm"
      classNamePrefix="react-select"
      styles={{
        ...globalSelectStyles,
        control: (base, state) => ({
          ...globalSelectStyles.control!(base, state),
          minHeight: 38,
          borderRadius: "0.75rem",
        }),
      }}
    />
  );
}
