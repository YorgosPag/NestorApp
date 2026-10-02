/**
 * @module lib/ownership/pka-file-verdict
 * @description **Είναι αυτό το αρχείο ΠΚΑ που επιτρέπεται να κριθεί;** (ADR-900 §3.8) — καθαρή συνάρτηση.
 *
 * Το ΠΚΑ ανεβαίνει από την **υπάρχουσα** ροή του φακέλου ακινήτου (`uploadEntityFile` → `files_personal`).
 * Πριν διαβαστεί ένα byte, κρίνεται το **έγγραφο του αρχείου**:
 * - ανήκει στον **ίδιο** άνθρωπο (`userId`) — ποτέ ΠΚΑ από τον φάκελο άλλου·
 * - ζει στον **φάκελο ΑΥΤΗΣ** της αγγελίας (`entityType` · `entityId === dossierId`)·
 * - είναι **έτοιμο** (`status: ready`) και **PDF**.
 *
 * Ίδιο σχήμα με το `attestation-document-verdict` της εντολής: κριτής πάνω στα δεδομένα, όχι στο I/O.
 */

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';

export const PKA_FILE_REFUSALS = [
  'certificate-missing',
  'certificate-not-yours',
  'certificate-not-ready',
  'certificate-not-pdf',
] as const;

export type PkaFileRefusal = (typeof PKA_FILE_REFUSALS)[number];

export interface PkaFileRef {
  readonly fileId: string;
  readonly storagePath: string;
  readonly storagePlacement: unknown;
}

export type PkaFileVerdict =
  | { readonly kind: 'accepted'; readonly file: PkaFileRef }
  | { readonly kind: 'refused'; readonly reason: PkaFileRefusal };

const PDF_CONTENT_TYPE = 'application/pdf';

function stringField(data: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * @param data — το έγγραφο του `files_personal/{fileId}` (ή `null` αν δεν υπάρχει)
 * @param expected — ο άνθρωπος και ο φάκελος της αγγελίας του
 */
export function judgePkaFile(
  fileId: string,
  data: Readonly<Record<string, unknown>> | null,
  expected: { readonly uid: string; readonly dossierId: string | null },
): PkaFileVerdict {
  if (data === null) return { kind: 'refused', reason: 'certificate-missing' };

  const owned =
    stringField(data, 'userId') === expected.uid &&
    expected.dossierId !== null &&
    stringField(data, 'entityType') === ENTITY_TYPES.PROPERTY_DOSSIER &&
    stringField(data, 'entityId') === expected.dossierId;
  // «Δεν υπάρχει» και «δεν είναι δικό σου» μένουν διακριτά ΜΟΝΟ προς τον ίδιο: το id ήρθε από τη
  // δική του οθόνη, άρα η διάκριση δεν επιβεβαιώνει ξένη ύπαρξη σε τρίτο.
  if (!owned) return { kind: 'refused', reason: 'certificate-not-yours' };

  if (stringField(data, 'status') !== FILE_STATUS.READY) return { kind: 'refused', reason: 'certificate-not-ready' };
  if (stringField(data, 'contentType') !== PDF_CONTENT_TYPE) return { kind: 'refused', reason: 'certificate-not-pdf' };

  const storagePath = stringField(data, 'storagePath');
  if (storagePath === null) return { kind: 'refused', reason: 'certificate-not-ready' };
  return { kind: 'accepted', file: { fileId, storagePath, storagePlacement: data.storagePlacement } };
}
