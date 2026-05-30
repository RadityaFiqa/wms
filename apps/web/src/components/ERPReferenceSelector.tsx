import React from 'react';
import CreatableSelect from 'react-select/creatable';

interface ERPReferenceSelectorProps {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
}

export function ERPReferenceSelector({ value, onChange, placeholder }: ERPReferenceSelectorProps) {
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
        styles={{
          control: (base) => ({
            ...base,
            backgroundColor: '#f8fafc',
            borderColor: '#e2e8f0',
            borderRadius: '0.5rem',
            padding: '2px',
            fontSize: '0.875rem',
            fontWeight: '600',
            '&:hover': {
              borderColor: '#3b82f6',
            },
          }),
          multiValue: (base) => ({
            ...base,
            backgroundColor: '#e0f2fe',
            borderRadius: '0.375rem',
            border: '1px solid #bae6fd',
          }),
          multiValueLabel: (base) => ({
            ...base,
            color: '#0369a1',
            fontWeight: '700',
          }),
          multiValueRemove: (base) => ({
            ...base,
            color: '#0284c7',
            ':hover': {
              backgroundColor: '#bae6fd',
              color: '#0369a1',
            },
          }),
        }}
      />
    </div>
  );
}
