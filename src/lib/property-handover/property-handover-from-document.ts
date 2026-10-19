/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** — έγγραφο Firestore → `PropertyHandover`, ή `null`.
 * @related ADR-916 §5.2 · ADR-839 / ADR-842 §7.6.12 (σύνορα ανάγνωσης) · CHECK 3.74
 * @module lib/property-handover/property-handover-from-document
 *
 * 🔑 **Κάθε ανάγνωση αποθηκευμένης παράδοσης περνά από εδώ** — ο γραφέας συμφιλίωσης και η πόρτα
 * προεπισκόπησης. Το CHECK 3.74 απαγορεύει ωμό `as PropertyHandover` οπουδήποτε αλλού.
 *
 * ⚠️ **Πεδίο προς πεδίο, κανένας ισχυρισμός τύπου.** Τη γράφει **μόνο** ο διακομιστής ⇒ έγγραφο χωρίς
 * κάτοχο, ακίνητο, παραλήπτη ή γνωστό κύκλο ζωής **δεν** είναι παράδοση (`null`), όχι «ελλιπής παράδοση».
 * Η ταυτότητα έρχεται **από έξω** και νικά (ίδιο συμβόλαιο με `propertyDossierFromDocument`).
 *
 * **Layering**: leaf — καθαρή συνάρτηση, κανένα Firestore SDK.
 */

import {
  PROPERTY_HANDOVER_COMPLETION_SOURCES,
  PROPERTY_HANDOVER_LIFECYCLES,
  type PropertyHandover,
  type PropertyHandoverCompletion,
  type PropertyHandoverCompletionSource,
  type PropertyHandoverLifecycle,
} from '@/types/property-handover';

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const isLifecycle = (value: unknown): value is PropertyHandoverLifecycle =>
  (PROPERTY_HANDOVER_LIFECYCLES as readonly unknown[]).includes(value);

const isCompletionSource = (value: unknown): value is PropertyHandoverCompletionSource =>
  (PROPERTY_HANDOVER_COMPLETION_SOURCES as readonly unknown[]).includes(value);

function completionOf(raw: unknown): PropertyHandoverCompletion | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { source, at } = raw as Record<string, unknown>;
  return isCompletionSource(source) && nonEmptyString(at) ? { source, at } : null;
}

/** **Διαβάζει ένα αποθηκευμένο έγγραφο ως παράδοση.** `null` ⇒ «αυτό δεν είναι παράδοση». */
export function propertyHandoverFromDocument(raw: unknown, id: string): PropertyHandover | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const stored = raw as Record<string, unknown>;

  const { companyId, propertyId, recipientContactId, lifecycle, createdAt, updatedAt } = stored;
  if (!nonEmptyString(companyId) || !nonEmptyString(propertyId) || !nonEmptyString(recipientContactId)) return null;
  if (!isLifecycle(lifecycle) || !nonEmptyString(createdAt) || !nonEmptyString(updatedAt)) return null;

  return {
    id,
    companyId,
    propertyId,
    recipientContactId,
    lifecycle,
    completion: completionOf(stored.completion),
    createdAt,
    updatedAt,
  };
}
