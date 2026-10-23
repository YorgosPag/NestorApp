/**
 * @fileoverview **Ο ΟΡΙΖΟΝΤΑΣ ΤΟΥ ΧΡΟΝΟΥ** — «η νωρίτερη παραδίδεται Δ΄ τρίμηνο 2027» δίπλα στο «Δεν είναι διαθέσιμες
 * το διάστημα που ζήτησες» (ADR-919 §11).
 * @related lib/demand/demand-match-axes.ts (`timingBlockers`) · components/demand/DemandBlockerList.tsx
 * @module lib/demand/demand-timing-horizon
 *
 * 🔑 **Καμία δεύτερη κρίση χρόνου** (ADR-919 §3.7): δεν ξαναρωτά «χωράει στο διάστημα;». Διαβάζει **μόνο** τις
 * αγγελίες που η **μηχανή** ήδη σημάδεψε με `not-available-then`, και από αυτές κρατά την υπόσχεση με το νωρίτερο
 * **τέλος** — το ίδιο κριτήριο Δ2 με το `timingBlockers`, άρα «η νωρίτερη» σημαίνει «η πρώτη που θα ταίριαζε αν
 * μετέθετες το διάστημά σου».
 *
 * 🏆 Η αγορά λέει «0 αποτελέσματα». Εμείς λέμε **πότε** θα υπάρχει κάτι — η πιο χρήσιμη πρόταση υποχώρησης για ζήτηση
 * χρόνου, χωρίς να εκθέσουμε ποια αγγελία (μόνο η δημόσια υπόσχεση, ήδη στην αγγελία).
 */

import type { ScheduledAvailability } from '@/types/availability-history';
import type { DemandOutcome } from './demand-matching';

/** Η νωρίτερη υπόσχεση ανάμεσα στις αγγελίες που σταμάτησε ο χρόνος, ή `null`. Ισοπαλία ⇒ η πιο στενή ακρίβεια. */
export function earliestTimingBlockedPromise(outcomes: readonly DemandOutcome[]): ScheduledAvailability | null {
  let earliest: ScheduledAvailability | null = null;
  for (const { facts, match } of outcomes) {
    const availability = facts.availability;
    if (availability.kind !== 'scheduled' || !match.blockers.includes('not-available-then')) continue;
    const sooner = earliest === null || availability.window.end < earliest.window.end;
    const sameEndNarrower = earliest !== null && availability.window.end === earliest.window.end
      && availability.window.start > earliest.window.start;
    if (sooner || sameEndNarrower) earliest = availability;
  }
  return earliest;
}
