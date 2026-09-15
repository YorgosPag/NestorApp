/**
 * @fileoverview **ΕΙΔΙΚΕΣ ΩΡΕΣ — ΚΛΕΙΔΙΑ ΤΗΣ ΦΟΡΜΑΣ** (ADR-841 §7 Α21.21).
 * @related components/mandate/SpecialHoursField.tsx · SpecialDayRow.tsx · agency-showcase-labels.ts
 * @module components/mandate/agency-showcase-special-hours-labels
 *
 * 🔑 **Χωρίστηκε από το `agency-showcase-labels.ts`** όταν εκείνο πέρασε τις 500 γραμμές (N.7.1) — ίδιο προηγούμενο
 * με το `agency-showcase-import-labels.ts`. Ίδιο namespace, ίδιο πρόθεμα: ο χωρισμός είναι αρχείων, όχι κλειδιών.
 */

import type { SpecialDayDefect, SpecialDayKind } from '@/lib/calendar/special-hours';
import { SHOWCASE_CARD_HOURS_DEFECT_KEYS } from './agency-showcase-labels';

const K = 'property-market:mandate.showcase';

export const SHOWCASE_SPECIAL_HOURS_KEYS = {
  title: `${K}.cardSpecialTitle`,
  hint: `${K}.cardSpecialHint`,
  add: `${K}.cardSpecialAdd`,
  remove: `${K}.cardSpecialRemove`,
  datePlaceholder: `${K}.cardSpecialDatePlaceholder`,
  kindLabel: `${K}.cardSpecialKindLabel`,
  /** 🔑 Το «Review» της Google: εθνικές αργίες σε ανοιχτή μέρα, χωρίς δήλωση — από τον ΙΔΙΟ κριτή με τη σελίδα. */
  suggested: `${K}.cardSpecialSuggested`,
  suggestedHint: `${K}.cardSpecialSuggestedHint`,
  suggestion: `${K}.cardSpecialSuggestion`,
  /** Η Πρωτομαγιά χρονιάς με κίνδυνο μετάθεσης, χωρίς γνωστή υπουργική απόφαση. */
  provisional: `${K}.cardSpecialProvisional`,
} as const;

/** **Είδος ειδικής μέρας → ετικέτα**. */
export const SHOWCASE_SPECIAL_KIND_KEYS: Record<SpecialDayKind, string> = {
  closed: `${K}.cardSpecialKind.closed`,
  regular: `${K}.cardSpecialKind.regular`,
  custom: `${K}.cardSpecialKind.custom`,
};

/**
 * **Ελάττωμα ειδικής μέρας → κλειδί**. Τα ελαττώματα **διαστημάτων** είναι τα ΙΔΙΑ κλειδιά με το εβδομαδιαίο
 * ωράριο (ο ίδιος κριτής, `dayIntervalsDefect`) — δεύτερο κείμενο για το ίδιο 22:00–22:00 θα διαφωνούσε κάποτε.
 */
export const SHOWCASE_SPECIAL_DEFECT_KEYS: Record<SpecialDayDefect, string> = {
  ...SHOWCASE_CARD_HOURS_DEFECT_KEYS,
  'date-invalid': `${K}.cardSpecialDefect.date-invalid`,
  'date-beyond-horizon': `${K}.cardSpecialDefect.date-beyond-horizon`,
  'date-duplicate': `${K}.cardSpecialDefect.date-duplicate`,
  'hours-missing': `${K}.cardSpecialDefect.hours-missing`,
  'too-many-days': `${K}.cardSpecialDefect.too-many-days`,
};
