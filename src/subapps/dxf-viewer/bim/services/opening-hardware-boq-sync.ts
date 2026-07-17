'use client';

/**
 * ADR-674 Φ C — Opening hardware → priced BOQ sync (σιδερικά take-off, Firestore I/O).
 *
 * An opening is NOT a single priced row: beyond its aggregated κούφωμα row
 * (OIK-5.01/5.02, owned by `opening-boq-sync.ts`) it emits N ADDITIVE «σιδερικά»
 * rows, one per purchasable hardware component, so the contractor gets each
 * piece as a costable line. This mirrors `stair-boq-sync.ts` EXACTLY (Revit
 * Material/Hardware Takeoff pattern): a fixed component universe + a dedicated
 * per-component resolver (`resolveOpeningHardwareMapping`), NOT the kind-table.
 *
 * Per-instance (like the stair), NOT signature-aggregated like the κούφωμα row:
 *   - `boq_bim_<openingId>_hw_lever`    — OIK-5.31, pcs
 *   - `boq_bim_<openingId>_hw_lockset`  — OIK-5.35, pcs
 *   - `boq_bim_<openingId>_hw_hinge`    — OIK-5.36, pcs (qty 3 on a single door)
 *   … one row per component the opening's kind carries.
 *
 * The quantity is the component's OWN count (Phase A `resolveOpeningHardwareSet`),
 * never `deriveAtoeQuantity`'s `pcs = 1` — three hinges are three pieces. The set
 * of components varies by kind, so EVERY sync iterates the full component universe
 * (Phase A SSoT) and lets the shared `syncManagedBoqRow` upsert the present ones
 * and delete-when-zero the absent ones — idempotent across a kind edit
 * (door → sliding-door removes the stale hinge/lockset rows) and correct for
 * hardware-less kinds (fixed/bay-window/overhead-door/revolving-door → all 0 →
 * nothing written).
 *
 * Contract (mirrors `stair-boq-sync`):
 *   - Deterministic IDs (idempotent upsert).
 *   - `source/sourceType: 'bim-auto'`, `sourceEntityType: 'opening'`.
 *   - `detached: true` rows are NEVER touched (user override).
 *   - Zero / absent component → orphan cleanup (delete instead of noise row).
 *   - `createdAt` preserved across updates.
 *   - Callers MUST `void` the returned promise — fire-and-forget.
 *
 * ADR-674 Φ C (no standalone ADR file yet — Phase A/B reference it by number).
 * @see ./stair-boq-sync.ts — the multi-row-per-entity pattern this mirrors
 * @see ../family-types/opening-hardware-set.ts — Phase A take-off SSoT
 */

import {
  resolveOpeningHardwareMapping,
  type AtoeMappingEntry,
  type OpeningHardwareBoqComponent,
} from '../config/bim-to-atoe-mapping';
import type { OpeningKind, OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import {
  HARDWARE_COMPONENT_LABEL_KEY,
  openingHasOperableHardware,
  resolveOpeningHardwareSet,
} from '../family-types/opening-hardware-set';
import { buildSingleEntityBoqRow } from './boq-base-row';
import { syncManagedBoqRow, deleteManagedBoqRow } from './boq-firestore-sync';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Minimal opening snapshot the hardware sync needs (params drive the set). */
export interface OpeningForHardwareBoq {
  readonly id: string;
  readonly kind: OpeningKind;
  readonly params: OpeningParams;
  /** Optional Family/Type params — forwarded to the Phase A material resolver. */
  readonly typeParams?: OpeningTypeParams | null;
}

export interface OpeningHardwareBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /**
   * ADR-395 Phase 1 (G7) — floor link. Stamped on every row as `linkedFloorId`
   * + `scope: 'floor'`; falls back to `scope: 'building'` / null when absent.
   */
  readonly floorId?: string;
}

/** One resolved priced hardware row (pure — no Firestore). */
export interface OpeningHardwareBoqRow {
  readonly id: string;
  readonly component: OpeningHardwareBoqComponent;
  /** The component's own piece count (3 hinges → 3), never a flat pcs=1. */
  readonly quantity: number;
  readonly mapping: AtoeMappingEntry;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * The full component universe (Phase A SSoT — NOT re-listed here). Every sync
 * iterates ALL of them so a kind change / hardware-less kind deletes stale rows
 * (mirror of the stair's fixed 3-component sweep).
 */
const ALL_HARDWARE_COMPONENTS: readonly OpeningHardwareBoqComponent[] =
  Object.keys(HARDWARE_COMPONENT_LABEL_KEY) as OpeningHardwareBoqComponent[];

// ============================================================================
// HELPERS
// ============================================================================

/** Deterministic BOQ row id for one opening-hardware component. */
export function openingHardwareBoqId(openingId: string, component: OpeningHardwareBoqComponent): string {
  return `boq_bim_${openingId}_hw_${component}`;
}

/**
 * Pure: the priced hardware rows an opening yields — one per component its kind
 * carries (empty for fixed/bay-window/overhead-door/revolving-door). The
 * quantity is the component's own count. This is the take-off the I/O upsert
 * writes; exposed for testing without a Firestore mock.
 */
export function buildOpeningHardwareBoqRows(opening: OpeningForHardwareBoq): readonly OpeningHardwareBoqRow[] {
  if (!openingHasOperableHardware(opening.kind)) return [];
  const items = resolveOpeningHardwareSet(opening.params, opening.typeParams);
  return items.map((item) => ({
    id: openingHardwareBoqId(opening.id, item.component),
    component: item.component,
    quantity: item.quantity,
    mapping: resolveOpeningHardwareMapping(item.component),
  }));
}

/** Quantity per component for THIS opening (absent components → 0 → delete). */
function hardwareQuantityByComponent(
  opening: OpeningForHardwareBoq,
): ReadonlyMap<OpeningHardwareBoqComponent, number> {
  const byComponent = new Map<OpeningHardwareBoqComponent, number>();
  for (const row of buildOpeningHardwareBoqRows(opening)) {
    byComponent.set(row.component, row.quantity);
  }
  return byComponent;
}

async function syncHardwareComponentRow(
  component: OpeningHardwareBoqComponent,
  quantity: number,
  opening: OpeningForHardwareBoq,
  context: OpeningHardwareBoqContext,
): Promise<void> {
  const id = openingHardwareBoqId(opening.id, component);
  await syncManagedBoqRow({
    id,
    quantity,
    buildPayload: (existingCreatedAt) =>
      buildSingleEntityBoqRow(
        id,
        context,
        opening.id,
        'opening',
        resolveOpeningHardwareMapping(component),
        quantity,
        existingCreatedAt,
      ),
    logLabel: 'OpeningHardwareBoqSync',
    logContext: { component },
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Upsert the priced hardware rows for an opening save/update. Idempotent: every
 * component in the universe is synced — present ones upserted with their count,
 * absent ones (kind changed / hardware-less) zero-deleted. `action` accepted for
 * caller-symmetry with the wall/opening/stair bridges (detach + createdAt logic
 * is action-agnostic here — same as `upsertStairBoq`).
 */
export async function upsertOpeningHardwareBoq(
  opening: OpeningForHardwareBoq,
  context: OpeningHardwareBoqContext,
  _action: 'created' | 'updated',
): Promise<void> {
  if (!context.companyId || !context.projectId || !context.buildingId) return;

  const byComponent = hardwareQuantityByComponent(opening);
  await Promise.all(
    ALL_HARDWARE_COMPONENTS.map((component) =>
      syncHardwareComponentRow(component, byComponent.get(component) ?? 0, opening, context),
    ),
  );
}

/** Delete every hardware row when an opening is deleted (skip detached). */
export async function deleteOpeningHardwareBoq(openingId: string): Promise<void> {
  await Promise.all(
    ALL_HARDWARE_COMPONENTS.map((component) =>
      deleteManagedBoqRow(openingHardwareBoqId(openingId, component), 'OpeningHardwareBoqSync', {
        openingId,
        component,
      }),
    ),
  );
}
