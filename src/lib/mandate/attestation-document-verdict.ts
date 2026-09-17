/**
 * @fileoverview **ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΤΟ ΕΝΤΥΠΟ ΤΟΥ ΓΡΑΦΕΙΟΥ ΓΙΑ ΑΥΤΗ ΤΗΝ ΑΓΓΕΛΙΑ;** — ο ένας κριτής βεβαίωσης.
 * @related ADR-864 §18.4 Δ1 · Α23 · services/mandate/attestation-document.ts
 * @module lib/mandate/attestation-document-verdict
 *
 * 🔴 **Η ΟΘΟΝΗ ΣΤΕΛΝΕΙ ΤΑΥΤΟΤΗΤΑ ΑΡΧΕΙΟΥ, Ο ΔΙΑΚΟΜΙΣΤΗΣ ΓΡΑΦΕΙ ΔΙΑΔΡΟΜΗ.** Μέχρι το Μέρος Γ η βεβαίωση
 * δεχόταν **οποιοδήποτε** κείμενο ως `documentPath` — δηλαδή «έχω υπογεγραμμένο έντυπο» χωρίς κανέναν
 * δεσμό ανάμεσα στο αρχείο, στο γραφείο και στην καταχώρηση. Η Bright MLS ζητά ανέβασμα· εδώ το αρχείο
 * **αποδεικνύει** ότι είναι **δικό σου** και **για αυτή** την αγγελία (§18.5 #3).
 *
 * ⚠️ **Χωρίς bypass super admin**: ρωτά τον **καθαρό** κριτή ενοικίασης, όχι το `fileResource.check`
 * (που αφήνει τον super admin να διαβάσει ξένο αρχείο). Η βεβαίωση είναι **δήλωση του γραφείου** —
 * κανένας ρόλος δεν βεβαιώνει με έντυπο άλλης εταιρείας.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, καμία Firestore.
 */

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';

/** Ό,τι διαβάζει ο κριτής από το `files/{fileId}` — τίποτε άλλο. */
interface AttestationFileFacts {
  readonly companyId?: string | null;
  readonly entityType?: unknown;
  readonly entityId?: unknown;
  readonly status?: unknown;
  readonly isDeleted?: unknown;
  readonly storagePath?: unknown;
  readonly contentType?: unknown;
  readonly displayName?: unknown;
}

export type AttestationDocumentVerdict =
  | {
      readonly kind: 'attached';
      readonly storagePath: string;
      /** Για το πάγωμα (ADR-864 §19): τύπος και όνομα **του `FileRecord`**, ποτέ του σύρματος. */
      readonly contentType: string;
      readonly fileName: string;
    }
  /** Κανένα αρχείο δεν δηλώθηκε. */
  | { readonly kind: 'refused'; readonly reason: 'consent-document-missing' }
  /** Δηλώθηκε, αλλά δεν είναι έτοιμο έντυπο **αυτού** του γραφείου για **αυτή** την αγγελία. */
  | { readonly kind: 'refused'; readonly reason: 'consent-document-invalid' };

const INVALID: AttestationDocumentVerdict = { kind: 'refused', reason: 'consent-document-invalid' };

/**
 * @param facts — `null` όταν το έγγραφο **δεν υπάρχει**: ανύπαρκτο και ξένο λέγονται **το ίδιο**, ώστε ο
 *   κριτής να μη γίνει μαντείο ύπαρξης αρχείων άλλων εταιρειών.
 */
export function judgeAttestationDocument(
  facts: AttestationFileFacts | null,
  expected: { readonly companyId: string; readonly ownerPropertyId: string },
): AttestationDocumentVerdict {
  if (facts === null) return INVALID;
  if (!isPayloadOwnedByCompany(facts, expected.companyId)) return INVALID;
  if (facts.entityType !== ENTITY_TYPES.OWNER_PROPERTY || facts.entityId !== expected.ownerPropertyId) return INVALID;
  if (facts.status !== FILE_STATUS.READY || facts.isDeleted === true) return INVALID;
  if (typeof facts.storagePath !== 'string' || facts.storagePath.trim() === '') return INVALID;
  return {
    kind: 'attached',
    storagePath: facts.storagePath,
    contentType: typeof facts.contentType === 'string' && facts.contentType !== '' ? facts.contentType : 'application/octet-stream',
    fileName: typeof facts.displayName === 'string' && facts.displayName.trim() !== '' ? facts.displayName.trim() : fileNameOf(facts.storagePath),
  };
}

/** Το τελευταίο τμήμα της διαδρομής — όνομα όταν το `FileRecord` δεν έχει `displayName`. */
function fileNameOf(storagePath: string): string {
  return storagePath.split('/').at(-1) ?? storagePath;
}
