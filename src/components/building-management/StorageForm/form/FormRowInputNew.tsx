'use client';

import React from 'react';
import { UnifiedFormField, type FormFieldValue } from '@/components/core/FormFields/FormField';

interface Props {
  label: string;
  value: string | number;
  onChange: (value: FormFieldValue) => void;
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
  // 🏢 ENTERPRISE: Generate unique id from name/label
  const fieldId = name || label.toLowerCase().replace(/\s+/g, '_');

  return (
    <UnifiedFormField
      id={fieldId}
      label={label}
      name={fieldId}
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      helpText={helper}
      error={error}
      unit={typeof trailingElement === 'string' ? trailingElement : undefined}
      variant="default"
      size="md"
    />
  );
}