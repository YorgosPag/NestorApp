/**
 * =============================================================================
 * ENTERPRISE: TASK FORM FIELD
 * =============================================================================
 *
 * Ένα πεδίο φόρμας των CRM task dialogs: `<fieldset>` + `<Label>` + το control.
 *
 * SSoT για το σχήμα «fieldset με spacing token + Label + control» που ήταν
 * αντιγραμμένο ~15 φορές μέσα στα CalendarCreateDialog / TaskEditDialog. Το
 * control μένει ευθύνη του καταναλωτή (`children`) — το πεδίο δεν ξέρει αν είναι
 * Input, EnumSelect, DatePickerField ή Textarea.
 *
 * @module components/crm/shared/TaskFormField
 * @see ADR-584
 */

'use client';

import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

export interface TaskFormFieldProps {
  /** Συνδέει την ετικέτα με το control. Παραλείπεται όταν το control δεν έχει id. */
  htmlFor?: string;
  /** Η ετικέτα — μεταφρασμένη από τον καταναλωτή. */
  label: string;
  /** Προσθέτει τον αστερίσκο υποχρεωτικού πεδίου. */
  required?: boolean;
  /** Control δεξιά της ετικέτας (π.χ. κουμπί υπαγόρευσης). */
  action?: ReactNode;
  children: ReactNode;
}

export function TaskFormField({
  htmlFor,
  label,
  required = false,
  action,
  children,
}: TaskFormFieldProps) {
  const sp = useSpacingTokens();

  const labelEl = (
    <Label htmlFor={htmlFor}>
      {label}
      {required ? ' *' : null}
    </Label>
  );

  return (
    <fieldset className={sp.spaceBetween.sm}>
      {action ? (
        <div className="flex items-center justify-between">
          {labelEl}
          {action}
        </div>
      ) : (
        labelEl
      )}
      {children}
    </fieldset>
  );
}
