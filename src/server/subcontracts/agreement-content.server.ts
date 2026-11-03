import 'server-only';

/**
 * Το **περιεχόμενο** ενός συμφωνητικού όπως το λύνει ο διακομιστής — μέρη, εμβέλεια, ρήτρες κριμένες απέναντι στη
 * βιβλιοθήκη (ADR-928 Φ2 αποφάσεις 4, 5, 6, 12). Ένας ορισμός για τρεις στιγμές: δημιουργία, αποθήκευση πρόχειρου, και
 * **ανανέωση στο `issue`** (§5.4: «στιγμιότυπο τη στιγμή της έκδοσης»).
 *
 * ⚠️ Μόνο **αναγνώσεις** (μέσα στη συναλλαγή) και καθαρή κρίση — καμία εγγραφή: ο καλών σκηνοθετεί μετά.
 * @module server/subcontracts/agreement-content.server
 */

import type { InvoiceIssuer } from '@/subapps/accounting/types/invoice';
import type { AgreementScopeInput, ProjectOwnersInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import type { PinnedClause } from '@/subapps/procurement/subcontracts/agreements/agreement-snapshot';
import { judgeClauseSelections, type ClauseSelectionInput } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import type {
  AgreementParties,
  AgreementScope,
  ProjectIdentitySnapshot,
  SiteAssignment,
} from '@/subapps/procurement/subcontracts/types/agreement';
import type { ClauseKey } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseSelection, CommercialTerms } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import type { SignatoryFieldSet } from '@/subapps/procurement/types/signatory-fields';
import { approvedLibraryOf, readApprovedClauses } from './clause-library-reads.server';
import { issuesOf, readContactParties, readProjectIdentity, type PartyRead } from './agreement-parties.server';
import type { SubcontractTx } from './subcontract-store.server';
import { assertNoSubcontractIssues } from './subcontract-write-error';

/** Ό,τι χρειάζεται για να λυθεί το περιεχόμενο — από το πρόχειρο του πελάτη ή από το αποθηκευμένο έγγραφο. */
export interface AgreementContentRequest {
  readonly scope: AgreementScopeInput;
  /** Οι αναθέσεις που υπάρχουν ήδη (μόνο `multi_project`) — δεν τις στέλνει ο πελάτης, τις κρατά ο γραφέας. */
  readonly existingAssignments: readonly SiteAssignment[];
  readonly subcontractorContactId: string;
  readonly projectOwners: ProjectOwnersInput;
  readonly issuerSignatory: SignatoryFieldSet | null;
  readonly terms: CommercialTerms;
  readonly clauses: readonly ClauseSelectionInput[];
  /** Οι αποθηκευμένες επιλογές — για να κρατηθούν οι αποφάσεις αποκλίσεων όπου η τιμή δεν άλλαξε. */
  readonly previousClauses: readonly ClauseSelection[];
}

export interface ResolvedAgreementContent {
  readonly parties: AgreementParties;
  readonly scope: AgreementScope;
  readonly projectIds: readonly string[];
  readonly clauses: readonly ClauseSelection[];
  /** Η ρήτρα και η καρφωμένη έκδοση ανά κλειδί — για το πάγωμα στο `issue`. */
  readonly pinned: ReadonlyMap<ClauseKey, PinnedClause | null>;
}

/** Τα έργα ενός εγγράφου — η **μία** παραγωγή του `projectIds` (Φ2 απόφαση 12). */
export function projectIdsOf(scope: AgreementScope): string[] {
  if (scope.kind === 'single_project') return [scope.project.projectId];
  return [...new Set(scope.assignments.map((assignment) => assignment.project.projectId))];
}

async function readScope(scope: SubcontractTx, request: AgreementContentRequest): Promise<PartyRead<AgreementScope>> {
  if (request.scope.kind === 'multi_project') return { ok: true, value: { kind: 'multi_project', assignments: request.existingAssignments } };
  const project: PartyRead<ProjectIdentitySnapshot> = await readProjectIdentity(scope, request.scope.projectId, request.scope.buildingIds, 'scope');
  return project.ok ? { ok: true, value: { kind: 'single_project', project: project.value } } : project;
}

/**
 * Διαβάζει και κρίνει. Ρίχνει `invalid` με **όλα** τα ευρήματα (μέρη + έργο + ρήτρες + εκδότης) — ο άνθρωπος βλέπει
 * τι λείπει μονομιάς, όχι ένα-ένα.
 */
export async function resolveAgreementContent(
  scope: SubcontractTx,
  request: AgreementContentRequest,
  issuer: PartyRead<InvoiceIssuer>,
): Promise<ResolvedAgreementContent> {
  const contacts = await readContactParties(scope, request.subcontractorContactId, request.projectOwners);
  const agreementScope = await readScope(scope, request);
  const pinned = await readApprovedClauses(scope, request.clauses.map((clause) => clause.clauseKey));
  const judged = judgeClauseSelections(request.clauses, approvedLibraryOf(pinned), request.terms, request.previousClauses, { uid: scope.ctx.uid });
  const issues: SubcontractIssue[] = [...issuesOf(issuer, contacts.subcontractor, contacts.projectOwners, agreementScope), ...judged.issues];
  assertNoSubcontractIssues(issues);
  if (!issuer.ok || !contacts.subcontractor.ok || !contacts.projectOwners.ok || !agreementScope.ok) return assertUnreachable();
  return {
    parties: {
      issuer: issuer.value,
      subcontractor: contacts.subcontractor.value,
      projectOwners: contacts.projectOwners.value,
      issuerSignatory: request.issuerSignatory,
    },
    scope: agreementScope.value,
    projectIds: projectIdsOf(agreementScope.value),
    clauses: judged.selections,
    pinned,
  };
}

/** Χωρίς ευρήματα κάθε ανάγνωση είναι `ok` — το `assertNoSubcontractIssues` το εγγυάται· εδώ μόνο για τη στένωση. */
function assertUnreachable(): never {
  throw new Error('subcontract agreement content: unresolved party without issues');
}
