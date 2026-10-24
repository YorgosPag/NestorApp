/**
 * @fileoverview **Ο ΟΡΙΖΟΝΤΑΣ ΤΟΥ ΧΡΟΝΟΥ** — «η νωρίτερη παραδίδεται Δ΄ τρίμηνο 2027» δίπλα στο «Δεν είναι διαθέσιμες
 * το διάστημα που ζήτησες» (ADR-919 §11).
 * @related lib/demand/demand-match-axes.ts (`timingBlockers`) · components/demand/DemandBlockerList.tsx ·
 *   lib/demand/demand-awaiting-delivery.ts (`compareDeliveryPromise`)
 * @module lib/demand/demand-timing-horizon
 *
 * 🔑 **Καμία δεύτερη κρίση χρόνου** (ADR-919 §3.7): δεν ξαναρωτά «χωράει στο διάστημα;». Διαβάζει **μόνο** τις
 * αγγελίες που η **μηχανή** ήδη σημάδεψε με `not-available-then`, και από αυτές κρατά την υπόσχεση με το νωρίτερο
 * **τέλος** — το ίδιο κριτήριο Δ2 με το `timingBlockers`, μέσω του ΕΝΟΣ συγκριτικού `compareDeliveryPromise`.
 *
 * ⚠️ **Σχολιάζει τη γραμμή `not-available-then` του `blockedBy`, άρα διαβάζει τις ΑΠΟΡΡΙΦΘΕΙΣΕΣ** — αγγελίες που
 * σταματά ο χρόνος **μαζί** με κατηγορικό εμπόδιο. Η αγγελία που τη σταματά **μόνο** ο χρόνος δεν είναι ποτέ εδώ
 * (το εμπόδιο είναι μετρήσιμο ⇒ `near-miss`): «η πρώτη που θα ταίριαζε αν περίμενες» είναι η σκάλα του
 * `awaitingDeliveryOf` (ADR-919 §12). Μέχρι το βήμα 9 αυτό το σχόλιο υποσχόταν το δεύτερο, ενώ ο κώδικας έκανε το
 * πρώτο.
 *
 * 🏆 Η αγορά λέει «0 αποτελέσματα». Εμείς λέμε **πότε** θα υπάρχει κάτι, χωρίς να εκθέσουμε ποια αγγελία (μόνο η
 * δημόσια υπόσχεση, ήδη στην αγγελία).
 */

import type { ScheduledAvailability } from '@/types/availability-history';
import { compareDeliveryPromise } from './demand-awaiting-delivery';
import type { DemandOutcome } from './demand-matching';

/** Η νωρίτερη υπόσχεση ανάμεσα στις αγγελίες που σταμάτησε ο χρόνος, ή `null`. Ισοπαλία ⇒ η πιο στενή ακρίβεια. */
export function earliestTimingBlockedPromise(outcomes: readonly DemandOutcome[]): ScheduledAvailability | null {
  let earliest: ScheduledAvailability | null = null;
  for (const { facts, match } of outcomes) {
    const availability = facts.availability;
    if (availability.kind !== 'scheduled' || !match.blockers.includes('not-available-then')) continue;
    if (earliest === null || compareDeliveryPromise(availability, earliest) < 0) earliest = availability;
  }
  return earliest;
}
