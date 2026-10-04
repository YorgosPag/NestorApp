/**
 * =============================================================================
 * Conveyance — συλλογή αρχείων-τεκμηρίων σε 6 επίπεδα (ADR-901 §5.5 · Σ-1)
 * =============================================================================
 *
 * «Ο εργολάβος δεν ξανανεβάζει τίποτα»: για μία υπόθεση διαβάζει τα **ήδη** ανεβασμένα
 * αρχεία του ακινήτου, των παρακολουθημάτων, του κτιρίου, του έργου και των επαφών
 * πωλητή/αγοραστών — και τα συνδεδεμένα (`linkedTo`), όπως τα δείχνει και το UI.
 *
 * Ερωτήματα: ΜΟΝΟ ισότητες (+ `in` / `array-contains-any`) ⇒ κανένας σύνθετος δείκτης
 * (CHECK 3.91) · πάντα `companyId` (CHECK 3.35). Το «ενεργό» (όχι κάδος / όχι
 * αντικατεστημένο) φιλτράρεται στη μνήμη με τον ΙΔΙΟ κριτή που χρησιμοποιεί το UI
 * (`FileRecordService.isVisibleInActiveLists`).
 *
 * @module services/conveyance/conveyance-evidence.server
 */

import 'server-only';

import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import type { EvidenceLevel } from '@/config/conveyance-checklist/types';
import { normalizeToISO } from '@/lib/date-local';
import { fileFingerprint } from '@/lib/conveyance/evidence-match';
import type { ConveyanceCaseParties, ConveyanceCaseSubject, EvidenceFile } from '@/types/conveyance-case';
import { decideEngagedEvidenceReach } from '@/lib/auth/container-access';
import { readContainerState } from '@/lib/files/file-record-read';
import { isContainerVisible, type CdeAudience } from '@/types/container-access';
import { fileLinkTag } from '@/lib/files/file-link-tag';

/** Όριο του Firestore για `in` / `array-contains-any`. */
const FIRESTORE_DISJUNCTION_LIMIT = 30;

/** Ένας στόχος αναζήτησης: σε ποιο επίπεδο, ποια οντότητα. */
export interface EvidenceTarget {
  readonly level: EvidenceLevel;
  readonly entityType: string;
  readonly entityId: string;
}

/** Τα (επίπεδο, οντότητα) που ψάχνουμε για μία υπόθεση. */
export function evidenceTargets(subject: ConveyanceCaseSubject, parties: ConveyanceCaseParties): readonly EvidenceTarget[] {
  const targets: EvidenceTarget[] = [{ level: 'property', entityType: ENTITY_TYPES.PROPERTY, entityId: subject.propertyId }];
  for (const a of subject.appurtenances) targets.push({ level: 'appurtenance', entityType: a.entityType, entityId: a.entityId });
  if (subject.buildingId) targets.push({ level: 'building', entityType: ENTITY_TYPES.BUILDING, entityId: subject.buildingId });
  if (subject.projectId) targets.push({ level: 'project', entityType: ENTITY_TYPES.PROJECT, entityId: subject.projectId });
  if (parties.seller.contactId) targets.push({ level: 'seller_contact', entityType: ENTITY_TYPES.CONTACT, entityId: parties.seller.contactId });
  for (const buyer of parties.buyers) targets.push({ level: 'buyer_contact', entityType: ENTITY_TYPES.CONTACT, entityId: buyer.contactId });
  return targets;
}

/**
 * ADR-905 §6 — **το ευρετήριο εξαρτήσεων** της υπόθεσης: οι ετικέτες (`fileLinkTag`) των στόχων της, ταξινομημένες
 * και μοναδικές. Ίδιο λεξιλόγιο με το `files.linkedTo` ⇒ ένα αρχείο απαντά «ποιες υποθέσεις με αφορούν;» με τις
 * ετικέτες που **ήδη** κουβαλά (κάτοχος + συνδέσεις), χωρίς δεύτερο λεξιλόγιο. Ιδιότητα ακινήτου/έργου: η ετικέτα
 * του ακινήτου/έργου είναι ήδη στόχος.
 */
export function caseDependencyKeys(subject: ConveyanceCaseSubject, parties: ConveyanceCaseParties): string[] {
  return [...new Set(evidenceTargets(subject, parties).map((t) => fileLinkTag(t.entityType, t.entityId)))].sort();
}

/** Οι ετικέτες ενός **αρχείου**: ο κάτοχός του + ό,τι είναι συνδεδεμένο (`linkedTo`). */
export function fileDependencyKeys(data: DocumentData | undefined): string[] {
  if (!data) return [];
  const keys = linkTagsOf(data);
  if (typeof data.entityType === 'string' && typeof data.entityId === 'string') keys.push(fileLinkTag(data.entityType, data.entityId));
  return [...new Set(keys)];
}

function isActive(data: DocumentData): boolean {
  if (data.isDeleted === true) return false;
  return (data.lifecycleState ?? 'active') === 'active';
}

/**
 * **Για ποιον** συλλέγονται τα τεκμήρια. `host` = ο οικοδεσπότης (όλα τα ενεργά, όπως στο UI του)·
 * ένα πρότυπο συμμετοχής = ο εξωτερικός, που βλέπει **μόνο** ό,τι φτάνει η εμβέλειά του (ADR-901 Φ2).
 */
export type EvidenceAudience = 'host' | CdeAudience;

/**
 * 🔑 ADR-901 Φ2 — το φίλτρο εμβέλειας. Η φάση διαβάζεται από τον **θεματοφύλακα** (`readContainerState`,
 * που ξαναπαράγει και συγκρίνει το `cdeReadReach`) και κρίνεται από τον **ΕΝΑ** κριτή CDE — ποτέ σύγκριση
 * literal `cdeReadReach === 'author'` εδώ (δεύτερος κριτής, ADR-749).
 */
function reaches(data: DocumentData, audience: EvidenceAudience): boolean {
  if (audience === 'host') return true;
  return isContainerVisible(decideEngagedEvidenceReach(audience, readContainerState(data).phase));
}

function toEvidence(fileId: string, data: DocumentData, target: EvidenceTarget, audience: EvidenceAudience): EvidenceFile | null {
  if (!isActive(data) || typeof data.purpose !== 'string' || !reaches(data, audience)) return null;
  const revision = typeof data.revision === 'number' ? data.revision : null;
  return {
    source: { kind: 'owned' },
    fileId,
    displayName: typeof data.displayName === 'string' ? data.displayName : fileId,
    entityType: target.entityType,
    entityId: target.entityId,
    purpose: data.purpose,
    level: target.level,
    fingerprint: fileFingerprint(fileId, revision, normalizeToISO(data.updatedAt)),
    createdAt: normalizeToISO(data.createdAt) ?? '',
  };
}

function linkTagsOf(data: DocumentData): string[] {
  const linkedTo: unknown = data.linkedTo;
  return Array.isArray(linkedTo) ? linkedTo.filter((tag): tag is string => typeof tag === 'string') : [];
}

/** Στόχοι που **κατέχουν** το αρχείο. Η ίδια επαφή μπορεί να είναι και πωλητής και αγοραστής ⇒ ένα τεκμήριο ανά επίπεδο. */
function ownerTargetsOf(data: DocumentData, targets: readonly EvidenceTarget[]): EvidenceTarget[] {
  return targets.filter((t) => t.entityType === data.entityType && t.entityId === data.entityId);
}

function tagIndexOf(targets: readonly EvidenceTarget[]): Map<string, EvidenceTarget[]> {
  const index = new Map<string, EvidenceTarget[]>();
  for (const t of targets) {
    const tag = fileLinkTag(t.entityType, t.entityId);
    index.set(tag, [...(index.get(tag) ?? []), t]);
  }
  return index;
}

/** Στόχοι στους οποίους το αρχείο είναι **συνδεδεμένο** (`linkedTo`) — τα δείχνει και το UI. */
function linkedTargetsOf(data: DocumentData, index: ReadonlyMap<string, readonly EvidenceTarget[]>): EvidenceTarget[] {
  return linkTagsOf(data).flatMap((tag) => index.get(tag) ?? []);
}

function evidenceKey(file: EvidenceFile): string {
  return `${file.fileId}|${file.level}|${file.entityId}`;
}

function uniqueEvidence(files: readonly EvidenceFile[]): EvidenceFile[] {
  const unique = new Map<string, EvidenceFile>();
  for (const file of files) unique.set(evidenceKey(file), file);
  return [...unique.values()];
}

function evidenceFrom(fileId: string, data: DocumentData, targets: readonly EvidenceTarget[], audience: EvidenceAudience): EvidenceFile[] {
  return targets.map((t) => toEvidence(fileId, data, t, audience)).filter((file): file is EvidenceFile => file !== null);
}

/**
 * ADR-905 §6 — τι συνεισφέρει **ΕΝΑ** αρχείο (σε μία κατάστασή του) στην όψη ενός θεατή: ο **ίδιος** μετασχηματισμός
 * με τον συλλέκτη (μισθωτής · `ready` · κάτοχος ∪ συνδέσεις · ενεργό · εμβέλεια). Ο αποδέκτης CDC συγκρίνει πριν/μετά:
 * διαφορά ⇔ η όψη αυτού του θεατή άλλαξε. Καμία δεύτερη λίστα «πεδίων που μετράνε».
 */
export function evidenceOfFile(
  companyId: string,
  fileId: string,
  data: DocumentData | undefined,
  targets: readonly EvidenceTarget[],
  audience: EvidenceAudience,
): EvidenceFile[] {
  if (!data || data.companyId !== companyId || data.status !== FILE_STATUS.READY) return [];
  const matched = [...ownerTargetsOf(data, targets), ...linkedTargetsOf(data, tagIndexOf(targets))];
  return uniqueEvidence(evidenceFrom(fileId, data, matched, audience)).sort((a, b) => evidenceKey(a).localeCompare(evidenceKey(b)));
}

function chunk<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += FIRESTORE_DISJUNCTION_LIMIT) chunks.push(items.slice(i, i + FIRESTORE_DISJUNCTION_LIMIT));
  return chunks;
}

/** Ιδιόκτητα αρχεία: ένα ερώτημα ανά τύπο οντότητας (`entityId in [...]`). */
async function ownedFiles(db: Firestore, companyId: string, targets: readonly EvidenceTarget[], audience: EvidenceAudience): Promise<EvidenceFile[]> {
  const byType = new Map<string, EvidenceTarget[]>();
  for (const t of targets) byType.set(t.entityType, [...(byType.get(t.entityType) ?? []), t]);
  const queries = [...byType.entries()].flatMap(([entityType, refs]) =>
    chunk([...new Set(refs.map((r) => r.entityId))]).map((ids) =>
      db.collection(COLLECTIONS.FILES)
        .where('companyId', '==', companyId)
        .where('entityType', '==', entityType)
        .where('entityId', 'in', ids)
        .where('status', '==', FILE_STATUS.READY)
        .get(),
    ),
  );
  const snaps = await Promise.all(queries);
  return snaps.flatMap((snap) => snap.docs.flatMap((doc) => evidenceFrom(doc.id, doc.data(), ownerTargetsOf(doc.data(), targets), audience)));
}

/** Συνδεδεμένα αρχεία (`linkedTo` = `fileLinkTag(...)`) — τα δείχνει και το UI. */
async function linkedFiles(db: Firestore, companyId: string, targets: readonly EvidenceTarget[], audience: EvidenceAudience): Promise<EvidenceFile[]> {
  const index = tagIndexOf(targets);
  const snaps = await Promise.all(chunk([...index.keys()]).map((tags) =>
    db.collection(COLLECTIONS.FILES)
      .where('companyId', '==', companyId)
      .where('linkedTo', 'array-contains-any', tags)
      .where('status', '==', FILE_STATUS.READY)
      .get(),
  ));
  return snaps.flatMap((snap) => snap.docs.flatMap((doc) => evidenceFrom(doc.id, doc.data(), linkedTargetsOf(doc.data(), index), audience)));
}

/**
 * Τα τεκμήρια για οποιουσδήποτε στόχους — χωρίς διπλά ανά (αρχείο, επίπεδο, οντότητα).
 * Ο ΕΝΑΣ συλλέκτης: τον καλεί η υπόθεση **και** το AI knowledge base (ADR-901 §2 Ε-Α).
 */
export async function collectEvidenceForTargets(
  db: Firestore,
  companyId: string,
  targets: readonly EvidenceTarget[],
  audience: EvidenceAudience = 'host',
): Promise<readonly EvidenceFile[]> {
  if (targets.length === 0) return [];
  const [owned, linked] = await Promise.all([
    ownedFiles(db, companyId, targets, audience),
    linkedFiles(db, companyId, targets, audience),
  ]);
  return uniqueEvidence([...owned, ...linked]);
}

/** Όλα τα τεκμήρια μιας υπόθεσης. */
export function collectConveyanceEvidence(
  db: Firestore,
  companyId: string,
  subject: ConveyanceCaseSubject,
  parties: ConveyanceCaseParties,
  audience: EvidenceAudience = 'host',
): Promise<readonly EvidenceFile[]> {
  return collectEvidenceForTargets(db, companyId, evidenceTargets(subject, parties), audience);
}
