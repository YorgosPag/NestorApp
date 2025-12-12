'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
}

export function FormRowSelect({ label, value, options, onChange, required }: Props) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && ' *'}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full px-3 rounded-md border border-input bg-background text-sm ${INTERACTIVE_PATTERNS.FORM_FIELD}`}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
