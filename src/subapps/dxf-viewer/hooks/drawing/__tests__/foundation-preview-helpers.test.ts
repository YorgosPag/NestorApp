/**
 * ADR-436 Slice 2 — foundation line-tool preview helper tests.
 *
 * Verifies the rubber-band state map: [] → cursor dot, [start] → band footprint
 * ghost (WYSIWYG via computeFoundationGeometry). Pure — μηδέν canvas.
 */

import { generateFoundationPreview, generateFoundationPadPreview } from '../foundation-preview-helpers';
import { foundationPreviewStore } from '../../../bim/foundations/foundation-preview-store';
import { sceneSnapTargetsStore, type SceneSnapTargets } from '../../../bim/framing/scene-snap-targets';
import { setPlacementRotationLock, clearPlacementRotationLock } from '../../../systems/cursor/PlacementRotationStore';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';

describe('generateFoundationPreview', () => {
  afterEach(() => foundationPreviewStore.reset());

  it('returns a cursor start marker when no points are clicked yet', () => {
    const preview = generateFoundationPreview([], { x: 10, y: 20 });
    expect(preview).not.toBeNull();
    expect(preview!.type).toBe('point');
    expect(preview!.preview).toBe(true);
  });

  it('returns a WYSIWYG FoundationEntity ghost once the start is placed', () => {
    foundationPreviewStore.set({ startPoint: { x: 0, y: 0 }, endPoint: null, kind: 'strip', overrides: {} });
    const preview = generateFoundationPreview([{ x: 0, y: 0 }], { x: 2000, y: 0 });
    expect(preview).not.toBeNull();
    const ghost = preview as { type: string; preview?: boolean; wysiwygPreview?: boolean };
    // WYSIWYG (2026-06-11): full FoundationEntity via the real renderer, not a green band polyline.
    expect(ghost.type).toBe('foundation');
    expect(ghost.preview).toBe(true);
    expect(ghost.wysiwygPreview).toBe(true);
  });

  it('uses the store kind/overrides for WYSIWYG width (tie-beam narrower than strip)', () => {
    foundationPreviewStore.set({ startPoint: { x: 0, y: 0 }, endPoint: null, kind: 'tie-beam', overrides: { width: 250 } });
    const preview = generateFoundationPreview([{ x: 0, y: 0 }], { x: 1000, y: 0 }) as {
      params: { width: number };
    };
    // ribbon width override → committed (WYSIWYG) FoundationEntity width = 250.
    expect(preview.params.width).toBe(250);
  });
});

describe('generateFoundationPadPreview — ADR-514 Φ6c live pad ghost', () => {
  const COLUMN_FP = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }];
  const emptyTargets = (partial: Partial<SceneSnapTargets> = {}): SceneSnapTargets => ({
    footprints: [], beamTargets: [], wallTargets: [], slabTargets: [], lineTargets: [],
    diskTargets: [], rectTargets: [], wallEntities: [], openings: [], ...partial,
  });
  afterEach(() => {
    foundationPreviewStore.reset();
    sceneSnapTargetsStore.reset();
  });

  it('επιστρέφει null όταν το store δεν είναι pad (safety)', () => {
    foundationPreviewStore.set({ startPoint: null, endPoint: null, kind: 'strip', overrides: {} });
    expect(generateFoundationPadPreview({ x: 10, y: 20 })).toBeNull();
  });

  it('χωρίς στόχους → WYSIWYG pad ghost στον cursor (μηδέν snap)', () => {
    foundationPreviewStore.set({ startPoint: null, endPoint: null, kind: 'pad', overrides: {} });
    const ghost = generateFoundationPadPreview({ x: 5000, y: 5000 }) as {
      type: string; preview?: boolean; wysiwygPreview?: boolean; params: { position: { x: number; y: number } };
    };
    expect(ghost.type).toBe('foundation');
    expect(ghost.wysiwygPreview).toBe(true);
    expect(ghost.params.position.x).toBeCloseTo(5000);
  });

  it('κοντά σε κολόνα → το pad κουμπώνει flush στην παρειά (preview ≡ commit)', () => {
    foundationPreviewStore.set({ startPoint: null, endPoint: null, kind: 'pad', overrides: {} });
    sceneSnapTargetsStore.set(emptyTargets({ footprints: [COLUMN_FP] }));
    const ghost = generateFoundationPadPreview({ x: 700, y: 200 }) as {
      params: { position: { x: number; y: number } };
    };
    // ανατολική παρειά κολόνας @ x=400 (ΙΔΙΟΣ εγκέφαλος 'foundation-pad' με το commit).
    expect(ghost.params.position.x).toBeCloseTo(400);
  });
});

describe('generateFoundationPadPreview — ADR-514 Φ6d place+rotate (2-click, mirror κολώνας)', () => {
  const fullTargets = (partial: Partial<SceneSnapTargets> = {}): SceneSnapTargets => ({
    footprints: [], beamTargets: [], wallTargets: [], slabTargets: [], lineTargets: [],
    diskTargets: [], rectTargets: [], wallEntities: [], openings: [], ...partial,
  });
  afterEach(() => {
    foundationPreviewStore.reset();
    sceneSnapTargetsStore.reset();
    clearPlacementRotationLock();
  });

  it('awaitingRotation → το pad μένει στην ΚΛΕΙΔΩΜΕΝΗ θέση και περιστρέφεται προς τον κέρσορα', () => {
    foundationPreviewStore.set({ startPoint: null, endPoint: null, kind: 'pad', overrides: {} });
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    setPlacementRotationLock({ x: 0, y: 0 }, 'center'); // 1ο κλικ: θέση κλειδωμένη
    const ghost = generateFoundationPadPreview({ x: 0, y: 5000 }) as {
      params: { position: { x: number; y: number }; rotation: number };
    };
    expect(ghost.params.position.x).toBeCloseTo(0); // μένει στην κλειδωμένη θέση, ΟΧΙ στον κέρσορα
    expect(ghost.params.position.y).toBeCloseTo(0);
    expect(Number.isFinite(ghost.params.rotation)).toBe(true); // περιστρέφεται live (αριθμητική γωνία)
  });

  it('awaitingRotation μέσα σε δίσκο → ΔΙΑΤΗΡΕΙ το polarDiskGrid γύρω από την κλειδωμένη θέση', () => {
    foundationPreviewStore.set({ startPoint: null, endPoint: null, kind: 'pad', overrides: {} });
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    sceneSnapTargetsStore.set(fullTargets({ diskTargets: [{ center: { x: 0, y: 0 }, radius: 5000 }] }));
    setPlacementRotationLock({ x: 0, y: 0 }, 'center');
    const ghost = generateFoundationPadPreview({ x: 8000, y: 0 }) as {
      polarDiskGrid?: unknown; params: { position: { x: number; y: number } };
    };
    expect(ghost.params.position.x).toBeCloseTo(0);
    expect(ghost.polarDiskGrid).toBeDefined(); // guidance ΠΑΡΑΜΕΝΕΙ (κοινό SSoT με κολόνα)
  });
});
