/**
 * @fileoverview **Η ΧΕΙΡΟΚΙΝΗΤΗ ΚΡΑΤΗΣΗ ΠΑΡΑΒΙΑΖΕΙ ΚΑΝΟΝΑ;** — ονομασμένη προειδοποίηση, ποτέ σιωπή.
 * @related ADR-835 §21 · lib/stay/stay-rules.ts · services/stay-calendar/stay-calendar-write.service.ts
 * @module lib/stay/stay-rule-warnings
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΑΓΟΡΑ: ΣΙΩΠΗΛΗ ΠΑΡΑΚΑΜΨΗ · ΕΔΩ: ΡΗΤΗ ΑΠΟΔΟΧΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Guesty και Hostaway αφήνουν τη χειροκίνητη κράτηση να αγνοεί τις ελάχιστες νύχτες
 * **χωρίς να το πουν**. Οι κανόνες φυλάνε τους **επισκέπτες**· ο οικοδεσπότης που γράφει
 * μια τηλεφωνική κράτηση έχει δικαίωμα να τους παρακάμψει — αλλά **το ξέρει**, και η
 * αποδοχή του μένει στο ίχνος.
 *
 * ⛔ Η **επικάλυψη** δεν είναι κανόνας — είναι overbooking, και την κρίνει μόνο ο κριτής
 * με σκληρή άρνηση. Ειδοποίηση και παράθυρο **δεν** ισχύουν για τον οικοδεσπότη (γράφει
 * κρατήσεις που ήδη έγιναν, και για σήμερα).
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import { daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { occupancyConflicts, type Occupancy } from '@/lib/occupancy/occupancy-conflict';

import { stayEnquiryOccupancy } from './stay-availability';
import type { StayCalendar } from './stay-availability-vocabulary';
import { STAY_OCCUPANCY_POLICY } from './stay-conflict';
import {
  arrivalAllowed,
  departureAllowed,
  maxNightsForArrival,
  minNightsForArrival,
  type StayOccupancySource,
} from './stay-rules';

/** Οι κανόνες που μια χειροκίνητη κράτηση μπορεί να παρακάμψει — με αποδοχή. */
export const STAY_RULE_WARNING_KINDS = [
  'arrival-not-allowed',
  'departure-not-allowed',
  'below-min-nights',
  'above-max-nights',
  'preparation',
] as const;

export type StayRuleWarningKind = (typeof STAY_RULE_WARNING_KINDS)[number];

/** `true` αν η τιμή είναι γνωστή προειδοποίηση. */
export function isStayRuleWarningKind(value: unknown): value is StayRuleWarningKind {
  return typeof value === 'string' && (STAY_RULE_WARNING_KINDS as readonly string[]).includes(value);
}

/** Η διαμονή τέμνει νύχτα προετοιμασίας (όχι εγγραφή — εκείνο είναι σκληρή άρνηση); */
function touchesPreparation(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  occupied: readonly Occupancy<StayOccupancySource>[],
): boolean {
  const preparation = occupied.filter((occupancy) => occupancy.source.kind === 'preparation');
  const verdict = occupancyConflicts(
    stayEnquiryOccupancy(propertyId, { checkIn, checkOut, guests: null }),
    preparation,
    STAY_OCCUPANCY_POLICY,
  );
  return verdict.kind !== 'clear';
}

/**
 * **Ποιους κανόνες παρακάμπτει η κράτηση `[checkIn, checkOut)`;** Κενό = κανέναν.
 *
 * @param baseMinNights — ο όρος `minNights` της ζωντανής βραχυχρόνιας διάθεσης.
 */
export function stayRuleWarningsFor(
  propertyId: string,
  calendar: StayCalendar<StayOccupancySource>,
  baseMinNights: number | null,
  checkIn: string,
  checkOut: string,
): readonly StayRuleWarningKind[] {
  if (calendar.kind !== 'declared') return [];
  const input = calendar.rules;
  const nights = daysBetweenDateKeys(checkIn, checkOut);
  if (nights === null) return [];
  const warnings: StayRuleWarningKind[] = [];
  if (!arrivalAllowed(input, checkIn)) warnings.push('arrival-not-allowed');
  if (!departureAllowed(input, checkOut)) warnings.push('departure-not-allowed');
  const min = minNightsForArrival(input, baseMinNights, checkIn, calendar.occupied);
  if (min !== null && nights < min) warnings.push('below-min-nights');
  const max = maxNightsForArrival(input, checkIn);
  if (max !== null && nights > max) warnings.push('above-max-nights');
  if (touchesPreparation(propertyId, checkIn, checkOut, calendar.occupied)) warnings.push('preparation');
  return warnings;
}
