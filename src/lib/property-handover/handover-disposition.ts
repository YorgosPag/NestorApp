/**
 * @fileoverview **Παραδίδεται αυτό το αρχείο στον αγοραστή;** — η ΜΙΑ κρίση (ADR-916 §5.1).
 * @related ADR-916 Δ3 · config/upload-entry-points (η δήλωση) · ADR-866 §5.3 (ένας κατάλογος)
 * @module lib/property-handover/handover-disposition
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΚΑΤΗΓΟΡΙΑ ΚΑΙ ΟΧΙ ΜΟΝΟ ΕΙΔΟΣ ΕΓΓΡΑΦΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-10-19 (ADR-916 §2.3): **0/100** αρχεία ακινήτου έχουν `entryPointId`, και το `purpose`
 * γράφεται από αγωγούς **εκτός** καταλόγου. Το `domain` και το `category` είναι **πάντα** συμπληρωμένα και
 * κλειστά ⇒ ο πίνακας ανά κατηγορία είναι το δίχτυ που **δεν** μπορεί να λείψει, και ο μεταγλωττιστής
 * αναγκάζει πληρότητα (`Record<FileCategory, …>`).
 *
 * ⚖️ **Προτεραιότητα** (η πρώτη που απαντά κερδίζει):
 *   1. εμπιστευτικό (`classification: confidential`) ⇒ `review` — ποτέ αυτόματα προς τα έξω (DLP)
 *   2. τομέας του **γραφείου** (λογιστική · οικονομικά · μεσιτεία · εισερχόμενα) ⇒ `internal`
 *   3. δήλωση καταλόγου (θέση ή ομάδα μελετών)
 *   4. κατηγορία
 *
 * Ό,τι **δεν** ταξινομείται είναι `review`: **ούτε** φεύγει σιωπηλά **ούτε** χάνεται σιωπηλά — το βλέπει το γραφείο.
 *
 * **Layering**: leaf — καμία εξάρτηση από Firestore ή React.
 */

import {
  ENTITY_TYPES,
  FILE_CATEGORIES,
  FILE_CLASSIFICATIONS,
  FILE_DOMAINS,
  FILE_LIFECYCLE_STATES,
  FILE_STATUS,
  type EntityType,
  type FileCategory,
  type FileClassification,
  type FileDomain,
  type FileLifecycleState,
  type FileStatus,
} from '@/config/domain-constants';
import { CDE_STATES, type CdeState } from '@/config/iso19650-constants';
import { declaredHandoverOf, findCatalogEntryForFile } from '@/config/upload-entry-points/queries';
import type { HandoverDisposition } from '@/config/upload-entry-points/types';
import type { FileRecord } from '@/types/file-record';

import { readFileHandoverProtocolOf } from './file-handover-origin';

/** Ό,τι χρειάζεται η κρίση από ένα αποθηκευμένο αρχείο — **τίποτα** παραπάνω. */
export type HandoverCandidateFile = Pick<
  FileRecord,
  | 'entityType'
  | 'entryPointId'
  | 'purpose'
  | 'domain'
  | 'category'
  | 'classification'
  | 'status'
  | 'lifecycleState'
  | 'isDeleted'
  | 'supersededByFileId'
  | 'cdeState'
  | 'handoverProtocolOf'
>;

/**
 * Η απόφαση **ανά κατηγορία** — το δίχτυ.
 *
 * - `documents` ⇒ `review`: γενικό είδος, χωρίς δήλωση καταλόγου δεν ξέρουμε τι είναι.
 * - `contracts` ⇒ `review`: κρατούν στοιχεία **συμβαλλομένων** — συχνά προηγούμενου, ακυρωμένου αγοραστή (ΓΚΠΔ άρθ. 25).
 * - `audio` ⇒ `internal`: φωνητικές σημειώσεις του γραφείου.
 */
export const HANDOVER_DISPOSITION_BY_CATEGORY: Readonly<Record<FileCategory, HandoverDisposition>> = {
  photos: 'deliver',
  floorplans: 'deliver',
  documents: 'review',
  invoices: 'internal',
  contracts: 'review',
  audio: 'internal',
  videos: 'deliver',
  drawings: 'deliver',
  permits: 'deliver',
  models: 'deliver',
  panoramas: 'deliver',
};

/** Οι τομείς που ανήκουν στη **λειτουργία** του γραφείου — κανένα αρχείο τους δεν φεύγει. */
const OFFICE_ONLY_DOMAINS: ReadonlySet<FileDomain> = new Set<FileDomain>([
  FILE_DOMAINS.ACCOUNTING,
  FILE_DOMAINS.FINANCIAL,
  FILE_DOMAINS.BROKERAGE,
  FILE_DOMAINS.INGESTION,
]);

/**
 * **Είναι υποψήφιο;** Μόνο ενεργή, ολοκληρωμένη, **τρέχουσα** έκδοση — ποτέ κάδος, αποτυχημένο ανέβασμα,
 * αντικατεστημένη έκδοση ή πρόχειρο (ISO 19650 `WIP`: ακόμη δεν είναι πληροφορία για κανέναν εκτός ομάδας).
 */
export function isHandoverEligible(file: HandoverCandidateFile): boolean {
  if (file.status !== FILE_STATUS.READY) return false;
  if (file.isDeleted === true) return false;
  if (file.lifecycleState !== undefined && file.lifecycleState !== FILE_LIFECYCLE_STATES.ACTIVE) return false;
  if (file.supersededByFileId) return false;
  return file.cdeState !== 'SUPERSEDED' && file.cdeState !== 'WIP';
}

/** **Η κρίση** για ένα επιλέξιμο αρχείο (η επιλεξιμότητα κρίνεται χωριστά — {@link isHandoverEligible}). */
export function handoverDispositionOf(file: HandoverCandidateFile): HandoverDisposition {
  // ADR-916 Φ-Γ2 Σ4 — το Πρωτόκολλο ταξιδεύει από τον ΔΙΚΟ του δρόμο. Παραδοτέο θα έμπαινε στο καθολικό ⇒ νέο αποτύπωμα ⇒
  // νέο πρωτόκολλο ⇒ ∞. Πρώτος κανόνας: κανένα άλλο κριτήριο δεν μπορεί να το ξαναστείλει.
  if (file.handoverProtocolOf !== undefined) return 'internal';
  if (file.classification === FILE_CLASSIFICATIONS.CONFIDENTIAL) return 'review';
  if (OFFICE_ONLY_DOMAINS.has(file.domain)) return 'internal';
  const entry = findCatalogEntryForFile(file.entityType, file);
  const declared = entry ? declaredHandoverOf(entry) : undefined;
  return declared ?? HANDOVER_DISPOSITION_BY_CATEGORY[file.category];
}

// =============================================================================
// ΑΝΑΓΝΩΣΗ ΑΠΟ ΕΓΓΡΑΦΟ — πεδίο προς πεδίο, κανένας ισχυρισμός τύπου
// =============================================================================

const memberOf = <T extends string>(values: readonly T[]) => (value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

const isEntityType = memberOf<EntityType>(Object.values(ENTITY_TYPES));
const isDomain = memberOf<FileDomain>(Object.values(FILE_DOMAINS));
const isCategory = memberOf<FileCategory>(Object.values(FILE_CATEGORIES));
const isStatus = memberOf<FileStatus>(Object.values(FILE_STATUS));
const isLifecycleState = memberOf<FileLifecycleState>(Object.values(FILE_LIFECYCLE_STATES));
const isClassification = memberOf<FileClassification>(Object.values(FILE_CLASSIFICATIONS));
const isCdeState = memberOf<CdeState>(Object.keys(CDE_STATES) as CdeState[]);
const optionalText = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/**
 * **Ένα αποθηκευμένο έγγραφο αρχείου ως υποψήφιο.** `null` ⇒ λείπει ή είναι άγνωστο κάποιο από τα **κλειστά**
 * πεδία που κρίνουν (οντότητα · τομέας · κατηγορία · κατάσταση). Ο καλών το βάζει τότε στα `review`: ό,τι δεν
 * αναγνωρίζεται **ούτε** παραδίδεται **ούτε** χάνεται σιωπηλά.
 */
export function handoverCandidateFromDocument(raw: unknown): HandoverCandidateFile | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const stored = raw as Record<string, unknown>;
  const { entityType, domain, category, status } = stored;
  if (!isEntityType(entityType) || !isDomain(domain) || !isCategory(category) || !isStatus(status)) return null;
  // Προαιρετικό πεδίο που ΥΠΑΡΧΕΙ με άγνωστη τιμή ≠ απόν: ένα άγνωστο `lifecycleState` διαβασμένο ως «ενεργό»
  // θα έκανε επιλέξιμο ό,τι ίσως είναι κάδος. Συντηρητικά ⇒ `review`.
  // (`null` = απόν — έτσι γράφει το Firestore τα κενά πεδία.)
  const unknownOptional =
    (stored.lifecycleState != null && !isLifecycleState(stored.lifecycleState))
    || (stored.classification != null && !isClassification(stored.classification))
    || (stored.cdeState != null && !isCdeState(stored.cdeState))
    || (stored.handoverProtocolOf != null && readFileHandoverProtocolOf(stored.handoverProtocolOf) === null);
  if (unknownOptional) return null;
  const handoverProtocolOf = readFileHandoverProtocolOf(stored.handoverProtocolOf);
  return {
    entityType,
    domain,
    category,
    status,
    entryPointId: optionalText(stored.entryPointId),
    purpose: optionalText(stored.purpose),
    classification: isClassification(stored.classification) ? stored.classification : undefined,
    lifecycleState: isLifecycleState(stored.lifecycleState) ? stored.lifecycleState : undefined,
    isDeleted: stored.isDeleted === true,
    supersededByFileId: optionalText(stored.supersededByFileId),
    cdeState: isCdeState(stored.cdeState) ? stored.cdeState : undefined,
    handoverProtocolOf: handoverProtocolOf ?? undefined,
  };
}

/** Τα αρχεία ενός ακινήτου, μοιρασμένα κατά απόφαση — ό,τι **δεν** είναι επιλέξιμο δεν εμφανίζεται πουθενά. */
export interface HandoverSelection<T> {
  readonly deliver: readonly T[];
  readonly review: readonly T[];
  readonly internal: readonly T[];
}

export function selectHandoverFiles<T extends HandoverCandidateFile>(files: readonly T[]): HandoverSelection<T> {
  const buckets: Record<HandoverDisposition, T[]> = { deliver: [], review: [], internal: [] };
  for (const file of files) {
    if (isHandoverEligible(file)) buckets[handoverDispositionOf(file)].push(file);
  }
  return buckets;
}
