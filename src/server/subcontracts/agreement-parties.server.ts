import 'server-only';

/**
 * Τα **μέρη και η ταυτότητα έργου** του συμφωνητικού, διαβασμένα από τις πηγές τους (ADR-928 §5.4 · Φ2 απόφαση 4).
 *
 * 🔑 **Καμία δική του αντιστοίχιση — μόνο σύνθεση υπαρχόντων SSoT** (το μοτίβο του `po-document-parties.ts`):
 * - εκδότης: `getCompanySetup` → `buildIssuer` (η **ίδια** ταυτότητα που τυπώνει το τιμολόγιο και η παραγγελία)·
 * - επαφές: `readOwnedContactDocsInTransaction` (φύλακας μισθωτή, ADR-742) → `extractContactParty`, με όνομα από το
 *   `extractContactDisplayName` (ο αναγνώστης του ωμού εγγράφου — το `extractContactParty` δίνει «undefined undefined»)·
 * - έργο: `ownedOrNull` + `getPrimaryAddress` / `formatFullAddressLine` (ADR-167)· κτίρια του **ίδιου** έργου.
 *
 * ⚖️ **Αποτυχία κλειστή**: ανύπαρκτο **ή ξένο** (δεν ξεχωρίζουν, ADR-742) ⇒ εύρημα, ποτέ επινοημένο μέρος. Οι αναγνώσεις
 * έργου/επαφών γίνονται **μέσα** στη συναλλαγή, πριν από κάθε εγγραφή· το προφίλ του φορέα πριν από αυτήν.
 * @module server/subcontracts/agreement-parties.server
 */

import type { DocumentData } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { buildingLabelOf } from '@/lib/buildings/building-label';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocsInTransaction } from '@/server/lib/owned-contact-docs';
import { buildIssuer } from '@/services/sales-accounting/sales-accounting-helpers';
import { getCompanySetup } from '@/subapps/accounting/services/repository/accounting-repo-company-setup';
import type { InvoiceIssuer } from '@/subapps/accounting/types/invoice';
import { extractContactParty, type ContactParty } from '@/subapps/accounting/utils/contact-party';
import type { ProjectOwnersInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import type {
  ProjectBuildingSnapshot,
  ProjectIdentitySnapshot,
  ProjectOwnerSnapshot,
  ProjectOwnersPresentation,
  SubcontractorSnapshot,
} from '@/subapps/procurement/subcontracts/types/agreement';
import type { Contact } from '@/types/contacts';
import type { Project } from '@/types/project';
import { formatFullAddressLine, getPrimaryAddress } from '@/types/project/address-helpers';
import type { SubcontractTx } from './subcontract-store.server';

/** Αποτέλεσμα ανάγνωσης: η τιμή ή τα ευρήματα — ο γραφέας μαζεύει **όλα** τα ευρήματα πριν απαντήσει. */
export type PartyRead<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly SubcontractIssue[] };

const fail = <T>(code: SubcontractIssue['code'], path: string): PartyRead<T> => ({ ok: false, issues: [{ code, path }] });

/** Ο φορέας — εκτός συναλλαγής (το προφίλ λογιστικής έχει δικό του αναγνώστη). Χωρίς προφίλ ⇒ κανένα έγγραφο. */
export async function readIssuer(companyId: string, uid: string): Promise<PartyRead<InvoiceIssuer>> {
  const profile = await getCompanySetup({ companyId, userId: uid });
  return profile ? { ok: true, value: buildIssuer(profile) } : fail('issuerProfileMissing', 'parties.issuer');
}

/** Επαφή ωμή → συναλλασσόμενος, με το όνομα από τον αναγνώστη του ωμού εγγράφου· `null` χωρίς αναγνώσιμο όνομα. */
function contactPartyOf(doc: DocumentData): ContactParty | null {
  const name = extractContactDisplayName(doc).trim();
  return name ? { ...extractContactParty(doc as Contact), name } : null;
}

function subcontractorOf(contactId: string, contacts: ReadonlyMap<string, DocumentData>): PartyRead<SubcontractorSnapshot> {
  const doc = contacts.get(contactId);
  const party = doc ? contactPartyOf(doc) : null;
  if (!doc || !party) return fail('contactUnknown', 'subcontractorContactId');
  const fatherName = typeof doc.fatherName === 'string' && doc.fatherName.trim() ? doc.fatherName.trim() : null;
  return { ok: true, value: { ...party, contactId, fatherName } };
}

function ownersOf(input: ProjectOwnersInput, contacts: ReadonlyMap<string, DocumentData>): PartyRead<ProjectOwnersPresentation> {
  if (input.kind !== 'named') return { ok: true, value: input };
  const owners: ProjectOwnerSnapshot[] = [];
  const issues: SubcontractIssue[] = [];
  input.contactIds.forEach((id, index) => {
    const doc = contacts.get(id);
    const party = doc ? contactPartyOf(doc) : null;
    if (party) owners.push({ ...party, contactId: id });
    else issues.push({ code: 'contactUnknown', path: `projectOwners.contactIds.${index}` });
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { kind: 'named', owners } };
}

export interface ContactPartiesRead {
  readonly subcontractor: PartyRead<SubcontractorSnapshot>;
  readonly projectOwners: PartyRead<ProjectOwnersPresentation>;
}

/** Υπεργολάβος + οικοπεδούχοι σε **μία** ανάγνωση (`getAll`) μέσα στη συναλλαγή. */
export async function readContactParties(scope: SubcontractTx, subcontractorId: string, owners: ProjectOwnersInput): Promise<ContactPartiesRead> {
  const ownerIds = owners.kind === 'named' ? owners.contactIds : [];
  const contacts = await readOwnedContactDocsInTransaction(scope.tx, scope.db, scope.ctx.companyId, [subcontractorId, ...ownerIds]);
  return { subcontractor: subcontractorOf(subcontractorId, contacts), projectOwners: ownersOf(owners, contacts) };
}

function projectAddressOf(project: Project): string {
  const primary = getPrimaryAddress(project.addresses);
  return primary ? formatFullAddressLine(primary) : (project.address ?? '').trim();
}

const nonBlank = (value: string | undefined): string | null => (value && value.trim() ? value.trim() : null);

/** Ό,τι χρειάζεται από το έγγραφο κτιρίου: ιδιοκτησία, έργο, ετικέτα (ADR-928 §5.24). */
interface BuildingFacts {
  readonly companyId: string;
  readonly projectId?: string;
  readonly name?: unknown;
  readonly code?: unknown;
}

/**
 * Η ταυτότητα του έργου, με κτίρια που ανήκουν **σε αυτό** το έργο. `path`: πού δείχνει το εύρημα (εμβέλεια ή ανάθεση).
 */
export async function readProjectIdentity(
  scope: SubcontractTx,
  projectId: string,
  buildingIds: readonly string[],
  path: string,
): Promise<PartyRead<ProjectIdentitySnapshot>> {
  const projectSnap = await scope.tx.get(scope.db.collection(COLLECTIONS.PROJECTS).doc(projectId));
  const buildingSnaps = buildingIds.length > 0
    ? await scope.tx.getAll(...buildingIds.map((id) => scope.db.collection(COLLECTIONS.BUILDINGS).doc(id)))
    : [];
  const project = ownedOrNull(projectSnap.data() as Project | undefined, scope.ctx.companyId, { resource: 'project', resourceId: projectId });
  if (!project) return fail('projectUnknown', `${path}.projectId`);
  const buildings: ProjectBuildingSnapshot[] = [];
  const issues: SubcontractIssue[] = [];
  buildingSnaps.forEach((snap, index) => {
    const building = ownedOrNull(snap.data() as BuildingFacts | undefined, scope.ctx.companyId, { resource: 'building', resourceId: snap.id });
    if (building && building.projectId === projectId) buildings.push({ id: snap.id, label: buildingLabelOf({ ...building, id: snap.id }) });
    else issues.push({ code: 'buildingNotInProject', path: `${path}.buildingIds.${index}` });
  });
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      projectId,
      name: project.name,
      address: projectAddressOf(project),
      licenseNumber: nonBlank(project.licenseNumber),
      issuingAuthority: nonBlank(project.issuingAuthority),
      buildingBlock: nonBlank(project.buildingBlock),
      plotNumber: nonBlank(project.plotNumber),
      buildingIds: [...buildingIds],
      buildings,
    },
  };
}

/** Όλα τα ευρήματα ενός συνόλου αναγνώσεων. */
export function issuesOf(...reads: readonly PartyRead<unknown>[]): SubcontractIssue[] {
  return reads.flatMap((read) => (read.ok ? [] : read.issues));
}
