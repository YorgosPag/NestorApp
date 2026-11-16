/**
 * =============================================================================
 * Άνοιγμα τεκμηρίου της υπόθεσης — επαγγελματίας ΚΑΙ οικοδεσπότης (ADR-901 Φ4 §5.4 · §5.9 · Φ4.4 · Α19-Α20)
 * =============================================================================
 *
 * **Κρίνε → ξαναπαράγαγε → διάβασε από τη σωστή κατοχή → υπόγραψε → κατέγραψε** (πρότυπο `openMandateEvidence`):
 * 1. η πρόσβαση, κρινόμενη **ανά αίτημα**: η δική μου συμμετοχή (`resolveEngagedCase`) — ή, για τον οικοδεσπότη,
 *    μισθωτής + δικαίωμα στη διαδρομή
 * 2. ο κατάλογος **του θεατή** ξαναπαράγεται στον server. Δεκτό είναι **μόνο** αρχείο που είναι τεκμήριο **ορατής**
 *    γραμμής. Οτιδήποτε άλλο είναι `not-found`, ίδιο με το ανύπαρκτο (Α19) — και για τον οικοδεσπότη: η έκθεση του
 *    δικηγόρου του αγοραστή **δεν** είναι στον κατάλογό του, άρα δεν ανοίγει (Α23)
 * 3. η διαδρομή έρχεται **από το έγγραφο**, ποτέ από το σύρμα: αρχείο του μισθωτή (`files`) **ή** σταλμένη έκδοση
 *    επαγγελματία (`files_personal`, μέσω του transmittal — κάτοχος = ο συντάκτης, όχι ο ζητών). Σύνδεσμος 15′
 * 4. **ένα** `document_accessed` στο βιβλίο **της υπόθεσης** (Α20) — με τον ρόλο του θεατή (και `host`)
 *
 * @module services/conveyance/conveyance-case-file-access.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { CASE_ACCESS_FIELD, CASE_DOCUMENT_FIELD, encodeCaseAccess, type CaseFileMode } from '@/lib/conveyance/case-activity';
import { parseContribution } from '@/lib/conveyance/contribution-schema';
import {
  openableFileOf,
  signAndRecordOpening,
  type EngagedFileOpening,
  type OpenableFile,
} from '@/server/engagement-files/engaged-file-opening.server';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { CaseActorRole, ConveyanceCase, DerivedChecklist, EvidenceFile } from '@/types/conveyance-case';
import { contributionsCollection } from './conveyance-contribution-store.server';
import { checklistForRole, engagedChecklistOf, HOST_CHECKLIST_VIEWER, resolveEngagedCase } from './conveyance-engagement-access.service';
import { loadConveyanceSubject } from './conveyance-subject.server';

/** Το λεξιλόγιο του ανοίγματος ζει στον κοινό πυρήνα (ADR-942 Φ2)· εδώ μόνο το όνομα που ξέρει η μεταβίβαση. */
export type CaseFileOpening = EngagedFileOpening;

interface FileOpenRequest {
  readonly uid: string;
  readonly email: string | null;
  readonly fileId: string;
  readonly mode: CaseFileMode;
}

export interface CaseFileRequest extends FileOpenRequest {
  readonly engagementId: string;
  readonly nowMs: number;
}

export interface HostCaseFileRequest extends FileOpenRequest {
  readonly record: ConveyanceCase;
}

/** Ο θεατής, όπως τον ξέρει ο πυρήνας: ποιος, με ποιον ρόλο, σε ποια υπόθεση, με ποιον κατάλογο. */
interface OpeningContext {
  readonly record: ConveyanceCase;
  readonly propertyName: string | null;
  readonly role: CaseActorRole;
  readonly checklist: DerivedChecklist;
}

/** Το τεκμήριο — **μόνο** αν είναι τεκμήριο γραμμής που **αυτός ο θεατής** βλέπει τώρα. */
function visibleEvidence(checklist: DerivedChecklist, fileId: string): EvidenceFile | null {
  for (const row of checklist.rows) {
    const file = row.files.find((f) => f.fileId === fileId);
    if (file) return file;
  }
  return null;
}

/** Αρχείο του μισθωτή-οικοδεσπότη — μόνο του μισθωτή της υπόθεσης. */
async function readOwnedFile(db: Firestore, companyId: string, fileId: string): Promise<OpenableFile | null> {
  const data = (await db.collection(COLLECTIONS.FILES).doc(fileId).get()).data();
  return data && data.companyId === companyId ? openableFileOf(data, fileId) : null;
}

/**
 * Σταλμένη έκδοση — μέσω **του transmittal**: της ίδιας υπόθεσης, μη αποσυρμένου, και το αρχείο **του συντάκτη**.
 * Ο κάδος του συντάκτη **δεν** κόβει (σιωπηλή δέσμευση: ό,τι στάλθηκε μένει ανοίξιμο ως την απόσυρση).
 */
async function readTransmittedFile(db: Firestore, record: ConveyanceCase, contributionId: string, fileId: string): Promise<OpenableFile | null> {
  const contribution = parseContribution((await contributionsCollection(db).doc(contributionId).get()).data());
  if (!contribution || contribution.caseId !== record.id || contribution.withdrawnAt !== null || contribution.file.fileId !== fileId) return null;
  const data = (await db.collection(COLLECTIONS.FILES_PERSONAL).doc(fileId).get()).data();
  if (!data || data.userId !== contribution.authorUid) return null;
  // Ο κάδος του συντάκτη αγνοείται επίτηδες (`isDeleted: false`): κάδος ≠ απόσυρση.
  return openableFileOf({ ...data, isDeleted: false }, fileId);
}

function readStoredFile(db: Firestore, record: ConveyanceCase, evidence: EvidenceFile): Promise<OpenableFile | null> {
  return evidence.source.kind === 'transmittal'
    ? readTransmittedFile(db, record, evidence.source.contributionId, evidence.fileId)
    : readOwnedFile(db, record.companyId, evidence.fileId);
}

/** Α20 — ένα άνοιγμα, ένα γεγονός, στο βιβλίο της υπόθεσης. */
async function recordCaseDocumentAccess(opening: OpeningContext, request: FileOpenRequest, file: OpenableFile): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: opening.record.id,
    entityName: opening.propertyName,
    action: 'document_accessed',
    changes: [
      { field: CASE_DOCUMENT_FIELD, oldValue: null, newValue: request.fileId, label: file.fileName },
      { field: CASE_ACCESS_FIELD, oldValue: null, newValue: encodeCaseAccess(request.mode, opening.role) },
    ],
    performedBy: request.uid,
    performedByName: request.email,
    companyId: opening.record.companyId,
  });
}

/** Κρίνε στον κατάλογο του θεατή → διάβασε → (κοινός πυρήνας) υπόγραψε → κατέγραψε. */
async function openVisibleFile(db: Firestore, opening: OpeningContext, request: FileOpenRequest): Promise<CaseFileOpening> {
  const evidence = visibleEvidence(opening.checklist, request.fileId);
  const file = evidence ? await readStoredFile(db, opening.record, evidence) : null;
  return signAndRecordOpening({
    file,
    mode: request.mode,
    record: (opened) => recordCaseDocumentAccess(opening, request, opened),
    logData: { caseId: opening.record.id, fileId: request.fileId },
  });
}

/** Ο επαγγελματίας ανοίγει/κατεβάζει ένα τεκμήριο της υπόθεσης. */
export async function openCaseFile(db: Firestore, request: CaseFileRequest): Promise<CaseFileOpening> {
  const resolution = await resolveEngagedCase(db, request.uid, request.engagementId, request.nowMs);
  if (!resolution.ok) return resolution;
  const { access } = resolution;
  const checklist = await engagedChecklistOf(db, access);
  return openVisibleFile(db, { record: access.record, propertyName: access.context.propertyName, role: access.engagement.role, checklist }, request);
}

/**
 * Ο **οικοδεσπότης** ανοίγει/κατεβάζει ένα τεκμήριο — και ό,τι του **στάλθηκε** (Φ4.4), που **δεν** κατέχει.
 * Μισθωτής + δικαίωμα κρίνονται στη διαδρομή (`authorizeForProperty`)· εδώ ο κατάλογός του.
 */
export async function openHostCaseFile(db: Firestore, request: HostCaseFileRequest): Promise<CaseFileOpening> {
  const context = await loadConveyanceSubject(db, request.record.companyId, request.record.subject.propertyId);
  if (!context) return { ok: false, rejection: 'not-found' };
  const checklist = await checklistForRole(db, request.record, context, HOST_CHECKLIST_VIEWER);
  return openVisibleFile(db, { record: request.record, propertyName: context.propertyName, role: 'host', checklist }, request);
}
