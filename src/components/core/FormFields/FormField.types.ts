import type React from 'react';

/** Form field value type */
export type FormFieldValue = string | number | boolean | null | undefined;

/** Form field validation custom function type */
export type ValidationFunction = (value: FormFieldValue) => string | undefined;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface FormFieldValidation {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: ValidationFunction;
}

export interface UnifiedFormFieldProps {
  // Basic props
  id: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' |
         'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'file';

  // Value and change handling
  value?: FormFieldValue;
  onChange?: (value: FormFieldValue) => void;
  onBlur?: () => void;
  onFocus?: () => void;

  // Label and description
  label?: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  tooltip?: string;

  // Validation and errors
  error?: string;
  validation?: FormFieldValidation;
  showValidationIcon?: boolean;

  // Layout options
  labelPosition?: 'top' | 'left' | 'right' | 'floating';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'bordered';

  // State
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  required?: boolean;

  // Select/Multi-select specific
  options?: SelectOption[];
  multiple?: boolean;
  searchable?: boolean;

  // Textarea specific
  rows?: number;
  resize?: boolean;

  // Number specific
  min?: number;
  max?: number;
  step?: number;

  // Formatting options
  currency?: boolean;
  percentage?: boolean;
  thousandsSeparator?: boolean;

  // Unit display
  unit?: string;
  unitPosition?: 'left' | 'right';

  // Actions
  actions?: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
  }>;

  // Style overrides
  className?: string;
  inputClassName?: string;
  labelClassName?: string;

  // HTML input compatibility — no index signature (TS unknown-inference)
  autoComplete?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'data-testid'?: string;
}
