/**
 * @fileoverview **Η ΕΠΙΛΟΓΗ ΤΟΥ ΕΠΙΣΚΕΠΤΗ ΣΤΟ ΔΗΜΟΣΙΟ ΗΜΕΡΟΛΟΓΙΟ** — άφιξη → αναχώρηση, και τι σημαίνει κάθε μέρα.
 * @related ADR-835 §21 · lib/stay/stay-nights-view.ts · components/listing-detail/ListingStayCalendar.tsx
 * @module lib/stay/stay-public-selection
 *
 * 🔑 **Το κατηγόρημα είναι το ίδιο με της μηχανής** (`stayableInView`, αγκυρωμένο με ισοδυναμία
 * σε κάθε ζεύγος): ο επισκέπτης δεν μπορεί να διαλέξει αναχώρηση που η μηχανή θα απέρριπτε.
 *
 * 🏆 **Ονομασμένη εξήγηση αντί για σκέτο γκρι**: κάθε μέρα έχει **νόημα** (`StayDayMeaning`) —
 * «μόνο αναχώρηση», «δεν ξεκινά διαμονή εδώ», «ελάχιστη διαμονή 3» — όχι μόνο ενεργό/ανενεργό.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { StayPublicNight } from './stay-nights-view';
import { stayableInView } from './stay-nights-view';

/** Η επιλογή: τίποτα · μόνο άφιξη · άφιξη και αναχώρηση. */
export type StayPublicSelection =
  | { readonly kind: 'none' }
  | { readonly kind: 'check-in'; readonly checkIn: string }
  | { readonly kind: 'range'; readonly checkIn: string; readonly checkOut: string };

export const NO_STAY_SELECTION: StayPublicSelection = { kind: 'none' };

/** Τι σημαίνει μια μέρα για τον επισκέπτη, **με την τρέχουσα επιλογή**. */
export type StayDayMeaning =
  | 'check-in'        // μπορεί να ξεκινήσει διαμονή
  | 'check-out'       // μπορεί να τελειώσει η διαμονή που ξεκίνησε
  | 'check-out-only'  // κλειστή νύχτα, αλλά δέχεται αναχώρηση
  | 'no-arrival'      // ανοιχτή νύχτα, αλλά δεν ξεκινά διαμονή εδώ
  | 'closed'          // μη διαθέσιμη
  | 'unsynced'        // κανάλι που σώπασε: ΔΕΝ ξέρουμε (ADR-835 §22) — ποτέ «ελεύθερη»
  | 'selected-check-in'
  | 'selected-check-out'
  | 'in-stay';

/** Οι νύχτες ανά ημερομηνία. */
export function nightsIndex(nights: readonly StayPublicNight[]): ReadonlyMap<string, StayPublicNight> {
  return new Map(nights.map((night) => [night.date, night]));
}

/** Η επόμενη επιλογή μετά από κλικ στη μέρα `day`. */
export function nextStaySelection(
  selection: StayPublicSelection,
  day: string,
  nights: readonly StayPublicNight[],
): StayPublicSelection {
  const canCheckIn = nightsIndex(nights).get(day)?.checkInAllowed === true;
  if (selection.kind === 'check-in' && day > selection.checkIn && stayableInView(nights, selection.checkIn, day)) {
    return { kind: 'range', checkIn: selection.checkIn, checkOut: day };
  }
  return canCheckIn ? { kind: 'check-in', checkIn: day } : selection;
}

function meaningWithoutSelection(night: StayPublicNight | undefined): StayDayMeaning {
  if (night === undefined) return 'closed';
  // 🔴 ΠΡΙΝ από κάθε άλλο νόημα: «δεν επιβεβαιώνεται» δεν είναι ούτε «ανοιχτή που δεν
  //    ξεκινά διαμονή» ούτε «κλειστή» — είναι **άγνωστη**, και το λέει (Στάδιο Γ).
  if (night.state === 'unsynced') return 'unsynced';
  if (night.checkInAllowed) return 'check-in';
  if (night.state === 'closed') return night.checkOutAllowed ? 'check-out-only' : 'closed';
  return 'no-arrival';
}

/** Το νόημα της μέρας `day` με την τρέχουσα επιλογή. */
export function stayDayMeaning(
  day: string,
  nights: readonly StayPublicNight[],
  selection: StayPublicSelection,
): StayDayMeaning {
  if (selection.kind !== 'none' && day === selection.checkIn) return 'selected-check-in';
  if (selection.kind === 'range') {
    if (day === selection.checkOut) return 'selected-check-out';
    if (day > selection.checkIn && day < selection.checkOut) return 'in-stay';
  }
  if (selection.kind === 'check-in' && day > selection.checkIn && stayableInView(nights, selection.checkIn, day)) {
    return 'check-out';
  }
  return meaningWithoutSelection(nightsIndex(nights).get(day));
}

/** `true` αν το κλικ στη μέρα αλλάζει κάτι — αλλιώς το κελί είναι ανενεργό (αλλά ΕΞΗΓΕΙΤΑΙ). */
export function isSelectableMeaning(meaning: StayDayMeaning): boolean {
  return meaning === 'check-in' || meaning === 'check-out' || meaning === 'selected-check-in';
}
