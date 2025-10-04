
'use client';

import React from 'react';

interface FilterSelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: { id: string; name: string }[];
  placeholder: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="h-9 px-3 rounded-md border border-input bg-background text-sm"
    >
      <option value="all">{placeholder}</option>
      {options && options.map((opt) => (
        <option key={opt.id} value={opt.name}>
          {opt.name}
        </option>
      ))}
    </select>
  );
}
