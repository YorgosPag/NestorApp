'use client';

/**
 * ADR-650 — gather / apply the whole topographic state across every topo store.
 *
 * The persistence layer must read from and write back to FIVE independent vanilla
 * stores (survey definition, contour config, contour display style, 3D prefs, cut/fill
 * question). Centralising the collect/apply here keeps `useTopoPersistence` focused on
 * the Firestore lifecycle and gives the round-trip a single, testable seam.
 *
 * Ordering on apply is load-bearing: the survey definition is restored FIRST (the
 * cut/fill store's `subscribeTopo` reaction clears its derived result on any survey
 * change), THEN the cut/fill QUESTION (mode/datum), which the survey reaction never
 * touches — so the restored mode/datum survive.
 */

import { getTopoState, setTopoPoints, setTopoBreaklines, setTopoBoundary } from '../TopoPointStore';
import { getContourConfig, restoreContourConfig } from '../contour-config-store';
import { getContourDisplayStyle, setContourDisplayStyle } from '../contour-display-store';
import { getTerrain3DState, setTerrain3DVisible, setTerrain3DStyle } from '../terrain-3d-store';
import { getCutFillState, setCutFillMode, setCutFillDatumZMm } from '../cut-fill-store';
import type { TopoPersistedState } from './topo-persistence-types';

/** Snapshot the full topographic state from every store (the persistence payload). */
export function collectTopoState(): TopoPersistedState {
  const topo = getTopoState();
  const terrain = getTerrain3DState();
  const cutFill = getCutFillState();
  return {
    surfaces: topo.surfaces,
    boundary: topo.boundary,
    contourConfig: getContourConfig(),
    contourDisplayStyle: getContourDisplayStyle(),
    terrain3d: { visible: terrain.visible, style: terrain.style },
    cutFill: { mode: cutFill.mode, datumZMm: cutFill.datumZMm },
  };
}

/** Restore a persisted state into every store (survey first — see module note). */
export function applyTopoState(state: TopoPersistedState): void {
  // 1) Survey definition (SSoT). Both named surfaces + boundary.
  setTopoPoints(state.surfaces.existing.points, 'existing');
  setTopoBreaklines(state.surfaces.existing.breaklines, 'existing');
  setTopoPoints(state.surfaces.proposed.points, 'proposed');
  setTopoBreaklines(state.surfaces.proposed.breaklines, 'proposed');
  setTopoBoundary(state.boundary);
  // 2) Settings (view state).
  restoreContourConfig(state.contourConfig);
  setContourDisplayStyle(state.contourDisplayStyle);
  setTerrain3DVisible(state.terrain3d.visible);
  setTerrain3DStyle(state.terrain3d.style);
  setCutFillMode(state.cutFill.mode);
  setCutFillDatumZMm(state.cutFill.datumZMm);
}
