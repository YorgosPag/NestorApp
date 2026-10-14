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
 * 🔑 Ο κανόνας ζει στον **κοινό** κριτή (`lib/files/container-file-verdict`, ADR-777 §8.96)· εδώ μένει μόνο το
 * λεξιλόγιο αρνήσεων του ΠΚΑ, που διαβάζει η οθόνη του.
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  judgeContainerFile,
  type ContainerFileRef,
  type ContainerFileRefusal,
} from '@/lib/files/container-file-verdict';

export const PKA_FILE_REFUSALS = [
  'certificate-missing',
  'certificate-not-yours',
  'certificate-not-ready',
  'certificate-not-pdf',
] as const;

export type PkaFileRefusal = (typeof PKA_FILE_REFUSALS)[number];

export type PkaFileRef = ContainerFileRef;

export type PkaFileVerdict =
  | { readonly kind: 'accepted'; readonly file: PkaFileRef }
  | { readonly kind: 'refused'; readonly reason: PkaFileRefusal };

const PKA_REFUSAL: Readonly<Record<ContainerFileRefusal, PkaFileRefusal>> = {
  'file-missing': 'certificate-missing',
  'file-not-yours': 'certificate-not-yours',
  'file-not-ready': 'certificate-not-ready',
  'file-wrong-type': 'certificate-not-pdf',
};

/**
 * @param data — το έγγραφο του `files_personal/{fileId}` (ή `null` αν δεν υπάρχει)
 * @param expected — ο άνθρωπος και ο φάκελος της αγγελίας του
 */
export function judgePkaFile(
  fileId: string,
  data: Readonly<Record<string, unknown>> | null,
  expected: { readonly uid: string; readonly dossierId: string | null },
): PkaFileVerdict {
  const verdict = judgeContainerFile(fileId, data, {
    owner: { kind: 'personal', userId: expected.uid },
    entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
    entityId: expected.dossierId,
    contentType: 'application/pdf',
  });
  return verdict.kind === 'accepted' ? verdict : { kind: 'refused', reason: PKA_REFUSAL[verdict.reason] };
}
