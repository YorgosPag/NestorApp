/**
 * ADR-366 §A.3 Q3 Phase 7.0B — 2D Section Panel scene sync.
 *
 * Wires the standalone SectionPanelRenderer to Nestor stores:
 *   - useBim3DEntitiesStore → walls/columns/beams/slabs (source-of-truth feed)
 *   - useSelection3DStore   → selected bim id (highlight)
 *   - useSectionStore       → section enabled + planes/bounds
 *   - useSection2DPanelStore → activePlaneId selection (UI-driven)
 *
 * Read-on-call pattern: `syncScene()` pulls latest store state synchronously
 * και rebuilds. ADR-040 compliant: stores subscribed από το consumer panel
 * component (micro-leaf), εδώ μόνο `getState()` reads.
 *
 * Port από `C:\genarc\src\engines\viewport\sectionSceneSync.ts` (76 LOC,
 * PORT_WITH_ADAPTATION per SPEC-3D-004A §3.2) με:
 *   - GenArc useBuildingStore/useUiStore → Nestor 3-store fan-out
 *   - ConnectedSet pre-computation → full-floor scan (Phase 7.0B simple)
 *   - Adapter conversion μέσω toWallPlan/toColumnPlan/... helpers
 *
 * @see SPEC-3D-004A §3.2 — GenArc port reference
 * @see ADR-366 §A.3 Q3
 */

import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useSectionStore } from '../stores/SectionStore';
import { useSection2DPanelStore } from '../stores/Section2DPanelStore';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import {
  toWallPlan,
  toColumnPlan,
  toBeamPlan,
  toSlabPlan,
  type WallPlan,
} from './section-intersect';
import { buildSectionPanelScene, type SectionEntitiesInput } from './section-geometry';
import {
  buildWallHostInputs,
  makeResolveHost,
  makeResolveHostTopside,
} from '../../bim/geometry/wall-host-plan-builder';
import { deriveAvailablePlanes, type ActivePlane2D } from './active-plane-derivation';
import type { SectionPanelRenderer } from './section-renderer';

export interface SectionPanelSceneSync {
  readonly setRenderer: (r: SectionPanelRenderer | null) => void;
  /** Rebuild the section scene synchronously from current store state. */
  readonly syncScene: () => void;
  /** Frame-to-content reset (re-fit camera σε current bbox). */
  readonly resetView: () => void;
}

export function createSectionPanelSceneSync(): SectionPanelSceneSync {
  let renderer: SectionPanelRenderer | null = null;

  function buildEntitiesInput(): { entities: SectionEntitiesInput; walls: WallPlan[] } {
    const { walls, columns, beams, slabs, roofs } = useBim3DEntitiesStore.getState();
    // ADR-401 Phase B/(γ): host inputs (beams + slabs + roofs) → per-wall resolveHost
    // (κάτω-παρειά, top-attach) ΚΑΙ resolveHostTopside (άνω-παρειά, base-attach)
    // για σκαλωτή/κεκλιμένη κορυφή ΚΑΙ βάση σε `attached` τοίχους. Footprints +
    // wall axis στο ίδιο plan space (canvas units).
    const hostInputs = buildWallHostInputs(beams, slabs, roofs);
    // ADR-404 Phase 3 — section parity: το cut plane (mm πάνω από τη βάση ορόφου)
    // μετατοπίζει τα κεκλιμένα στοιχεία, ίδια προβολή με την 2Δ κάτοψη.
    const cutPlaneMm = useDrawingScaleStore.getState().viewRange.cutPlaneMm;
    const wallPlans = walls.map((w) => {
      const start = { x: w.params.start.x, y: w.params.start.y };
      const end = { x: w.params.end.x, y: w.params.end.y };
      return toWallPlan(
        w,
        0,
        makeResolveHost(start, end, hostInputs),
        makeResolveHostTopside(start, end, hostInputs),
        cutPlaneMm,
      );
    });
    return {
      entities: {
        walls: wallPlans,
        columns: columns.map((c) => toColumnPlan(c, 0, cutPlaneMm)),
        beams: beams.map((b) => toBeamPlan(b)),
        slabs: slabs.map((s) => toSlabPlan(s)),
        // Phase 7.0B: openings ΔΕΝ είναι στο Bim3DEntitiesStore feed.
        // Walls θα εμφανίζονται χωρίς opening cutouts μέχρι Phase 7.0C+.
        openings: [],
      },
      walls: wallPlans,
    };
  }

  function resolveActivePlane(): ActivePlane2D | null {
    const sectionState = useSectionStore.getState();
    if (!sectionState.enabled) return null;
    const available = deriveAvailablePlanes({
      mode: sectionState.mode,
      boxBounds: sectionState.boxBounds,
      planes: sectionState.planes,
    });
    if (available.length === 0) return null;
    const activeId = useSection2DPanelStore.getState().activePlaneId;
    return available.find((p) => p.id === activeId) ?? available[0];
  }

  return {
    setRenderer(r) {
      renderer = r;
    },

    syncScene() {
      if (!renderer) return;
      const plane = resolveActivePlane();
      if (!plane) return;
      const { entities } = buildEntitiesInput();
      const selectedBimIds = useSelection3DStore.getState().selectedBimIds;
      const sceneData = buildSectionPanelScene(
        { axis: plane.axis, position: plane.position },
        entities,
        selectedBimIds,
      );
      renderer.update(sceneData);
    },

    resetView() {
      renderer?.resetView();
    },
  };
}
