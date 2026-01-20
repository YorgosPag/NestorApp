'use client';

import React from 'react';
import { UnifiedFormField } from '@/components/core/FormFields/FormField';
import { DROPDOWN_PLACEHOLDERS } from '@/constants/property-statuses-enterprise';

interface Props {
  label: string;
  value: string;
  options: string[] | { value: string; label: string }[];
  onChange: (value: string) => void;
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

  return (
    <UnifiedFormField
      label={label}
      name={name || label.toLowerCase().replace(/\s+/g, '_')}
      type="select"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      helperText={helper}
      error={error}
      options={selectOptions}
      variant="default"
      size="md"
    />
  );
}