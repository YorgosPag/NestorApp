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
    // ADR-559 — `enabled` (grip-system master, AutoCAD GRIPS) and `showGrips` (visible on
    // selection) are DISTINCT schema fields; map each from its NAMESAKE. The renderer gate is
    // `!showGrips || !enabled`, so the «Εμφάνιση Χερουλιών» toggle (which writes `enabled`) now
    // takes effect. Before this, BOTH store fields read `settings.showGrips`, so the toggle was a
    // silent no-op (off → grips still painted).
    // 🛡️ ADR-559 hardening (2026-07-01) — a STALE/partial persisted settings blob (older schema,
    // before `enabled` was a distinct field) hydrates these as `undefined`. Since the gate hides on
    // `!enabled`/`!showGrips`, an undefined value would blank ALL grips (every entity, DXF + BIM)
    // until any settings write re-filled them. Default undefined → `true` at this single writer
    // boundary so a missing toggle can never suppress grips; an EXPLICIT `false` still hides.
    enabled: settings.enabled ?? true,
    colors: settings.colors,
    gripSize: settings.gripSize,
    pickBoxSize: settings.pickBoxSize,
    apertureSize: settings.apertureSize,
    showGrips: settings.showGrips ?? true,
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
