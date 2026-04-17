'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: ClearableSelect — Radix Select με επιλογή "clear" (SSoT)
 * =============================================================================
 *
 * Wrapper πάνω από canonical `@/components/ui/select` (ADR-001) που προσθέτει
 * ένα ενσωματωμένο "Καθαρισμός επιλογής" item στην κορυφή του dropdown.
 *
 * Χρησιμοποιεί το SSoT sentinel `SELECT_CLEAR_VALUE` από
 * `@/config/domain-constants`. Όταν ο χρήστης επιλέξει το clear item, το
 * `onValueChange` καλείται με κενό string ''. Έτσι τα upstream state fields
 * (που τυπικά είναι `string` ή optional enums) πηγαίνουν πίσω σε "μη
 * επιλεγμένο" state, ενεργοποιώντας ξανά τα Google-style missing-data warnings.
 *
 * Γιατί helper:
 *   - Radix Select απαγορεύει `<SelectItem value="" />` (crash σε runtime).
 *   - Το placeholder του `SelectValue` εμφανίζεται μόνο όταν value='' — αρχικά
 *     μόνο. Μόλις ο χρήστης επιλέξει κάτι, δεν υπάρχει way back χωρίς helper.
 *   - SSoT: αν το pattern γίνει inline σε πολλά sites, διασπάται. Αυτό το
 *     component κρατάει τη λογική σε ένα σημείο.
 *
 * Generic: το `onValueChange` δέχεται string (το value του καθαρισμένου field).
 * Callers που χρησιμοποιούν enum types πρέπει να κάνουν το cast στη δική τους
 * update function (π.χ. `value ? value as FrameType : undefined`).
 *
 * @module components/ui/clearable-select
 * @enterprise ADR-001, ADR-287 Batch 26
 * @since 2026-04-17
 */

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectTriggerProps,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';

export interface ClearableSelectProps {
  /** Current value — '' means "no selection" (placeholder shown). */
  value: string;
  /** Called with new value; receives '' όταν επιλεγεί το clear item. */
  onValueChange: (value: string) => void;
  /** Placeholder text εμφανίζεται όταν value === ''. */
  placeholder: string;
  /** Translated label for the clear option (first item in dropdown). */
  clearLabel: string;
  /** Disabled trigger. */
  disabled?: boolean;
  /** Trigger size (inherits από SelectTriggerProps). */
  size?: SelectTriggerProps['size'];
  /** Optional id για τα form field associations. */
  id?: string;
  /** Extra classes στο SelectTrigger. */
  triggerClassName?: string;
  /** SelectItem children (τα κανονικά options). */
  children: React.ReactNode;
}

export function ClearableSelect({
  value,
  onValueChange,
  placeholder,
  clearLabel,
  disabled,
  size = 'sm',
  id,
  triggerClassName,
  children,
}: ClearableSelectProps) {
  const handleChange = React.useCallback(
    (next: string) => {
      onValueChange(isSelectClearValue(next) ? '' : next);
    },
    [onValueChange],
  );

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger size={size} id={id} className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELECT_CLEAR_VALUE} className="text-xs italic text-muted-foreground">
          {clearLabel}
        </SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}
