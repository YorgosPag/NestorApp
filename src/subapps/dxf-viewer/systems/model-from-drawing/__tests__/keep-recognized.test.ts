/**
 * ⚓ ADR-929 §6.20 · Δ22 — «Κράτησε τα αναγνωρισμένα»: διαστάσεις και γραμμές της εικόνας ως οντότητες, ΑΝΕΞΑΡΤΗΤΑ από
 * τους τοίχους, μέσα από τον ΠΡΑΓΜΑΤΙΚΟ ελεγκτή, το ΠΡΑΓΜΑΤΙΚΟ ιστορικό και το ΠΡΑΓΜΑΤΙΚΟ store υποβάθρων (κανένα `jest.mock`).
 *
 * Κλειδώνει:
 *   1. ΧΩΡΙΣ κανέναν τοίχο ⇒ διαστάσεις στο layer του στυλ + γραμμές στο `RECOGNIZED_Geometry`, σε ΕΝΑ βήμα ιστορικού·
 *   2. ποιες γραμμές: όχι πινελιές γραμμάτων, όχι όσες ζωγραφίζει ήδη διάσταση, ναι όσες δεν δέθηκαν, βεβαιότητα ≥ επιλογής·
 *   3. ένα Ctrl+Z ⇒ φεύγουν διαστάσεις, γραμμές ΚΑΙ τα δύο νέα layers·
 *   4. ιδεμποτία: δεύτερο πάτημα ⇒ μηδέν νέες, κανένα βήμα, και το λέει·
 *   5. προέλευση (Δ9) πάνω σε κάθε οντότητα·
 *   6. η προεπισκόπηση λέει ΑΚΡΙΒΩΣ ό,τι γράφεται· σκηνή που άλλαξε στο μεταξύ ⇒ `stale`, τίποτα γραμμένο·
 *   7. χωρίς βαθμονόμηση ⇒ `uncalibrated`, τίποτα γραμμένο.
 */

import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { Entity, LineEntity } from '../../../types/entities';
import type { DimensionEntity } from '../../../types/dimension';
import type { PlanConfidence, PlanSegmentRole, RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { __resetLayerStoreForTesting } from '../../../stores/LayerStore';
import { resolveDimensionLayerSpec } from '../../../services/named-layer';
import { IMPORT_LAYER_NAMES } from '../../../services/import-layer-names';
import { findSceneLayerByName } from '../../../core/commands/layer/EnsureSceneLayerCommand';
import { getDimStyleRegistry } from '../../dimensions/dim-style-registry';
import { TEST_RASTER_PLACEMENT } from '../../../bim/model-from-drawing/__tests__/raster-wall-lines-fixture';
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
import { modelFromDrawingStore } from '../model-from-drawing-store';
import type { ProposalLineSource } from '../proposal-line-source';
import { PLAN_RECOGNITION_META_KEY } from '../recognized-provenance';
import { harness, type Harness } from './model-from-drawing-harness';

const FLOOR = 'flr_keep';
const IMAGE = 'bg_keep';
const UNDO = 'keep-undo';
const SPANS = 3;

type RasterSource = Extract<ProposalLineSource, { kind: 'raster' }>;

const segment = (id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment => ({
  id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx: 1, confidence: { score: 1, factors: {} },
});

/** Πέρα από την αλυσίδα διαστάσεων: παρειά (σίγουρη), αβέβαιη, πινελιά γράμματος, γραμμή διάστασης χωρίς άνοιγμα. */
const EXTRA: readonly RasterSegment[] = [
  segment('face', 0, 250, 200, 250),
  segment('faint', 0, 280, 200, 280),
  segment('glyph', 240, 10, 244, 20),
  segment('loose', 250, 40, 250, 140),
];

const ROLES: ReadonlyMap<string, PlanSegmentRole> = new Map<string, PlanSegmentRole>([
  ['d0', 'dimension-line'], ['e0', 'extension-line'], ['e1', 'extension-line'], ['e2', 'extension-line'],
  ['e3', 'extension-line'], ['face', 'wall-face'], ['faint', 'unknown'], ['glyph', 'annotation'], ['loose', 'dimension-line'],
]);

const confidence = (score: number): PlanConfidence => ({ score, factors: {} });

function rasterSource(): RasterSource {
  const all = [...CHAIN_SEGMENTS, ...EXTRA];
  return {
    kind: 'raster', recognitionId: 'run_keep.1', floorId: FLOOR, backgroundId: IMAGE,
    segments: [],
    dimensions: {
      fusion: chainFusion([chainSpan(0), chainSpan(1), chainSpan(2)]),
      segments: CHAIN_SEGMENTS,
      originalToAligned: IDENTITY_HOMOGRAPHY,
      alignedToOriginal: IDENTITY_HOMOGRAPHY,
      verdicts: [],
    },
    linework: {
      adjustedSegments: all,
      segmentRoles: ROLES,
      segmentConfidence: new Map(all.map((s) => [s.id, confidence(s.id === 'faint' ? 0 : 1)])),
    },
  };
}

const dims = (h: Harness): DimensionEntity[] =>
  h.entities().filter((e: Entity): e is DimensionEntity => e.type === 'dimension');
const lines = (h: Harness): LineEntity[] => h.entities().filter((e: Entity): e is LineEntity => e.type === 'line');
const sourceIdOf = (e: Entity): string | undefined =>
  (e.metadata?.[PLAN_RECOGNITION_META_KEY] as { sourceId?: string } | undefined)?.sourceId;

function sceneOf(h: Harness) {
  const { accessor } = h.deps;
  return accessor.currentLevelId ? accessor.getLevelScene(accessor.currentLevelId) : null;
}

function dimLayerName(): string {
  const spec = resolveDimensionLayerSpec(getDimStyleRegistry().getActiveStyle());
  if (!spec) throw new Error('the default dim style must name a target layer');
  return spec.name;
}

function review(h: Harness): void {
  modelFromDrawingSession.open();
  modelFromDrawingSession.adoptRasterSegments(rasterSource(), h.deps);
}

function seed(calibrated = true): void {
  seedFloorBackground(testFloorplanBackground({
    id: IMAGE, floorId: FLOOR, ...TEST_RASTER_PLACEMENT, calibration: calibrated ? TEST_CALIBRATION : null,
  }));
}

beforeEach(() => {
  seed();
  __resetLayerStoreForTesting();
  getGlobalCommandHistory().clear();
});
afterEach(() => modelFromDrawingSession.close());

describe('ADR-929 §6.20 — «Κράτησε τα αναγνωρισμένα»', () => {
  it('ΧΩΡΙΣ τοίχους ⇒ διαστάσεις + γραμμές, κάθε στρώση στο δικό της layer, ΕΝΑ βήμα ιστορικού', () => {
    const h = harness([]);
    review(h);
    expect(modelFromDrawingStore.get().proposal?.walls).toHaveLength(0);
    expect(modelFromDrawingSession.keep(h.deps, UNDO)).toBe(true);

    const scene = sceneOf(h)!;
    const dimLayer = findSceneLayerByName(scene, dimLayerName());
    const lineLayer = findSceneLayerByName(scene, IMPORT_LAYER_NAMES.recognizedGeometry);
    expect(dims(h)).toHaveLength(SPANS);
    expect(dims(h).every((d) => d.layerId === dimLayer?.id)).toBe(true);
    expect(lines(h).every((l) => l.layerId === lineLayer?.id)).toBe(true);
    expect(h.walls()).toHaveLength(0);
    expect(getGlobalCommandHistory().getUndoStack().length).toBe(1);
  });

  it('ποιες γραμμές: όχι γράμματα, όχι ό,τι ζωγραφίζει διάσταση, ναι η αδέσμευτη, βεβαιότητα ≥ υψηλή', () => {
    const h = harness([]);
    review(h);
    modelFromDrawingSession.keep(h.deps, UNDO);
    expect(lines(h).map(sourceIdOf).sort()).toEqual(['face', 'loose']);
  });

  it('βεβαιότητα «όλες» ⇒ μπαίνει και η αβέβαιη· η προεπισκόπηση το λέει ΠΡΙΝ', () => {
    const h = harness([]);
    review(h);
    expect(modelFromDrawingStore.get().lineSummary?.fresh).toBe(2);
    modelFromDrawingSession.setKeepMinTier('low', h.deps);
    expect(modelFromDrawingStore.get().lineSummary?.fresh).toBe(3);
    modelFromDrawingSession.keep(h.deps, UNDO);
    expect(lines(h)).toHaveLength(3);
  });

  it('ένα Ctrl+Z ⇒ φεύγουν διαστάσεις, γραμμές ΚΑΙ τα δύο layers', () => {
    const h = harness([]);
    review(h);
    modelFromDrawingSession.keep(h.deps, UNDO);
    expect(getGlobalCommandHistory().undo()).toBe(true);
    const scene = sceneOf(h)!;
    expect(dims(h)).toHaveLength(0);
    expect(lines(h)).toHaveLength(0);
    expect(findSceneLayerByName(scene, dimLayerName())).toBeNull();
    expect(findSceneLayerByName(scene, IMPORT_LAYER_NAMES.recognizedGeometry)).toBeNull();
  });

  it('ιδεμποτία: δεύτερο πάτημα ⇒ μηδέν νέες, κανένα βήμα, ειδοποίηση με όνομα', () => {
    const h = harness([]);
    review(h);
    modelFromDrawingSession.keep(h.deps, UNDO);
    const before = h.entities().length;
    getGlobalCommandHistory().clear();
    expect(modelFromDrawingSession.keep(h.deps, UNDO)).toBe(false);
    expect(h.entities()).toHaveLength(before);
    expect(getGlobalCommandHistory().canUndo()).toBe(false);
    expect(modelFromDrawingStore.get().notice).toEqual({
      kind: 'kept', dimensions: { kind: 'written', count: 0 }, lines: { kind: 'written', count: 0 },
    });
  });

  it('Δ9 — κάθε οντότητα φέρει την εικόνα και το κομμάτι της από όπου βγήκε', () => {
    const h = harness([]);
    review(h);
    modelFromDrawingSession.keep(h.deps, UNDO);
    expect(dims(h).map(sourceIdOf).sort()).toEqual(['ds0', 'ds1', 'ds2']);
    for (const e of [...dims(h), ...lines(h)]) {
      expect((e.metadata?.[PLAN_RECOGNITION_META_KEY] as { backgroundId?: string }).backgroundId).toBe(IMAGE);
    }
  });

  it('🔴 η σκηνή άλλαξε μετά την προεπισκόπηση ⇒ `stale`, τίποτα γραμμένο', () => {
    const h = harness([]);
    review(h);
    modelFromDrawingSession.keep(h.deps, UNDO);
    const kept = lines(h)[0];
    getGlobalCommandHistory().clear();
    h.setEntities(h.entities().filter((e) => e.id !== kept.id));
    expect(modelFromDrawingSession.keep(h.deps, UNDO)).toBe(false);
    expect(modelFromDrawingStore.get().notice).toEqual({ kind: 'stale' });
    expect(getGlobalCommandHistory().canUndo()).toBe(false);
  });

  it('🔴 χωρίς βαθμονόμηση ⇒ `uncalibrated`, τίποτα γραμμένο', () => {
    seed(false);
    const h = harness([]);
    review(h);
    expect(modelFromDrawingSession.keep(h.deps, UNDO)).toBe(false);
    expect(modelFromDrawingStore.get().notice).toEqual({ kind: 'uncalibrated' });
    expect(h.entities()).toHaveLength(0);
  });
});
