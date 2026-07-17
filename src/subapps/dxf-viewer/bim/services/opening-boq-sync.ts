'use client';

/**
 * ADR-376 Phase B.2 — Opening signature-group BOQ sync (Firestore I/O).
 *
 * Extracted από `BimToBoqBridge.ts` για file-size hygiene (Google SRP N.7.1).
 * Bridge focuses on wall/slab/column/beam single-entry + multi-layer paths· αυτό
 * το module owns το opening signature-group lifecycle.
 *
 * One BOQ row per Mode C signature group (Revit Schedule pattern, 6/6 industry
 * convergence — Revit / ArchiCAD / Tekla / Allplan / Bentley / Vectorworks).
 * Detach guard + delete-when-empty + createdAt preservation.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §7 B.2 §11 v7
 */

import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isFrozenBaselineStatus } from '@/types/boq/units';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveAtoeMapping } from '../config/bim-to-atoe-mapping';
import type { OpeningKind, OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import { resolveOpeningEffective } from '../family-types/opening-type-resolution';
import { recordBaselineDrift } from './boq-firestore-sync';
import {
  buildEffectiveSignatureMembers,
  buildOpeningGroupPayload,
  collectAffectedSignatures,
  computeOpeningSignature,
  signatureGroupBoqId,
  signatureKey,
  type GrouperOpeningRow,
  type OpeningDocRow,
  type OpeningSignature,
} from './opening-boq-grouper';

const logger = createModuleLogger('OpeningBoqSync');

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface OpeningBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  readonly floorplanId: string;
  /**
   * ADR-395 Phase 1 (G7) — floor link. All openings in a signature group share
   * the same floorplan → same floor, so it is stamped on the group row as
   * `linkedFloorId` + `scope: 'floor'`.
   */
  readonly floorId?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recompute signature group(s) μετά από opening save. Όταν παράμετροι άλλαξαν
 * έτσι ώστε signature να μεταβληθεί (`prevParams` δίνει different sig), και
 * τα δύο groups (old + new) ξαναυπολογίζονται για να διορθωθεί quantity.
 *
 * Detach guard: αν υπάρχον BOQ row είναι `detached: true`, παραλείπεται
 * (user manually edited it, αντιμετωπίζεται ως de-coupled).
 */
export async function upsertOpeningGroupForOpening(
  opening: { readonly id: string; readonly kind: OpeningKind; readonly params: OpeningParams },
  prevParams: OpeningParams | null,
  context: OpeningBoqContext,
): Promise<void> {
  if (!isContextValid(context)) return;

  const newSig = computeOpeningSignature(opening.params);
  const signaturesToRecompute = new Map<string, OpeningSignature>();
  signaturesToRecompute.set(signatureKey(newSig), newSig);

  if (prevParams) {
    const prevSig = computeOpeningSignature(prevParams);
    if (signatureKey(prevSig) !== signatureKey(newSig)) {
      signaturesToRecompute.set(signatureKey(prevSig), prevSig);
    }
  }

  await Promise.all(
    [...signaturesToRecompute.values()].map((sig) => recomputeSignatureGroup(context, sig)),
  );
}

/**
 * Recompute the signature group an opening was deleted from. Caller passes
 * the last-known params (`deletedParams`) — χωρίς αυτά, δεν ξέρουμε ποιο
 * group να ξανα-υπολογίσει.
 */
export async function deleteOpeningFromGroup(
  deletedParams: OpeningParams | null,
  context: OpeningBoqContext,
): Promise<void> {
  if (!isContextValid(context)) return;
  if (!deletedParams) return;
  const sig = computeOpeningSignature(deletedParams);
  await recomputeSignatureGroup(context, sig);
}

/**
 * ADR-421 SLICE C — re-feed the BOQ signature groups of every opening of `typeId`
 * on ONE floorplan, after a family-type edit. Effective-aware (Revit-grade): the
 * type is the source of truth, so each persisted doc is resolved «type wins»
 * BEFORE grouping — a non-active floor's stale drift-cache therefore reports the
 * NEW dimensions/kind without the doc itself being re-persisted (its geometry
 * self-heals on next load via `openingDocToEntity`).
 *
 * Only the affected groups are touched: the OLD signature (from the stale
 * `doc.params`) shrinks/deletes and the NEW signature (effective) grows.
 * Cross-type quantity stays correct because membership is counted from EVERY
 * floorplan opening resolved to its own type. Idempotent.
 */
export async function refeedOpeningBoqForTypeOnFloorplan(
  context: OpeningBoqContext,
  typeId: string,
): Promise<void> {
  if (!isContextValid(context)) return;
  const rows = await fetchAllOpeningsForFloorplan(context);
  const effective = buildEffectiveSignatureMembers(rows, resolveOpeningEffective);
  const affected = collectAffectedSignatures(rows, typeId, resolveOpeningEffective);
  await Promise.all(
    affected.map((sig) =>
      writeSignatureGroup(context, sig, effective.get(signatureKey(sig))?.members ?? []),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// INTERNAL
// ────────────────────────────────────────────────────────────────────────────

function isContextValid(context: OpeningBoqContext): boolean {
  return Boolean(context.companyId && context.projectId && context.buildingId && context.floorplanId);
}

async function recomputeSignatureGroup(
  context: OpeningBoqContext,
  signature: OpeningSignature,
): Promise<void> {
  await writeSignatureGroup(context, signature, await fetchOpeningsForSignature(context, signature));
}

/**
 * Write (upsert / delete) the BOQ row for ONE signature group from a pre-resolved
 * member list. The single write primitive shared by the per-signature active-floor
 * path ({@link recomputeSignatureGroup}) and the effective-aware cross-floor path
 * ({@link refeedOpeningBoqForTypeOnFloorplan}) — SSoT for detach guard,
 * delete-when-empty and createdAt preservation.
 */
async function writeSignatureGroup(
  context: OpeningBoqContext,
  signature: OpeningSignature,
  members: readonly GrouperOpeningRow[],
): Promise<void> {
  const groupId = signatureGroupBoqId(context.floorplanId, signature);

  // Detach guard: εάν user έχει αποσυνδέσει manually αυτό το BOQ row, μένει
  // ως έχει — δεν ενημερώνεται ούτε διαγράφεται από BIM bridge.
  // NOTE: COLLECTIONS.BOQ_ITEMS inlined σε κάθε call site για να αποτρέπεται
  // false-positive attribution στο CHECK 3.17 entity-audit scanner (forward
  // module-write scan ~300 chars αλλιώς πιάνει το FLOORPLAN_OPENINGS read
  // ref της `fetchOpeningsForSignature`). BOQ_ITEMS δεν είναι audit-tracked
  // (derived data), οπότε scanner returns no-write όταν βλέπει BOQ_ITEMS.
  const existing = await getDoc(doc(db, COLLECTIONS.BOQ_ITEMS, groupId)).catch(() => null);
  if (existing && existing.exists()) {
    const data = existing.data() as Record<string, unknown>;
    // Detach guard: ο χρήστης αποσύνδεσε manually αυτό το BOQ row — μένει ως έχει.
    if (data.detached === true) return;
    // ADR-673/674 — frozen-baseline guard: μόλις ένα BOQ row φύγει από draft/submitted
    // (approved/certified/locked) είναι συμβατικό στιγμιότυπο. Ο BIM auto-sync ΠΟΤΕ δεν
    // το διαγράφει ούτε το ξαναγράφει — καθρεφτίζει τον Firestore delete rule + την 5D-BIM
    // cost πρακτική (πιστοποιημένη ποσότητα αμετάβλητη). Αντί για σιωπηλό skip, καταγράφουμε
    // την απόκλιση του live μοντέλου (member count) ως drift metadata (ADR-674), ώστε ο
    // άνθρωπος να τη δει για revision — baseline αμετάβλητο, row ΠΟΤΕ delete.
    if (isFrozenBaselineStatus(data.status)) {
      await recordBaselineDrift(doc(db, COLLECTIONS.BOQ_ITEMS, groupId), data, members.length, 'OpeningBoqSync');
      return;
    }
  }

  if (members.length === 0) {
    // Group εξαντλήθηκε (last opening deleted / signature changed away).
    if (existing && existing.exists()) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.BOQ_ITEMS, groupId));
      } catch (err) {
        logger.error('OpeningBoqSync: signature-group delete failed', { groupId, err });
      }
    }
    return;
  }

  const mapping = resolveAtoeMapping('opening', signature.kind);
  if (!mapping) return;

  const existingCreatedAt = existing && existing.exists()
    ? ((existing.data() as Record<string, unknown>).createdAt as string | undefined) ?? null
    : null;

  const built = buildOpeningGroupPayload({
    context,
    signature,
    members,
    mapping,
    existingCreatedAt,
  });

  try {
    await setDoc(doc(db, COLLECTIONS.BOQ_ITEMS, groupId), built.payload);
  } catch (err) {
    logger.error('OpeningBoqSync: signature-group upsert failed', { groupId, err });
  }
}

/**
 * Base equality query over a floorplan's persisted openings, scoped to
 * companyId+projectId+floorplanId (served by the existing composite index —
 * CHECK 3.10 satisfied: companyId inline). Extra constraints (e.g. a `kind`
 * filter) are appended by the caller so both fetch helpers share this prefix
 * instead of a duplicated query preamble (N.18 / jscpd, ADR-583).
 */
function queryFloorplanOpenings(context: OpeningBoqContext, ...extra: QueryConstraint[]) {
  return query(
    collection(db, COLLECTIONS.FLOORPLAN_OPENINGS),
    where('companyId', '==', context.companyId),
    where('projectId', '==', context.projectId),
    where('floorplanId', '==', context.floorplanId),
    ...extra,
  );
}

async function fetchOpeningsForSignature(
  context: OpeningBoqContext,
  signature: OpeningSignature,
): Promise<GrouperOpeningRow[]> {
  const q = queryFloorplanOpenings(context, where('kind', '==', signature.kind));

  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    logger.error('OpeningBoqSync: signature-group fetch failed', { err });
    return [];
  }

  const matches: GrouperOpeningRow[] = [];
  snap.forEach((d) => {
    const data = d.data() as { params?: OpeningParams; createdAt?: { toMillis?: () => number } };
    const params = data.params;
    if (!params) return;
    if (
      params.width !== signature.width ||
      params.height !== signature.height ||
      params.sillHeight !== signature.sillHeight ||
      (params.openDirection ?? 'na') !== signature.openDirection
    ) return;
    matches.push({
      id: d.id,
      kind: signature.kind,
      params,
      createdAtMillis: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0,
    });
  });
  return matches;
}

/**
 * ADR-421 SLICE C — fetch ALL persisted openings of a floorplan (no `kind`
 * filter, unlike {@link fetchOpeningsForSignature}) so the caller can resolve
 * each doc «type wins» before grouping. A type edit can change the governed
 * `kind`, so filtering by the stale persisted `kind` would miss re-kinded docs.
 * Equality-only query served by the existing companyId+projectId+floorplanId
 * composite index — CHECK 3.10 satisfied (companyId present).
 */
export async function fetchAllOpeningsForFloorplan(
  context: OpeningBoqContext,
): Promise<OpeningDocRow[]> {
  const q = queryFloorplanOpenings(context);

  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    logger.error('OpeningBoqSync: floorplan opening fetch failed', { err });
    return [];
  }

  const rows: OpeningDocRow[] = [];
  snap.forEach((d) => {
    const data = d.data() as {
      params?: OpeningParams;
      typeId?: string;
      typeOverrides?: Partial<OpeningTypeParams>;
      createdAt?: { toMillis?: () => number };
    };
    if (!data.params) return;
    rows.push({
      id: d.id,
      params: data.params,
      typeId: data.typeId,
      typeOverrides: data.typeOverrides,
      createdAtMillis: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0,
    });
  });
  return rows;
}
