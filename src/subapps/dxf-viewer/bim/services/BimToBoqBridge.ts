'use client';

/**
 * BIM → BOQ Auto-Feed Bridge (ADR-363 Phase 6 + 6.1 multi-layer)
 *
 * Fire-and-forget Firestore service: όταν ένα BIM entity αποθηκεύεται /
 * διαγράφεται, δημιουργείται / ενημερώνεται / αφαιρείται το αντίστοιχο
 * BOQ row με σωστή ΑΤΟΕ category + auto-derived quantity (m²/m³/pcs).
 *
 * **Phase 6 single-entry** (default): ένα BoqItem ανά entity με deterministic
 * id `boq_bim_${entity.id}`.
 *
 * **Phase 6.1 multi-layer DNA** (walls μόνο, όταν `params.dna.layers.length > 1`):
 *   - 1 parent summary row `boq_bim_${entity.id}` (isGroupParent=true)
 *   - N child rows `boq_bim_${entity.id}_layer_${layerId}` (per WallDna layer)
 *   Per-layer detach guard ανεξάρτητο ανά row. Industry pattern: Revit Material
 *   Takeoff / ArchiCAD Interactive Schedule (6/6 σύγκλιση, SPEC-3D-004D §12 Q4).
 *
 * Contract:
 *   - Deterministic IDs (idempotent upsert).
 *   - `source: 'bim-auto'`, `sourceType: 'bim-auto'` σε κάθε BIM-generated row.
 *   - `detached: true` rows ΔΕΝ overwriteάρονται από update (user override).
 *   - Callers MUST `void` το returned promise — fire-and-forget audit pattern.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see .ssot-registry.json (module: bim-to-boq-bridge, Tier 3)
 */

import { doc, getDoc, getDocs, query, setDoc, where, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { BOQItem } from '@/types/boq';
import {
  resolveAtoeMapping,
  deriveAtoeQuantity,
  type AtoeMappingEntry,
  type BimEntityType,
} from '../config/bim-to-atoe-mapping';
import type { WallDna } from '../types/wall-dna-types';
import {
  buildMultiLayerBoqPayloads,
  layerChildBoqId,
  parentBoqId,
  type BuiltBoqRow,
  type ExistingCreatedAtMap,
} from './boq-multi-layer-builder';
import {
  buildFinishBoqPayloads,
  finishChildBoqIds,
  hasFinishContribution,
  type FinishBoqContribution,
} from './structural-finish-boq';
import { isFrozenBaselineStatus } from '@/types/boq/units';
import { buildSingleEntityBoqRow } from './boq-base-row';
import { deleteManagedBoqRow, recordBaselineDrift } from './boq-firestore-sync';

const logger = createModuleLogger('BimToBoqBridge');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Minimal BIM entity snapshot passed στο bridge. */
export interface BimEntityForBoq {
  readonly id: string;
  readonly kind: string;
  /**
   * Για walls: `params.category` + optional `params.dna` (Phase 6.1 multi-layer).
   * `dna` is `unknown` here on purpose — bridge narrows at runtime με
   * `isMultiLayerWall()`. Keeps consumer callsites free από strict imports
   * του `WallDna` type (avoid cyclic imports + back-compat με existing
   * `params as unknown as {...}` casts στα persistence hooks).
   */
  readonly params?: Readonly<{
    category?: string;
    [key: string]: unknown;
  }>;
  // ADR-407 — `lengthM` carries the running length for path-length entities
  // (railings → ΑΤΟΕ unit 'm'); area/volume cover surface/solid entities.
  readonly geometry?: Readonly<{ area?: number; volume?: number; lengthM?: number }>;
  /**
   * ADR-449 — Καθαρό derived contribution σοβά (κολόνα/δοκάρι). Όταν υπάρχει ΚΑΙ
   * έχει θετικό εμβαδό, το bridge παράγει parent (στατικός πυρήνας) + finish
   * children (interior/exterior σοβάς) αντί single-entry. Υπολογίζεται upstream
   * στο `column-boq-feed` (έχει πρόσβαση στη σκηνή για ανάλυση γειτνίασης).
   */
  readonly finishContribution?: FinishBoqContribution;
}

export interface BimBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /**
   * ADR-395 Phase 1 (G7) — floor link. Stamped on the BOQ row as
   * `linkedFloorId` + `scope: 'floor'` so the building Επιμετρήσεις tab can
   * group BIM quantities per floor. Resolved upstream από `floorId` (import
   * destination) ή `Level.buildingId` chain. Όταν λείπει → `scope: 'building'`,
   * `linkedFloorId: null` (back-compat).
   */
  readonly floorId?: string;
  /**
   * ADR-376 Phase B.2 — opening signature group scope. Required όταν το
   * entityType είναι `'opening'` (per-floorplan aggregation). Ignored από
   * το wall/slab/column/beam single-entry + multi-layer path.
   */
  readonly floorplanId?: string;
}

// ============================================================================
// HELPERS — single-entry path
// ============================================================================

function buildSingleEntryPayload(
  deterministicId: string,
  entityType: BimEntityType,
  entity: BimEntityForBoq,
  context: BimBoqContext,
  mapping: AtoeMappingEntry,
  existingCreatedAt: string | null,
): Record<string, unknown> {
  const quantity = deriveAtoeQuantity(mapping.unit, entity.geometry);
  return buildSingleEntityBoqRow(deterministicId, context, entity.id, entityType, mapping, quantity, existingCreatedAt);
}

// ============================================================================
// HELPERS — multi-layer path
// ============================================================================

function isMultiLayerWall(entityType: BimEntityType, entity: BimEntityForBoq): entity is BimEntityForBoq & {
  params: { dna: WallDna; category?: string };
} {
  if (entityType !== 'wall') return false;
  const dna = entity.params?.dna as WallDna | undefined;
  return !!dna && Array.isArray(dna.layers) && dna.layers.length > 1;
}

interface RowFetchResult {
  readonly exists: boolean;
  readonly detached: boolean;
  readonly createdAt: string | null;
  /** ADR-674 — πλήρες existing doc data (μόνο όταν `exists`), για frozen-baseline drift. */
  readonly raw?: Record<string, unknown>;
}

async function fetchRowStates(
  ids: readonly string[],
): Promise<Map<string, RowFetchResult>> {
  const result = new Map<string, RowFetchResult>();
  const snaps = await Promise.all(
    ids.map((id) => getDoc(doc(db, COLLECTIONS.BOQ_ITEMS, id)).catch(() => null)),
  );
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!;
    const snap = snaps[i];
    if (!snap) {
      result.set(id, { exists: false, detached: false, createdAt: null });
      continue;
    }
    if (!snap.exists()) {
      result.set(id, { exists: false, detached: false, createdAt: null });
      continue;
    }
    const data = snap.data() as Record<string, unknown>;
    result.set(id, {
      exists: true,
      detached: data.detached === true,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      raw: data,
    });
  }
  return result;
}

function buildExistingCreatedAtMap(states: ReadonlyMap<string, RowFetchResult>): ExistingCreatedAtMap {
  const map = new Map<string, string | null>();
  for (const [id, state] of states) {
    map.set(id, state.createdAt);
  }
  return map;
}

async function upsertBoqRow(
  row: BuiltBoqRow,
  state: RowFetchResult,
  action: 'created' | 'updated',
): Promise<void> {
  if (action === 'updated' && state.detached) return;
  // ADR-674 — frozen-baseline guard: υπογεγραμμένο row (status ∉ draft/submitted)
  // ΠΟΤΕ δεν overwriteάρεται· καταγράφουμε μόνο την απόκλιση του live μοντέλου.
  if (state.exists && state.raw && isFrozenBaselineStatus(state.raw.status)) {
    const live = typeof row.payload.estimatedQuantity === 'number' ? row.payload.estimatedQuantity : 0;
    await recordBaselineDrift(doc(db, COLLECTIONS.BOQ_ITEMS, row.id), state.raw, live, 'BimToBoqBridge');
    return;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.BOQ_ITEMS, row.id), row.payload);
  } catch (err) {
    logger.error('BimToBoqBridge: row upsert failed', { rowId: row.id, err });
  }
}

const NO_ROW_STATE: RowFetchResult = { exists: false, detached: false, createdAt: null };

/**
 * Resolve the ATOE mapping for an entity, narrowing the index-typed
 * `sectionKind` (ADR-363 Φ2 beam-steel discriminator) + `classification`
 * (ADR-408 MEP pipe plumbing) params to `string`. Shared prologue of the
 * single-entry + finish upsert paths.
 */
function resolveEntityAtoeMapping(
  entityType: BimEntityType,
  entity: BimEntityForBoq,
): AtoeMappingEntry | undefined {
  const category = entity.params?.category;
  const rawSectionKind = entity.params?.['sectionKind'];
  const sectionKind = typeof rawSectionKind === 'string' ? rawSectionKind : undefined;
  const rawClassification = entity.params?.['classification'];
  const classification = typeof rawClassification === 'string' ? rawClassification : undefined;
  return resolveAtoeMapping(entityType, entity.kind, category, sectionKind, classification) ?? undefined;
}

/**
 * Upsert a group parent + its per-layer/finish children, each with its own
 * detach guard via the pre-fetched `states` map. Shared tail of the
 * multi-layer-wall and finish paths.
 */
async function upsertRowGroup(
  parent: BuiltBoqRow,
  children: readonly BuiltBoqRow[],
  states: ReadonlyMap<string, RowFetchResult>,
  action: 'created' | 'updated',
): Promise<void> {
  await upsertBoqRow(parent, states.get(parent.id) ?? NO_ROW_STATE, action);
  await Promise.all(
    children.map((child) => upsertBoqRow(child, states.get(child.id) ?? NO_ROW_STATE, action)),
  );
}

// ============================================================================
// BRIDGE CLASS
// ============================================================================

class BimToBoqBridgeImpl {

  /**
   * Upsert BOQ item(s) από BIM entity save. Multi-layer walls δημιουργούν
   * 1 parent + N children· τα υπόλοιπα entities (ή walls χωρίς DNA) πάνε
   * single-entry path.
   *
   * **Openings ΔΕΝ περνούν από εδώ μετά το ADR-376 Phase B.2.** Καλέστε
   * `upsertOpeningGroupForOpening()` από `opening-boq-sync.ts` direct —
   * single-entry per-opening rows αντικαταστάθηκαν από signature-group
   * aggregation (Revit Schedule pattern, 6/6 industry). Αν entityType ===
   * 'opening' εδώ → warn + skip για να μην δημιουργούνται ξανά legacy
   * `boq_bim_<openingId>` rows.
   *
   * Detach guard ανά row (parent + κάθε child ξεχωριστά).
   */
  async upsertBoqItemForBim(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    if (!context.companyId || !context.projectId || !context.buildingId) return;

    if (entityType === 'opening') {
      logger.warn(
        'BimToBoqBridge.upsertBoqItemForBim called with opening — use upsertOpeningGroupForOpening από opening-boq-sync.ts instead (ADR-376 Phase B.2)',
        { entityId: entity.id },
      );
      return;
    }

    if (isMultiLayerWall(entityType, entity)) {
      await this.upsertMultiLayerWall(entity, context, action);
      return;
    }

    if (hasFinishContribution(entity.finishContribution)) {
      await this.upsertWithFinish(entityType, entity, context, action);
      return;
    }

    await this.upsertSingleEntry(entityType, entity, context, action);
  }

  /**
   * ADR-449 — parent (στατικός πυρήνας, π.χ. column OIK-2.03 m³) + finish children
   * (interior Knauf OIK-4.01 m² / exterior σοβάς OIK-4.03 m²). Mirror του
   * `upsertMultiLayerWall`: ένα combined fetch των states (detach guard + createdAt
   * preservation), per-row upsert. Ο πυρήνας ΔΕΝ αλλάζει — ο σοβάς είναι additive.
   */
  private async upsertWithFinish(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    const coreMapping = resolveEntityAtoeMapping(entityType, entity);
    if (!coreMapping) return;
    const finish = entity.finishContribution;
    if (!hasFinishContribution(finish)) return;

    const coreQuantity = deriveAtoeQuantity(coreMapping.unit, entity.geometry);
    // ADR-449 PART B — υποψήφια ids = parent + ένα child ανά υλικό (group-by-material).
    const candidateIds = [parentBoqId(entity.id), ...finishChildBoqIds(entity.id, finish)];
    const states = await fetchRowStates(candidateIds);
    const existingCreatedAt = buildExistingCreatedAtMap(states);

    const { parent, children } = buildFinishBoqPayloads(
      { entityId: entity.id, entityType, coreMapping, coreQuantity, finish, context },
      existingCreatedAt,
    );

    await upsertRowGroup(parent, children, states, action);
  }

  private async upsertSingleEntry(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    const mapping = resolveEntityAtoeMapping(entityType, entity);
    if (!mapping) return;

    const deterministicId = parentBoqId(entity.id);
    const ref = doc(db, COLLECTIONS.BOQ_ITEMS, deterministicId);

    const snap = await getDoc(ref).catch(() => null);
    if (snap === null) return;

    if (snap.exists()) {
      const existing = snap.data() as Record<string, unknown>;
      if (action === 'updated' && existing.detached === true) return;
      // ADR-674 — frozen-baseline guard: υπογεγραμμένο row (status ∉ draft/submitted)
      // ΠΟΤΕ δεν overwriteάρεται· καταγράφουμε μόνο την απόκλιση του live μοντέλου.
      if (isFrozenBaselineStatus(existing.status)) {
        const live = deriveAtoeQuantity(mapping.unit, entity.geometry);
        await recordBaselineDrift(ref, existing, live, 'BimToBoqBridge');
        return;
      }
    }

    const existingCreatedAt = snap.exists()
      ? (snap.data() as Record<string, unknown>).createdAt as string ?? null
      : null;
    const payload = buildSingleEntryPayload(deterministicId, entityType, entity, context, mapping, existingCreatedAt);

    try {
      await setDoc(ref, payload);
    } catch (err) {
      logger.error('BimToBoqBridge: upsert failed', { entityId: entity.id, entityType, err });
    }
  }

  private async upsertMultiLayerWall(
    entity: BimEntityForBoq & { params: { dna: WallDna; category?: string } },
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    const category = entity.params.category;
    const parentMapping = resolveAtoeMapping('wall', entity.kind, category);
    if (!parentMapping) return;

    const wallNetArea = entity.geometry?.area ?? 0;
    const dna = entity.params.dna;

    // Pre-collect all candidate IDs (parent + every layer child) and fetch
    // existing states ONCE — combined detach check + createdAt preservation.
    const candidateIds: string[] = [parentBoqId(entity.id)];
    for (const layer of dna.layers) {
      candidateIds.push(layerChildBoqId(entity.id, layer.id));
    }
    const states = await fetchRowStates(candidateIds);
    const existingCreatedAt = buildExistingCreatedAtMap(states);

    const { parent, children } = buildMultiLayerBoqPayloads(
      {
        entityId: entity.id,
        entityType: 'wall',
        dna,
        wallNetArea,
        parentMapping,
        context,
      },
      existingCreatedAt,
    );

    await upsertRowGroup(parent, children, states, action);
  }

  /**
   * Διαγραφή BOQ row(s) όταν διαγράφεται BIM entity.
   * Cascades σε όλα τα child layer rows. Skip detached items (user override).
   */
  async deleteBoqItemForBim(entityId: string, companyId: string): Promise<void> {
    const parentId = parentBoqId(entityId);

    // Find every child row anchored σε αυτό το entity (multi-layer cascade).
    // Query by parentBoqItemId === parentId — Phase 6.1 children καρφώνουν αυτό
    // το pointer, single-entry rows δεν έχουν children.
    let childIds: string[] = [];
    try {
      const q = query(
        collection(db, COLLECTIONS.BOQ_ITEMS),
        where('companyId', '==', companyId),
        where('parentBoqItemId', '==', parentId),
      );
      const snap = await getDocs(q);
      childIds = snap.docs.map((d) => d.id);
    } catch (err) {
      // Non-fatal: cascade query failure means children stay orphaned (manual
      // cleanup possible via "Re-sync BOQ" Phase 6.2+ recovery action).
      logger.error('BimToBoqBridge: cascade query failed', { entityId, err });
    }

    const allIds = [parentId, ...childIds];
    await Promise.all(allIds.map((id) => deleteManagedBoqRow(id, 'BimToBoqBridge')));
  }

  /** Look up the BOQ summary item που δημιουργήθηκε για ένα BIM entity (read-only). */
  async getBoqItemBySourceEntity(entityId: string): Promise<BOQItem | null> {
    const deterministicId = parentBoqId(entityId);
    const ref = doc(db, COLLECTIONS.BOQ_ITEMS, deterministicId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() as Record<string, unknown>;
      return { id: deterministicId, ...data } as BOQItem;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const bimToBoqBridge = new BimToBoqBridgeImpl();
