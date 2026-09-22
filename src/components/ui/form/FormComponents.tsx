'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { InfoLabel } from '@/components/ui/InfoLabel';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

// Design tokens για centralized styling
export const FORM_STYLES = {
  grid: {
    container: "grid gap-6 md:gap-4 py-6 md:py-4",
    field: "grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4",
  },
  label: {
    base: "text-left md:text-right font-medium text-base md:text-sm",
  },
  input: {
    span: "col-span-1 md:col-span-3",
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
  /** Ρητό id του πεδίου. Χωρίς αυτό, το `FormField` φτιάχνει ένα (`useId`) — βλ. `children`. */
  htmlFor?: string;
  required?: boolean;
  /**
   * Το πεδίο — ή **συνάρτηση που δέχεται το id του** (React Aria `TextField` / Chakra
   * `FormControl`): η ετικέτα και η σύνδεσή της ζουν στο ΙΔΙΟ σημείο, άρα ένα πεδίο
   * χωρίς όνομα γίνεται **δομικά αδύνατο** (ADR-598 G11 §3 procurement — 35 ετικέτες
   * χωρίς πεδίο μετρήθηκαν επειδή η σύνδεση γινόταν με το χέρι).
   */
  children: React.ReactNode | ((fieldId: string) => React.ReactNode);
  className?: string;
  helpText?: string;
  errorText?: string;
  /** Tooltip text — when provided, renders InfoLabel with HelpCircle hover icon (ADR-242) */
  tooltip?: string;
}

export function FormField({ label, htmlFor: explicitId, required = false, children, className, helpText, errorText, tooltip }: FormFieldProps) {
  const generatedId = React.useId();
  const htmlFor = typeof children === 'function' ? explicitId ?? generatedId : explicitId;
  return (
    <div className={cn("w-full space-y-2", className)}>
      {tooltip ? (
        <span className="inline-flex items-center gap-1">
          <InfoLabel htmlFor={htmlFor} label={label} tooltip={tooltip} className="text-left font-medium text-sm" />
          {required && <span className="text-destructive">*</span>}
        </span>
      ) : (
        <FormLabel htmlFor={htmlFor} required={required}>
          {label}
        </FormLabel>
      )}
      <div className="w-full">
        {typeof children === 'function' ? children(htmlFor ?? generatedId) : children}
        {helpText && (
          <p className="text-xs text-muted-foreground mt-1">{helpText}</p>
        )}
        {errorText && (
          <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1 text-xs font-medium text-destructive" role="alert">{errorText}</p>
        )}
      </div>
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
      className={cn("text-left font-medium text-sm", className)}
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
    <div className={cn("w-full", className)}>
      {children}
    </div>
  );
}