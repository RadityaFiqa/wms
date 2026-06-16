import React, { useState, useEffect } from "react";
import Select from "react-select";
import { useErpDocuments } from "@/hooks/useErpDocuments";
import { useDebounce } from "@/hooks/useDebounce";
import { globalSelectStyles } from "@/lib/react-select";

interface DocumentReferenceSelectorProps {
  value: number | null;
  cardType: "IN" | "OUT";
  onChange: (docRef: any) => void;
  error?: string;
  disabled?: boolean;
  gateOperationUuid?: string;
}

export function DocumentReferenceSelector({
  value,
  cardType,
  onChange,
  error,
  disabled,
  gateOperationUuid,
}: DocumentReferenceSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const debouncedSearch = useDebounce(inputValue, 300);

  const { documentsData, isLoading } = useErpDocuments({
    search: debouncedSearch || undefined,
    type: cardType,
    limit: 20,
    gateOperationUuid: gateOperationUuid || undefined,
  });

  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Cache selected document to keep it in options list
  useEffect(() => {
    if (value && documentsData?.data) {
      const found = documentsData.data.find((d: any) => d.id === value);
      if (found) {
        setSelectedDoc(found);
      }
    }
  }, [value, documentsData]);

  const optionsMap = new Map();

  if (selectedDoc) {
    const label = `${selectedDoc.documentNumber} ${selectedDoc.origin ? `(${selectedDoc.origin})` : ""} - ${selectedDoc.partnerName || "Tanpa Partner"}`;
    optionsMap.set(selectedDoc.id, {
      value: selectedDoc.id,
      label,
      doc: selectedDoc,
    });
  }

  const items = documentsData?.data || [];
  items.forEach((d: any) => {
    const label = `${d.documentNumber} ${d.origin ? `(${d.origin})` : ""} - ${d.partnerName || "Tanpa Partner"}`;
    optionsMap.set(d.id, {
      value: d.id,
      label,
      doc: d,
    });
  });

  console.log(`items`, items);

  const options = Array.from(optionsMap.values());

  console.log(`options`, options);
  const selectedOption = options.find((opt) => opt.value === value) || null;

  console.log(
    "[DocumentReferenceSelector] documentsData:",
    documentsData,
    "inputValue:",
    inputValue,
    "options:",
    options,
    "selectedOption:",
    selectedOption,
  );

  return (
    <div className="w-full">
      <Select
        value={selectedOption}
        onInputChange={(val) => setInputValue(val)}
        onChange={(opt: any) => {
          setSelectedDoc(opt ? opt.doc : null);
          onChange(opt ? opt.doc : null);
        }}
        options={options}
        isLoading={isLoading}
        placeholder="Ketik No Dokumen, Asal Dokumen, atau Nama Partner..."
        isClearable
        isSearchable
        isDisabled={disabled}
        noOptionsMessage={() =>
          isLoading ? "Memuat..." : "Dokumen ERP tidak ditemukan"
        }
        className="text-sm"
        classNamePrefix="react-select"
        styles={globalSelectStyles}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
