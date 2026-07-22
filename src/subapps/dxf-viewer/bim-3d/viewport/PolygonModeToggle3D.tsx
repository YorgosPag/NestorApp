"use client";

/**
 * PolygonModeToggle3D — ADR-539 (Cinema 4D material library) viewport host.
 *
 * Giorgio 2026-07-22: το κάτω πάνελ υλικών (`PolygonMaterialPanel`) είναι πλέον **ΠΑΝΤΑ ορατό**
 * στον 3D κάμβα — μπαίνεις στο 3D και τα υλικά είναι αμέσως εκεί, χωρίς να επιλέξεις οντότητα ή να
 * πατήσεις κουμπί «Όψεις» (το κουμπί αφαιρέθηκε). Ο τρόπος βαφής (ΣΩΜΑ/ΣΟΒΑΣ/ΠΟΛΥΓΩΝΑ) δηλώνεται
 * μέσα στο ίδιο το panel.
 *
 * Αυτός ο host κρατά μόνο δύο ευθύνες γύρω από το panel:
 *   - faced render lifecycle: όταν μπαίνει/βγαίνει το per-face «ΠΟΛΥΓΩΝΑ» mode (`active`), ξαναχτίζει
 *     τη σκηνή ώστε τα solids να γίνουν faced (pickable per-face) ↔ legacy render·
 *   - reset του store στο unmount (κανένα stale mode στο επόμενο άνοιγμα του 3D).
 *
 * ADR-040: low-frequency leaf — subscribes only to the polygon store (user-triggered, not 60fps).
 *
 * @see ../stores/PolygonMode3DStore.ts
 * @see ../ui/PolygonMaterialPanel.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useEffect, type RefObject } from 'react';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { resyncBimScene } from '../scene/bim3d-resync';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { PolygonMaterialPanel } from '../ui/PolygonMaterialPanel';

export interface PolygonModeToggle3DProps {
  readonly managerRef: RefObject<ThreeJsSceneManager | null>;
  readonly externalEntitiesMode: boolean;
  readonly bimEntities: Bim3DEntities | null | undefined;
}

export function PolygonModeToggle3D({ managerRef, externalEntitiesMode, bimEntities }: PolygonModeToggle3DProps) {
  // Faced render lifecycle — rebuild ONLY when the per-face «ΠΟΛΥΓΩΝΑ» mode toggles (`active`). The
  // prev-guard skips the initial mount (BimViewport3D already does the first resync) and every other
  // store change (mode swap σώμα↔σοβάς, face selection), so entity-level modes never force a rebuild.
  useEffect(() => {
    return usePolygonMode3DStore.subscribe((s, prev) => {
      if (s.active === prev.active) return;
      if (!s.active) managerRef.current?.setSelectedFace(null, null);
      resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
    });
  }, [managerRef, externalEntitiesMode, bimEntities]);

  // Reset the store when the viewport unmounts (no stale mode on re-open).
  useEffect(() => () => { usePolygonMode3DStore.getState().reset(); }, []);

  // Per-face material library — ΠΑΝΤΑ ορατό (κάτω μπάρα, Cinema 4D Material Manager).
  return <PolygonMaterialPanel />;
}
