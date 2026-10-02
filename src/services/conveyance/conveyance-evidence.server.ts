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

import type { DocumentData, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import type { EvidenceLevel } from '@/config/conveyance-checklist/types';
import { normalizeToISO } from '@/lib/date-local';
import { fileFingerprint } from '@/lib/conveyance/evidence-match';
import type { ConveyanceCaseParties, ConveyanceCaseSubject, EvidenceFile } from '@/types/conveyance-case';

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

function isActive(data: DocumentData): boolean {
  if (data.isDeleted === true) return false;
  return (data.lifecycleState ?? 'active') === 'active';
}

function toEvidence(doc: QueryDocumentSnapshot, target: EvidenceTarget): EvidenceFile | null {
  const data = doc.data();
  if (!isActive(data) || typeof data.purpose !== 'string') return null;
  const revision = typeof data.revision === 'number' ? data.revision : null;
  return {
    fileId: doc.id,
    displayName: typeof data.displayName === 'string' ? data.displayName : doc.id,
    entityType: target.entityType,
    entityId: target.entityId,
    purpose: data.purpose,
    level: target.level,
    fingerprint: fileFingerprint(doc.id, revision, normalizeToISO(data.updatedAt)),
    createdAt: normalizeToISO(data.createdAt) ?? '',
  };
}

function chunk<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += FIRESTORE_DISJUNCTION_LIMIT) chunks.push(items.slice(i, i + FIRESTORE_DISJUNCTION_LIMIT));
  return chunks;
}

/** Ιδιόκτητα αρχεία: ένα ερώτημα ανά τύπο οντότητας (`entityId in [...]`). */
async function ownedFiles(db: Firestore, companyId: string, targets: readonly EvidenceTarget[]): Promise<EvidenceFile[]> {
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
  return snaps.flatMap((snap) => snap.docs.flatMap((doc) => {
    const data = doc.data();
    // Η ίδια επαφή μπορεί να είναι και πωλητής και αγοραστής ⇒ ένα τεκμήριο ανά επίπεδο.
    return targets
      .filter((t) => t.entityType === data.entityType && t.entityId === data.entityId)
      .map((t) => toEvidence(doc, t))
      .filter((file): file is EvidenceFile => file !== null);
  }));
}

/** Συνδεδεμένα αρχεία (`linkedTo` = `'{entityType}:{entityId}'`) — τα δείχνει και το UI. */
async function linkedFiles(db: Firestore, companyId: string, targets: readonly EvidenceTarget[]): Promise<EvidenceFile[]> {
  const tagToTargets = new Map<string, EvidenceTarget[]>();
  for (const t of targets) {
    const tag = `${t.entityType}:${t.entityId}`;
    tagToTargets.set(tag, [...(tagToTargets.get(tag) ?? []), t]);
  }
  const snaps = await Promise.all(chunk([...tagToTargets.keys()]).map((tags) =>
    db.collection(COLLECTIONS.FILES)
      .where('companyId', '==', companyId)
      .where('linkedTo', 'array-contains-any', tags)
      .where('status', '==', FILE_STATUS.READY)
      .get(),
  ));
  return snaps.flatMap((snap) => snap.docs.flatMap((doc) => {
    const linkedTo: unknown = doc.data().linkedTo;
    const tags = Array.isArray(linkedTo) ? linkedTo.filter((tag): tag is string => typeof tag === 'string') : [];
    return tags.flatMap((tag) => tagToTargets.get(tag) ?? [])
      .map((t) => toEvidence(doc, t))
      .filter((file): file is EvidenceFile => file !== null);
  }));
}

/**
 * Τα τεκμήρια για οποιουσδήποτε στόχους — χωρίς διπλά ανά (αρχείο, επίπεδο, οντότητα).
 * Ο ΕΝΑΣ συλλέκτης: τον καλεί η υπόθεση **και** το AI knowledge base (ADR-901 §2 Ε-Α).
 */
export async function collectEvidenceForTargets(
  db: Firestore,
  companyId: string,
  targets: readonly EvidenceTarget[],
): Promise<readonly EvidenceFile[]> {
  if (targets.length === 0) return [];
  const [owned, linked] = await Promise.all([ownedFiles(db, companyId, targets), linkedFiles(db, companyId, targets)]);
  const unique = new Map<string, EvidenceFile>();
  for (const file of [...owned, ...linked]) unique.set(`${file.fileId}|${file.level}|${file.entityId}`, file);
  return [...unique.values()];
}

/** Όλα τα τεκμήρια μιας υπόθεσης. */
export function collectConveyanceEvidence(
  db: Firestore,
  companyId: string,
  subject: ConveyanceCaseSubject,
  parties: ConveyanceCaseParties,
): Promise<readonly EvidenceFile[]> {
  return collectEvidenceForTargets(db, companyId, evidenceTargets(subject, parties));
}
