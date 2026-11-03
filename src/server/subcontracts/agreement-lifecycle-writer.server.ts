import 'server-only';

/**
 * Ο γραφέας των **μεταβάσεων** του συμφωνητικού (ADR-928 §5.5 · §5.6 · Φ2 αποφάσεις 5, 8, 9, 13).
 *
 * Οι **κανόνες** ζουν στην καθαρή μηχανή (`agreement-lifecycle.ts`)· εδώ η ανάγνωση, ο CAS και η εγγραφή.
 * - `issue`: ξανακρίνει τις ρήτρες απέναντι στη βιβλιοθήκη (έκδοση που προχώρησε ⇒ 422 `clauseVersionOutdated`),
 *   **ανανεώνει** μέρη και έργο από τις πηγές τους, και παγώνει **αναθεώρηση** (στιγμιότυπο + κείμενα ρητρών + sha256)
 *   στην **ίδια** συναλλαγή. Id αναθεώρησης ντετερμινιστικό ⇒ δύο ταυτόχρονα «Έκδοση» συγκρούονται στο `create()`.
 * - `accept` σε προσφορά Τρόπου Β: **γεννά** το συμφωνητικό (ρόλος `agreement`, `draft`, δικός του αριθμός) στην ίδια
 *   συναλλαγή. Ιδεμποτικό δομικά: δεύτερο `accept` αποτυγχάνει στον πίνακα μεταβάσεων.
 * - `mobilize`: γράφει την ημερομηνία εγκατάστασης (το Υ.Γ. του 2009).
 * Όλες οι αναγνώσεις **πριν** από κάθε εγγραφή.
 * @module server/subcontracts/agreement-lifecycle-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { todayLocalDate } from '@/lib/date-local';
import { generateDeterministicSubcontractRevisionId, generateSubcontractAgreementId } from '@/services/enterprise-id.service';
import type { InvoiceIssuer } from '@/subapps/accounting/types/invoice';
import { nextAgreementNumber } from '@/subapps/procurement/subcontracts/agreements/agreement-document-number';
import {
  refuseTransition,
  spawnsAgreementOnAccept,
  statusAfter,
} from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import {
  agreementContentOf,
  agreementSnapshotHash,
  bilingualIssues,
  buildAgreementSnapshot,
  frozenClauseOf,
} from '@/subapps/procurement/subcontracts/agreements/agreement-snapshot';
import { selectionInputsOf } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type {
  AgreementTransitionInput,
  AgreementTransitionResult,
  SubcontractAgreement,
  SubcontractAgreementRevision,
  SubcontractAgreementTransition,
} from '@/subapps/procurement/subcontracts/types/agreement';
import { resolveAgreementContent, type AgreementContentRequest } from './agreement-content.server';
import { readIssuer, type PartyRead } from './agreement-parties.server';
import { newAgreementRecord } from './agreement-writer.server';
import {
  agreementDocRef,
  agreementRevisionDocRef,
  assertRevision,
  readAgreementCounter,
  readOwned,
  runSubcontractTransaction,
  stageAgreementCounter,
  stageCreate,
  stageUpdate,
  type SubcontractTx,
} from './subcontract-store.server';
import { assertGovernance, assertNoSubcontractIssues } from './subcontract-write-error';


/** Το περιεχόμενο του εγγράφου όπως είναι αποθηκευμένο, ως αίτημα επίλυσης — για την ανανέωση στο `issue`. */
function storedContentRequest(agreement: SubcontractAgreement): AgreementContentRequest {
  const owners = agreement.parties.projectOwners;
  return {
    scope: agreement.scope.kind === 'single_project'
      ? { kind: 'single_project', projectId: agreement.scope.project.projectId, buildingIds: agreement.scope.project.buildingIds }
      : { kind: 'multi_project' },
    existingAssignments: agreement.scope.kind === 'multi_project' ? agreement.scope.assignments : [],
    subcontractorContactId: agreement.parties.subcontractor.contactId,
    projectOwners: owners.kind === 'named' ? { kind: 'named', contactIds: owners.owners.map((owner) => owner.contactId) } : owners,
    issuerSignatory: agreement.parties.issuerSignatory,
    terms: agreement.terms,
    clauses: selectionInputsOf(agreement.clauses),
    previousClauses: agreement.clauses,
  };
}

/** `issue`: ανανέωση + πάγωμα. Επιστρέφει το ενημερωμένο έγγραφο και την αναθεώρηση. */
async function stageIssue(scope: SubcontractTx, current: SubcontractAgreement, issuer: PartyRead<InvoiceIssuer>): Promise<AgreementTransitionResult> {
  const today = todayLocalDate();
  assertGovernance(refuseTransition(current, 'issue', today));
  const resolved = await resolveAgreementContent(scope, storedContentRequest(current), issuer);
  const { parties } = resolved;
  const refreshed: SubcontractAgreement = { ...current, parties, scope: resolved.scope, projectIds: resolved.projectIds, clauses: resolved.clauses };
  assertGovernance(refuseTransition(refreshed, 'issue', today));
  const frozen = resolved.clauses.map((selection) => {
    const pinned = resolved.pinned.get(selection.clauseKey);
    if (!pinned) throw new Error(`pinned clause vanished after judging: ${selection.clauseKey}`);
    return frozenClauseOf(selection, pinned, refreshed.terms);
  });
  assertNoSubcontractIssues(bilingualIssues(frozen, refreshed.languages.secondary));
  const revisionNumber = (current.issuedRevision ?? 0) + 1;
  const snapshot = buildAgreementSnapshot(refreshed, frozen);
  const revision: SubcontractAgreementRevision = {
    id: generateDeterministicSubcontractRevisionId(current.id, revisionNumber),
    companyId: current.companyId,
    agreementId: current.id,
    revisionNumber,
    amends: null,
    snapshot,
    contentHash: await agreementSnapshotHash(snapshot),
    pdfFileId: null,
    sealed: false,
    issuedBy: scope.ctx.uid,
    issuedAt: scope.now,
  };
  stageCreate(scope, 'agreementRevision', agreementRevisionDocRef(scope.db, current.id, revision.id), revision);
  const agreement = stageUpdate(scope, 'agreement', agreementDocRef(scope.db, current.id), current, {
    parties, scope: refreshed.scope, projectIds: refreshed.projectIds, clauses: refreshed.clauses,
    status: statusAfter('issue'), issuedRevision: revisionNumber, issuedAt: scope.now,
  });
  return { agreement, revision, spawnedAgreement: null };
}

/** `accept`: και, στον Τρόπο Β, το συμφωνητικό που γεννά η αποδεκτή προσφορά — με δικό του αριθμό. */
async function stageAccept(scope: SubcontractTx, current: SubcontractAgreement): Promise<AgreementTransitionResult> {
  const spawns = spawnsAgreementOnAccept(current);
  const counter = spawns ? await readAgreementCounter(scope) : null;
  assertGovernance(refuseTransition(current, 'accept', todayLocalDate()));
  let spawnedAgreement: SubcontractAgreement | null = null;
  if (spawns) {
    const numbered = nextAgreementNumber(counter, scope.ctx.companyId, 'agreement', todayLocalDate());
    const id = generateSubcontractAgreementId();
    stageAgreementCounter(scope, numbered.counter);
    spawnedAgreement = stageCreate(scope, 'agreement', agreementDocRef(scope.db, id), newAgreementRecord(
      scope, { id, role: 'agreement', documentNumber: numbered.documentNumber, sourceOfferId: current.id }, agreementContentOf(current),
    ));
  }
  const agreement = stageUpdate(scope, 'agreement', agreementDocRef(scope.db, current.id), current, {
    status: statusAfter('accept'), acceptedAt: scope.now, ...(spawnedAgreement ? { agreementId: spawnedAgreement.id } : {}),
  });
  return { agreement, revision: null, spawnedAgreement };
}

/** Οι απλές μεταβάσεις: μόνο κατάσταση (και η μέρα εγκατάστασης στο `mobilize`). */
function stageSimple(scope: SubcontractTx, current: SubcontractAgreement, transition: SubcontractAgreementTransition, input: AgreementTransitionInput): AgreementTransitionResult {
  const today = todayLocalDate();
  assertGovernance(refuseTransition(current, transition, today));
  const extra = transition === 'mobilize' ? { mobilizedOn: input.mobilizedOn ?? today } : {};
  const agreement = stageUpdate(scope, 'agreement', agreementDocRef(scope.db, current.id), current, { status: statusAfter(transition), ...extra });
  return { agreement, revision: null, spawnedAgreement: null };
}

/** Η **μία** πόρτα κάθε μετάβασης: ανάγνωση + CAS, μετά ο κλάδος. */
export async function transitionSubcontractAgreement(
  ctx: AuthContext,
  id: string,
  transition: SubcontractAgreementTransition,
  input: AgreementTransitionInput,
): Promise<AgreementTransitionResult> {
  const issuer = transition === 'issue' ? await readIssuer(ctx.companyId, ctx.uid) : null;
  return runSubcontractTransaction(ctx, async (scope) => {
    const current = await readOwned(scope, 'agreement', agreementDocRef(scope.db, id));
    assertRevision(current, input.expectedRevision);
    if (transition === 'issue' && issuer) return stageIssue(scope, current, issuer);
    if (transition === 'accept') return stageAccept(scope, current);
    return stageSimple(scope, current, transition, input);
  });
}
