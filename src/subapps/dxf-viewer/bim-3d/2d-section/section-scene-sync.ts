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
import {
  toWallPlan,
  toColumnPlan,
  toBeamPlan,
  toSlabPlan,
  type WallPlan,
} from './section-intersect';
import { buildSectionPanelScene, type SectionEntitiesInput } from './section-geometry';
import {
  beamHostInput,
  slabHostInput,
  makeResolveHost,
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
    const { walls, columns, beams, slabs } = useBim3DEntitiesStore.getState();
    // ADR-401 Phase B: host inputs (beams + slabs) → per-wall resolveHost για
    // σκαλωτή/κεκλιμένη κορυφή σε `attached` τοίχους. Footprints + wall axis
    // στο ίδιο plan space (canvas units).
    const hostInputs = [...beams.map(beamHostInput), ...slabs.map(slabHostInput)];
    const wallPlans = walls.map((w) =>
      toWallPlan(
        w,
        0,
        makeResolveHost({ x: w.params.start.x, y: w.params.start.y }, { x: w.params.end.x, y: w.params.end.y }, hostInputs),
      ),
    );
    return {
      entities: {
        walls: wallPlans,
        columns: columns.map((c) => toColumnPlan(c)),
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
      const selectedBimId = useSelection3DStore.getState().selectedBimId;
      const sceneData = buildSectionPanelScene(
        { axis: plane.axis, position: plane.position },
        entities,
        selectedBimId,
      );
      renderer.update(sceneData);
    },

    resetView() {
      renderer?.resetView();
    },
  };
}
