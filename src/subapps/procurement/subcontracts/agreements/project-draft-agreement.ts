/**
 * @fileoverview **Το συμφωνητικό όπως θα είναι αν αποθηκευτεί τώρα** — η είσοδος της ζωντανής προεπισκόπησης
 *   (ADR-928 Φ3γ απόφαση 4).
 * @module subapps/procurement/subcontracts/agreements/project-draft-agreement
 *
 * 🔑 Περιεχόμενο από το **τοπικό** πρόχειρο, μέσα από τον ΙΔΙΟ `contentFieldsOf` με τον γραφέα· ρήτρες από τον ΙΔΙΟ
 *    κριτή (`judgeAgreementDraft`). Ό,τι ακολουθεί (`previewSnapshotOf` → `buildAgreementDocument`) είναι το μοντέλο της
 *    Φ3β, άρα η προεπισκόπηση και το PDF δεν διαφωνούν.
 * 🔑 **Τα μέρη τα γράφει μόνο ο διακομιστής** (Φ2 απόφαση 4): μένουν του αποθηκευμένου εγγράφου. Μέρος που το πρόχειρο
 *    άλλαξε και θέλει ανάγνωση πηγής (άλλη επαφή, άλλοι ονομαστικοί οικοπεδούχοι, άλλο έργο) **δεν μαντεύεται** — αναφέρεται
 *    στο `stale` και η οθόνη λέει «ενημερώνεται στην αποθήκευση». Ό,τι λύνεται χωρίς πηγή (κτίρια του ίδιου έργου ·
 *    οικοπεδούχοι «κανένας» / «συλλογικά» · υπογράφων) προβάλλεται αμέσως.
 */

import type { AgreementScope, ProjectOwnersPresentation, SubcontractAgreement } from '../types/agreement';
import type { ClauseSelection } from '../types/commercial-terms';
import { contentFieldsOf } from './agreement-content-fields';
import type { AgreementScopeInput, ProjectOwnersInput, SubcontractAgreementDraftInput } from './agreement-draft';

export const STALE_AGREEMENT_PARTS = ['subcontractor', 'projectOwners', 'scope'] as const;
export type StaleAgreementPart = (typeof STALE_AGREEMENT_PARTS)[number];

export interface ProjectedDraftAgreement {
  readonly agreement: SubcontractAgreement;
  readonly stale: readonly StaleAgreementPart[];
}

type Projected<T> = { readonly value: T; readonly stale: boolean };

function scopeOf(saved: AgreementScope, input: AgreementScopeInput): Projected<AgreementScope> {
  if (saved.kind === 'multi_project') return { value: saved, stale: input.kind !== 'multi_project' };
  if (input.kind !== 'single_project' || input.projectId !== saved.project.projectId) return { value: saved, stale: true };
  return { value: { kind: 'single_project', project: { ...saved.project, buildingIds: input.buildingIds } }, stale: false };
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, index) => id === b[index]);

function ownersOf(saved: ProjectOwnersPresentation, input: ProjectOwnersInput): Projected<ProjectOwnersPresentation> {
  if (input.kind !== 'named') return { value: input, stale: false };
  const savedIds = saved.kind === 'named' ? saved.owners.map((owner) => owner.contactId) : null;
  return { value: saved, stale: savedIds === null || !sameIds(savedIds, input.contactIds) };
}

/** `selections`: οι επιλογές του κριτή πάνω στο πρόχειρο (`judgeAgreementDraft(...).selections`). */
export function projectDraftAgreement(
  saved: SubcontractAgreement,
  draft: SubcontractAgreementDraftInput,
  selections: readonly ClauseSelection[],
): ProjectedDraftAgreement {
  const scope = scopeOf(saved.scope, draft.scope);
  const owners = ownersOf(saved.parties.projectOwners, draft.projectOwners);
  const parties = { ...saved.parties, projectOwners: owners.value, issuerSignatory: draft.issuerSignatory };
  const stale: StaleAgreementPart[] = [];
  if (draft.subcontractorContactId !== saved.parties.subcontractor.contactId) stale.push('subcontractor');
  if (owners.stale) stale.push('projectOwners');
  if (scope.stale) stale.push('scope');
  return { agreement: { ...saved, ...contentFieldsOf(draft, { parties, scope: scope.value, clauses: selections }) }, stale };
}
