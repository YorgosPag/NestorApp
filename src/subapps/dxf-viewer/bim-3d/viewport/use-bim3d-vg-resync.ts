"use client";

import { useEffect, type RefObject } from 'react';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { type Bim3DEntities, EMPTY_BIM_ENTITIES, useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { subscribeEnvelopeSpec } from '../../bim/stores/envelope-spec-store';
import { subscribeEnvelopeFloorSlabs } from '../../bim/stores/envelope-floor-slabs-store';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { resyncBimScene } from '../scene/bim3d-resync';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

// Re-exported for backward compatibility (canonical home: Bim3DEntitiesStore).
export { EMPTY_BIM_ENTITIES };

// ADR-375 Phase C.4 v2.6 — V/G category visibility re-sync wiring.
// BimSceneLayer.sync() filters hidden categories at scene-build time, but
// toggling visibility in the V/G panel must trigger a rebuild. The entities
// store subscription only fires on entity changes, so a dedicated subscription
// on objectStyles re-issues syncBimEntities with the current entity snapshot
// whenever any category toggle, color, or pattern mutates.
export function useBim3DVgResync(
  managerRef: RefObject<ThreeJsSceneManager | null>,
  externalEntitiesMode: boolean,
  bimEntities: Bim3DEntities | null | undefined,
): void {
  useEffect(() => {
    // Re-issue the scene rebuild με το τρέχον snapshot. ADR-399: scope-aware SSoT
    // — single-floor (active level) ή multi-floor (stacked building) ανάλογα με
    // το `floor3DScope`, χωρίς διπλότυπη syncBimEntities λογική εδώ.
    const resync = (): void => {
      resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
    };

    // (a) V/G category visibility / color / pattern toggles (ADR-375 C.4 v2.6).
    let prevObjectStyles = useBimRenderSettingsStore.getState().objectStyles;
    const unsubVg = useBimRenderSettingsStore.subscribe((state) => {
      if (state.objectStyles === prevObjectStyles) return;
      prevObjectStyles = state.objectStyles;
      resync();
    });

    // (b) ADR-396 P6 — Thermal envelope spec authoring (command «Εφαρμογή»).
    // BimSceneLayer.syncEnvelope διαβάζει το per-level spec· όταν ο χρήστης
    // εφαρμόσει/αλλάξει θερμοπρόσοψη, rebuild για 2D⟷3D parity.
    const unsubEnvelope = subscribeEnvelopeSpec(resync);

    // (c) ADR-396 v2 Φ5C — cross-floor slab snapshot (αίθριο vs δωμάτιο). Όταν
    // αλλάζει ο όροφος/οι πλάκες ψηλότερων ορόφων, το Z1 κέλυφος μπορεί να αλλάξει
    // (τρύπα γίνεται αίθριο→μονώνεται γύρω) → rebuild για 2D⟷3D parity.
    const unsubFloorSlabs = subscribeEnvelopeFloorSlabs(resync);

    // (d) ADR-408 Φ5 — colour-by-system: when circuits change (create / assign /
    // dissolve), rebuild so the fixture/panel meshes pick up the System colour.
    let prevSystems = useMepSystemStore.getState().systems;
    const unsubSystems = useMepSystemStore.subscribe((state) => {
      if (state.systems === prevSystems) return;
      prevSystems = state.systems;
      resync();
    });

    // (e) ADR-413 — PBR textures load async; when a texture set finishes loading
    // the cache bumps `textureAssetVersion`, so rebuild to swap the flat material
    // for the textured variant. Mode-agnostic (this hook runs in both the store
    // and external-entities feeds), so it covers the read-only overlay too.
    let prevTexV = useBim3DEntitiesStore.getState().textureAssetVersion;
    const unsubTextures = useBim3DEntitiesStore.subscribe((state) => {
      if (state.textureAssetVersion === prevTexV) return;
      prevTexV = state.textureAssetVersion;
      resync();
    });

    return () => {
      unsubVg();
      unsubEnvelope();
      unsubFloorSlabs();
      unsubSystems();
      unsubTextures();
    };
  }, [managerRef, externalEntitiesMode, bimEntities]);
}
