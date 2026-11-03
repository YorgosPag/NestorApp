import 'server-only';

/**
 * Ο γραφέας του **πρόχειρου** συμφωνητικού (ADR-928 §5.4 · Φ2) — δημιουργία, αποθήκευση πρόχειρου, ανάθεση εργοταξίου.
 *
 * 🔑 Ο πελάτης στέλνει **ids**· τα μέρη και το έργο τα λύνει ο διακομιστής (`agreement-content.server.ts`).
 * 🔑 Ο αριθμός εγγράφου δίνεται **μέσα** στη συναλλαγή που γράφει το έγγραφο (Φ2 απόφαση 7).
 * 🔑 Το `decision` των αποκλίσεων **δεν** έρχεται ποτέ από τον πελάτη — ο κριτής (`judge-deviations`) κρατά την απόφαση
 *    όταν η τιμή δεν άλλαξε, αλλιώς τη γυρίζει σε `pending`.
 * Μεταβάσεις κύκλου ζωής: `agreement-lifecycle-writer.server.ts` · αποφάσεις αποκλίσεων: `agreement-deviation-writer.server.ts`.
 * @module server/subcontracts/agreement-writer.server
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { AuthContext } from '@/lib/auth';
import { todayLocalDate } from '@/lib/date-local';
import { generateSubcontractAgreementId, generateSubcontractAssignmentId } from '@/services/enterprise-id.service';
import { nextAgreementNumber } from '@/subapps/procurement/subcontracts/agreements/agreement-document-number';
import { validateAgreementDraft, type SubcontractAgreementDraftInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import { refuseAssignment, refuseContentEdit } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import type { InvoiceIssuer } from '@/subapps/accounting/types/invoice';
import { contentFieldsOf, projectIdsOf } from '@/subapps/procurement/subcontracts/agreements/agreement-content-fields';
import type {
  AgreementAssignmentInput,
  AgreementDocumentRole,
  SiteAssignment,
  SubcontractAgreement,
  SubcontractAgreementContent,
} from '@/subapps/procurement/subcontracts/types/agreement';
import { resolveAgreementContent, type AgreementContentRequest } from './agreement-content.server';
import { readIssuer, readProjectIdentity, type PartyRead } from './agreement-parties.server';
import {
  agreementDocRef,
  assertRevision,
  readAgreementCounter,
  readOwned,
  runSubcontractTransaction,
  stageAgreementCounter,
  stageCreate,
  stageUpdate,
  type SubcontractTx,
} from './subcontract-store.server';
import { assertGovernance, assertNoSubcontractIssues, SubcontractWriteError } from './subcontract-write-error';

/** Το αίτημα περιεχομένου από ένα πρόχειρο του πελάτη. */
function contentRequestOf(input: SubcontractAgreementDraftInput, current: SubcontractAgreement | null): AgreementContentRequest {
  return {
    scope: input.scope,
    existingAssignments: current?.scope.kind === 'multi_project' ? current.scope.assignments : [],
    subcontractorContactId: input.subcontractorContactId,
    projectOwners: input.projectOwners,
    issuerSignatory: input.issuerSignatory,
    terms: input.terms,
    clauses: input.clauses,
    previousClauses: current?.clauses ?? [],
  };
}

/** Επικύρωση πριν από τη συναλλαγή (καθαρή) + προφίλ φορέα (δικός του αναγνώστης). */
async function prepareDraft(ctx: AuthContext, input: SubcontractAgreementDraftInput): Promise<{ today: CalendarDay; issuer: PartyRead<InvoiceIssuer> }> {
  const today = todayLocalDate();
  assertNoSubcontractIssues(validateAgreementDraft(input, today));
  return { today, issuer: await readIssuer(ctx.companyId, ctx.uid) };
}

export interface NewAgreementRecordInput {
  readonly id: string;
  readonly role: AgreementDocumentRole;
  readonly documentNumber: string;
  readonly sourceOfferId: string | null;
}

/** Ο φάκελος νέου εγγράφου — ο **ένας** ορισμός, για δημιουργία και για τη γέννηση συμφωνητικού του Τρόπου Β. */
export function newAgreementRecord(
  scope: SubcontractTx,
  envelope: NewAgreementRecordInput,
  content: SubcontractAgreementContent,
): SubcontractAgreement {
  return {
    ...content,
    ...envelope,
    companyId: scope.ctx.companyId,
    agreementId: null,
    status: 'draft',
    mobilizedOn: null,
    issuedRevision: null,
    revision: 1,
    createdAt: scope.now,
    updatedAt: scope.now,
    issuedAt: null,
    acceptedAt: null,
    createdBy: scope.ctx.uid,
    updatedBy: scope.ctx.uid,
  };
}

/** Νέα προσφορά (ρόλος `offer`) σε κατάσταση `draft`, με αριθμό από τον μετρητή του χώρου. */
export async function createSubcontractAgreement(ctx: AuthContext, input: SubcontractAgreementDraftInput): Promise<SubcontractAgreement> {
  const { today, issuer } = await prepareDraft(ctx, input);
  return runSubcontractTransaction(ctx, async (scope) => {
    const counter = await readAgreementCounter(scope);
    const resolved = await resolveAgreementContent(scope, contentRequestOf(input, null), issuer);
    const numbered = nextAgreementNumber(counter, scope.ctx.companyId, 'offer', today);
    const id = generateSubcontractAgreementId();
    stageAgreementCounter(scope, numbered.counter);
    const record = newAgreementRecord(scope, { id, role: 'offer', documentNumber: numbered.documentNumber, sourceOfferId: null }, contentFieldsOf(input, resolved));
    return stageCreate(scope, 'agreement', agreementDocRef(scope.db, id), record);
  });
}

/** Αποθήκευση πρόχειρου: CAS, μόνο σε `draft`, ίδια λύση περιεχομένου με τη δημιουργία. */
export async function updateSubcontractAgreementDraft(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  input: SubcontractAgreementDraftInput,
): Promise<SubcontractAgreement> {
  const { issuer } = await prepareDraft(ctx, input);
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = agreementDocRef(scope.db, id);
    const current = await readOwned(scope, 'agreement', ref);
    assertRevision(current, expectedRevision);
    assertGovernance(refuseContentEdit(current.status));
    const resolved = await resolveAgreementContent(scope, contentRequestOf(input, current), issuer);
    return stageUpdate(scope, 'agreement', ref, current, contentFieldsOf(input, resolved));
  });
}

/** Ανάθεση εργοταξίου σε συμφωνητικό πολλών έργων (Δ2) — **χωρίς** νέο έγγραφο, με στιγμιότυπο έργου και ιστορικό. */
export function addSubcontractAgreementAssignment(ctx: AuthContext, id: string, input: AgreementAssignmentInput): Promise<SubcontractAgreement> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = agreementDocRef(scope.db, id);
    const current = await readOwned(scope, 'agreement', ref);
    assertRevision(current, input.expectedRevision);
    assertGovernance(refuseAssignment(current));
    // Η μηχανή εγγυάται `multi_project`· ο έλεγχος εδώ στενεύει τον τύπο (και πιάνει απόκλιση μηχανής ↔ γραφέα).
    if (current.scope.kind !== 'multi_project') throw new SubcontractWriteError('invalidTransition');
    const project = await readProjectIdentity(scope, input.projectId, input.buildingIds, 'assignment');
    if (!project.ok) throw new SubcontractWriteError('invalid', project.issues);
    const assignment: SiteAssignment = {
      id: generateSubcontractAssignmentId(),
      project: project.value,
      startDate: input.startDate,
      durationDays: input.durationDays,
      note: input.note,
      assignedBy: scope.ctx.uid,
      assignedAt: scope.now,
    };
    const nextScope = { kind: 'multi_project' as const, assignments: [...current.scope.assignments, assignment] };
    return stageUpdate(scope, 'agreement', ref, current, { scope: nextScope, projectIds: projectIdsOf(nextScope) });
  });
}
