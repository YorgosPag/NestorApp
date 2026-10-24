/**
 * @fileoverview **Η ΜΕΛΛΟΝΤΙΚΗ ΥΠΟΣΧΕΣΗ ΠΑΡΑΔΟΣΗΣ μιας αγγελίας** — το ΕΝΑ κριτήριο «χτίζεται» και το ΕΝΑ συγκριτικό.
 * @related ADR-919 §12 · lib/demand/demand-awaiting-delivery.ts (`pendingDeliveryOf`, «χτίζονται N» στη ζήτηση) ·
 *   lib/market/area-market-summary.ts (`summarizeUnderConstruction`, «χτίζονται N» στην περιοχή)
 * @module lib/listings/delivery-promise
 *
 * 🔑 Ζει στο επίπεδο της **αγγελίας**, όχι της ζήτησης: το ρωτούν και η απάντηση ζήτησης και η νυχτερινή σύνοψη περιοχής.
 * Μέχρι το ADR-919 «επαλήθευση §12» ήταν δεμένο μέσα στο `pendingDeliveryOf` (μαζί με το κατηγόρημα του ταιριάσματος),
 * οπότε η σελίδα περιοχής θα έπρεπε να γράψει δεύτερο. Δύο κριτήρια θα διαφωνούσαν για το «σήμερα».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Το «σήμερα» είναι όρισμα.
 */

import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ScheduledAvailability } from '@/types/availability-history';
import type { ListingAvailability } from '@/types/listing-availability';

/**
 * Η **μελλοντική** υπόσχεση παράδοσης, αλλιώς `null`.
 *
 * Μετρά μόνο `window.end > σήμερα`. Μια ληγμένη υπόσχεση δεν είναι «χτίζεται»: είναι υπόσχεση που δεν τηρήθηκε, και η
 * θέση της είναι στο `slipNoticeOf`.
 *
 * @param todayDate — ISO `YYYY-MM-DD`· ρητή παράμετρος, ποτέ ανάγνωση ρολογιού
 */
export function futureDeliveryPromiseOf(
  availability: ListingAvailability,
  todayDate: string,
): ScheduledAvailability | null {
  if (availability.kind !== 'scheduled') return null;
  return availability.window.end > todayDate ? availability : null;
}

/**
 * **Θα έχει παραδοθεί ως αυτή την ημέρα;** Το ΕΝΑ κριτήριο «διαθέσιμο ως» (ADR-919 §12).
 *
 * `ready` ⇒ ναι · `scheduled` ⇒ `window.end <= byDate` (το **τέλος** του παραθύρου, το χειρότερο που υποσχέθηκε) ·
 * `unknown` ⇒ `null`, δηλαδή **δεν ξέρουμε**, ποτέ «όχι». Ο καλών αποφασίζει τι σημαίνει η άγνοια: η ζήτηση τη
 * γράφει εμπόδιο (`availability-unknown`), η αναζήτηση τη μετρά στον κάδο «δεν το δήλωσαν».
 *
 * 🔑 Μέχρι το ADR-919 §12 ζούσε inline στο `timingBlockers`. Το φίλτρο αναζήτησης θα ήταν δεύτερο `<=`.
 *
 * @param byDate — ISO `YYYY-MM-DD`
 */
export function deliveredBy(availability: ListingAvailability, byDate: string): boolean | null {
  switch (availability.kind) {
    case 'ready':
      return true;
    case 'unknown':
      return null;
    case 'scheduled':
      return availability.window.end <= byDate;
  }
}

/** Νωρίτερο τέλος πρώτα· στην ισοπαλία, η στενότερη ακρίβεια (μεταγενέστερη αρχή). Το κριτήριο Δ2 του `timingBlockers`. */
export function compareDeliveryPromise(a: ScheduledAvailability, b: ScheduledAvailability): number {
  if (a.window.end !== b.window.end) return a.window.end < b.window.end ? -1 : 1;
  if (a.window.start === b.window.start) return 0;
  return a.window.start > b.window.start ? -1 : 1;
}

/**
 * **Τα επόμενα `count` τρίμηνα**, από το τρέχον, ως υποσχέσεις: οι επιλογές του «διαθέσιμο ως» (ADR-919 §12).
 *
 * 🔑 Υποσχέσεις και όχι σκέτες ημέρες, ώστε η ετικέτα να βγαίνει από τη ΜΙΑ φράση (`availabilityPromisePhrase`) και η
 * τιμή να είναι το `window.end`, ακριβώς ό,τι κρίνει το `deliveredBy`. Κατασκευαστής ο ΕΝΑΣ (`scheduledAvailability`).
 *
 * @param todayDate — ISO `YYYY-MM-DD`· ρητή παράμετρος, ποτέ ανάγνωση ρολογιού
 */
export function upcomingDeliveryQuarters(todayDate: string, count: number): readonly ScheduledAvailability[] {
  const year = Number(todayDate.slice(0, 4));
  const firstQuarter = Math.floor((Number(todayDate.slice(5, 7)) - 1) / 3);
  const quarters: ScheduledAvailability[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const index = firstQuarter + offset;
    const month = String((index % 4) * 3 + 1).padStart(2, '0');
    const promise = scheduledAvailability('quarter', `${year + Math.floor(index / 4)}-${month}-01`);
    if (promise.kind === 'scheduled') quarters.push(promise);
  }
  return quarters;
}
