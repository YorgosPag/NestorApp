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

import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { BOQItem } from '@/types/boq';
import {
  resolveStairComponentMapping,
  type AtoeMappingEntry,
  type StairBoqComponent,
} from '../config/bim-to-atoe-mapping';
import type { StairKind, StairParams } from '../types/stair-types';
import { computeStairBoqQuantities } from '../stairs/stair-boq-quantities';
import { resolveEffectiveStairParams } from '../geometry/stairs/stair-effective-params';
import type { HostFootprintInput } from '../geometry/wall-host-plan-builder';

const logger = createModuleLogger('StairBoqSync');

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
  const now = nowISO();
  const payload: BOQItem = {
    id,
    companyId: context.companyId,
    projectId: context.projectId,
    buildingId: context.buildingId,
    scope: context.floorId ? 'floor' : 'building',
    linkedFloorId: context.floorId ?? null,
    linkedUnitId: null,
    linkedUnitIds: null,
    costAllocationMethod: 'by_area',
    customAllocations: null,
    categoryCode: mapping.categoryCode,
    subCategoryCode: null,
    title: mapping.titleEL,
    description: null,
    unit: mapping.unit,
    estimatedQuantity: quantity,
    actualQuantity: null,
    wasteFactor: 0,
    wastePolicy: 'inherited',
    materialUnitCost: 0,
    laborUnitCost: 0,
    equipmentUnitCost: 0,
    priceAuthority: 'master',
    linkedPhaseId: null,
    linkedTaskId: null,
    linkedInvoiceId: null,
    linkedContractorId: null,
    source: 'bim-auto',
    measurementMethod: 'bim',
    status: 'draft',
    qaStatus: 'pending',
    notes: null,
    createdBy: null,
    approvedBy: null,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    sourceType: 'bim-auto',
    sourceEntityId: stair.id,
    sourceEntityType: 'stair',
    detached: null,
    parentBoqItemId: null,
    isGroupParent: null,
    layerIndex: null,
    materialId: null,
  };
  return stripUndefinedDeep(payload as unknown as Record<string, unknown>);
}

async function syncComponentRow(
  component: StairBoqComponent,
  quantity: number,
  stair: StairForBoq,
  context: StairBoqContext,
): Promise<void> {
  const id = stairComponentBoqId(stair.id, component);
  const ref = doc(db, COLLECTIONS.BOQ_ITEMS, id);

  const snap = await getDoc(ref).catch(() => null);
  if (snap === null) return;

  // Detach guard: a user-owned row is never auto-touched (no overwrite, no
  // zero-delete).
  if (snap.exists() && (snap.data() as Record<string, unknown>).detached === true) return;

  if (quantity <= 0) {
    if (snap.exists()) {
      try {
        await deleteDoc(ref);
      } catch (err) {
        logger.error('StairBoqSync: zero-quantity delete failed', { rowId: id, err });
      }
    }
    return;
  }

  const existingCreatedAt = snap.exists()
    ? ((snap.data() as Record<string, unknown>).createdAt as string | undefined) ?? null
    : null;
  const mapping = resolveStairComponentMapping(component);
  const payload = buildStairComponentPayload(id, stair, context, mapping, quantity, existingCreatedAt);

  try {
    await setDoc(ref, payload);
  } catch (err) {
    logger.error('StairBoqSync: component upsert failed', { rowId: id, component, err });
  }
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
  const byComponent: Readonly<Record<StairBoqComponent, number>> = {
    concrete: q.concreteVolumeM3,
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
    STAIR_COMPONENTS.map(async (component) => {
      const ref = doc(db, COLLECTIONS.BOQ_ITEMS, stairComponentBoqId(stairId, component));
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        if ((snap.data() as Record<string, unknown>).detached === true) return;
        await deleteDoc(ref);
      } catch (err) {
        logger.error('StairBoqSync: delete failed', { stairId, component, err });
      }
    }),
  );
}
