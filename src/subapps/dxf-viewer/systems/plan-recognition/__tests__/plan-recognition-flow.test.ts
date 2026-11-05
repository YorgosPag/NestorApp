/**
 * ⚓ ADR-929 Φ5 — **η πρώτη πλήρης ροή εικόνα → τοίχοι**, μέσα από τους ΠΡΑΓΜΑΤΙΚΟΥΣ ελεγκτές:
 * υπόβαθρο (συνθετική παλιά σάρωση) → `planRecognitionSession.run` (Φ1+Φ2 στον ίδιο κώδικα με τον Worker, Φ4 χωρίς
 * ανάγνωση) → `modelFromDrawingSession.adoptRasterSegments` (η ΙΔΙΑ μηχανή του ADR-911) → έγκριση → τοίχοι.
 *
 * Η αλήθεια: οι `SyntheticWall` σε mm, με την **ακριβή** τοποθέτηση του δείγματος ως τοποθέτηση του υποβάθρου.
 */

import type { Entity } from '../../../types/entities';
import { isWallEntity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { Point2D } from '../../../rendering/types/Types';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { buildAutoWallType } from '../../../bim/family-types/auto-wall-type';
import { getBuiltInWallTypes } from '../../../bim/family-types/built-in-types';
import { createWallTyper } from '../../../bim/family-types/wall-typer';
import type { WallSceneAccessor } from '../../../bim/walls/add-wall-to-scene';
import { createPlanAligner } from '../../../bim/plan-recognition/alignment/plan-align-client';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticWall } from '../../../bim/plan-recognition/testing/synthetic-plan-raster';
import type { CalibrationData, FloorplanBackground } from '../../../floorplan-background/providers/types';
import { modelFromDrawingSession, type ModelFromDrawingDeps } from '../../model-from-drawing/model-from-drawing-session';
import { modelFromDrawingStore } from '../../model-from-drawing/model-from-drawing-store';
import { __setPlanAlignerForTests, planRecognitionSession } from '../plan-recognition-session';
import { planRecognitionStore } from '../plan-recognition-store';

const mockBackgrounds = new Map<string, FloorplanBackground>();
const mockProviders = new Map<string, { getPlanRaster: () => PlanRaster | null }>();
jest.mock('../../../floorplan-background/stores/floorplanBackgroundStore', () => ({
  getFloorBackground: (id: string) => mockBackgrounds.get(id) ?? null,
  getFloorProvider: (id: string) => mockProviders.get(id) ?? null,
}));

const FLOOR = 'flr_test';
const PLAN = renderSyntheticPlan({
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: 0.06, marginMm: 600, wallStyle: 'outlined', strokePx: 2, rotationDeg: 1.3,
  degradation: { seed: 42, noiseAmplitude: 25, yellowing: 0.8 },
});
const CALIBRATED: CalibrationData = {
  method: 'two-point', pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, realDistance: 1, unit: 'm',
  rotationDerived: false, calibratedAt: 0, calibratedBy: 'u',
};

function installBackground(calibration: CalibrationData | null): void {
  mockBackgrounds.set(FLOOR, {
    id: 'bg_test', companyId: 'co', floorId: FLOOR, fileId: 'file_test', providerId: 'image',
    providerMetadata: {} as FloorplanBackground['providerMetadata'],
    naturalBounds: PLAN.placement.naturalBounds, transform: PLAN.placement.transform, calibration,
    opacity: 1, visible: true, locked: false, createdAt: 0, updatedAt: 0, createdBy: 'u', updatedBy: 'u',
  });
  // Νέο buffer σε κάθε κλήση, όπως ο αληθινός provider (ο ευθυγραμμιστής αποσπά το buffer).
  mockProviders.set(FLOOR, { getPlanRaster: () => ({ ...PLAN.image, rgba: new Uint8ClampedArray(PLAN.image.rgba) }) });
}

function deps(): { deps: ModelFromDrawingDeps; walls: () => Entity[] } {
  let scene = { entities: [], units: 'mm' } as unknown as SceneModel;
  const accessor: WallSceneAccessor = {
    currentLevelId: 'lvl', getLevelScene: () => scene, setLevelScene: (_id, next) => { scene = next; },
  };
  let n = 0;
  const typer = createWallTyper({
    types: getBuiltInWallTypes('co'),
    mint: (category, thicknessMm) => buildAutoWallType(`t-${(n += 1)}`, category, thicknessMm, 'co', 'u'),
  });
  return {
    deps: { accessor, typing: { typeWall: typer.typeWall, commit: jest.fn() }, layersById: {}, pickTolerance: 5, undoName: 'u' },
    walls: () => (scene.entities as unknown as Entity[]).filter(isWallEntity),
  };
}

/** Μέσο σφάλμα των δύο άκρων του άξονα, στην καλύτερη φορά (mm). */
function axisErrorMm(a: Point2D, b: Point2D, t: SyntheticWall): number {
  const d = (p: Point2D, q: Point2D) => Math.hypot(p.x - q.x, p.y - q.y);
  return Math.min(d(a, t.start) + d(b, t.end), d(a, t.end) + d(b, t.start)) / 2;
}

async function recognise(h: ReturnType<typeof deps>): Promise<void> {
  modelFromDrawingSession.open();
  const source = await planRecognitionSession.run(FLOOR);
  if (source) modelFromDrawingSession.adoptRasterSegments(source, h.deps);
}

function confirmAllGroups(h: ReturnType<typeof deps>): void {
  for (const g of modelFromDrawingStore.get().proposal?.groups ?? []) {
    modelFromDrawingSession.confirmGroup(g.thicknessMm, g.suggestedCategory, h.deps);
  }
}

beforeEach(() => {
  mockBackgrounds.clear();
  mockProviders.clear();
  __setPlanAlignerForTests(createPlanAligner({ spawn: () => null }));
});
afterEach(() => {
  modelFromDrawingSession.close();
  planRecognitionSession.close();
});

describe('ADR-929 Φ5 — εικόνα υποβάθρου → τοίχοι μέσα από τον βοηθό του ADR-911', () => {
  it('η αναγνώριση δίνει πρόταση με ΟΛΟΥΣ τους τοίχους, άξονας ≤ 1 px από την αλήθεια', async () => {
    installBackground(CALIBRATED);
    const h = deps();
    await recognise(h);
    const recognition = planRecognitionStore.get();
    expect(recognition).toMatchObject({ phase: 'ready', failure: null });
    expect(recognition.fusion?.segmentConfidence.size).toBe(recognition.run?.segments.length);
    const state = modelFromDrawingStore.get();
    expect(state).toMatchObject({ phase: 'review', lineSource: { kind: 'raster', floorId: FLOOR } });
    const walls = state.proposal?.walls ?? [];
    expect(walls).toHaveLength(SAMPLE_HOUSE_WALLS.length);
    for (const truth of SAMPLE_HOUSE_WALLS) {
      const best = Math.min(...walls.map((w) => axisErrorMm(w.params.start, w.params.end, truth)));
      expect(best * 0.06).toBeLessThanOrEqual(1);
    }
  });

  it('έγκριση με βαθμονομημένη εικόνα: γράφονται ΟΛΟΙ οι τοίχοι, σε ένα βήμα', async () => {
    installBackground(CALIBRATED);
    const h = deps();
    await recognise(h);
    confirmAllGroups(h);
    expect(modelFromDrawingSession.approve(h.deps)).toBe(true);
    expect(h.walls()).toHaveLength(SAMPLE_HOUSE_WALLS.length);
  });

  it('🔴 αβαθμονόμητη εικόνα: προεπισκόπηση ναι, εγγραφή ΟΧΙ, με όνομα', async () => {
    installBackground(null);
    const h = deps();
    await recognise(h);
    confirmAllGroups(h);
    expect(modelFromDrawingStore.get().proposal?.walls.length).toBeGreaterThan(0);
    expect(modelFromDrawingSession.approve(h.deps)).toBe(false);
    expect(modelFromDrawingStore.get().notice).toEqual({ kind: 'uncalibrated' });
    expect(h.walls()).toHaveLength(0);
  });

  it('όροφος χωρίς υπόβαθρο: αποτυχία με όνομα, καμία πρόταση', async () => {
    const h = deps();
    await recognise(h);
    expect(planRecognitionStore.get()).toMatchObject({ phase: 'idle', failure: 'no-background' });
    expect(modelFromDrawingStore.get().phase).toBe('picking');
  });

  it('δύο διαδοχικές αναγνωρίσεις: μόνο η ΤΕΛΕΥΤΑΙΑ μετρά', async () => {
    installBackground(CALIBRATED);
    const first = planRecognitionSession.run(FLOOR);
    const second = planRecognitionSession.run(FLOOR);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBeNull();
    expect(b?.recognitionId.startsWith(planRecognitionStore.get().run?.id ?? '-')).toBe(true);
  });
});
