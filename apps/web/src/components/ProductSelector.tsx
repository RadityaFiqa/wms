import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useProducts } from '@/hooks/useInventory';
import { useDebounce } from '@/hooks/useDebounce';

interface ProductSelectorProps {
  value: number;
  onChange: (productId: number, product?: any) => void;
  error?: string;
}

export function ProductSelector({ value, onChange, error }: ProductSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 300);
  
  const { products, isLoading } = useProducts({ search: debouncedSearch || undefined });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Cache selected product details to ensure it stays in options list even when search changes
  useEffect(() => {
    if (value && products && products.length > 0) {
      const found = products.find((p: any) => p.id === value);
      if (found) {
        setSelectedProduct(found);
      }
    }
  }, [value, products]);

  // Combine cached product and search results
  const optionsMap = new Map();
  
  if (selectedProduct) {
    optionsMap.set(selectedProduct.id, {
      value: selectedProduct.id,
      label: `[${selectedProduct.sku}] ${selectedProduct.name} (${selectedProduct.uom || 'Unit'})`,
      product: selectedProduct,
    });
  }

  (products || []).forEach((p: any) => {
    optionsMap.set(p.id, {
      value: p.id,
      label: `${p.name} (${p.uom || 'Unit'})`,
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
        onChange={(opt: any) => {
          setSelectedProduct(opt ? opt.product : null);
          onChange(opt ? opt.value : 0, opt ? opt.product : null);
        }}
        options={options}
        isLoading={isLoading}
        placeholder="Ketik SKU atau nama barang..."
        isClearable
        isSearchable
        noOptionsMessage={() => (isLoading ? 'Memuat...' : 'Produk tidak ditemukan')}
        className="text-sm"
        classNamePrefix="react-select"
        styles={{
          control: (base) => ({
            ...base,
            backgroundColor: '#f8fafc',
            borderColor: '#e2e8f0',
            borderRadius: '0.5rem',
            padding: '2px',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#0f172a',
            '&:hover': {
              borderColor: '#3b82f6',
            },
          }),
          option: (base, state) => ({
            ...base,
            color: '#1e293b',
            backgroundColor: state.isSelected ? '#e2e8f0' : state.isFocused ? '#f1f5f9' : '#ffffff',
            fontSize: '0.875rem',
            fontWeight: '550',
            cursor: 'pointer',
            '&:active': {
              backgroundColor: '#cbd5e1',
            },
          }),
          singleValue: (base) => ({
            ...base,
            color: '#0f172a',
          }),
          noOptionsMessage: (base) => ({
            ...base,
            color: '#64748b',
            fontSize: '0.875rem',
          }),
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
