/**
 * ⚓ ADR-929 Δ20 Σ1.3 — οι διαστάσεις της αναγνώρισης γράφονται ΜΑΖΙ με τους τοίχους στην έγκριση, μέσα από τον
 * ΠΡΑΓΜΑΤΙΚΟ ελεγκτή, το ΠΡΑΓΜΑΤΙΚΟ ιστορικό και το ΠΡΑΓΜΑΤΙΚΟ store υποβάθρων (κανένα `jest.mock`).
 *
 * Κλειδώνει:
 *   1. έγκριση ⇒ τοίχοι + μία γραμμική διάσταση ανά άνοιγμα, στο layer του στυλ (`DIMLAYER`), ΕΝΑ βήμα ιστορικού·
 *   2. ένα Ctrl+Z ⇒ φεύγουν τοίχοι, διαστάσεις ΚΑΙ το layer που δημιουργήθηκε·
 *   3. άρνηση τοίχων ⇒ καμία διάσταση, κανένα layer, κανένα βήμα ιστορικού·
 *   4. ιδεμποτία: δεύτερη εγγραφή της ίδιας πηγής ⇒ μηδέν νέες διαστάσεις, κανένα βήμα·
 *   5. πηγή χωρίς διαστάσεις ⇒ μόνο τοίχοι (η συμπεριφορά πριν το Σ1.3).
 */

import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { Entity } from '../../../types/entities';
import type { DimensionEntity } from '../../../types/dimension';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { __resetLayerStoreForTesting } from '../../../stores/LayerStore';
import { resolveDimensionLayerSpec } from '../../../services/named-layer';
import { findSceneLayerByName } from '../../../core/commands/layer/EnsureSceneLayerCommand';
import { getDimStyleRegistry } from '../../dimensions/dim-style-registry';
import {
  TEST_RASTER_PLACEMENT,
  wallLinesAsRasterSegments,
} from '../../../bim/model-from-drawing/__tests__/raster-wall-lines-fixture';
import {
  CHAIN_SEGMENTS,
  chainFusion,
  chainSpan,
} from '../../../bim/plan-recognition/fusion/__tests__/dimension-chain-fixture';
import {
  seedFloorBackground,
  TEST_CALIBRATION,
  testFloorplanBackground,
} from '../../../floorplan-background/testing/background-fixture';
import { modelFromDrawingSession } from '../model-from-drawing-session';
import { writeRecognizedDimensions } from '../model-from-drawing-dimensions';
import type { ProposalLineSource } from '../proposal-line-source';
import { confirmAllGroups, harness, type Harness } from './model-from-drawing-harness';

const FLOOR = 'flr_dims';
const IMAGE = 'bg_dims';
const SPANS = 3;

type RasterSource = Extract<ProposalLineSource, { kind: 'raster' }>;

function rasterSource(withDimensions = true): RasterSource {
  return {
    kind: 'raster', recognitionId: 'run_dims.1', floorId: FLOOR, backgroundId: IMAGE,
    segments: wallLinesAsRasterSegments(),
    ...(withDimensions
      ? {
          dimensions: {
            fusion: chainFusion([chainSpan(0), chainSpan(1), chainSpan(2)]),
            segments: CHAIN_SEGMENTS,
            originalToAligned: IDENTITY_HOMOGRAPHY,
            alignedToOriginal: IDENTITY_HOMOGRAPHY,
            verdicts: [],
          },
        }
      : {}),
  };
}

const dims = (h: Harness): DimensionEntity[] =>
  h.entities().filter((e: Entity): e is DimensionEntity => e.type === 'dimension');

const layerName = (): string => {
  const spec = resolveDimensionLayerSpec(getDimStyleRegistry().getActiveStyle());
  if (!spec) throw new Error('the default dim style must name a target layer');
  return spec.name;
};

/** Η ζωντανή σκηνή του harness (για τα layers του εγγράφου). */
function sceneOf(h: Harness) {
  const { accessor } = h.deps;
  return accessor.currentLevelId ? accessor.getLevelScene(accessor.currentLevelId) : null;
}

function reviewAndApprove(h: Harness, source: RasterSource): boolean {
  modelFromDrawingSession.open();
  modelFromDrawingSession.adoptRasterSegments(source, h.deps);
  confirmAllGroups(h);
  return modelFromDrawingSession.approve(h.deps);
}

beforeEach(() => {
  seedFloorBackground(testFloorplanBackground({
    id: IMAGE, floorId: FLOOR, ...TEST_RASTER_PLACEMENT, calibration: TEST_CALIBRATION,
  }));
  __resetLayerStoreForTesting();
  getGlobalCommandHistory().clear();
});
afterEach(() => modelFromDrawingSession.close());

describe('ADR-929 Δ20 Σ1.3 — διαστάσεις στην έγκριση', () => {
  it('έγκριση ⇒ τοίχοι + μία διάσταση ανά άνοιγμα, στο layer του στυλ, σε ΕΝΑ βήμα ιστορικού', () => {
    const h = harness([]);
    expect(reviewAndApprove(h, rasterSource())).toBe(true);
    expect(h.walls().length).toBeGreaterThan(0);
    const written = dims(h);
    expect(written).toHaveLength(SPANS);
    const layer = findSceneLayerByName(sceneOf(h)!, layerName());
    expect(layer).not.toBeNull();
    for (const d of written) {
      expect(d.dimensionType).toBe('linear');
      expect(d.layerId).toBe(layer?.id);
    }
    expect(getGlobalCommandHistory().getUndoStack().length).toBe(1);
  });

  it('ένα Ctrl+Z ⇒ φεύγουν τοίχοι, διαστάσεις ΚΑΙ το νέο layer', () => {
    const h = harness([]);
    reviewAndApprove(h, rasterSource());
    expect(getGlobalCommandHistory().undo()).toBe(true);
    expect(h.walls()).toHaveLength(0);
    expect(dims(h)).toHaveLength(0);
    expect(findSceneLayerByName(sceneOf(h)!, layerName())).toBeNull();
    expect(getGlobalCommandHistory().canUndo()).toBe(false);
  });

  it('🔴 άρνηση τοίχων (τίποτα νέο να γραφτεί) ⇒ καμία διάσταση, κανένα βήμα ιστορικού', () => {
    const h = harness([]);
    reviewAndApprove(h, rasterSource(false));
    const wallsBefore = h.walls().length;
    getGlobalCommandHistory().clear();
    // Ίδιοι τοίχοι ήδη στη σκηνή ⇒ η έγκριση αρνείται· οι διαστάσεις ΔΕΝ γράφονται μόνες τους.
    expect(reviewAndApprove(h, rasterSource())).toBe(false);
    expect(h.walls()).toHaveLength(wallsBefore);
    expect(dims(h)).toHaveLength(0);
    expect(findSceneLayerByName(sceneOf(h)!, layerName())).toBeNull();
    expect(getGlobalCommandHistory().canUndo()).toBe(false);
  });

  it('ιδεμποτία: δεύτερη εγγραφή της ίδιας πηγής ⇒ μηδέν νέες, κανένα βήμα', () => {
    const h = harness([]);
    reviewAndApprove(h, rasterSource());
    const undoBefore = getGlobalCommandHistory().getUndoStack().length;
    expect(writeRecognizedDimensions(rasterSource(), h.deps.accessor, 'again')).toBe(0);
    expect(dims(h)).toHaveLength(SPANS);
    expect(getGlobalCommandHistory().getUndoStack().length).toBe(undoBefore);
  });

  it('πηγή χωρίς διαστάσεις ⇒ μόνο τοίχοι, κανένα layer διαστάσεων', () => {
    const h = harness([]);
    expect(reviewAndApprove(h, rasterSource(false))).toBe(true);
    expect(h.walls().length).toBeGreaterThan(0);
    expect(dims(h)).toHaveLength(0);
    expect(findSceneLayerByName(sceneOf(h)!, layerName())).toBeNull();
  });
});
