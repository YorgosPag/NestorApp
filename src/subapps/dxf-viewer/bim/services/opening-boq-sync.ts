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

import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveAtoeMapping } from '../config/bim-to-atoe-mapping';
import type { OpeningKind, OpeningParams } from '../types/opening-types';
import {
  buildOpeningGroupPayload,
  computeOpeningSignature,
  signatureGroupBoqId,
  signatureKey,
  type GrouperOpeningRow,
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
  const members = await fetchOpeningsForSignature(context, signature);
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
    if (data.detached === true) return;
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

async function fetchOpeningsForSignature(
  context: OpeningBoqContext,
  signature: OpeningSignature,
): Promise<GrouperOpeningRow[]> {
  const q = query(
    collection(db, COLLECTIONS.FLOORPLAN_OPENINGS),
    where('companyId', '==', context.companyId),
    where('projectId', '==', context.projectId),
    where('floorplanId', '==', context.floorplanId),
    where('kind', '==', signature.kind),
  );

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
