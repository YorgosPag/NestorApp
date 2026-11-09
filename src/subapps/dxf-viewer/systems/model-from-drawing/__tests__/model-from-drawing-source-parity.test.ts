/**
 * ⚓ ADR-929 §6.14 — **ίδιο σχήμα ⇒ ίδια ερώτηση**, από όποια πηγή κι αν ήρθε.
 *
 * Οι ΙΔΙΕΣ 160 γραμμές τοίχου του σχεδίου δοκιμής μπαίνουν στη μηχανή με δύο τρόπους, μέσα από την ΠΡΑΓΜΑΤΙΚΗ ραφή
 * πηγής (`resolveProposalLines`) και το ΠΡΑΓΜΑΤΙΚΟ store υποβάθρων (κανένα `jest.mock`):
 *   · **πηγή-σχέδιο**: οι γραμμές της σκηνής, κλειστά ορθογώνια (`closedRectangleStrategy`)·
 *   · **πηγή-εικόνα**: οι ίδιες γραμμές ως pixel μιας βαθμονομημένης εικόνας, ζεύγη παρειών (`rasterParallelPairStrategy`).
 *
 * Ισοτιμία στο **αποτέλεσμα**, όχι στα ακατέργαστα ορθογώνια: τα ζεύγη ενώνουν συγγραμμικά κομμάτια ίδιου πάχους σε
 * έναν τοίχο (ADR-911 Π-7: 40 ⇒ 34), που είναι η ίδια απάντηση με το συμφραζόμενο της πηγής-σχεδίου. Η σύγκριση
 * θέσης γίνεται με τον ΕΝΑ ταιριαστή των αποφάσεων (`matchAnchors`, IoU ≥ `DECISION_ANCHOR_MIN_IOU`) στη σκηνή.
 */

import type { WallProposal } from '../../../bim/model-from-drawing/wall-proposal';
import { computeWallProposal } from '../../../bim/model-from-drawing/wall-proposal';
import {
  decisionAnchorOf,
  matchAnchors,
  SCENE_ANCHOR_FRAME,
  type DecisionAnchor,
} from '../../../bim/model-from-drawing/decision-anchors';
import {
  colorOf,
  ENTITIES,
  LEVEL,
  WALL,
} from '../../../bim/model-from-drawing/__tests__/opening-fixture';
import {
  TEST_RASTER_PLACEMENT,
  wallLinesAsRasterSegments,
} from '../../../bim/model-from-drawing/__tests__/raster-wall-lines-fixture';
import { MODEL_FROM_DRAWING_LIMITS } from '../../../config/tolerance-config';
import {
  seedFloorBackground,
  TEST_CALIBRATION,
  testFloorplanBackground,
} from '../../../floorplan-background/testing/background-fixture';
import type { LiveScene } from '../model-from-drawing-live';
import { resolveProposalLines, SCENE_LINE_SOURCE, type ProposalLineSource } from '../proposal-line-source';

const FLOOR = 'flr_parity';
const IMAGE = 'bg_parity';
const MIN_IOU = MODEL_FROM_DRAWING_LIMITS.DECISION_ANCHOR_MIN_IOU;

function proposalFor(source: ProposalLineSource, live: LiveScene): WallProposal {
  const lines = resolveProposalLines(source, live, WALL, {});
  if (!lines) throw new Error('expected proposal lines for the source');
  return computeWallProposal({ ...lines, sceneUnits: live.sceneUnits, levelId: live.levelId });
}

/** Οι άγκυρες, ΣΤΗ ΣΚΗΝΗ, των στοιχείων με τις δοσμένες καταστάσεις (κοινό πλαίσιο και για τις δύο πηγές). */
function sceneAnchors(p: WallProposal, statuses: readonly string[]): DecisionAnchor[] {
  return p.items.filter((i) => statuses.includes(i.status)).map((i) => decisionAnchorOf(i.rect, SCENE_ANCHOR_FRAME));
}

function drawingProposal(): WallProposal {
  return proposalFor(SCENE_LINE_SOURCE, { levelId: LEVEL, entities: ENTITIES, sceneUnits: 'mm' });
}

function imageProposal(): WallProposal {
  seedFloorBackground(testFloorplanBackground({
    id: IMAGE, floorId: FLOOR, ...TEST_RASTER_PLACEMENT, calibration: TEST_CALIBRATION,
  }));
  const source: ProposalLineSource = {
    kind: 'raster', recognitionId: 'run_parity', floorId: FLOOR, backgroundId: IMAGE, segments: wallLinesAsRasterSegments(),
  };
  // Η σκηνή είναι κενή: κάθε τοίχος βγαίνει μόνο από τα pixel.
  return proposalFor(source, { levelId: LEVEL, entities: [], sceneUnits: 'mm' });
}

describe('ADR-929 §6.14 — ισοτιμία πηγής: σχέδιο ↔ εικόνα του ΙΔΙΟΥ σχεδίου', () => {
  const drawing = drawingProposal();
  const image = imageProposal();
  const drawingAsks = sceneAnchors(drawing, ['needs-decision']);
  const imageAsks = sceneAnchors(image, ['needs-decision']);

  it('μάρτυρας: και οι δύο πηγές ρωτούν κάτι (η ισοτιμία δεν είναι «κενό = κενό»)', () => {
    expect(drawingAsks.length).toBeGreaterThan(0);
    expect(imageAsks.length).toBeGreaterThan(0);
  });

  it('ό,τι ρωτά το σχέδιο το ρωτά και η εικόνα, και αντίστροφα — ένα προς ένα, στην ίδια θέση', () => {
    const forward = matchAnchors(drawingAsks, imageAsks, MIN_IOU);
    const backward = matchAnchors(imageAsks, drawingAsks, MIN_IOU);
    expect(forward.orphaned).toEqual([]);
    expect(backward.orphaned).toEqual([]);
    expect(imageAsks).toHaveLength(drawingAsks.length);
  });

  it('όπου το σχέδιο ρωτά, η εικόνα ΔΕΝ βγάζει σιωπηλό τοίχο (έτοιμο ή σε αναμονή επιβεβαίωσης)', () => {
    const imageBuilds = sceneAnchors(image, ['ready', 'unconfirmed']);
    expect(matchAnchors(drawingAsks, imageBuilds, MIN_IOU).storedByFresh.size).toBe(0);
  });
});
