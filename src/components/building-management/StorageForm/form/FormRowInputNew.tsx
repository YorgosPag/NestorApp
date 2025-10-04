'use client';

import React from 'react';
import { UnifiedFormField } from '@/components/core/FormFields/FormField';

interface Props {
  label: string;
  value: string | number;
  onChange: (value: any) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  helper?: string;
  trailingElement?: React.ReactNode;
  disabled?: boolean;
  name?: string;
}

export function FormRowInputNew({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  required,
  helper,
  trailingElement,
  disabled = false,
  name
}: Props) {
  return (
    <UnifiedFormField
      label={label}
      name={name || label.toLowerCase().replace(/\s+/g, '_')}
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      helperText={helper}
      error={error}
      suffix={trailingElement}
      variant="default"
      size="default"
    />
  );
}