/**
 * @fileoverview **Φρουρός: αποσύνδεση από κτίριο χώρου που είναι παρακολούθημα μονάδας** (ADR-898 §20 · ADR-247).
 * @module lib/api/space-attachment-guard
 *
 * 🔑 Ο κανόνας «ποιοι χώροι είναι του κτιρίου» λέει: χώρος **χωρίς** `buildingId` μετρά στο κτίριο της μονάδας που τον
 *   έχει. Άρα το «Αποσύνδεση από κτίριο» σε χώρο που ανήκει σε μονάδα **δεν θα έκανε τίποτα ορατό** — ο χώρος θα
 *   «επέστρεφε» σιωπηλά. Αντί για σιωπηλή μαντεψιά: **409** με κωδικό πολιτικής· ο άνθρωπος τον αφαιρεί πρώτα από τη μονάδα.
 * 🔑 Η **μετακίνηση** σε άλλο κτίριο (`buildingId` = άλλο) επιτρέπεται: θέση ≠ ανάθεση.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { nonEmptyText as textOf, projectOfSpace } from '@/lib/api/space-building-project-guard';
import { linkedSpaceOwnersInScope } from '@/lib/firestore/entity-linking.service';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';

/** Ζητά το σώμα να αδειάσει το `buildingId`; (`undefined` = δεν το αγγίζει.) */
function detachesBuilding(body: Readonly<Record<string, unknown>>): boolean {
  return Object.prototype.hasOwnProperty.call(body, 'buildingId') && body.buildingId !== undefined && textOf(body.buildingId) === null;
}

/** @throws ApiError(409, SPACE_LINKED_TO_UNIT) όταν ο χώρος αποσυνδέεται από κτίριο ενώ ανήκει σε μονάδα. */
export async function assertNotDetachingAttachedSpace(
  db: AdminFirestore,
  spaceId: string,
  body: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): Promise<void> {
  if (!detachesBuilding(body) || textOf(existing.buildingId) === null) return;
  const scope = { projectId: await projectOfSpace(db, existing), buildingId: textOf(existing.buildingId) };
  const owners = await linkedSpaceOwnersInScope(db, scope, new Set([spaceId]));
  if (owners.has(spaceId)) {
    throw new ApiError(409, `Space ${spaceId} is attached to property ${owners.get(spaceId)}`, POLICY_ERROR_CODES.SPACE_LINKED_TO_UNIT);
  }
}
