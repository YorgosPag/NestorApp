'use client';

/**
 * ADR-456 Slice 2b — Structural Settings Service.
 *
 * Persists building-level `StructuralSettings` στο `buildings/{buildingId}`
 * doc μέσω του υπάρχοντος `updateBuildingWithPolicy` gateway (Admin SDK,
 * tenant-isolated, version-checked) — sibling του ADR-451 foundation datum.
 * Κανένα direct Firestore SDK call.
 *
 * @see ../bim/structural/structural-settings.ts
 */

import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import type { StructuralSettings } from '../bim/structural/structural-settings';

/**
 * Persist τις δομοστατικές ρυθμίσεις για το δοθέν κτίριο.
 * Fire-and-forget safe: οι callers μπορούν να παραλείψουν το await σε debounced
 * paths.
 */
export async function saveStructuralSettings(
  buildingId: string,
  settings: StructuralSettings,
): Promise<void> {
  await updateBuildingWithPolicy({
    buildingId,
    updates: { structuralSettings: settings },
  });
}
