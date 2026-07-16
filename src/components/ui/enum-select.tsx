/**
 * =============================================================================
 * 🏢 ENTERPRISE: Enum Select
 * =============================================================================
 *
 * Radix Select (ADR-001) οδηγούμενο από πίνακα τιμών ενός string union.
 *
 * SSoT για το «map ενός enum πίνακα σε `<SelectItem>`» σχήμα, που ήταν
 * αντιγραμμένο σε 7 σημεία μέσα σε 3 αρχεία (τύπος / κατάσταση / προτεραιότητα
 * task, υπενθύμιση).
 *
 * Η τιμή που επιστρέφει το Radix είναι `string`· εδώ ταιριάζεται μέσα στον πίνακα
 * `values` αντί να γίνει τυφλό cast, οπότε το `onValueChange` παραμένει πλήρως
 * τυποποιημένο και μια τιμή εκτός union δεν μπορεί να διαρρεύσει.
 *
 * @module components/ui/enum-select
 * @see ADR-584
 */

'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import '@/lib/design-system';

export interface EnumSelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  /** Οι επιλέξιμες τιμές, σε σειρά εμφάνισης. */
  values: readonly T[];
  /** Τιμή → ετικέτα για τον χρήστη (συνήθως ένα `t(...)` call). */
  getLabel: (value: T) => string;
  /** Συνδέει το trigger με ένα εξωτερικό `<Label htmlFor>`. */
  id?: string;
  disabled?: boolean;
}

export function EnumSelect<T extends string>({
  value,
  onValueChange,
  values,
  getLabel,
  id,
  disabled = false,
}: EnumSelectProps<T>) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const match = values.find((candidate) => candidate === next);
        if (match !== undefined) onValueChange(match);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((candidate) => (
          <SelectItem key={candidate} value={candidate}>
            {getLabel(candidate)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
