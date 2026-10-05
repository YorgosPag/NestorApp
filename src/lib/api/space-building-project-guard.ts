/**
 * @fileoverview **Φρουρός της άγκυρας ενός χώρου**: σε ποιο κτίριο και ποιο έργο επιτρέπεται να δεθεί (ADR-898 §21.6 Ε6).
 * @module lib/api/space-building-project-guard
 *
 * 🔑 Ως τις 2026-10-05 το `PATCH {buildingId}` δεχόταν **οποιοδήποτε** κτίριο· ο καταρράκτης `child-building` ξανάγραφε
 *   μετά σιωπηλά `projectId` + `linkedCompanyId` του χώρου από το νέο κτίριο. Δηλαδή ένα λάθος κλικ σε ένα από έξι
 *   «Κτήριο Α» **άλλαζε έργο** σε μια θέση, χωρίς να το πει κανείς. Για τις μονάδες ο κανόνας υπήρχε
 *   (`BUILDING_PROJECT_MISMATCH`)· για τους χώρους όχι.
 * 🔒 **Και το κτίριο δεν ρωτιόταν ΠΟΙΑΝΟΥ είναι** (§21.6 Ε6-γ): ο ασύνδετος χώρος περνούσε με κάθε ταυτότητα κτιρίου,
 *   και ο ίδιος καταρράκτης έγραφε στον χώρο το **`companyId` του κτιρίου** — δηλαδή ένα PATCH με ξένη ταυτότητα
 *   μετέφερε την εγγραφή σε άλλον χώρο εργασίας. Πλέον **κάθε** νέο κτίριο περνά από τον φύλακα του πόρου
 *   (`requireBuildingInTenant`, ADR-742): ξένο ≡ ανύπαρκτο ⇒ `404`, με ίχνος ελέγχου. Ο έλεγχος προηγείται του κανόνα
 *   του έργου, ώστε η απάντηση να μην γίνεται μαντείο ύπαρξης (409 για ξένο, 404 για ανύπαρκτο).
 * 🔑 Το κατηγόρημα του έργου είναι το ΙΔΙΟ με του επιλογέα της φόρμας (`lib/spaces/space-building-scope`): ό,τι δεν
 *   προσφέρεται εκεί, αρνείται εδώ.
 * 🔑 Χώρος **χωρίς** έργο περνά (ανάθεση, όχι μετακίνηση). Η αλλαγή έργου γίνεται με **δύο ρητές** πράξεις:
 *   αποσύνδεση (ο καταρράκτης αδειάζει το έργο) και νέα σύνδεση.
 * 🔑 **Το έργο ενός χώρου ΠΡΟΚΥΠΤΕΙ από το κτίριό του** (§21.6 Ε6-δ): κανένα σώμα αιτήματος δεν το ορίζει δίπλα σε
 *   κτίριο. Στη γέννηση {@link resolveNewSpaceAnchor}· στο PATCH το `projectId` δεν γράφεται καθόλου
 *   (`SPACE_COMMON_UPDATE_FIELDS`).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { AuthContext } from '@/lib/auth/types';
import { requireBuildingInTenant, requireProjectInTenant } from '@/lib/auth/tenant-isolation';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { isBuildingInSpaceProject } from '@/lib/spaces/space-building-scope';

/** Μη κενό κείμενο, αλλιώς `null`. */
export function nonEmptyText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/** Ποιος ρωτά και από ποια διαδρομή — ό,τι χρειάζεται ο φύλακας του πόρου για το ίχνος ελέγχου. */
export interface SpaceGuardCaller {
  readonly ctx: AuthContext;
  /** Η διαδρομή API, όπως γράφεται στο ίχνος μιας άρνησης. */
  readonly path: string;
}

async function projectOfBuilding(db: AdminFirestore, buildingId: string): Promise<string | null> {
  return nonEmptyText((await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get()).data()?.projectId);
}

/**
 * Το έργο ενός κτιρίου **του καλούντος** — ο ΕΝΑΣ φύλακας (ύπαρξη + χώρος εργασίας + ίχνος), μία ανάγνωση.
 * @throws TenantIsolationError(404) ξένο ή ανύπαρκτο κτίριο
 */
async function projectOfOwnedBuilding(caller: SpaceGuardCaller, buildingId: string): Promise<string | null> {
  const building = await requireBuildingInTenant({ ctx: caller.ctx, buildingId, path: caller.path });
  return nonEmptyText(building.projectId);
}

/** Το έργο του χώρου — δικό του, αλλιώς του κτιρίου του (η σύνδεση είναι μοναδική ανά έργο). */
export async function projectOfSpace(db: AdminFirestore, existing: Readonly<Record<string, unknown>>): Promise<string | null> {
  const own = nonEmptyText(existing.projectId);
  if (own !== null) return own;
  const buildingId = nonEmptyText(existing.buildingId);
  return buildingId === null ? null : projectOfBuilding(db, buildingId);
}

/**
 * Το νέο κτίριο ενός χώρου: **του καλούντος** (πάντα) και **του έργου του χώρου** (όταν ο χώρος έχει έργο).
 * @throws TenantIsolationError(404) όταν το κτίριο είναι ξένο ή ανύπαρκτο — και για τον ασύνδετο χώρο
 * @throws ApiError(409, SPACE_BUILDING_OTHER_PROJECT) όταν ο χώρος πάει σε κτίριο που δεν είναι του έργου του
 */
export async function assertBuildingInSpaceProject(
  db: AdminFirestore,
  caller: SpaceGuardCaller,
  spaceId: string,
  body: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): Promise<void> {
  const nextBuildingId = nonEmptyText(body.buildingId);
  if (nextBuildingId === null || nextBuildingId === nonEmptyText(existing.buildingId)) return;

  // 🔒 ΠΡΩΤΑ ο χώρος εργασίας: ισχύει και για τον χώρο χωρίς έργο, που ο κανόνας του έργου αφήνει να περάσει.
  const buildingProjectId = await projectOfOwnedBuilding(caller, nextBuildingId);

  const spaceProjectId = await projectOfSpace(db, existing);
  if (spaceProjectId === null) return;

  if (!isBuildingInSpaceProject(spaceProjectId, buildingProjectId)) {
    throw new ApiError(
      409,
      `Space ${spaceId} belongs to project ${spaceProjectId}; building ${nextBuildingId} does not`,
      POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT,
    );
  }
}

/** Η άγκυρα ενός χώρου που γεννιέται: το κτίριό του και το έργο που προκύπτει. */
export interface NewSpaceAnchor {
  readonly buildingId: string | null;
  readonly projectId: string | null;
}

/**
 * **Η άγκυρα ενός ΝΕΟΥ χώρου** — κοινή για `POST /api/parking` και `POST /api/storages`.
 * - με κτίριο ⇒ το έργο **είναι** του κτιρίου· `projectId` του σώματος που διαφωνεί ⇒ άρνηση (όχι σιωπηλή διόρθωση)·
 * - χωρίς κτίριο (ανοιχτός χώρος, ADR-191) ⇒ το `projectId` του σώματος, αφού περάσει από τον φύλακα του έργου·
 * - χωρίς κανένα ⇒ ασύνδετος χώρος.
 *
 * @throws TenantIsolationError(404) ξένο ή ανύπαρκτο κτίριο / έργο
 * @throws ApiError(409, BUILDING_PROJECT_MISMATCH) όταν το σώμα ονομάζει άλλο έργο από του κτιρίου
 */
export async function resolveNewSpaceAnchor(
  caller: SpaceGuardCaller,
  body: Readonly<{ buildingId?: unknown; projectId?: unknown }>,
): Promise<NewSpaceAnchor> {
  const buildingId = nonEmptyText(body.buildingId)?.trim() ?? null;
  const claimedProjectId = nonEmptyText(body.projectId)?.trim() ?? null;

  if (buildingId === null) {
    if (claimedProjectId !== null) {
      await requireProjectInTenant({ ctx: caller.ctx, projectId: claimedProjectId, path: caller.path });
    }
    return { buildingId: null, projectId: claimedProjectId };
  }

  const buildingProjectId = await projectOfOwnedBuilding(caller, buildingId);
  if (claimedProjectId !== null && claimedProjectId !== buildingProjectId) {
    throw new ApiError(
      409,
      `Building ${buildingId} does not belong to project ${claimedProjectId}`,
      POLICY_ERROR_CODES.BUILDING_PROJECT_MISMATCH,
    );
  }
  return { buildingId, projectId: buildingProjectId };
}
