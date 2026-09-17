/**
 * =============================================================================
 * «ΟΡΙΣΜΟΣ ΩΣ ΤΡΕΧΟΥΣΑΣ» — Η ΠΟΛΙΤΙΚΗ, ΚΑΘΑΡΗ (ADR-862 Φ0 · ανοιχτό του Β10)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποια εγγραφή γεννιέται όταν μια ΠΑΛΙΑ έκδοση γίνεται ξανά τρέχουσα;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΓΙΑΤΙ ΠΟΤΕ «ΑΝΑΣΤΑΣΗ»
 * ─────────────────────────────────────────────────────────────────────────────
 * • **Box** *«Promote file version»*: *«creates a new copy of the old version and puts it
 *   at the top of the versions history»*.
 * • **SharePoint**: *«doesn't remove the earlier version you just restored. It creates a
 *   copy and makes it the latest version»*.
 * • **Figma**: η επαναφορά είναι **νέο βήμα** ιστορικού, όχι επανατύλιξη.
 * ⇒ Η παλιά έκδοση **μένει** αρχείο (UK BIM Framework, «Continuous Archiving»)· γεννιέται
 *   **νέος διάδοχος** με τα bytes της, και ο σημερινός αντικαθίσταται με τον ΕΝΑ γραφέα.
 *
 * 🏆 **Πού ξεπερνάμε**:
 * 1. **Ατομικότητα**: ο διάδοχος γεννιέται **μέσα στη συναλλαγή** της αντικατάστασης
 *    (`successorBirth`) ⇒ **καμία στιγμή** με δύο ενεργές εκδόσεις της ίδιας θέσης.
 * 2. **Ρητή προϋπόθεση κεφαλής** (AIP-154 `etag`, HTTP `If-Match`): ο αιτών δηλώνει ποια
 *    έκδοση **είδε** ως τρέχουσα· αν άλλαξε, ονομασμένη άρνηση `head-moved` — ποτέ σιωπηλή
 *    αντικατάσταση δουλειάς που δεν είδε.
 * 3. **Ιδεμποτησία**: ντετερμινιστικό αναγνωριστικό διαδόχου ανά (μισθωτής, πηγή, κεφαλή) ⇒
 *    διπλό κλικ / επανάληψη δικτύου = **ένα** αποτέλεσμα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΕΡΙΕΧΟΜΕΝΟ ΑΠΟ ΤΗΝ ΠΗΓΗ · ΘΕΣΗ ΑΠΟ ΤΗΝ ΚΕΦΑΛΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η θέση (οντότητα · κατηγορία · σκοπός · όροφος) έρχεται από την **τρέχουσα** κεφαλή: αν
 * το αρχείο μετακινήθηκε από τότε, η επαναφορά **δεν** το γυρίζει πίσω — και ο κριτής
 * διαδοχής απαιτεί **ίδια** ταυτότητα με την κεφαλή. Το περιεχόμενο (bytes · σκηνή DXF ·
 * μικρογραφία · μονάδες) έρχεται από την **πηγή**.
 * ⛔ **ΠΟΤΕ** `classification`/`sourceRevisions` (ADR-845: έχουν ΕΝΑΝ γραφέα) και **ΠΟΤΕ**
 * πεδία CDE: ο διάδοχος γεννιέται `pre-cde` — μια παλιά σφραγίδα δεν γίνεται σφραγίδα νέου.
 *
 * @module services/iso19650/version-promotion-policy
 * @see services/iso19650/version-promotion — ο ενορχηστρωτής (Admin SDK)
 * @see services/iso19650/container-transitions — ο ΕΝΑΣ γραφέας (`successorBirth`)
 */

import { FILE_STATUS } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';
import type { BuildPendingFileRecordInput } from '@/services/file-record/file-record-core';
import type { FileRecord } from '@/types/file-record';

/** Γιατί **δεν** έγινε η προώθηση — πριν φτάσει στον γραφέα. Κλειστό σύνολο. */
export type PromotionPreflightRefusal =
  /** Η πηγή δεν υπάρχει ή ανήκει σε άλλον μισθωτή — ένα όνομα, κανένα μαντείο ύπαρξης. */
  | 'not-found'
  /** Η κεφαλή που είδε ο αιτών δεν είναι πια η τρέχουσα (AIP-154 ⇒ `ABORTED`). */
  | 'head-moved'
  /** Η πηγή δεν έχει bytes να αντιγραφούν (π.χ. `pending`/`failed`). */
  | 'source-not-ready';

/**
 * Τα πεδία **περιεχομένου** που περνούν από την πηγή στον διάδοχο.
 * ⚠️ Κλειστή λίστα, ως δεδομένα: νέο πεδίο περιεχομένου χωρίς γραμμή εδώ **δεν** ταξιδεύει.
 */
const PROMOTED_CONTENT_FIELDS = [
  'sizeBytes',
  'hash',
  'processedData',
  'processingStatus',
  'thumbnailUrl',
  'userDrawingUnits',
  'disciplineCode',
  'documentSeries',
] as const satisfies readonly (keyof FileRecord)[];

/** Τα πεδία **θέσης** της κεφαλής που δεν τα παράγει ο builder. */
const HEAD_POSITION_FIELDS = [
  'publicationIdentity',
  'projectLabel',
  'buildingLabel',
  'folderId',
  'entryPointId',
] as const satisfies readonly (keyof FileRecord)[];

/** **Ο σπόρος του ντετερμινιστικού αναγνωριστικού** — ίδια αίτηση ⇒ ίδιος διάδοχος. */
export function promotionSeed(companyId: string, sourceFileId: string, headFileId: string): string {
  return `version-promotion:${companyId}:${sourceFileId}:${headFileId}`;
}

/** Η είσοδος του builder: **θέση** από την κεφαλή, **ταυτότητα αρχείου** από την πηγή. */
export function successorBuilderInput(params: {
  readonly source: FileRecord;
  readonly head: FileRecord;
  readonly successorId: string;
  readonly companyId: string;
  readonly actorUid: string;
}): BuildPendingFileRecordInput {
  const { source, head } = params;
  return {
    fileId: params.successorId,
    companyId: params.companyId,
    createdBy: params.actorUid,
    entityType: head.entityType,
    entityId: head.entityId,
    domain: head.domain,
    category: head.category,
    originalFilename: source.originalFilename,
    contentType: source.contentType,
    ext: source.ext,
    ...(head.projectId ? { projectId: head.projectId } : {}),
    ...(head.purpose ? { purpose: head.purpose } : {}),
    ...(head.levelFloorId ? { levelFloorId: head.levelFloorId } : {}),
    ...(head.linkedTo && head.linkedTo.length > 0 ? { linkedTo: head.linkedTo } : {}),
  };
}

/** Αντιγραφή **μόνο** των ορισμένων τιμών — το Firestore απορρίπτει `undefined`. */
function definedFields<K extends keyof FileRecord>(
  record: FileRecord,
  fields: readonly K[],
): Partial<Pick<FileRecord, K>> {
  const picked: Partial<Pick<FileRecord, K>> = {};
  for (const field of fields) {
    if (record[field] !== undefined && record[field] !== null) picked[field] = record[field];
  }
  return picked;
}

/**
 * **Η πλήρης εγγραφή του διαδόχου** — έτοιμη για `successorBirth`.
 *
 * 🔑 `status: ready` **από τη γέννηση**: τα bytes υπάρχουν ήδη (αντιγράφηκαν πριν τη
 * συναλλαγή), και ο κριτής διαδοχής απαιτεί έτοιμο διάδοχο.
 * 🔑 `promotedFromFileId`: η προέλευση, για το ιστορικό — «η v4 είναι η v2 ξανά».
 */
export function promotedSuccessorRecord(params: {
  readonly base: Readonly<Record<string, unknown>>;
  readonly source: FileRecord;
  readonly head: FileRecord;
  readonly downloadUrl: string;
}): Record<string, unknown> {
  const at = nowISO();
  return {
    ...params.base,
    ...definedFields(params.head, HEAD_POSITION_FIELDS),
    ...definedFields(params.source, PROMOTED_CONTENT_FIELDS),
    status: FILE_STATUS.READY,
    downloadUrl: params.downloadUrl,
    promotedFromFileId: params.source.id,
    createdAt: at,
    updatedAt: at,
  };
}
