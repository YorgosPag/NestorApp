/**
 * =============================================================================
 * Τα τεκμήρια ΜΙΑΣ υπόθεσης για ΕΝΑΝ θεατή — ο ΕΝΑΣ δρόμος (ADR-901 Φ4.4)
 * =============================================================================
 *
 * `αρχεία του μισθωτή-οικοδεσπότη (εμβέλεια θεατή) ∪ transmittals που φτάνουν στον θεατή`
 *
 * Τον ρωτούν **όλοι**: η όψη του οικοδεσπότη · οι εντολές ελέγχου του (αποδοχή/απόρριψη σταλμένου εγγράφου) · ο
 * κατάλογος του επαγγελματία · η πρόσκληση με email · οι λήξεις. Δεύτερος δρόμος = δεύτερη αλήθεια: μια γραμμή που
 * ο επαγγελματίας βλέπει `uploaded` και ο οικοδεσπότης `notary_side`.
 *
 * Τα transmittals μετατρέπονται από τον **καθαρό** πυρήνα (`lib/conveyance/contribution-evidence.ts`), όπου ζουν οι
 * κανόνες Α23/Α24· εδώ μόνο φέρνουμε τα δεδομένα: τις αποστολές, τους ενεργούς **τώρα** συντάκτες και την κατάσταση
 * των προσωπικών αρχείων (κάτοχος · bytes).
 *
 * Φ4.5 (Α28): για τις **δικές του** τρέχουσες αποστολές, ο θεατής-συντάκτης μαθαίνει αν η στοίβα του έχει νεότερη,
 * αποστελλόμενη κεφαλή (`newerVersion`) — με την **ίδια** κρίση που θα κάνει ο γραφέας (`contributedFileOf`).
 *
 * @module services/conveyance/conveyance-case-evidence.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { CaseViewerRole } from '@/lib/conveyance/contribution-audience';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import {
  contributionEvidence,
  currentContributions,
  sealedDeliveries,
  type ActiveContributor,
  type ContributedFileState,
} from '@/lib/conveyance/contribution-evidence';
import { readStackHead } from '@/services/iso19650/version-stack';
import type { ConveyanceCase, EvidenceFile, NewerVersion, SealedDelivery } from '@/types/conveyance-case';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';
import { contributedFileOf } from './conveyance-contributed-file';
import { readCaseContributions } from './conveyance-contribution-store.server';
import { activeCaseEngagements } from './conveyance-engagement-support';
import { collectConveyanceEvidence, type EvidenceAudience } from './conveyance-evidence.server';

/** **Ποιος** κοιτά: ο ρόλος (`visibleTo` · ακροατήριο), η εμβέλεια στα αρχεία του μισθωτή, και ποιος είναι (`own`). */
export interface CaseEvidenceViewer {
  readonly role: CaseViewerRole;
  readonly audience: EvidenceAudience;
  /** `null` = ο οικοδεσπότης ως χώρος (δεν είναι ποτέ συντάκτης transmittal). */
  readonly uid: string | null;
}

/** Ο οικοδεσπότης: όλες οι γραμμές, όλα τα ενεργά αρχεία του, και ό,τι του στάλθηκε. */
export const HOST_EVIDENCE_VIEWER: CaseEvidenceViewer = { role: 'host', audience: 'host', uid: null };

/** Η ανάγνωση των προσωπικών αρχείων των αποστολών — **μία** κατά id (καμία κατά οντότητα: Α24). */
interface ContributedFilesRead {
  readonly states: Map<string, ContributedFileState>;
  /** Αρχεία με διάδοχο (`supersededByFileId`) — μόνο αυτά αξίζουν περπάτημα ως την κεφαλή (Φ4.5). */
  readonly superseded: ReadonlySet<string>;
}

async function contributedFiles(db: Firestore, contributions: readonly ConveyanceContribution[]): Promise<ContributedFilesRead> {
  const fileIds = [...new Set(contributions.map((c) => c.file.fileId))];
  if (fileIds.length === 0) return { states: new Map(), superseded: new Set() };
  const snapshots = await db.getAll(...fileIds.map((id) => db.collection(COLLECTIONS.FILES_PERSONAL).doc(id)));
  const states = new Map<string, ContributedFileState>();
  const superseded = new Set<string>();
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    if (!data || typeof data.userId !== 'string') continue;
    const hasBytes = typeof data.storagePath === 'string' && data.storagePath !== '';
    states.set(snapshot.id, { fileId: snapshot.id, ownerUid: data.userId, hasBytes });
    if (typeof data.supersededByFileId === 'string' && data.supersededByFileId !== '') superseded.add(snapshot.id);
  }
  return { states, superseded };
}

/** Η κεφαλή της στοίβας, **αν** είναι νεότερη και αποστελλόμενη στην ίδια γραμμή — η ΙΔΙΑ κρίση με τον γραφέα. */
async function newerVersionOf(record: ConveyanceCase, uid: string, c: ConveyanceContribution): Promise<NewerVersion | null> {
  const purpose = findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, c.entryPointId)?.purpose;
  if (!purpose) return null;
  const head = await readStackHead({ userId: uid }, c.file.fileId);
  if (!head || head.id === c.file.fileId) return null;
  const sendable = contributedFileOf(head, head.id, { uid, caseId: record.id, purpose });
  return sendable ? { displayName: sendable.displayName } : null;
}

/**
 * Φ4.5 (Α28) — «υπάρχει νεότερη έκδοση;» **μόνο** για τις τρέχουσες αποστολές **του θεατή** που έχουν διάδοχο.
 * Για κάθε άλλον θεατή (οικοδεσπότης · άλλος ρόλος) **δεν** διαβάζεται τίποτα — δεν υπάρχει τι να διαρρεύσει.
 */
async function newerVersionsFor(
  record: ConveyanceCase,
  viewer: CaseEvidenceViewer,
  current: readonly ConveyanceContribution[],
  superseded: ReadonlySet<string>,
): Promise<ReadonlyMap<string, NewerVersion>> {
  const uid = viewer.uid;
  if (uid === null) return new Map();
  const mine = current.filter((c) => c.authorUid === uid && superseded.has(c.file.fileId));
  const found = await Promise.all(mine.map(async (c) => [c.id, await newerVersionOf(record, uid, c)] as const));
  return new Map(found.filter((entry): entry is readonly [string, NewerVersion] => entry[1] !== null));
}

/**
 * Ό,τι μαθαίνει ένας θεατής για τα έγγραφα της υπόθεσης: τα **τεκμήρια** που φτάνουν σε αυτόν, και (Π2) οι
 * **σφραγισμένες** παραδόσεις — ότι κάτι παραδόθηκε σε γραμμή που βλέπει, χωρίς το ίδιο.
 */
export interface CaseEvidence {
  readonly files: readonly EvidenceFile[];
  readonly sealed: readonly SealedDelivery[];
}

const NO_CONTRIBUTIONS = { files: [], sealed: [] } as const satisfies CaseEvidence;

/** Τα τεκμήρια από transmittals που φτάνουν στον θεατή. Ανάγνωση που απέτυχε ⇒ **κανένα** (fail-closed). */
async function collectContributionEvidence(db: Firestore, record: ConveyanceCase, viewer: CaseEvidenceViewer, nowMs: number): Promise<CaseEvidence> {
  const contributions = await readCaseContributions(db, record);
  if (!contributions || contributions.length === 0) return NO_CONTRIBUTIONS;
  const [engagements, files] = await Promise.all([activeCaseEngagements(db, record, nowMs), contributedFiles(db, contributions)]);
  const activeContributors: readonly ActiveContributor[] = engagements.map((e) => ({ uid: e.uid, role: e.role }));
  const current = currentContributions(contributions, activeContributors);
  const delivery = { contributions, activeContributors, files: files.states, viewer: viewer.role };
  return {
    files: contributionEvidence({
      ...delivery,
      viewerUid: viewer.uid,
      newerVersions: await newerVersionsFor(record, viewer, current, files.superseded),
    }),
    sealed: sealedDeliveries(delivery),
  };
}

/** Όλα τα τεκμήρια της υπόθεσης για αυτόν τον θεατή (+ οι σφραγισμένες παραδόσεις, Π2). */
export async function collectCaseEvidence(
  db: Firestore,
  record: ConveyanceCase,
  viewer: CaseEvidenceViewer,
  nowMs: number = Date.now(),
): Promise<CaseEvidence> {
  const [owned, contributed] = await Promise.all([
    collectConveyanceEvidence(db, record.companyId, record.subject, record.parties, viewer.audience),
    collectContributionEvidence(db, record, viewer, nowMs),
  ]);
  return { files: [...owned, ...contributed.files], sealed: contributed.sealed };
}
