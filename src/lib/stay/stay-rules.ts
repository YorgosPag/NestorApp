/**
 * @fileoverview **ΤΙ ΕΠΙΤΡΕΠΟΥΝ ΟΙ ΚΑΝΟΝΕΣ;** — οι πρωτογενείς κρίσεις, κοινές για μηχανή και πλέγμα.
 * @related ADR-835 §21 · types/stay-rules.ts · lib/stay/stay-availability.ts ·
 *   lib/stay/stay-nights-view.ts
 * @module lib/stay/stay-rules
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΑΡΧΕΙΟ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ — ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΜΠΟΡΟΥΝ ΝΑ ΔΙΑΦΩΝΗΣΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η μηχανή απαντά *«επιτρέπεται 10–14/08;»*· το δημόσιο ημερολόγιο απαντά *«επιτρέπεται
 * άφιξη στις 10/08;»*. Αν ζούσαν σε δύο αρχεία, η Airbnb-τύπου ασυμφωνία «το ημερολόγιο
 * το έδειχνε ελεύθερο, η κράτηση απορρίφθηκε» θα ήταν ερώτημα **πότε**. Κάθε κρίση εδώ
 * είναι **η μία**, και μια άγκυρα ισοδυναμίας δένει τους δύο καταναλωτές.
 *
 * ⛔ **Δεν είναι κριτής επικάλυψης.** Το «τέμνονται;» το απαντά μόνο ο
 * `occupancyConflicts`. Η προετοιμασία μπαίνει ως **συνθετικές καταλήψεις** που κρίνει
 * **ο ίδιος** κριτής ({@link stayCalendarOccupancies}).
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι (το «τώρα» = `StayClock`).
 */

import {
  addDaysToDateKey,
  daysBetweenDateKeys,
  isDateKey,
  isoWeekdayOfDateKey,
} from '@/lib/calendar/date-key';
import { addMonthsUTC, normalizeToMillisOrNull, utcDateOf } from '@/lib/date-local';
import type { Occupancy } from '@/lib/occupancy/occupancy-conflict';
import {
  stayEntryOccupancyOf,
  stayEntryOccupies,
  type StayCalendarEntry,
} from '@/types/stay-calendar';
import type {
  StayDayRule,
  StayDayRules,
  StayRules,
  StayRulesInput,
} from '@/types/stay-rules';

// =============================================================================
// 1. ΗΜΕΡΑ ΚΑΙ ΧΡΟΝΟΣ
// =============================================================================

/** Κενή υπέρβαση — «ισχύει η βάση». */
const NO_DAY_RULE: StayDayRule = {};

/** Πόσες μέρες μπροστά/πίσω ψάχνουμε την κοντινότερη επιτρεπτή ημερομηνία. */
export const STAY_NEAREST_SEARCH_DAYS = 14;

/** Η υπέρβαση της ημέρας, ή κενή. */
export function dayRuleOn(days: StayDayRules, dateKey: string): StayDayRule {
  return days[dateKey] ?? NO_DAY_RULE;
}

/**
 * **Η νωρίτερη επιτρεπτή άφιξη** (advance notice).
 *
 * `days: 0` με αποκοπή 18:00 ⇒ σήμερα ως τις 17:59 ώρα Αθήνας, αύριο μετά. Η αποκοπή
 * κρίνεται σε **λεπτά Αθήνας** του `StayClock` — ποτέ UTC.
 */
export function earliestCheckIn(input: StayRulesInput): string {
  const { rules, clock } = input;
  const { days, sameDayCutoffHour } = rules.advanceNotice;
  const pastCutoff =
    days === 0 && sameDayCutoffHour !== null && clock.minutes >= sameDayCutoffHour * 60;
  const offset = pastCutoff ? 1 : days;
  return addDaysToDateKey(clock.today, offset) ?? clock.today;
}

/**
 * **Η πρώτη ΜΗ διαθέσιμη νύχτα** του παραθύρου κρατήσεων, ή `null` αν δεν υπάρχει όριο.
 * Διαμονή επιτρέπεται μόνο με `checkOut <= bookableUntil`.
 */
export function bookableUntil(input: StayRulesInput): string | null {
  const months = input.rules.availabilityWindowMonths;
  if (months === null) return null;
  const moved = addMonthsUTC(input.clock.today, months);
  const ms = moved === null ? null : normalizeToMillisOrNull(moved);
  return ms === null ? null : utcDateOf(ms);
}

// =============================================================================
// 2. ΑΦΙΞΗ / ΑΝΑΧΩΡΗΣΗ
// =============================================================================

/** Επιτρέπεται **άφιξη** αυτή τη μέρα; (μέρα εβδομάδας της βάσης **και** όχι CTA) */
export function arrivalAllowed(input: StayRulesInput, dateKey: string): boolean {
  const weekday = isoWeekdayOfDateKey(dateKey);
  if (weekday === null) return false;
  if (!input.rules.arrivalWeekdays.includes(weekday)) return false;
  return dayRuleOn(input.days, dateKey).closedToArrival !== true;
}

/** Επιτρέπεται **αναχώρηση** αυτή τη μέρα; (μέρα εβδομάδας της βάσης **και** όχι CTD) */
export function departureAllowed(input: StayRulesInput, dateKey: string): boolean {
  const weekday = isoWeekdayOfDateKey(dateKey);
  if (weekday === null) return false;
  if (!input.rules.departureWeekdays.includes(weekday)) return false;
  return dayRuleOn(input.days, dateKey).closedToDeparture !== true;
}

/** Η κοντινότερη ημέρα πριν/μετά που ικανοποιεί το κριτήριο — μετρήσιμη διέξοδος. */
export interface StayNearestDates {
  readonly before: string | null;
  readonly after: string | null;
}

/**
 * **Πού αλλιώς;** — η κοντινότερη ημέρα (έως {@link STAY_NEAREST_SEARCH_DAYS}) που περνά.
 * Το `before` δεν πέφτει κάτω από το `floor` (π.χ. νωρίτερη άφιξη ή η επόμενη της άφιξης).
 */
export function nearestDates(
  dateKey: string,
  allowed: (candidate: string) => boolean,
  floor: string,
): StayNearestDates {
  let before: string | null = null;
  let after: string | null = null;
  for (let step = 1; step <= STAY_NEAREST_SEARCH_DAYS; step += 1) {
    const earlier = addDaysToDateKey(dateKey, -step);
    if (before === null && earlier !== null && earlier >= floor && allowed(earlier)) {
      before = earlier;
    }
    const later = addDaysToDateKey(dateKey, step);
    if (after === null && later !== null && allowed(later)) after = later;
    if (before !== null && after !== null) break;
  }
  return { before, after };
}

// =============================================================================
// 3. ΔΙΑΡΚΕΙΑ — ανά ημέρα ΑΦΙΞΗΣ, με χαλάρωση ορφανού κενού
// =============================================================================

/** Μέγιστες νύχτες για διαμονή που ξεκινά `checkIn` — ή `null` (χωρίς όριο). */
export function maxNightsForArrival(input: StayRulesInput, checkIn: string): number | null {
  return dayRuleOn(input.days, checkIn).maxNights ?? input.rules.maxNights;
}

/** Ημι-ανοιχτό κενό `[from, to)` ανάμεσα σε δύο κατειλημμένα διαστήματα. */
interface BoundedGap {
  readonly from: string;
  readonly to: string;
}

/**
 * **Το κλειστό κενό που περιέχει τη νύχτα `dateKey`** — τέλος της προηγούμενης κατάληψης
 * ως αρχή της επόμενης. `null` αν η νύχτα είναι κατειλημμένη ή το κενό **δεν** κλείνει
 * και από τις δύο πλευρές (ορφανό είναι μόνο ό,τι είναι παγιδευμένο).
 */
function boundedGapAround<TSource>(
  dateKey: string,
  occupied: readonly Occupancy<TSource>[],
): BoundedGap | null {
  let from: string | null = null;
  let to: string | null = null;
  for (const occupancy of occupied) {
    const end = occupancy.expiresAt;
    if (occupancy.startsAt <= dateKey && (end === null || end > dateKey)) return null;
    if (end !== null && end <= dateKey && (from === null || end > from)) from = end;
    if (occupancy.startsAt > dateKey && (to === null || occupancy.startsAt < to)) {
      to = occupancy.startsAt;
    }
  }
  return from === null || to === null ? null : { from, to };
}

/**
 * **Ελάχιστες νύχτες για άφιξη `checkIn`** — υπέρβαση ημέρας ?? όρος της αγγελίας, και
 * 🏆 χαλαρωμένες στο μήκος του κενού όταν η άφιξη πέφτει σε ορφανό κενό ≤ του κανόνα
 * (πρότυπο PriceLabs: «δίνυχτο κενό ⇒ ελάχιστο 2»).
 *
 * @param baseMinNights — `ShortLeaseOffer.minNights` όπως προβάλλεται· `null` = δεν δηλώθηκε.
 * @returns `null` = κανένα ελάχιστο.
 */
export function minNightsForArrival<TSource>(
  input: StayRulesInput,
  baseMinNights: number | null,
  checkIn: string,
  occupied: readonly Occupancy<TSource>[],
): number | null {
  const declared = dayRuleOn(input.days, checkIn).minNights ?? baseMinNights;
  const orphan = input.rules.orphanGap;
  if (declared === null || orphan === null) return declared;
  const gap = boundedGapAround(checkIn, occupied);
  if (gap === null || gap.from !== checkIn) return declared;
  const gapNights = daysBetweenDateKeys(gap.from, gap.to);
  if (gapNights === null || gapNights > orphan.maxNights) return declared;
  return Math.min(declared, gapNights);
}

// =============================================================================
// 4. ΠΡΟΕΤΟΙΜΑΣΙΑ — συνθετικές καταλήψεις για τον ΙΔΙΟ κριτή
// =============================================================================

/** Η πηγή μιας κατάληψης ημερολογίου: εγγραφή, ή νύχτες προετοιμασίας γύρω από εγγραφή. */
export type StayOccupancySource =
  | { readonly kind: 'entry'; readonly entry: StayCalendarEntry }
  | { readonly kind: 'preparation'; readonly of: StayCalendarEntry };

/**
 * Γύρω από ποιες εγγραφές μπαίνει προετοιμασία: κάθε **διαμονή** — κράτηση που
 * καταλαμβάνει ή εξωτερικό block (κράτηση άλλου καναλιού). 🏆 Η Airbnb την εφαρμόζει
 * μόνο στις **δικές της** κρατήσεις· εδώ ισχύει για όλα τα κανάλια. Τα blocks του
 * ιδιοκτήτη **δεν** είναι επισκέπτες και δεν χρειάζονται καθάρισμα.
 */
function needsPreparation(entry: StayCalendarEntry): boolean {
  if (!stayEntryOccupies(entry)) return false;
  return entry.kind === 'booking' || entry.block.source === 'external';
}

function preparationAround(
  entry: StayCalendarEntry,
  from: string,
  to: string,
  nights: number,
): Occupancy<StayOccupancySource>[] {
  const base = stayEntryOccupancyOf(entry);
  const before = addDaysToDateKey(from, -nights);
  const after = addDaysToDateKey(to, nights);
  const source: StayOccupancySource = { kind: 'preparation', of: entry };
  const shape = { occupancyId: null, holderId: `preparation:${base.occupancyId ?? ''}`, source };
  const out: Occupancy<StayOccupancySource>[] = [];
  if (before !== null) out.push({ ...base, ...shape, startsAt: before, expiresAt: from });
  if (after !== null) out.push({ ...base, ...shape, startsAt: to, expiresAt: after });
  return out;
}

/**
 * **Οι καταλήψεις του ημερολογίου, όπως τις βλέπει ο επισκέπτης** — εγγραφές που
 * καταλαμβάνουν + νύχτες προετοιμασίας.
 *
 * 🔑 **Μοιραζόμενη προετοιμασία** (Airbnb): με 1 νύχτα, κράτηση Α `[1,5)` και ερώτημα
 * `[6,11)` χωράνε — η νύχτα 5 είναι «μετά» του Α **και** «πριν» του ερωτήματος. Ο
 * κριτής συγκρίνει το **ερώτημα** με τις καταλήψεις, όχι καταλήψεις μεταξύ τους.
 *
 * ⚠️ Χαλασμένη εγγραφή **δεν** παίρνει προετοιμασία (δεν ξέρουμε άκρα)· ο κριτής τη
 * βλέπει αυτούσια και απαντά `undetermined` — fail-closed.
 */
export function stayCalendarOccupancies(
  entries: readonly StayCalendarEntry[],
  preparationNights: StayRules['preparationNights'],
): Occupancy<StayOccupancySource>[] {
  const out: Occupancy<StayOccupancySource>[] = [];
  for (const entry of entries) {
    if (!stayEntryOccupies(entry)) continue;
    const occupancy = stayEntryOccupancyOf(entry);
    out.push({ ...occupancy, source: { kind: 'entry', entry } });
    const { startsAt, expiresAt } = occupancy;
    if (preparationNights === 0 || !needsPreparation(entry)) continue;
    if (!isDateKey(startsAt) || expiresAt === null || !isDateKey(expiresAt)) continue;
    out.push(...preparationAround(entry, startsAt, expiresAt, preparationNights));
  }
  return out;
}
