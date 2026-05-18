'use client';

/**
 * BIM → BOQ Auto-Feed Bridge (ADR-363 Phase 6)
 *
 * Fire-and-forget Firestore service: when a BIM entity is saved/deleted it
 * creates/updates/removes a corresponding BOQ item with the correct ΑΤΟΕ
 * category and auto-derived quantity (m²/m³/pcs).
 *
 * Contract:
 *   - Deterministic ID: `boq_bim_${entity.id}` — idempotent upsert, no duplicates.
 *   - `source: 'bim-auto'`, `sourceType: 'bim-auto'` on every BIM-generated item.
 *   - `detached: true` items are NEVER overwritten — user has taken manual control.
 *   - Callers MUST `void` the returned promise — audit-pattern fire-and-forget.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see .ssot-registry.json (module: bim-to-boq-bridge, Tier 3)
 */

import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { BOQItem } from '@/types/boq';
import {
  resolveAtoeMapping,
  type AtoeMappingEntry,
  type BimEntityType,
} from '../config/bim-to-atoe-mapping';

const logger = createModuleLogger('BimToBoqBridge');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Minimal BIM entity snapshot passed to the bridge. */
export interface BimEntityForBoq {
  readonly id: string;
  readonly kind: string;
  /** For walls: params.category must be present to resolve ΑΤΟΕ mapping. */
  readonly params?: Readonly<{ category?: string; [key: string]: unknown }>;
  readonly geometry?: Readonly<{ area?: number; volume?: number }>;
}

export interface BimBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function deriveQuantity(unit: string, geometry?: BimEntityForBoq['geometry']): number {
  if (unit === 'pcs') return 1;
  if (unit === 'm2') return geometry?.area ?? 0;
  if (unit === 'm3') return geometry?.volume ?? 0;
  return 0;
}

function buildBoqPayload(
  deterministicId: string,
  entityType: BimEntityType,
  entity: BimEntityForBoq,
  context: BimBoqContext,
  mapping: AtoeMappingEntry,
  existingCreatedAt: string | null,
): Record<string, unknown> {
  const now = nowISO();
  const quantity = deriveQuantity(mapping.unit, entity.geometry);
  const payload: BOQItem = {
    id: deterministicId,
    companyId: context.companyId,
    projectId: context.projectId,
    buildingId: context.buildingId,
    scope: 'building',
    linkedFloorId: null,
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
    sourceEntityId: entity.id,
    sourceEntityType: entityType,
    detached: null,
  };
  return stripUndefinedDeep(payload as unknown as Record<string, unknown>);
}

// ============================================================================
// BRIDGE CLASS
// ============================================================================

class BimToBoqBridgeImpl {

  /**
   * Upsert a BOQ item from a BIM entity save.
   * Skips if the existing item is detached (user override).
   * One Firestore read (combined detach check + createdAt preservation).
   */
  async upsertBoqItemForBim(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    if (!context.companyId || !context.projectId || !context.buildingId) return;

    const category = entity.params?.category;
    const mapping = resolveAtoeMapping(entityType, entity.kind, category);
    if (!mapping) return;

    const deterministicId = `boq_bim_${entity.id}`;
    const ref = doc(db, COLLECTIONS.BOQ_ITEMS, deterministicId);

    // Single read: covers detach guard + createdAt preservation
    const snap = await getDoc(ref).catch(() => null);
    if (snap === null) return; // Firestore unavailable

    if (snap.exists()) {
      const existing = snap.data() as Record<string, unknown>;
      if (action === 'updated' && existing.detached === true) return;
    }

    const existingCreatedAt = snap.exists()
      ? (snap.data() as Record<string, unknown>).createdAt as string ?? null
      : null;
    const payload = buildBoqPayload(deterministicId, entityType, entity, context, mapping, existingCreatedAt);

    try {
      await setDoc(ref, payload);
    } catch (err) {
      logger.error('BimToBoqBridge: upsert failed', { entityId: entity.id, entityType, err });
    }
  }

  /**
   * Delete the BOQ item when its source BIM entity is deleted.
   * Skips if item is detached (user has taken ownership).
   */
  async deleteBoqItemForBim(entityId: string): Promise<void> {
    const deterministicId = `boq_bim_${entityId}`;
    const ref = doc(db, COLLECTIONS.BOQ_ITEMS, deterministicId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      if ((snap.data() as Record<string, unknown>).detached === true) return;
      await deleteDoc(ref);
    } catch (err) {
      logger.error('BimToBoqBridge: delete failed', { entityId, err });
    }
  }

  /** Look up the BOQ item generated for a given BIM entity (read-only). */
  async getBoqItemBySourceEntity(entityId: string): Promise<BOQItem | null> {
    const deterministicId = `boq_bim_${entityId}`;
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
