/**
 * =============================================================================
 * Ο ΕΝΑΣ γραφέας του transmittal (ADR-901 §5.8.1 · Φ4.4 · άγκυρες Α23-Α26)
 * =============================================================================
 *
 * **Αποστολή** — *«στέλνω ΑΥΤΗ την έκδοση του δικού μου αρχείου, για ΑΥΤΗ τη γραμμή»*:
 * 1. **Κρίνε** τη δική μου συμμετοχή ανά αίτημα (`resolveEngagedCase`) — ανάκληση = άμεση
 * 2. **Κρίνε** ρόλο × κατάσταση υπόθεσης × γραμμή (`judgeContribution` — το πάγωμα ζει εκεί)
 * 3. **Το αρχείο** από το `files_personal`, κρινόμενο **στον server**: δικό μου · έτοιμο · αυτής της υπόθεσης ·
 *    του entry point της γραμμής. Οτιδήποτε άλλο ⇒ `not-found`, ίδιο με το ανύπαρκτο (κανένα μαντείο ύπαρξης)
 * 4. **Συναλλαγή**: ίδια έκδοση ήδη ζωντανή ⇒ `already-issued` (ιδεμπότητα)· αλλιώς **νέο** αμετάβλητο έγγραφο
 *    με `supersedes` την προηγούμενη
 * 5. **Παράδοση** (`conveyance-contribution-delivery.ts`): δέσμευση της έκδοσης · ίχνος · ειδοποίηση ακροατηρίου
 *
 * **Επανέκδοση** (Φ4.5) — *«στείλε τη νέα έκδοση στους ίδιους»*: ο client δίνει μόνο την αποστολή· ο server βρίσκει
 * την κεφαλή της στοίβας και περνά από τον **ίδιο** δρόμο, με compare-and-set στην προηγούμενη (Α27).
 *
 * **Απόσυρση** — μόνο ο συντάκτης, ενεργός, εντός πολιτικής κατάστασης· ήδη αποσυρμένη ⇒ καμία εγγραφή.
 *
 * ⛔ Το ακροατήριο **δεν** έρχεται ποτέ από το αίτημα: το ορίζει ο ρόλος (Α23).
 *
 * @module services/conveyance/conveyance-contribution.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { getChecklistItem, itemsForProfile } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { judgeContribution, roleContributesIn, type ContributionRefusal } from '@/lib/conveyance/contribution-policy';
import { parseContribution } from '@/lib/conveyance/contribution-schema';
import { generateConveyanceContributionId } from '@/services/enterprise-id.service';
import { readStackHead } from '@/services/iso19650/version-stack';
import type { ContributionFile, ConveyanceContribution } from '@/types/conveyance-contribution';
import type { EngagementVerdict } from '@/types/engagement';
import { contributedFileOf } from './conveyance-contributed-file';
import { authorItemContributionsQuery, contributionsCollection, contributionsOf, latestLive, readCaseContributions } from './conveyance-contribution-store.server';
import { deliverIssued, deliverWithdrawn } from './conveyance-contribution-delivery';
import { resolveEngagedCase, type EngagedCaseAccess } from './conveyance-engagement-access.service';
import { engagementViewOf, readCaseViewers, signalCaseChangeInTx, signalViewsInTx } from './conveyance-view-signal.server';
import type { CaseViewers } from '@/lib/conveyance/view-signal-audience';

interface ContributionActor {
  readonly uid: string;
  readonly engagementId: string;
  readonly nowMs: number;
}

interface IssueContributionRequest extends ContributionActor {
  readonly checklistItemId: string;
  readonly entryPointId: string;
  readonly fileId: string;
}

interface WithdrawContributionRequest extends ContributionActor {
  readonly contributionId: string;
}

interface ReissueContributionRequest extends ContributionActor {
  readonly contributionId: string;
}

/**
 * Φ4.5 — οι αρνήσεις της **επανέκδοσης**, πέρα από του κριτή:
 * - `superseded`       — η αποστολή δεν είναι πια η τελευταία ζωντανή του συντάκτη για τη γραμμή
 * - `no-newer-version` — η κεφαλή της στοίβας είναι η ίδια η σταλμένη, ή δεν είναι (ακόμη) αποστελλόμενη
 */
export type ReissueRefusal = 'superseded' | 'no-newer-version';

type Rejection =
  | { readonly ok: false; readonly rejection: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly ok: false; readonly rejection: 'refused'; readonly refusal: ContributionRefusal | ReissueRefusal }
  | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' | 'failed' };

export type IssueContributionOutcome =
  | { readonly ok: true; readonly kind: 'issued' | 'already-issued'; readonly contribution: ConveyanceContribution }
  | Rejection;

export type WithdrawContributionOutcome =
  | { readonly ok: true; readonly kind: 'withdrawn' | 'already-withdrawn'; readonly contribution: ConveyanceContribution }
  | Rejection;

/** Η γραμμή — **μόνο** αν ανήκει στο προφίλ της υπόθεσης (ποτέ γραμμή άλλου καταλόγου από το σύρμα). */
function itemOfCase(access: EngagedCaseAccess, itemId: string): ChecklistItem | null {
  const item = getChecklistItem(itemId);
  return item && itemsForProfile(access.record.profile).includes(item) ? item : null;
}

function caseStateOf(access: EngagedCaseAccess) {
  return effectiveCaseState(access.record.storedState, access.context.legalPhase);
}

async function readContributedFile(db: Firestore, access: EngagedCaseAccess, request: IssueContributionRequest): Promise<ContributionFile | null> {
  const purpose = findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, request.entryPointId)?.purpose;
  if (!purpose) return null;
  const snapshot = await db.collection(COLLECTIONS.FILES_PERSONAL).doc(request.fileId).get();
  return contributedFileOf(snapshot.data(), request.fileId, { uid: request.uid, caseId: access.record.id, purpose });
}

function newContribution(access: EngagedCaseAccess, request: IssueContributionRequest, file: ContributionFile, supersedes: string | null): ConveyanceContribution {
  return {
    id: generateConveyanceContributionId(),
    companyId: access.record.companyId,
    caseId: access.record.id,
    projectId: access.record.subject.projectId,
    authorUid: request.uid,
    authorRole: access.engagement.role,
    authorEngagementId: access.engagement.id,
    checklistItemId: request.checklistItemId,
    entryPointId: request.entryPointId,
    file,
    supersedes,
    issuedAt: new Date(request.nowMs).toISOString(),
    withdrawnAt: null,
    withdrawnBy: null,
  };
}

/** Ό,τι χρειάζεται το σήμα της όψης (§14.8): η γραμμή (ακροατήριο) και οι όψεις της υπόθεσης τώρα. */
interface TransmittalSignal {
  readonly item: ChecklistItem;
  readonly viewers: CaseViewers;
}

/**
 * Η συναλλαγή της αποστολής: ίδια έκδοση ζωντανή ⇒ ιδεμπότητα · αλλιώς νέο έγγραφο που διαδέχεται το προηγούμενο.
 * `expectedPrevious` (Φ4.5): compare-and-set — η επανέκδοση γράφει **μόνο** αν η αποστολή που διαδέχεται είναι ακόμη
 * η τελευταία ζωντανή. Κρίνεται **μέσα** στη συναλλαγή: δύο παράλληλα πατήματα δεν γεννούν δύο διαδόχους.
 */
async function writeIssue(db: Firestore, access: EngagedCaseAccess, request: IssueContributionRequest, file: ContributionFile, expectedPrevious: string | null, signal: TransmittalSignal) {
  return db.runTransaction(async (tx) => {
    const previous = latestLive(contributionsOf(await tx.get(authorItemContributionsQuery(db, access.record, request.uid, request.checklistItemId))));
    if (previous && previous.file.fileId === file.fileId) return { kind: 'already-issued' as const, contribution: previous };
    if (expectedPrevious !== null && previous?.id !== expectedPrevious) return null;
    const contribution = newContribution(access, request, file, previous?.id ?? null);
    tx.create(contributionsCollection(db).doc(contribution.id), contribution);
    signalCaseChangeInTx(tx, db, { kind: 'transmittal', authorRole: contribution.authorRole, item: signal.item }, signal.viewers);
    return { kind: 'issued' as const, contribution };
  });
}

/** Η αποστολή με **ήδη** κριμένη συμμετοχή — κοινή για την αποστολή και την επανέκδοση (ΕΝΑΣ γραφέας). */
async function issueWithAccess(
  db: Firestore,
  access: EngagedCaseAccess,
  request: IssueContributionRequest,
  expectedPrevious: string | null,
): Promise<IssueContributionOutcome> {
  const item = itemOfCase(access, request.checklistItemId);
  if (!item) return { ok: false, rejection: 'not-found' };
  const judgement = judgeContribution({ role: access.engagement.role, state: caseStateOf(access), item, entryPointId: request.entryPointId });
  if (!judgement.ok) return { ok: false, rejection: 'refused', refusal: judgement.refusal };
  const file = await readContributedFile(db, access, request);
  if (!file) return expectedPrevious === null ? { ok: false, rejection: 'not-found' } : { ok: false, rejection: 'refused', refusal: 'no-newer-version' };
  const viewers = await readCaseViewers(db, access.record, request.nowMs);
  const written = await writeIssue(db, access, request, file, expectedPrevious, { item, viewers });
  if (!written) return { ok: false, rejection: 'refused', refusal: 'superseded' };
  // Και στην ιδεμπότητα: η παράδοση συγκλίνει (μισή αποτυχία προηγούμενου αιτήματος διορθώνεται εδώ).
  await deliverIssued(db, { access, item, contribution: written.contribution, fresh: written.kind === 'issued', nowMs: request.nowMs });
  return { ok: true, ...written };
}

/** Ο επαγγελματίας στέλνει μια έκδοση δικού του αρχείου σε μια γραμμή της υπόθεσης. */
export async function issueContribution(db: Firestore, request: IssueContributionRequest): Promise<IssueContributionOutcome> {
  const resolution = await resolveEngagedCase(db, request.uid, request.engagementId, request.nowMs);
  if (!resolution.ok) return resolution;
  return issueWithAccess(db, resolution.access, request, null);
}

/** Μία αποστολή **του θεατή**, αυτής της υπόθεσης, ζωντανή — αλλιώς `null` (ξένη ≡ ανύπαρκτη). */
async function readOwnLiveContribution(db: Firestore, access: EngagedCaseAccess, request: ReissueContributionRequest): Promise<ConveyanceContribution | null> {
  const current = parseContribution((await contributionsCollection(db).doc(request.contributionId).get()).data());
  if (!current || current.caseId !== access.record.id || current.authorUid !== request.uid || current.withdrawnAt !== null) return null;
  return current;
}

/**
 * Φ4.5 — **«Στείλε τη νέα έκδοση στους ίδιους»** (Aconex «auto update transmittal»), με ένα πάτημα.
 *
 * Ο client λέει **μόνο** ποια αποστολή· **ο server** αποφασίζει ποια έκδοση: την **κεφαλή** της στοίβας του συντάκτη
 * (`readStackHead`). Μετά, ο ΙΔΙΟΣ δρόμος με την αποστολή — κριτής (Α25), ακροατήριο από τον ρόλο (Α23), `supersedes`,
 * δέσμευση (Α26), ίχνος, ειδοποίηση. Μηδέν δεύτερος γραφέας.
 */
export async function reissueContribution(db: Firestore, request: ReissueContributionRequest): Promise<IssueContributionOutcome> {
  const resolution = await resolveEngagedCase(db, request.uid, request.engagementId, request.nowMs);
  if (!resolution.ok) return resolution;
  const { access } = resolution;
  const current = await readOwnLiveContribution(db, access, request);
  if (!current) return { ok: false, rejection: 'not-found' };
  const head = await readStackHead({ userId: request.uid }, current.file.fileId);
  if (!head || head.id === current.file.fileId) return { ok: false, rejection: 'refused', refusal: 'no-newer-version' };
  const successor = { ...request, checklistItemId: current.checklistItemId, entryPointId: current.entryPointId, fileId: head.id };
  return issueWithAccess(db, access, successor, current.id);
}

/** Η συναλλαγή της απόσυρσης — μόνο του συντάκτη, μόνο αυτής της υπόθεσης. */
async function writeWithdraw(db: Firestore, access: EngagedCaseAccess, request: WithdrawContributionRequest, viewers: CaseViewers) {
  const ref = contributionsCollection(db).doc(request.contributionId);
  return db.runTransaction(async (tx) => {
    const current = parseContribution((await tx.get(ref)).data());
    if (!current || current.caseId !== access.record.id || current.authorUid !== request.uid) return null;
    if (current.withdrawnAt !== null) return { kind: 'already-withdrawn' as const, contribution: current };
    const withdrawn = { ...current, withdrawnAt: new Date(request.nowMs).toISOString(), withdrawnBy: request.uid };
    tx.update(ref, { withdrawnAt: withdrawn.withdrawnAt, withdrawnBy: withdrawn.withdrawnBy });
    const item = getChecklistItem(current.checklistItemId);
    // Γραμμή που δεν υπάρχει πια στον κατάλογο ⇒ μόνο ο συντάκτης (fail-closed, όπως το `audienceOfTransmittal`).
    if (item) signalCaseChangeInTx(tx, db, { kind: 'transmittal', authorRole: current.authorRole, item }, viewers);
    else signalViewsInTx(tx, db, [engagementViewOf(access.engagement)]);
    return { kind: 'withdrawn' as const, contribution: withdrawn };
  });
}

/** Ο συντάκτης αποσύρει μια αποστολή του — ρητή πράξη με ίχνος (ο κάδος του **δεν** είναι απόσυρση). */
export async function withdrawContribution(db: Firestore, request: WithdrawContributionRequest): Promise<WithdrawContributionOutcome> {
  const resolution = await resolveEngagedCase(db, request.uid, request.engagementId, request.nowMs);
  if (!resolution.ok) return resolution;
  const { access } = resolution;
  if (!roleContributesIn(access.engagement.role, caseStateOf(access))) return { ok: false, rejection: 'refused', refusal: 'case-frozen' };
  const written = await writeWithdraw(db, access, request, await readCaseViewers(db, access.record, request.nowMs));
  if (!written) return { ok: false, rejection: 'not-found' };
  if (written.kind === 'withdrawn') {
    const remaining = await readCaseContributions(db, access.record);
    await deliverWithdrawn({ access, contribution: written.contribution, remaining: remaining ?? null });
  }
  return { ok: true, ...written };
}
