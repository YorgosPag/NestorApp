/**
 * @fileoverview **Φρουρός: μετακίνηση χώρου σε κτίριο ΑΛΛΟΥ έργου** (ADR-898 §21.6 Ε6).
 * @module lib/api/space-building-project-guard
 *
 * 🔑 Ως τις 2026-10-05 το `PATCH {buildingId}` δεχόταν **οποιοδήποτε** κτίριο· ο καταρράκτης `child-building` ξανάγραφε
 *   μετά σιωπηλά `projectId` + `linkedCompanyId` του χώρου από το νέο κτίριο. Δηλαδή ένα λάθος κλικ σε ένα από έξι
 *   «Κτήριο Α» **άλλαζε έργο** σε μια θέση, χωρίς να το πει κανείς. Για τις μονάδες ο κανόνας υπήρχε
 *   (`BUILDING_PROJECT_MISMATCH`)· για τους χώρους όχι.
 * 🔑 Το κατηγόρημα είναι το ΙΔΙΟ με του επιλογέα της φόρμας (`lib/spaces/space-building-scope`): ό,τι δεν προσφέρεται
 *   εκεί, αρνείται εδώ.
 * 🔑 Χώρος **χωρίς** έργο περνά (ανάθεση, όχι μετακίνηση). Η αλλαγή έργου γίνεται με **δύο ρητές** πράξεις:
 *   αποσύνδεση (ο καταρράκτης αδειάζει το έργο) και νέα σύνδεση.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { isBuildingInSpaceProject } from '@/lib/spaces/space-building-scope';

/** Μη κενό κείμενο, αλλιώς `null`. */
export function nonEmptyText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

async function projectOfBuilding(db: AdminFirestore, buildingId: string): Promise<string | null> {
  return nonEmptyText((await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get()).data()?.projectId);
}

/** Το έργο του χώρου — δικό του, αλλιώς του κτιρίου του (η σύνδεση είναι μοναδική ανά έργο). */
export async function projectOfSpace(db: AdminFirestore, existing: Readonly<Record<string, unknown>>): Promise<string | null> {
  const own = nonEmptyText(existing.projectId);
  if (own !== null) return own;
  const buildingId = nonEmptyText(existing.buildingId);
  return buildingId === null ? null : projectOfBuilding(db, buildingId);
}

/** @throws ApiError(409, SPACE_BUILDING_OTHER_PROJECT) όταν ο χώρος πάει σε κτίριο που δεν είναι του έργου του. */
export async function assertBuildingInSpaceProject(
  db: AdminFirestore,
  spaceId: string,
  body: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): Promise<void> {
  const nextBuildingId = nonEmptyText(body.buildingId);
  if (nextBuildingId === null || nextBuildingId === nonEmptyText(existing.buildingId)) return;

  const spaceProjectId = await projectOfSpace(db, existing);
  if (spaceProjectId === null) return;

  const buildingProjectId = await projectOfBuilding(db, nextBuildingId);
  if (!isBuildingInSpaceProject(spaceProjectId, buildingProjectId)) {
    throw new ApiError(
      409,
      `Space ${spaceId} belongs to project ${spaceProjectId}; building ${nextBuildingId} does not`,
      POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT,
    );
  }
}
