import React from "react";
import CreatableSelect from "react-select/creatable";
import { globalSelectStyles } from "@/lib/react-select";

interface ERPReferenceSelectorProps {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
}

export function ERPReferenceSelector({
  value,
  onChange,
  placeholder,
}: ERPReferenceSelectorProps) {
  const options = (value || []).map((v) => ({ value: v, label: v }));

  return (
    <div className="w-full">
      <CreatableSelect
        isMulti
        placeholder={placeholder}
        value={options}
        onChange={(newVal: any) => {
          onChange(newVal ? newVal.map((opt: any) => opt.value) : []);
        }}
        options={[]}
        noOptionsMessage={() => "Ketik nomor referensi dan tekan Enter"}
        formatCreateLabel={(inputValue) => `Tambah "${inputValue}"`}
        className="text-sm"
        classNamePrefix="react-select"
        styles={globalSelectStyles}
      />
    </div>
  );
}
