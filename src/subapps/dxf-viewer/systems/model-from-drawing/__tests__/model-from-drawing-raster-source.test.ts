/**
 * ⚓ ADR-929 §6.11 · §6.12 — οι αποφάσεις Δ7 με **πηγή-εικόνα**, μέσα από τον ΠΡΑΓΜΑΤΙΚΟ ελεγκτή
 * (`modelFromDrawingSession.adoptRasterSegments`) και το ΠΡΑΓΜΑΤΙΚΟ store υποβάθρων (κανένα `jest.mock`).
 *
 * Η πηγή: οι γραμμές τοίχου του σχεδίου δοκιμής (που έχει αμφίσημα ορθογώνια) ως τμήματα σε pixel μιας εικόνας,
 * μέσω της ΜΙΑΣ απεικόνισης `sceneToRasterPixel`. Η σκηνή είναι κενή: κάθε τοίχος βγαίνει μόνο από τα pixel.
 *
 * Κλειδώνει τρία πράγματα:
 *   1. **ίδια εικόνα, νέα πηγή** (νέα αναγνώριση, μετατόπιση < 1 px) ⇒ η απόφαση ΜΕΝΕΙ, με την αποθηκευμένη άγκυρα·
 *   2. **άλλη εικόνα στον ίδιο όροφο** (Αντικατάσταση), στα ΙΔΙΑ pixel ⇒ η απόφαση γίνεται ορατή ορφανή, ποτέ ψευδώς
 *      δεμένη σε ξένο ορθογώνιο· οι ομάδες πάχους (Δ3) μένουν (κανόνας ορόφου)·
 *   3. **πηγή αντικατεστημένης εικόνας** ⇒ `resolveProposalLines` = `null` και καμία εγγραφή.
 */

import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import type { WallProposal } from '../../../bim/model-from-drawing/wall-proposal';
import { imageAnchorFrameId } from '../../../bim/model-from-drawing/decision-anchors';
import { sceneToRasterPixel, type RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import {
  seedFloorBackground,
  TEST_CALIBRATION,
  testFloorplanBackground,
} from '../../../floorplan-background/testing/background-fixture';
import { modelFromDrawingSession } from '../model-from-drawing-session';
import { modelFromDrawingStore } from '../model-from-drawing-store';
import { readLiveScene } from '../model-from-drawing-live';
import {
  currentRasterPlacement,
  isRasterPlacementCalibrated,
  resolveProposalLines,
  type ProposalLineSource,
} from '../proposal-line-source';
import { confirmAllGroups, ENTITIES, harness, WALL_HEX, type Harness } from './model-from-drawing-harness';

const FLOOR = 'flr_raster';
const IMAGE_A = 'bg_a';
const IMAGE_B = 'bg_b';

/** 1 px = 10 mm, εικόνα 1200 × 1300 px: καλύπτει το σχέδιο δοκιμής (≈ 0,7–10,3 m × 0,25–11,3 m). */
const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 1200, height: 1300 },
  transform: { translateX: 0, translateY: 0, scaleX: 10, scaleY: 10, rotation: 0 },
};

type RasterSource = Extract<ProposalLineSource, { kind: 'raster' }>;
type SceneLine = Entity & { readonly start: Point2D; readonly end: Point2D };

const WALL_LINES = ENTITIES.filter(
  (e) => (e as { color?: string }).color?.toLowerCase() === WALL_HEX,
) as readonly SceneLine[];

function toPixel(p: Point2D, shiftPx: number): Point2D {
  const px = sceneToRasterPixel(p, PLACEMENT);
  if (!px) throw new Error('test placement must be invertible');
  return { x: px.x + shiftPx, y: px.y + shiftPx };
}

/** Οι γραμμές τοίχου ως πινελιές της εικόνας· `shiftPx` = η ίδια εικόνα ξαναδιαβασμένη λίγο αλλιώς. */
function segmentsOf(shiftPx: number): RasterSegment[] {
  return WALL_LINES.map((line) => ({
    id: line.id,
    start: toPixel(line.start, shiftPx),
    end: toPixel(line.end, shiftPx),
    style: 'stroke',
    strokeWidthPx: 1,
    confidence: { score: 0.9, factors: { geometry: 0.9 } },
  }));
}

function rasterSource(backgroundId: string, recognitionId: string, shiftPx = 0): RasterSource {
  return { kind: 'raster', recognitionId, floorId: FLOOR, backgroundId, segments: segmentsOf(shiftPx) };
}

function installImage(backgroundId: string): void {
  seedFloorBackground(testFloorplanBackground({ id: backgroundId, floorId: FLOOR, ...PLACEMENT, calibration: TEST_CALIBRATION }));
}

const state = () => modelFromDrawingStore.get();
const shownProposal = (): WallProposal => {
  const proposal = state().proposal;
  if (!proposal) throw new Error('expected a proposal under review');
  return proposal;
};
const undecidedKeys = (p: WallProposal): string[] =>
  p.items.filter((i) => i.status === 'needs-decision').map((i) => i.key);

/** Η εικόνα Α αναγνωρίζεται, οι ομάδες επιβεβαιώνονται, και ο άνθρωπος λέει «τοίχος» στο ΠΡΩΤΟ αμφίσημο. */
function decideFirstOnImageA(h: Harness) {
  modelFromDrawingSession.open();
  modelFromDrawingSession.adoptRasterSegments(rasterSource(IMAGE_A, 'run_1.0'), h.deps);
  confirmAllGroups(h);
  const undecidedBefore = undecidedKeys(shownProposal());
  modelFromDrawingSession.setUndecided(undecidedBefore[0], true, h.deps);
  const [anchor] = state().acceptedDecisions;
  return { anchor, undecidedBefore, groups: state().categoryByThicknessMm };
}

beforeEach(() => installImage(IMAGE_A));
afterEach(() => modelFromDrawingSession.close());

describe('ADR-929 §6.11 · §6.12 — αποφάσεις Δ7 με πηγή-εικόνα', () => {
  it('προϋπόθεση: η πηγή-εικόνα έχει αμφίσημα ορθογώνια, με άγκυρες στο πλαίσιο της ΕΙΚΟΝΑΣ', () => {
    const h = harness([]);
    modelFromDrawingSession.open();
    modelFromDrawingSession.adoptRasterSegments(rasterSource(IMAGE_A, 'run_1.0'), h.deps);
    const proposal = shownProposal();
    const keys = undecidedKeys(proposal);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(proposal.decisions.anchorByKey.get(key)?.frameId).toBe(imageAnchorFrameId(IMAGE_A));
    }
  });

  it('ίδια εικόνα, νέα πηγή (νέα αναγνώριση, 0,3 px αλλού): η απόφαση ΜΕΝΕΙ, με την αποθηκευμένη άγκυρα', () => {
    const h = harness([]);
    const { anchor, undecidedBefore, groups } = decideFirstOnImageA(h);
    expect(anchor).toBeDefined();
    modelFromDrawingSession.adoptRasterSegments(rasterSource(IMAGE_A, 'run_2.0', 0.3), h.deps);
    const proposal = shownProposal();
    expect(state().acceptedDecisions).toEqual([anchor]);
    expect(state().acceptedDecisions[0]).toBe(anchor);
    expect(proposal.decisions.orphaned).toEqual([]);
    expect([...proposal.decisions.anchorByKey.values()]).toContain(anchor);
    expect(undecidedKeys(proposal)).toHaveLength(undecidedBefore.length - 1);
    expect(state().categoryByThicknessMm).toBe(groups);
  });

  it('🔴 άλλη εικόνα στον ίδιο όροφο, στα ΙΔΙΑ pixel: η απόφαση γίνεται ορατή ορφανή, ποτέ ψευδώς δεμένη· οι Δ3 μένουν', () => {
    const h = harness([]);
    const { anchor, undecidedBefore, groups } = decideFirstOnImageA(h);
    installImage(IMAGE_B);
    modelFromDrawingSession.adoptRasterSegments(rasterSource(IMAGE_B, 'run_3.0'), h.deps);
    const proposal = shownProposal();
    expect(proposal.decisions.orphaned).toHaveLength(1);
    expect(proposal.decisions.orphaned[0]).toBe(anchor);
    expect([...proposal.decisions.anchorByKey.values()]).not.toContain(anchor);
    expect(undecidedKeys(proposal)).toHaveLength(undecidedBefore.length);
    for (const key of undecidedKeys(proposal)) {
      expect(proposal.decisions.anchorByKey.get(key)?.frameId).toBe(imageAnchorFrameId(IMAGE_B));
    }
    expect(state().acceptedDecisions).toEqual([anchor]);
    expect(state().categoryByThicknessMm).toBe(groups);
  });

  it('🔴 πηγή εικόνας που αντικαταστάθηκε: καμία γραμμή, καμία τοποθέτηση, καμία εγγραφή', () => {
    const h = harness([]);
    const sourceA = rasterSource(IMAGE_A, 'run_1.0');
    modelFromDrawingSession.open();
    modelFromDrawingSession.adoptRasterSegments(sourceA, h.deps);
    confirmAllGroups(h);
    const live = readLiveScene(h.deps.accessor);
    if (!live) throw new Error('expected a live scene');
    // Μάρτυρας: όσο η εικόνα Α είναι στον όροφο, η ίδια πηγή ΔΙΝΕΙ γραμμές — το `null` πιο κάτω δεν είναι κενό.
    expect(resolveProposalLines(sourceA, live, null, {})).not.toBeNull();
    installImage(IMAGE_B);
    expect(resolveProposalLines(sourceA, live, null, {})).toBeNull();
    expect(currentRasterPlacement(sourceA)).toBeNull();
    expect(isRasterPlacementCalibrated(sourceA)).toBe(false);
    expect(modelFromDrawingSession.approve(h.deps)).toBe(false);
    expect(h.walls()).toHaveLength(0);
  });
});
