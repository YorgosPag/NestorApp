/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΓΕΝΝΗΣΗΣ ΦΑΚΕΛΟΥ** — ό,τι επιτρέπεται να στείλει ο πελάτης, και τίποτε άλλο.
 * @related ADR-866 Φ1.1 · §2.8.7 (Δ1 · Δ4) · types/property-dossier.ts · app/api/property-dossiers/route.ts
 * @module lib/property-dossier/property-dossier-request-schema
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΠΕΔΙΑ — ΚΑΙ Ο ΚΑΤΟΧΟΣ ΔΕΝ ΕΙΝΑΙ ΕΝΑ ΑΠΟ ΑΥΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · `id` — η ταυτότητα `pdos_*` που **προ-γέννησε** ο πελάτης (Google Drive `files.generateIds`):
 *   το ανέβασμα του Φ1.3 χρειάζεται τον προορισμό **πριν** υπάρξει το έγγραφο. Ο διακομιστής **δεν**
 *   την εμπιστεύεται: πρόθεμα + uuid v4 από το **μητρώο** (`enterpriseIdFromRequest`), και `create()`.
 * · `label` · `type` — το {@link PropertyDossierDraft}.
 *
 * ⛔ **Κανένα `userId`**: ο κάτοχος είναι **πάντα** ο αιτών (`actor.ctx.uid`). Ένα `userId` στο σώμα
 * **αφαιρείται** από το zod (προεπιλογή `strip`) — δεν φτάνει ποτέ στον γραφέα.
 *
 * ⚠️ **Το μήκος/κενό του ονόματος ΔΕΝ κρίνεται εδώ**: είναι **invariant** (`label-required` ·
 * `label-too-long`) που τρέχει **και** η φόρμα, άρα απαντά `422` με κωδικό — όχι `400` «δεν σε
 * κατάλαβα». Εδώ κρίνεται μόνο το **σχήμα**.
 *
 * **Layering**: leaf — zod, καμία εξάρτηση από Firestore ή React.
 */

import { z } from 'zod';

import { propertyTypeSchema } from '@/lib/property/property-type-schema';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { enterpriseIdFromRequest } from '@/services/enterprise-id-parse';
import {
  PROPERTY_DOSSIER_LIFECYCLES,
  type PropertyDossierChange,
  type PropertyDossierDraft,
} from '@/types/property-dossier';

/** Η ταυτότητα του φακέλου, κανονικοποιημένη — ή ζήτημα στο μονοπάτι `id`. */
const dossierId = z.string().transform((value, ctx) => {
  const id = propertyDossierIdFrom(value);
  if (id === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom });
    return z.NEVER;
  }
  return id;
});

/** Το σώμα του `POST /api/property-dossiers`. */
export const propertyDossierBirthRequestSchema = z.object({
  id: dossierId,
  label: z.string(),
  type: propertyTypeSchema.nullable(),
});

export type PropertyDossierBirthRequest = z.infer<typeof propertyDossierBirthRequestSchema>;

/** Το προσχέδιο του αιτήματος — **χωρίς** την ταυτότητα, που ταξιδεύει χωριστά ως «γέννηση». */
export function propertyDossierDraftOf(request: PropertyDossierBirthRequest): PropertyDossierDraft {
  return { label: request.label, type: request.type };
}

/**
 * **Το σώμα του `PATCH /api/property-dossiers/[dossierId]`** (ADR-866 Φ1.2) — **ένα από τα δύο**, και τίποτε άλλο:
 * · `{ lifecycle }` — αρχειοθέτηση / επαναφορά·
 * · `{ label, type }` — μετονομασία / διόρθωση είδους.
 *
 * 🔴 **`.strict()` και στα δύο**: ένα σώμα που ανακατεύει (`{ lifecycle, label }`) ή κουβαλά ξένο κλειδί (`userId`)
 * **απορρίπτεται** (400) — δεν «διαλέγουμε» σιωπηλά ποια πράξη εννοούσε. Εδώ το `strip` της γέννησης θα ήταν λάθος: εκεί
 * το `userId` απλώς αγνοείται, εδώ μια ασαφής **πράξη** δεν επιτρέπεται να εκτελεστεί κατά μάντευση.
 */
export const propertyDossierPatchRequestSchema = z.union([
  z.object({ lifecycle: z.enum(PROPERTY_DOSSIER_LIFECYCLES) }).strict(),
  z.object({ label: z.string(), type: propertyTypeSchema.nullable() }).strict(),
]);

export type PropertyDossierPatchRequest = z.infer<typeof propertyDossierPatchRequestSchema>;

/** Σώμα → **μεταβολή** του τομέα (`PropertyDossierChange`) — η μία μετάφραση, ώστε η πόρτα να μην ξέρει σχήματα. */
export function propertyDossierChangeOf(request: PropertyDossierPatchRequest): PropertyDossierChange {
  return 'lifecycle' in request
    ? { kind: 'lifecycle', lifecycle: request.lifecycle }
    : { kind: 'details', draft: { label: request.label, type: request.type } };
}

/**
 * **Η ταυτότητα φακέλου από το αίτημα** (σώμα γέννησης **ή** διαδρομή μεταβολής) — πρόθεμα `pdos` + uuid v4 από το **μητρώο**, ή `null`.
 * Η πόρτα απαντά `null` με **404** (ποτέ 400): μια άκυρη ταυτότητα είναι «δεν υπάρχει εδώ», όχι «δεν σε κατάλαβα».
 */
export function propertyDossierIdFrom(value: unknown): string | null {
  return enterpriseIdFromRequest(value, ENTERPRISE_ID_PREFIXES.PROPERTY_DOSSIER);
}
