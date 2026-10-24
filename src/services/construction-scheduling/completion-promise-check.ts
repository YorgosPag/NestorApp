/**
 * @fileoverview **Ο ΕΛΕΓΧΟΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΥΠΟΣΧΕΣΗΣ** — σχέδιο · πρόβλεψη · υπόσχεση, σε ΜΙΑ κρίση (ADR-919 §11).
 * @related ADR-919 §6 (πρόβλεψη) · §7 (δήλωση, Α7) · ADR-777 §8.99.4 Δ1
 * @module services/construction-scheduling/completion-promise-check
 *
 * 🔑 **Το πρότυπο είναι το «Must Finish By» του Primavera P6**: η δημόσια υπόσχεση είναι **εξωτερικός περιορισμός**
 * του έργου, και όταν η πρόβλεψη τον ξεπερνά το P6 δείχνει **αρνητικό περιθώριο** (negative float). Το P6 όμως το
 * αφήνει στον προγραμματιστή να το διαβάσει σε στήλη· εδώ η κρίση **ονομάζεται** και φτάνει σε όποιον δηλώνει την
 * υπόσχεση, τη στιγμή που τη δηλώνει.
 *
 * 🏆 **Πιο νωρίς από την αγορά**: πέρα από την παραβίαση, προειδοποιεί **πριν** συμβεί — όταν το περιθώριο που
 * μένει πέφτει κάτω από το 7,5% του χρόνου ως την υπόσχεση (το κατώφλι «κίτρινο» του SmartPM για την προβλεπόμενη
 * ολοκλήρωση). Και πιάνει την **ληγμένη** υπόσχεση, που στο ImmoScout24 βρέθηκε να μένει δημοσιευμένη.
 *
 * ⛔ **Μόνο εσωτερικό.** Τα `plannedFinish` / ημέρες απόκλισης / η πρόταση **δεν** φτάνουν ποτέ στο κοινό (ADR-777
 * §8.99.4 «Ιδιωτικότητα»). Στο κοινό φτάνει μόνο ό,τι εγκρίνει άνθρωπος, μέσω του `completionDeclaration`.
 *
 * ⚠️ **Χωρίς ρολόι**: το «σήμερα» είναι όρισμα, όπως σε όλη τη μηχανή (ο επιλυτής δεν το διαβάζει, άρα η κρίση
 * λήξης ζει εδώ).
 */

import { daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import type { AvailabilityDeclaration, ListingAvailability } from '@/types/listing-availability';
import type { CompletionForecast } from './completion-forecast';

/** Περιθώριο κάτω από αυτό το κλάσμα του χρόνου ως την υπόσχεση ⇒ «σε κίνδυνο» (SmartPM: κίτρινο στο 7,5%). */
export const PROMISE_AT_RISK_MARGIN_RATIO = 0.075;

export type CompletionPromiseSignal =
  /** Η υπόσχεση έληξε και το κτίριο δεν παραδόθηκε: το κοινό διαβάζει ψέμα. */
  | { readonly kind: 'expired'; readonly promisedEnd: string; readonly daysAgo: number }
  /** Η πρόβλεψη ξεπερνά την υπόσχεση (αρνητικό περιθώριο, P6). */
  | { readonly kind: 'forecast-beyond-promise'; readonly forecastFinish: string; readonly daysBeyond: number; readonly isLowerBound: boolean }
  /** Εντός υπόσχεσης, αλλά με περιθώριο κάτω από το κατώφλι. */
  | { readonly kind: 'at-risk'; readonly forecastFinish: string; readonly marginDays: number }
  /** Το ίδιο το σχέδιο (`completionDate`) τελειώνει μετά την υπόσχεση: υποσχεθήκαμε κάτι που ούτε σχεδιάσαμε. */
  | { readonly kind: 'plan-beyond-promise'; readonly plannedFinish: string; readonly daysBeyond: number }
  /** Το χρονοδιάγραμμα δεν δίνει έντιμη ημερομηνία· ποτέ ψεύτικη. */
  | { readonly kind: 'forecast-unreliable'; readonly reason: 'cyclic-dependencies' | 'invalid-dates' };

export interface CompletionPromiseCheck {
  /** Η πρόταση του χρονοδιαγράμματος (Δ1) — τρίμηνο που **περιέχει** την πρόβλεψη· `null` = τίποτα να προτείνει. */
  readonly proposal: AvailabilityDeclaration | null;
  /** Η πρόβλεψη είναι το νωρίτερο (κάτι μπλοκαρισμένο), όχι εκτίμηση. */
  readonly proposalIsLowerBound: boolean;
  /** Από το σοβαρότερο στο ελαφρύτερο. */
  readonly signals: readonly CompletionPromiseSignal[];
}

export interface CompletionPromiseInputs {
  /** Η **παρουσιάσιμη** δημόσια υπόσχεση (ό,τι βλέπει το κοινό), ή `null`. */
  readonly promise: Extract<ListingAvailability, { kind: 'scheduled' }> | null;
  readonly forecast: CompletionForecast;
  /** `Building.completionDate` — το εσωτερικό σχέδιο, όπως είναι αποθηκευμένο. */
  readonly plannedCompletion: string | null | undefined;
  /** Παραδόθηκε ήδη (`isDeliveredBuildingStatus`)· τότε καμία υπόσχεση δεν ελέγχεται. */
  readonly delivered: boolean;
  /** ISO ημέρα — η ημερομηνία κατάστασης. */
  readonly today: string;
}

function proposalOf(forecast: CompletionForecast): AvailabilityDeclaration | null {
  return forecast.kind === 'forecast' ? { precision: 'quarter', anchor: forecast.finish } : null;
}

function planDayOf(raw: string | null | undefined): string | null {
  const day = typeof raw === 'string' ? raw.slice(0, 10) : '';
  return isDateKey(day) ? day : null;
}

function forecastSignal(promiseEnd: string, forecast: CompletionForecast, today: string): CompletionPromiseSignal | null {
  if (forecast.kind === 'unreliable') return { kind: 'forecast-unreliable', reason: forecast.reason };
  if (forecast.kind !== 'forecast') return null;
  const beyond = daysBetweenDateKeys(promiseEnd, forecast.finish) ?? 0;
  if (beyond > 0) {
    return { kind: 'forecast-beyond-promise', forecastFinish: forecast.finish, daysBeyond: beyond, isLowerBound: forecast.isLowerBound };
  }
  const horizon = daysBetweenDateKeys(today, promiseEnd) ?? 0;
  const margin = -beyond;
  return horizon > 0 && margin < horizon * PROMISE_AT_RISK_MARGIN_RATIO
    ? { kind: 'at-risk', forecastFinish: forecast.finish, marginDays: margin }
    : null;
}

function planSignal(promiseEnd: string, plannedCompletion: string | null | undefined): CompletionPromiseSignal | null {
  const planned = planDayOf(plannedCompletion);
  if (planned === null) return null;
  const beyond = daysBetweenDateKeys(promiseEnd, planned) ?? 0;
  return beyond > 0 ? { kind: 'plan-beyond-promise', plannedFinish: planned, daysBeyond: beyond } : null;
}

/** **Η μία κρίση** σχεδίου · πρόβλεψης · υπόσχεσης για την οθόνη του κτιρίου. */
export function checkCompletionPromise(inputs: CompletionPromiseInputs): CompletionPromiseCheck {
  const proposal = inputs.delivered ? null : proposalOf(inputs.forecast);
  const proposalIsLowerBound = inputs.forecast.kind === 'forecast' && inputs.forecast.isLowerBound;
  if (inputs.delivered || inputs.promise === null) {
    const unreliable = !inputs.delivered && inputs.forecast.kind === 'unreliable'
      ? [{ kind: 'forecast-unreliable', reason: inputs.forecast.reason } as const]
      : [];
    return { proposal, proposalIsLowerBound, signals: unreliable };
  }

  const promiseEnd = inputs.promise.window.end;
  const overdue = daysBetweenDateKeys(promiseEnd, inputs.today) ?? 0;
  const expired: CompletionPromiseSignal | null = overdue > 0 ? { kind: 'expired', promisedEnd: promiseEnd, daysAgo: overdue } : null;
  const signals = [expired, forecastSignal(promiseEnd, inputs.forecast, inputs.today), planSignal(promiseEnd, inputs.plannedCompletion)]
    .filter((signal): signal is CompletionPromiseSignal => signal !== null);
  // Υπόσχεση που ισχύει δεν χρειάζεται πρόταση: η πρόταση εμφανίζεται μόνο για να ΔΙΟΡΘΩΣΕΙ (παραβίαση ή λήξη).
  const broken = signals.some((signal) => signal.kind === 'expired' || signal.kind === 'forecast-beyond-promise');
  return { proposal: broken ? proposal : null, proposalIsLowerBound, signals };
}
