/**
 * =============================================================================
 * 🏢 ENTERPRISE: Date Picker Field
 * =============================================================================
 *
 * Popover-triggered date field: κουμπί με εικονίδιο + μορφοποιημένη ετικέτα, που
 * ανοίγει ένα `<Calendar mode="single">`.
 *
 * SSoT για το σχήμα που ήταν αντιγραμμένο σε 3 σημεία (CalendarCreateDialog ×2,
 * TaskEditDialog). Το locale το λύνει μόνο του από την τρέχουσα γλώσσα, ώστε η
 * ετικέτα και το πλέγμα του ημερολογίου να μη μπορούν να διαφωνήσουν.
 *
 * Δεν αντικαθιστά το πληκτρολογήσιμο date field του `TaskDetailPanel` — εκείνο
 * είναι σκόπιμα διαφορετικό UX (ελεύθερο κείμενο + PopoverAnchor).
 *
 * @module components/ui/date-picker-field
 * @see ADR-584
 */

'use client';

import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDateFnsLocale } from '@/i18n/date-fns-locale';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

export interface DatePickerFieldProps {
  /** Η επιλεγμένη ημερομηνία — `undefined` όταν δεν έχει επιλεγεί καμία. */
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  /** Κείμενο του κουμπιού όταν δεν υπάρχει επιλεγμένη ημερομηνία. */
  placeholder: string;
  /** Συνδέει το κουμπί με ένα εξωτερικό `<Label htmlFor>`. */
  id?: string;
  disabled?: boolean;
}

export function DatePickerField({
  value,
  onSelect,
  placeholder,
  id,
  disabled = false,
}: DatePickerFieldProps) {
  const locale = useDateFnsLocale();
  const iconSizes = useIconSizes();
  const sp = useSpacingTokens();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className={`${sp.margin.right.sm} ${iconSizes.sm}`} />
          {value ? format(value, 'PPP', { locale }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`w-auto ${sp.padding.none}`}>
        <Calendar mode="single" selected={value} onSelect={onSelect} autoFocus />
      </PopoverContent>
    </Popover>
  );
}
