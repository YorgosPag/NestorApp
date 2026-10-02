/**
 * @fileoverview **Άρνηση του server → αποτέλεσμα της ουράς** για κάθε γραφή δηλώσεων αντικειμενικής — μονάδα
 * (`property-mutation-gateway`) **και** κτίριο (`building-mutation-gateway`, ADR-898 Φ4β). Μία μετάφραση, όχι δύο.
 * @related `objective-value-improve-subject.ts` (το λεξιλόγιο αρνήσεων) · `lib/async/field-patch-queue.ts` (ο καταναλωτής)
 * @module lib/objective-value/objective-value-write-failure
 *
 * 🔑 422 = κανόνας δήλωσης (με `violations`) · 403 = κλείδωμα συναλλαγής · άλλο 4xx = ονομασμένη άρνηση (`other`) ·
 * 5xx/δίκτυο = `failed` (η ουρά προσφέρει «ξαναδοκίμασε»). **Δεν πετά ποτέ.**
 */

import { apiErrorBodyOf } from '@/lib/api/api-client-types';
import { ApiClientError } from '@/lib/api/enterprise-api-client';

import { objectiveValueRejectionOf, type ObjectiveValueWriteOutcome } from './objective-value-improve-subject';

export function objectiveValueWriteFailureOf(cause: unknown): ObjectiveValueWriteOutcome {
  if (!ApiClientError.isApiClientError(cause) || cause.statusCode >= 500) return { kind: 'failed' };
  if (cause.statusCode === 403) return { kind: 'rejected', reasons: ['locked'] };
  const violations = apiErrorBodyOf(cause)?.violations;
  const reasons = Array.isArray(violations) && violations.length > 0 ? violations.map(objectiveValueRejectionOf) : ['other' as const];
  return { kind: 'rejected', reasons };
}
