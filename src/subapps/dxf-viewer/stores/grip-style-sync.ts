/**
 * @file grip-style-sync.ts
 * @description 🏢 SSoT — the ONE writer mapping `GripSettings` → `gripStyleStore`.
 *
 * Before this, the full `gripStyleStore.set({ enabled, colors, gripSize, ... })`
 * mapping block was copy-pasted in **4 places**:
 *   - `GripProvider` mount effect
 *   - `GripProvider` updateGripSettings — central (enterprise) path
 *   - `GripProvider` updateGripSettings — local fallback path
 *   - `StyleManagerProvider.syncGripStore`
 * and the StyleManager copy wrote only a 7-field SUBSET (dropped dpiScale,
 * showMidpoints/Centers/Quadrants, showAperture, multiGripEdit, snapToGrips,
 * showGripTips, maxGripsPerEntity, and forced opacity=1.0). That partial write
 * was a latent SSoT hazard: whichever path ran last could silently stomp the
 * advanced fields. This single mapper writes the FULL state from one place;
 * every writer now delegates here.
 *
 * Note: this is distinct from `settings/sync/storeSync.ts`, which maps
 * `GripSettings → GripStylePort` (size + colors only, the hexagonal port path).
 */

import { gripStyleStore } from './GripStyleStore';
import type { GripSettings } from '../types/gripSettings';

/**
 * Push the full effective grip settings into the legacy `gripStyleStore`.
 * Idempotent: calling twice with equal settings yields the same store state.
 */
export function syncGripStyleStoreFromSettings(settings: GripSettings): void {
  gripStyleStore.set({
    enabled: settings.showGrips,
    colors: settings.colors,
    gripSize: settings.gripSize,
    pickBoxSize: settings.pickBoxSize,
    apertureSize: settings.apertureSize,
    showGrips: settings.showGrips,
    opacity: settings.opacity || 1.0,
    showAperture: settings.showAperture,
    multiGripEdit: settings.multiGripEdit,
    snapToGrips: settings.snapToGrips,
    showGripTips: settings.showGripTips,
    dpiScale: settings.dpiScale ?? 1.0,
    showMidpoints: settings.showMidpoints,
    showCenters: settings.showCenters,
    showQuadrants: settings.showQuadrants,
    maxGripsPerEntity: settings.maxGripsPerEntity,
    gripObjLimit: settings.gripObjLimit,
  });
}
