'use client';

/**
 * ADR-395 Phase 2 (G1) — Stair → BOQ sync (Firestore I/O).
 *
 * A stair is NOT a single-row entity: it produces THREE independent BOQ rows
 * (Revit Material Takeoff pattern) with deterministic ids so the Measurements
 * tab detach guard works per row:
 *   - `boq_bim_<stairId>_concrete` — OIK-2.05, m³ (RC structure types only)
 *   - `boq_bim_<stairId>_cladding` — OIK-5.05, m²
 *   - `boq_bim_<stairId>_handrail` — OIK-12.01, m
 *
 * Quantities are geometry-derived (`computeStairBoqQuantities`), mirroring the
 * wall/slab/column/beam path — the legacy `qto` field was removed
 * (ADR-395 §4.6 / G5). A component whose quantity resolves to 0 (e.g. handrail
 * on a stair with no rails, concrete on a steel-grating stair) is deleted
 * instead of written as a noise row — mirrors the opening signature-group
 * delete-when-empty contract.
 *
 * Contract (mirrors `BimToBoqBridge` + `opening-boq-sync`):
 *   - Deterministic IDs (idempotent upsert).
 *   - `source/sourceType: 'bim-auto'`, `sourceEntityType: 'stair'`.
 *   - `detached: true` rows are NEVER touched (user override) — neither
 *     overwritten nor zero-deleted.
 *   - `createdAt` preserved across updates.
 *   - Callers MUST `void` the returned promise — fire-and-forget.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-395-bim-quantities-building-measurements.md §4.1
 */

import {
  resolveStairComponentMapping,
  type AtoeMappingEntry,
  type StairBoqComponent,
} from '../config/bim-to-atoe-mapping';
import type { StairKind, StairParams } from '../types/stair-types';
import { computeStairBoqQuantities } from '../stairs/stair-boq-quantities';
import { resolveEffectiveStairParams } from '../geometry/stairs/stair-effective-params';
import type { HostFootprintInput } from '../geometry/wall-host-plan-builder';
import { buildSingleEntityBoqRow } from './boq-base-row';
import { syncManagedBoqRow, deleteManagedBoqRow } from './boq-firestore-sync';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Minimal stair snapshot the sync needs (params drive the quantities). */
export interface StairForBoq {
  readonly id: string;
  readonly kind: StairKind;
  readonly params: StairParams;
}

export interface StairBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /**
   * ADR-395 Phase 1 (G7) — floor link. Stamped on every row as
   * `linkedFloorId` + `scope: 'floor'` for per-floor grouping in the building
   * Επιμετρήσεις tab. Falls back to `scope: 'building'` / null when absent.
   */
  readonly floorId?: string;
  /**
   * ADR-401 Phase G.2 — host resolver (δοκάρια/πλάκες του ορόφου) ώστε οι ποσότητες
   * μιας `attached` σκάλας να βγαίνουν από τα **effective** params (re-step στο host),
   * ΙΔΙΑ SSoT με το 3D (`resolveEffectiveStairParams`). Revit-grade: schedule =
   * resolved μοντέλο. Απών → nominal params (μη-attached / no host context).
   */
  readonly resolveHostInput?: (id: string) => HostFootprintInput | null;
  /**
   * ADR-685 Φάση 1 (μέρος 3) — BOQ safety-guard: κοινός όγκος σκυροδέματος
   * σκάλας↔πλάκας βάσης (m³) προς αφαίρεση από τη γραμμή σκυροδέματος ΤΗΣ
   * ΣΚΑΛΑΣ. Η πλάκα βάσης κρατά τον πλήρη όγκο της (ένας ιδιοκτήτης — Revit
   * Join Geometry parity), οπότε ο κοινός στύλος σκυροδέματος αφαιρείται εδώ
   * ώστε να μη μετρηθεί διπλά. Clamp ≥0 στο `upsertStairBoq`. Απών/`0` → καμία
   * αφαίρεση (byte-for-byte το nominal concrete volume).
   */
  readonly embeddedOverlapVolumeM3?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STAIR_COMPONENTS: readonly StairBoqComponent[] = ['concrete', 'cladding', 'handrail'];

// ============================================================================
// HELPERS
// ============================================================================

/** Deterministic BOQ row id for one stair component. */
export function stairComponentBoqId(stairId: string, component: StairBoqComponent): string {
  return `boq_bim_${stairId}_${component}`;
}

function buildStairComponentPayload(
  id: string,
  stair: StairForBoq,
  context: StairBoqContext,
  mapping: AtoeMappingEntry,
  quantity: number,
  existingCreatedAt: string | null,
): Record<string, unknown> {
  return buildSingleEntityBoqRow(id, context, stair.id, 'stair', mapping, quantity, existingCreatedAt);
}

async function syncComponentRow(
  component: StairBoqComponent,
  quantity: number,
  stair: StairForBoq,
  context: StairBoqContext,
): Promise<void> {
  const id = stairComponentBoqId(stair.id, component);
  await syncManagedBoqRow({
    id,
    quantity,
    buildPayload: (existingCreatedAt) =>
      buildStairComponentPayload(
        id,
        stair,
        context,
        resolveStairComponentMapping(component),
        quantity,
        existingCreatedAt,
      ),
    logLabel: 'StairBoqSync',
    logContext: { component },
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Upsert the three component rows for a stair save/update. Idempotent.
 * `action` is accepted for caller-symmetry with the wall/opening bridges but
 * the per-row detach + createdAt logic is action-agnostic here.
 */
export async function upsertStairBoq(
  stair: StairForBoq,
  context: StairBoqContext,
  _action: 'created' | 'updated',
): Promise<void> {
  if (!context.companyId || !context.projectId || !context.buildingId) return;

  // ADR-401 Phase G.2 — profile-aware ποσότητες: όταν η σκάλα είναι `attached`, οι
  // ποσότητες βγαίνουν από τα effective params (re-step), ΙΔΙΑ SSoT γέφυρα με το 3D.
  // Μη-attached / χωρίς host resolver → identity (byte-for-byte τα nominal params).
  const { params: effectiveParams } = resolveEffectiveStairParams(stair.params, {
    resolveHostInput: context.resolveHostInput,
  });
  const q = computeStairBoqQuantities(effectiveParams);
  // ADR-685 Φ1 (μέρος 3) — BOQ safety-guard: αφαίρεσε το κοινό σκάλα↔πλάκα-βάσης
  // σκυρόδεμα από τη γραμμή ΤΗΣ ΣΚΑΛΑΣ (η πλάκα κρατά τον πλήρη όγκο, ένας
  // ιδιοκτήτης). Clamp ≥0 — μη-concrete σκάλες έχουν ήδη μηδενικό concrete volume,
  // ασφαλές να αφαιρεθεί 0.
  const concreteVolumeM3 = Math.max(
    0,
    q.concreteVolumeM3 - (context.embeddedOverlapVolumeM3 ?? 0),
  );
  const byComponent: Readonly<Record<StairBoqComponent, number>> = {
    concrete: concreteVolumeM3,
    cladding: q.treadCladdingAreaM2,
    handrail: q.handrailLinearM,
  };

  await Promise.all(
    STAIR_COMPONENTS.map((component) =>
      syncComponentRow(component, byComponent[component], stair, context),
    ),
  );
}

/** Delete all three component rows when a stair is deleted (skip detached). */
export async function deleteStairBoq(stairId: string): Promise<void> {
  await Promise.all(
    STAIR_COMPONENTS.map((component) =>
      deleteManagedBoqRow(stairComponentBoqId(stairId, component), 'StairBoqSync', {
        stairId,
        component,
      }),
    ),
  );
}
