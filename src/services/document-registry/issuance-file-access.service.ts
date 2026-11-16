import 'server-only';

/**
 * =============================================================================
 * Ο μηχανικός ανοίγει/κατεβάζει ό,τι του **δόθηκε** — ο ΠΡΟΣΑΡΜΟΓΕΑΣ έκδοσης της πόρτας αρχείων (ADR-942 Φ2)
 * =============================================================================
 *
 * **Κρίνε → ξαναπαράγαγε → διάβασε από τον κάτοχο → (κοινός πυρήνας) υπόγραψε → κατέγραψε**, όπως η μεταβίβαση:
 * 1. η συμμετοχή: δική του, ενεργή **τώρα** (ο ΕΝΑΣ κριτής `judgeIssuanceEngagement`)
 * 2. το παράθυρο της ανάθεσης (Ε4): όσο είναι αναληφθείσα · ή ως την έκδοση + 30 ημέρες· «δεν ξέρω» ⇒ `unknown`
 * 3. το δόσιμο: **ζωντανό**, αυτής της ανάθεσης, γι' αυτό το αρχείο — αλλιώς `not-found`, ίδιο με ανύπαρκτο (Α19)
 * 4. το αρχείο: ζωντανό, στο **σημερινό** δοχείο του κατόχου (ακίνητο που πέρασε στον ιδιοκτήτη ⇒ `not-found`)
 * 5. ίχνος `document_accessed` στο **ακίνητο** (ADR-195), με τρόπο και ρόλο — **κάθε** προβολή και λήψη
 *
 * 🔑 Λήψη επιτρέπεται: ο επιθεωρητής **οφείλει** να τηρεί τα στοιχεία της επιθεώρησης (ΤΟΤΕΕ 20701-4, ADR-942 §9.4).
 *
 * @module services/document-registry/issuance-file-access.service
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isEngaged } from '@/lib/auth/engagement-judge';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { isLiveProvision } from '@/lib/document-requests/document-provision-schema';
import { issuanceFileAccessWindow } from '@/lib/document-requests/issuance-file-access-window';
import { ISSUANCE_AUDIT_FIELDS } from '@/lib/document-validity/issuance-audit-fields';
import { readSubjectProvisions } from '@/server/document-requests/document-provision-store.server';
import {
  openableFileOf,
  signAndRecordOpening,
  type EngagedFileOpening,
  type EngagedFileRequest,
  type OpenableFile,
} from '@/server/engagement-files/engaged-file-opening.server';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { IssuanceEngagement } from '@/types/engagement';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { issuancePropertyNameOf, judgeIssuanceEngagement, readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';
import { issuanceLatestIssuedOn } from './issuance-latest-issued.server';
import { issuanceRequestContainerOf, readContainerFileRecord, type IssuanceRequestContainer } from './issuance-request-files.server';

type Refusal = Extract<EngagedFileOpening, { ok: false }>;

/** Το αρχείο — μόνο αν ζει **τώρα** στο δοχείο του κατόχου (ποτέ η διαδρομή από το σύρμα). */
async function readContainerFile(db: Firestore, container: IssuanceRequestContainer, fileId: string): Promise<OpenableFile | null> {
  const data = await readContainerFileRecord(db, container, fileId);
  return data === null ? null : openableFileOf(data, fileId);
}

/** Ε4 — ανοιχτό παράθυρο; `null` ⇒ ναι · αλλιώς η απόρριψη. */
async function windowRefusal(db: Firestore, assignment: DocumentIssuanceAssignment, nowMs: number): Promise<Refusal | null> {
  const now = new Date(nowMs);
  const latestIssuedOn = await issuanceLatestIssuedOn(db, assignment, now);
  if (latestIssuedOn === 'unknown') return { ok: false, rejection: 'unknown' };
  return issuanceFileAccessWindow(assignment, latestIssuedOn, conveyanceToday(now)).open ? null : { ok: false, rejection: 'not-found' };
}

/** Δόθηκε (και δεν ανακλήθηκε) **αυτό** το αρχείο σε **αυτή** την ανάθεση; `null` ⇒ ναι. */
async function provisionRefusal(db: Firestore, assignment: DocumentIssuanceAssignment, fileId: string): Promise<Refusal | null> {
  const provisions = await readSubjectProvisions(db, { companyId: assignment.companyId, subject: { kind: 'document_issuance', id: assignment.id } });
  if (provisions === null) return { ok: false, rejection: 'unknown' };
  return provisions.some((p) => p.fileId === fileId && isLiveProvision(p)) ? null : { ok: false, rejection: 'not-found' };
}

/**
 * Ένα άνοιγμα, ένα γεγονός, στο βιβλίο του **ακινήτου**: «— → προβολή | λήψη» με το όνομα του αρχείου (λέξεις, ADR-195).
 * Είδος χωρίς πεδία ιστορικού ⇒ σφάλμα ⇒ `failed`: **κανένα** άνοιγμα χωρίς ίχνος.
 */
async function recordIssuanceDocumentAccess(db: Firestore, assignment: DocumentIssuanceAssignment, request: EngagedFileRequest, file: OpenableFile): Promise<void> {
  const fields = ISSUANCE_AUDIT_FIELDS[assignment.documentKind];
  if (fields === null) throw new Error(`issuance audit fields missing for ${assignment.documentKind}`);
  await EntityAuditService.recordChange({
    entityType: assignment.scope === 'property' ? 'property' : 'owner_property',
    entityId: assignment.propertyId,
    entityName: await issuancePropertyNameOf(db, assignment.companyId, assignment.propertyId),
    action: 'document_accessed',
    changes: [{ field: fields.documentAccess, oldValue: null, newValue: request.mode, label: file.fileName }],
    performedBy: request.uid,
    performedByName: request.email,
    companyId: assignment.companyId,
  });
}

/** Ο μηχανικός ανοίγει/κατεβάζει ένα αρχείο που του δόθηκε. */
export async function openIssuanceFile(db: Firestore, engagement: IssuanceEngagement, request: EngagedFileRequest): Promise<EngagedFileOpening> {
  const decision = judgeIssuanceEngagement(engagement, request.uid, request.nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const assignment = await readHostedIssuanceAssignment(db, engagement.hostCompanyId, engagement.subject.assignmentId);
  if (!assignment) return { ok: false, rejection: 'not-found' };
  const refused = (await windowRefusal(db, assignment, request.nowMs)) ?? (await provisionRefusal(db, assignment, request.fileId));
  if (refused) return refused;
  const container = await issuanceRequestContainerOf(db, assignment);
  const file = container === null ? null : await readContainerFile(db, container, request.fileId);
  return signAndRecordOpening({
    file,
    mode: request.mode,
    record: (opened) => recordIssuanceDocumentAccess(db, assignment, request, opened),
    logData: { assignmentId: assignment.id, fileId: request.fileId },
  });
}
