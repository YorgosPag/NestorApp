/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΦΑΚΕΛΟΥ** — έγγραφο Firestore → `PropertyDossier`, ή `null`.
 * @related ADR-866 Φ1.1 · ADR-839 / ADR-842 §7.6.12 (σύνορα ανάγνωσης) · CHECK 3.74
 * @module lib/property-dossier/property-dossier-from-document
 *
 * 🔑 **Κάθε ανάγνωση αποθηκευμένου φακέλου περνά από εδώ** — ο γραφέας διακομιστή σήμερα (επανάληψη
 * γέννησης, §2.8.7 Δ4), ο ζωντανός αναγνώστης της οθόνης αύριο (Φ1.2, `useOwnedDocuments.fromDocument`).
 * Το CHECK 3.74 απαγορεύει ωμό `as PropertyDossier` οπουδήποτε αλλού.
 *
 * ⚠️ **Πεδίο προς πεδίο, ΚΑΝΕΝΑΣ ισχυρισμός τύπου.** Τον φάκελο τον γράφει **μόνο** ο διακομιστής, άρα
 * κάθε αποθηκευμένο έγγραφο είναι σήμερα πλήρες — και γι' αυτό η απάντηση σε έγγραφο που **δεν** είναι
 * φάκελος (λείπει κάτοχος, άγνωστος κύκλος ζωής) είναι `null`, όχι «ελλιπής φάκελος». Όταν ο φάκελος
 * αποκτήσει πεδία που προστίθενται μετά τη γέννηση (Φ1.3: διεύθυνση), η **απουσία** τους θα έχει
 * δηλωμένη ουδέτερη τιμή εδώ — ποτέ εφευρημένη στον αναγνώστη.
 *
 * ⚠️ **Η ταυτότητα έρχεται από έξω και νικά**: το `id` του εγγράφου είναι η αυθεντία, όχι ένα `id`
 * γραμμένο στο περιεχόμενο (ίδιο συμβόλαιο με `readStoredDemand`).
 *
 * **Layering**: leaf — καθαρή συνάρτηση, κανένα Firestore SDK.
 */

import { PROPERTY_TYPES, type PropertyTypeCanonical } from '@/constants/property-types';
import {
  PROPERTY_DOSSIER_LIFECYCLES,
  type PropertyDossier,
  type PropertyDossierLifecycle,
} from '@/types/property-dossier';

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const isLifecycle = (value: unknown): value is PropertyDossierLifecycle =>
  (PROPERTY_DOSSIER_LIFECYCLES as readonly unknown[]).includes(value);

const isPropertyType = (value: unknown): value is PropertyTypeCanonical =>
  (PROPERTY_TYPES as readonly unknown[]).includes(value);

/**
 * **Διαβάζει ένα αποθηκευμένο έγγραφο ως φάκελο.** `null` ⇒ «αυτό δεν είναι φάκελος».
 *
 * ⚠️ Άγνωστο `type` διαβάζεται `null` («δεν είναι γνωστό»), **όχι** άρνηση: το λεξιλόγιο των ειδών
 * μπορεί να στενέψει στο μέλλον (όπως στο ADR-777 §8.32), και ο φάκελος του ανθρώπου δεν πρέπει να
 * εξαφανιστεί επειδή άλλαξε ένας κατάλογος.
 */
export function propertyDossierFromDocument(raw: unknown, id: string): PropertyDossier | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const stored = raw as Record<string, unknown>;

  const { userId, label, lifecycle, createdAt, updatedAt } = stored;
  if (!nonEmptyString(userId) || !nonEmptyString(label) || !isLifecycle(lifecycle)) return null;
  if (!nonEmptyString(createdAt) || !nonEmptyString(updatedAt)) return null;

  return {
    id,
    userId,
    label,
    type: isPropertyType(stored.type) ? stored.type : null,
    lifecycle,
    createdAt,
    updatedAt,
  };
}
