'use client';

import React from 'react';
import { UnifiedFormField, type FormFieldValue } from '@/components/core/FormFields/FormField';
import { DROPDOWN_PLACEHOLDERS } from '@/constants/property-statuses-enterprise';

interface Props {
  label: string;
  value: string;
  options: string[] | { value: string; label: string }[];
  onChange: (value: FormFieldValue) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  helper?: string;
  name?: string;
}

export function FormRowSelectNew({ 
  label, 
  value, 
  options, 
  onChange, 
  required,
  disabled = false,
  placeholder = DROPDOWN_PLACEHOLDERS.GENERIC_SELECT,
  error,
  helper,
  name
}: Props) {
  // Convert string array to option objects if needed
  const selectOptions = options.map(option => {
    if (typeof option === 'string') {
      return { value: option, label: option };
    }
    return option;
  });

  // 🏢 ENTERPRISE: Generate unique id from name/label
  const fieldId = name || label.toLowerCase().replace(/\s+/g, '_');

  return (
    <UnifiedFormField
      id={fieldId}
      label={label}
      name={fieldId}
      type="select"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      helpText={helper}
      error={error}
      options={selectOptions}
      variant="default"
      size="md"
    />
  );
}