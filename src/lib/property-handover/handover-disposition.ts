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
 *   0. Πρωτόκολλο ⇒ `internal` · **απόφαση του γραφείου** (Φ-Δ.4, αιτιολογημένη — Purview override)
 *   1. εμπιστευτικό (`classification: confidential`) ⇒ `review` — ποτέ αυτόματα προς τα έξω (DLP)
 *   2. τομέας του **γραφείου** (λογιστική · οικονομικά · μεσιτεία · εισερχόμενα) ⇒ `internal`
 *   3. δήλωση καταλόγου (θέση ή ομάδα μελετών) — για **κοινό** αρχείο (κτίριο · έργο, Φ-Γ3) **μόνο** η δήλωση
 *      `sharedHandover`, αλλιώς `internal` (`shared-undeclared`): δεδομένα τρίτων, φεύγουν μόνο ρητά
 *   4. κατηγορία (μόνο αρχεία της μονάδας)
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
import { declaredHandoverOf, declaredSharedHandoverOf, findCatalogEntryForFile } from '@/config/upload-entry-points/queries';
import type { HandoverDisposition } from '@/config/upload-entry-points/types';
import type { FileRecord } from '@/types/file-record';
import type { HandoverDispositionBasis } from '@/types/property-handover-file-decision';

import { readFileHandoverDecision } from './file-handover-decision';
import { readFileHandoverProtocolOf } from './file-handover-origin';
import { isSharedHandoverSource } from './handover-source-scope';

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
  | 'handoverDecision'
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

/** Η κρίση **και** ο κανόνας που απάντησε — ό,τι βλέπει ο άνθρωπος ως «γιατί» (Purview policy tip). */
export interface HandoverDispositionVerdict {
  readonly disposition: HandoverDisposition;
  readonly basis: Exclude<HandoverDispositionBasis, 'unrecognised'>;
}

/**
 * **Η ΜΙΑ κρίση, με την αιτιολόγησή της** (η επιλεξιμότητα κρίνεται χωριστά — {@link isHandoverEligible}).
 * Η {@link handoverDispositionOf} της **αναθέτει**: καμία δεύτερη αλυσίδα κανόνων.
 */
export function handoverDispositionBasisOf(file: HandoverCandidateFile): HandoverDispositionVerdict {
  // ADR-916 Φ-Γ2 Σ4 — το Πρωτόκολλο ταξιδεύει από τον ΔΙΚΟ του δρόμο. Παραδοτέο θα έμπαινε στο καθολικό ⇒ νέο αποτύπωμα ⇒
  // νέο πρωτόκολλο ⇒ ∞. Πρώτος κανόνας: κανένα άλλο κριτήριο — ούτε απόφαση γραφείου — δεν μπορεί να το ξαναστείλει.
  if (file.handoverProtocolOf !== undefined) return { disposition: 'internal', basis: 'protocol' };
  // Φ-Δ.4 — ο άνθρωπος αποφάσισε, με αιτιολογία: νικά κάθε κανόνα **κατάταξης** (και το DLP του εμπιστευτικού, όπως το
  // override του Purview). Η επιλεξιμότητα (κάδος · πρόχειρο · αντικατεστημένο) μένει **πριν** από εδώ.
  if (file.handoverDecision !== undefined) return { disposition: file.handoverDecision.disposition, basis: 'office-decision' };
  if (file.classification === FILE_CLASSIFICATIONS.CONFIDENTIAL) return { disposition: 'review', basis: 'confidential' };
  if (OFFICE_ONLY_DOMAINS.has(file.domain)) return { disposition: 'internal', basis: 'office-domain' };
  const entry = findCatalogEntryForFile(file.entityType, file);
  // Φ-Γ3 (Ο2) — κοινό αρχείο (κτίριο · έργο): ΜΟΝΟ η ρητή δήλωση για τα κοινά· ούτε το `handover` της μονάδας ούτε η
  // κατηγορία. Χωρίς δήλωση μένει στο γραφείο — ορατό στην καρτέλα με τον λόγο, ώστε το γραφείο να το αποφασίσει.
  if (isSharedHandoverSource(file.entityType)) {
    const shared = entry ? declaredSharedHandoverOf(entry) : undefined;
    return shared !== undefined ? { disposition: shared, basis: 'catalog' } : { disposition: 'internal', basis: 'shared-undeclared' };
  }
  const declared = entry ? declaredHandoverOf(entry) : undefined;
  if (declared !== undefined) return { disposition: declared, basis: 'catalog' };
  return { disposition: HANDOVER_DISPOSITION_BY_CATEGORY[file.category], basis: 'category' };
}

/** **Η κρίση** για ένα επιλέξιμο αρχείο. */
export function handoverDispositionOf(file: HandoverCandidateFile): HandoverDisposition {
  return handoverDispositionBasisOf(file).disposition;
}

/** Τι θα έκρινε ο κανόνας **χωρίς** την απόφαση του γραφείου — η σημασία του «Αυτόματα». */
export function automaticHandoverDispositionOf(file: HandoverCandidateFile): HandoverDisposition {
  return handoverDispositionOf({ ...file, handoverDecision: undefined });
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
    || (stored.handoverProtocolOf != null && readFileHandoverProtocolOf(stored.handoverProtocolOf) === null)
    || (stored.handoverDecision != null && readFileHandoverDecision(stored.handoverDecision) === null);
  if (unknownOptional) return null;
  const handoverProtocolOf = readFileHandoverProtocolOf(stored.handoverProtocolOf);
  const handoverDecision = readFileHandoverDecision(stored.handoverDecision);
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
    handoverDecision: handoverDecision ?? undefined,
  };
}

/**
 * **Παραδοτέο ΤΩΡΑ;** — το ξαναρωτά ο εκτελεστής **μέσα** στη συναλλαγή της αντιγραφής (Φ-Δ.4): μια απόφαση «μένει
 * εσωτερικό» που δεσμεύτηκε ανάμεσα στην ανάγνωση του συνόλου και την εγγραφή του καθολικού **νικά** την αντιγραφή.
 */
export function isHandoverDeliverableDocument(raw: unknown): boolean {
  const candidate = handoverCandidateFromDocument(raw);
  return candidate !== null && isHandoverEligible(candidate) && handoverDispositionOf(candidate) === 'deliver';
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
