/**
 * @fileoverview **Φρουρός της άγκυρας μιας μονάδας**: χώρος εργασίας · έργο · κτίριο (ADR-898 §21.6 Ε6-α/γ).
 * @module api/properties/[id]/property-anchor-guard
 *
 * 🔑 **Ο κανόνας τομέα** (πρότυπο Revit «Not Placed» — απόφαση 2026-10-05): το **έργο** είναι το όριο της μονάδας.
 *   Μέσα του η μονάδα **τοποθετείται** (κτίριο · όροφος) και **ξετοποθετείται** ελεύθερα· το έργο της **δεν αλλάζει ως
 *   παρενέργεια** μιας τοποθέτησης. Άρα:
 *   - μονάδα έργου πάει **μόνο** σε κτίριο του ίδιου έργου — το ΙΔΙΟ κατηγόρημα με τους χώρους
 *     (`lib/spaces/space-building-scope`), που είναι και το φίλτρο του επιλογέα·
 *   - η αποσύνδεση από κτίριο **κρατά** το έργο (ADR-284: μονάδα δεν υπάρχει χωρίς έργο)· ο καταρράκτης
 *     `property-building` δεν το αδειάζει πια.
 * 🔒 **Τι έκλεισε.** Ως τις 2026-10-05 το `PATCH /api/properties/[id]` έγραφε **αυτούσια** από το σώμα:
 *   - `companyId` ⇒ μία γραμμή JSON μετέφερε τη μονάδα σε άλλον χώρο εργασίας·
 *   - `projectId` ⇒ οποιοδήποτε έργο, χωρίς έλεγχο ιδιοκτησίας ή συνέπειας με το κτίριο·
 *   - `buildingId` ⇒ οποιοδήποτε κτίριο, και ο καταρράκτης έγραφε μετά το `companyId` **του κτιρίου**.
 *   Το σχήμα είναι `.passthrough()` και ο μόνος φρουρός από κάτω ήταν η λίστα άρνησης πέντε ονομάτων.
 * ⚠️ Το `projectId` **δεν** απαγορεύεται ως πεδίο: ηχώ της αποθηκευμένης τιμής περνά (ιδεμπότητα), και μονάδα **χωρίς**
 *   έργο (παλιά εγγραφή) το αποκτά — από τον φύλακα του έργου. Απαγορεύεται η **αλλαγή** του.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  nonEmptyText,
  projectOfOwnedBuilding,
  projectOfSpace,
  type SpaceGuardCaller,
} from '@/lib/api/space-building-project-guard';
import { requireProjectInTenant } from '@/lib/auth/tenant-isolation';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { isBuildingInSpaceProject } from '@/lib/spaces/space-building-scope';

type Doc = Readonly<Record<string, unknown>>;

function projectBoundary(propertyId: string, detail: string): ApiError {
  return new ApiError(409, `Property ${propertyId}: ${detail}`, POLICY_ERROR_CODES.PROPERTY_PROJECT_BOUNDARY);
}

/** 🔒 Ο χώρος εργασίας μιας μονάδας δεν γράφεται από σώμα αιτήματος· μόνο η ηχώ της αποθηκευμένης τιμής περνά. */
function assertTenantUntouched(body: Doc, existing: Doc): void {
  if (!('companyId' in body) || body.companyId === undefined) return;
  const claimed = body.companyId;
  const stored = nonEmptyText(existing.companyId);
  // Η ΙΔΙΑ ερώτηση ιδιοκτησίας με κάθε φύλακα (SSoT `tenant-ownership`): κενό ή απόν δεν είναι χώρος εργασίας.
  const echoes = typeof claimed === 'string' && stored !== null && isPayloadOwnedByCompany({ companyId: claimed }, stored);
  if (!echoes) throw new ApiError(400, 'companyId is not writable');
}

/**
 * Το έργο με το οποίο κρίνεται η γραφή: το έργο της μονάδας· χωρίς έργο, αυτό που **ζητά** το σώμα (επαληθευμένο).
 * @throws ApiError(409) αλλαγή ή άδειασμα του έργου μονάδας που έχει έργο
 * @throws TenantIsolationError(404) έργο ξένο ή ανύπαρκτο
 */
async function effectiveProjectOf(
  db: AdminFirestore,
  caller: SpaceGuardCaller,
  propertyId: string,
  body: Doc,
  existing: Doc,
): Promise<string | null> {
  const ownProjectId = await projectOfSpace(db, existing);
  if (!('projectId' in body) || body.projectId === undefined) return ownProjectId;

  const claimed = nonEmptyText(body.projectId);
  if (ownProjectId !== null) {
    if (claimed !== ownProjectId) throw projectBoundary(propertyId, `belongs to project ${ownProjectId}; it cannot change`);
    return ownProjectId;
  }
  if (claimed !== null) await requireProjectInTenant({ ctx: caller.ctx, projectId: claimed, path: caller.path });
  return claimed;
}

/** Ό,τι προσθέτει ο φρουρός στη γραφή — σήμερα μόνο το έργο που η μονάδα **κρατά** όταν φεύγει από το κτίριό της. */
export type PropertyAnchorPatch = { readonly projectId?: string };

/**
 * Αποσύνδεση από κτίριο: μονάδα που το έργο της το «ήξερε» μόνο το κτίριο (παλιά εγγραφή, χωρίς δικό της `projectId`)
 * το **παίρνει μαζί της** στην ΙΔΙΑ γραφή — αλλιώς θα έμενε μονάδα χωρίς έργο (ADR-284).
 */
async function projectKeptOnUnlink(db: AdminFirestore, body: Doc, existing: Doc): Promise<PropertyAnchorPatch> {
  const unlinks = 'buildingId' in body && body.buildingId !== undefined && nonEmptyText(body.buildingId) === null;
  if (!unlinks || nonEmptyText(existing.projectId) !== null) return {};
  const inherited = await projectOfSpace(db, existing);
  return inherited === null ? {} : { projectId: inherited };
}

/**
 * Ό,τι αγγίζει την άγκυρα μιας μονάδας, **πριν τη γραφή**. Επιστρέφει ό,τι πρέπει να γραφτεί **μαζί**.
 * @throws ApiError(400) `companyId` διαφορετικό από το αποθηκευμένο
 * @throws ApiError(409, PROPERTY_PROJECT_BOUNDARY) αλλαγή έργου, ή κτίριο άλλου έργου
 * @throws TenantIsolationError(404) κτίριο ή έργο ξένο / ανύπαρκτο
 */
export async function assertPropertyAnchorWrite(
  db: AdminFirestore,
  caller: SpaceGuardCaller,
  propertyId: string,
  body: Doc,
  existing: Doc,
): Promise<PropertyAnchorPatch> {
  assertTenantUntouched(body, existing);

  const touchesProject = 'projectId' in body && body.projectId !== undefined;
  const nextBuildingId = nonEmptyText(body.buildingId);
  const movesBuilding = nextBuildingId !== null && nextBuildingId !== nonEmptyText(existing.buildingId);
  if (!touchesProject && !movesBuilding) return projectKeptOnUnlink(db, body, existing);

  // 🔒 ΠΡΩΤΑ ο χώρος εργασίας του κτιρίου: ξένο ≡ ανύπαρκτο ⇒ 404, πριν από κάθε κρίση έργου (κανένα μαντείο 409/404).
  const buildingProjectId = movesBuilding ? await projectOfOwnedBuilding(caller, nextBuildingId) : null;

  const projectId = await effectiveProjectOf(db, caller, propertyId, body, existing);
  if (movesBuilding && !isBuildingInSpaceProject(projectId, buildingProjectId)) {
    throw projectBoundary(propertyId, `building ${nextBuildingId} is not in project ${projectId}`);
  }
  return {};
}
