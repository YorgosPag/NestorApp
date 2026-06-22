/**
 * ADR-363 §5.7 + ADR-458 — Beam preview ↔ committed **cutback parity**.
 *
 * Κλειδώνει τον λόγο ύπαρξης του bug #6 (Giorgio 2026-06-17): «με 1ο κλικ στη γωνία
 * κολόνας, η γωνία δοκαριού δεν ταυτίζεται στο PREVIEW, αλλά ταυτίζεται μετά το commit».
 *
 * Ρίζα: το committed δοκάρι περνά από το scene post-pass `applyBeamColumnCutback2D`
 * (frame-into, «η κολόνα νικάει»), ενώ το preview ιστορικά ΔΕΝ. Fix: το WYSIWYG preview
 * (`generateBeamPreview` → `makeBeamWysiwygGhost`) εφαρμόζει το ΙΔΙΟ cutback μέσω του
 * κοινού SSoT `buildBeamCutbackDisplay`, με τα ΙΔΙΑ column footprints (preview store).
 *
 * Αυτό το test αποδεικνύει ότι, για ταυτόσημα start/end/overrides/columns, το preview
 * `geometry.displayOutline`/`displayAxisPolyline` είναι **byte-for-byte ίσο** με αυτό που
 * παράγει ο committed scene-pass → preview === committed (γωνία δοκαριού πάνω στην παρειά
 * κολόνας ΚΑΙ στο preview).
 */

import { buildAnchoredBeamParams, buildBeamEntity } from '../beam-completion';
import { generateBeamPreview } from '../beam-preview-helpers';
import { applyBeamColumnCutback2D } from '../../canvas/dxf-scene-beam-cutback';
import { beamPreviewStore } from '../../../bim/beams/beam-preview-store';
import { sceneSnapTargetsStore } from '../../../bim/framing/scene-snap-targets';
import type { Point2D } from '../../../rendering/types/Types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const START: Point2D = { x: 0, y: 0 };
const END: Point2D = { x: 4000, y: 0 }; // L→R (edge-anchor → σώμα y∈[0,250])

// Κολόνα στη γωνία του 1ου κλικ: x∈[-200,200], y∈[-200,200]. Επικαλύπτει το
// anchored δοκάρι (x∈[0,4000], y∈[0,250]) → ενεργό cutback (frame-into).
const COLUMN_FOOTPRINT: Point2D[] = [
  { x: -200, y: -200 },
  { x: 200, y: -200 },
  { x: 200, y: 200 },
  { x: -200, y: 200 },
];

type WithDisplay = {
  geometry?: {
    displayOutline?: { x: number; y: number; z?: number }[][];
    displayAxisPolyline?: { points: { x: number; y: number; z?: number }[] };
  };
};

/** Committed path: build entity (edge-anchored + flush) → scene post-pass cutback.
 *  Περνά τα ΙΔΙΑ column footprints με το preview (όπως ο πραγματικός commit μέσω store). */
function committedDisplay(): WithDisplay['geometry'] {
  const params = buildAnchoredBeamParams(START, END, 'straight', {}, 'mm', [COLUMN_FOOTPRINT]);
  const built = buildBeamEntity(params, '', 'mm');
  if (!built.ok) throw new Error('beam build failed');
  const beamDxf = {
    id: 'beam-commit',
    type: 'beam',
    geometry: {
      outline: built.entity.geometry.outline,
      axisPolyline: built.entity.geometry.axisPolyline,
    },
  } as unknown as DxfEntityUnion;
  const columnDxf = {
    id: 'col-commit',
    type: 'column',
    geometry: { footprint: { vertices: COLUMN_FOOTPRINT } },
  } as unknown as DxfEntityUnion;
  const out = applyBeamColumnCutback2D([beamDxf, columnDxf]);
  return (out.find((e) => e.id === 'beam-commit') as unknown as WithDisplay).geometry;
}

/** Preview path: store-driven WYSIWYG ghost (same builder + same cutback SSoT). */
function previewDisplay(): WithDisplay['geometry'] {
  beamPreviewStore.reset();
  beamPreviewStore.set({ startPoint: START, endPoint: null, kind: 'straight', overrides: {} });
  // ADR-398 §3.10 — τα column footprints ζουν πλέον στο κοινό sceneSnapTargetsStore.
  sceneSnapTargetsStore.set({ footprints: [COLUMN_FOOTPRINT], beamTargets: [], wallTargets: [], slabTargets: [] });
  const ghost = generateBeamPreview([START], END, 'mm');
  return (ghost as unknown as WithDisplay).geometry;
}

describe('Beam preview ↔ committed cutback parity (ADR-458)', () => {
  afterEach(() => {
    beamPreviewStore.reset();
    sceneSnapTargetsStore.reset();
  });

  it('το preview εφαρμόζει cutback (αποκτά displayOutline) όταν υπάρχει κολόνα στη γωνία', () => {
    const preview = previewDisplay();
    expect(preview?.displayOutline).toBeDefined();
    expect(Array.isArray(preview?.displayOutline)).toBe(true);
    expect(preview?.displayOutline?.length).toBeGreaterThan(0);
  });

  it('preview.displayOutline === committed.displayOutline (ίδια γεωμετρία κοπής)', () => {
    expect(previewDisplay()?.displayOutline).toEqual(committedDisplay()?.displayOutline);
  });

  it('preview.displayAxisPolyline === committed.displayAxisPolyline (άκρο στην παρειά κολόνας)', () => {
    expect(previewDisplay()?.displayAxisPolyline).toEqual(committedDisplay()?.displayAxisPolyline);
  });
});
