'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Design tokens για centralized styling
export const FORM_STYLES = {
  grid: {
    container: "grid gap-4 py-4",
    field: "grid grid-cols-4 items-center gap-4",
  },
  label: {
    base: "text-right font-medium",
  },
  input: {
    span: "col-span-3",
  }
} as const;

// FormGrid - Container για όλα τα form fields
interface FormGridProps {
  children: React.ReactNode;
  className?: string;
}

export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div className={cn(FORM_STYLES.grid.container, className)}>
      {children}
    </div>
  );
}

// FormField - Single field με label και input
interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, required = false, children, className }: FormFieldProps) {
  return (
    <div className={cn(FORM_STYLES.grid.field, className)}>
      <FormLabel htmlFor={htmlFor} required={required}>
        {label}
      </FormLabel>
      {children}
    </div>
  );
}

// FormLabel - Centralized label με consistent styling
interface FormLabelProps {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormLabel({ htmlFor, required = false, children, className }: FormLabelProps) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn(FORM_STYLES.label.base, className)}
    >
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
  );
}

// FormInput - Wrapper για inputs με consistent styling
interface FormInputProps {
  children: React.ReactNode;
  className?: string;
}

export function FormInput({ children, className }: FormInputProps) {
  return (
    <div className={cn(FORM_STYLES.input.span, className)}>
      {children}
    </div>
  );
}