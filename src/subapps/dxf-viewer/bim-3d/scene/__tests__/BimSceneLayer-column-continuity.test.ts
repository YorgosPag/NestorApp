/**
 * ADR-489 §7 — view-scoped column→footing continuity στον `BimSceneLayer`.
 *
 * Δύο ξεχωριστές συμπεριφορές, ένα σημείο ελέγχου (`columnToMesh` arg #11 =
 * `effectiveBaseZmm`):
 *
 *   **§7-A (bug fix)** — στο «Όλοι οι όροφοι» η συνέχεια παράγεται **per-stack**:
 *   ο graph βλέπει ΟΛΟΥΣ τους ορόφους μαζί σε absolute Z, οπότε η κολώνα του
 *   Ισογείου βρίσκει το πέδιλό της στη Θεμελίωση **ανεξάρτητα από το ποιος όροφος
 *   είναι ενεργός**. Πριν, ο χάρτης ερχόταν από ένα global store που έγραφε ο
 *   organism pass ΜΟΝΟ για τον ενεργό όροφο → με ενεργό τον 1ο Όροφο ο χάρτης
 *   αδείαζε από τα ids του Ισογείου και οι προεκτάσεις εξαφανίζονταν σιωπηλά.
 *
 *   **§7-B (feature)** — στο single-floor scope ΚΑΜΙΑ συνέχεια: τα πέδιλα δεν
 *   σχεδιάζονται εκεί, οπότε η προέκταση θα κρεμόταν στο κενό κάτω από την κάτοψη
 *   και θα εμπόδιζε την επιλογή/επεξεργασία της κολώνας στο 3Δ.
 */

import * as THREE from 'three';

const wallToMesh = jest.fn();
const columnToMesh = jest.fn();
const beamToMesh = jest.fn();
const slabToMesh = jest.fn();
/** ADR-550 Φ2 — τα πέδιλα περνούν από το point-entity contract registry, όχι από `syncColumns`. */
const foundationToMesh = jest.fn();
const stairToMeshes = jest.fn();
const resolveEntityBuilding = jest.fn();
const getLayer = jest.fn();

jest.mock('../../converters/BimToThreeConverter', () => ({
  wallToMesh:   (...a: unknown[]) => wallToMesh(...a),
  columnToMesh: (...a: unknown[]) => columnToMesh(...a),
  beamToMesh:   (...a: unknown[]) => beamToMesh(...a),
  slabToMesh:   (...a: unknown[]) => slabToMesh(...a),
  foundationToMesh: (...a: unknown[]) => foundationToMesh(...a),
}));
jest.mock('../../converters/StairToThreeConverter', () => ({
  stairToMeshes: (...a: unknown[]) => stairToMeshes(...a),
}));
jest.mock('../../../bim/utils/bim-floor-utils', () => ({
  resolveEntityBuilding: (...a: unknown[]) => resolveEntityBuilding(...a),
}));
jest.mock('../../../stores/LayerStore', () => ({
  getLayer: (...a: unknown[]) => getLayer(...a),
}));
jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import { BimSceneLayer } from '../BimSceneLayer';
import { bearingColumn, padFooting, makeStructuralFloor } from './minimal-bim-entities';
import type { FloorStackEntry } from '../multi-floor-3d-source';

const mockDrawingState = useDrawingScaleStore.getState as jest.Mock;
const FAKE_MESH = (): THREE.Mesh => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

/** `columnToMesh(column, floorElevationMm, levelId, baseElevation, top, base, nominalH, walls, beams, suppress, effectiveBaseZmm, clipTop)`. */
const EFFECTIVE_BASE_ARG = 10;

/** The `effectiveBaseZmm` handed to the converter for `columnId` (undefined ⇒ nominal base). */
function effectiveBaseOf(columnId: string): number | undefined {
  const call = columnToMesh.mock.calls.find((c) => (c[0] as { id: string }).id === columnId);
  if (!call) throw new Error(`columnToMesh never called for "${columnId}"`);
  return call[EFFECTIVE_BASE_ARG] as number | undefined;
}

/** Θεμελίωση: πέδιλο με ΑΠΟΛΥΤΗ άνω παρειά −1000mm, ένα επίπεδο κάτω από το Ισόγειο. */
const FOUNDATION_FLOOR: FloorStackEntry = {
  levelId: 'L-foundation',
  floorElevationMm: -1000,
  entities: makeStructuralFloor({ foundations: [padFooting('f1', -1000)] }),
};
/** Ισόγειο: κολώνα με nominal βάση στο FFL της (z = 0). */
const GROUND_FLOOR: FloorStackEntry = {
  levelId: 'L-ground',
  floorElevationMm: 0,
  entities: makeStructuralFloor({ columns: [bearingColumn('c1')] }),
};
/** 1ος Όροφος: κολώνα χωρίς πέδιλο — ΠΟΤΕ δεν κατεβαίνει. */
const UPPER_FLOOR: FloorStackEntry = {
  levelId: 'L-upper',
  floorElevationMm: 3000,
  entities: makeStructuralFloor({ columns: [bearingColumn('c2')] }),
};

beforeEach(() => {
  wallToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  columnToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  beamToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  slabToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  foundationToMesh.mockReset().mockImplementation(() => FAKE_MESH());
  stairToMeshes.mockReset().mockImplementation(() => [FAKE_MESH()]);
  resolveEntityBuilding.mockReset().mockReturnValue({ id: '', baseElevation: 0 });
  getLayer.mockReset().mockReturnValue(null);
  mockDrawingState.mockReturnValue({ objectStyles: {} });
});

describe('ADR-489 §7-A — «Όλοι οι όροφοι»: per-stack continuity', () => {
  it('κολώνα Ισογείου εδράζεται στο πέδιλο Θεμελίωσης (cross-floor, absolute Z)', () => {
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor([FOUNDATION_FLOOR, GROUND_FLOOR]);
    expect(effectiveBaseOf('c1')).toBe(-1000);
  });

  it('ΤΟ BUG: η συνέχεια δεν εξαρτάται από το ποιος όροφος είναι «ενεργός»', () => {
    // Ο 1ος Όροφος μπροστά στο stack — παλιά ο organism pass έγραφε τον χάρτη ΜΟΝΟ για
    // τον ενεργό όροφο, οπότε το `c1` έχανε το entry του και η προέκταση εξαφανιζόταν.
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor([UPPER_FLOOR, FOUNDATION_FLOOR, GROUND_FLOOR]);
    expect(effectiveBaseOf('c1')).toBe(-1000);
  });

  it('η σειρά των ορόφων στο stack δεν αλλάζει το αποτέλεσμα (ίδιο absolute frame)', () => {
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor([GROUND_FLOOR, FOUNDATION_FLOOR]);
    expect(effectiveBaseOf('c1')).toBe(-1000);
  });

  it('κολώνα χωρίς πέδιλο κρατά τη nominal βάση (κανένα entry)', () => {
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor([FOUNDATION_FLOOR, GROUND_FLOOR, UPPER_FLOOR]);
    expect(effectiveBaseOf('c2')).toBeUndefined();
  });

  it('χωρίς όροφο Θεμελίωσης στο stack → καμία προέκταση', () => {
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor([GROUND_FLOOR, UPPER_FLOOR]);
    expect(effectiveBaseOf('c1')).toBeUndefined();
  });
});

describe('ADR-489 §7-B — single-floor: καμία προέκταση (επεξεργάσιμη κολώνα)', () => {
  it('προβολή ενός ορόφου → η κολώνα κρατά τη nominal βάση', () => {
    new BimSceneLayer(new THREE.Scene()).sync(GROUND_FLOOR.entities, 0, 'L-ground');
    expect(effectiveBaseOf('c1')).toBeUndefined();
  });

  it('ΑΚΟΜΗ ΚΑΙ όταν πέδιλο + κολώνα συνυπάρχουν στον ΙΔΙΟ όροφο', () => {
    // Το gate είναι το scope, ΟΧΙ η απουσία πεδίλου: το ίδιο ζευγάρι δίνει −1000 σε
    // multi-floor. Έτσι η κολώνα μένει επιλέξιμη/επεξεργάσιμη στην προβολή ορόφου.
    const floor = makeStructuralFloor({
      columns: [bearingColumn('c1')],
      foundations: [padFooting('f1', -1000)],
    });
    new BimSceneLayer(new THREE.Scene()).sync(floor, 0, 'L-ground');
    expect(effectiveBaseOf('c1')).toBeUndefined();

    columnToMesh.mockClear();
    new BimSceneLayer(new THREE.Scene()).syncMultiFloor([
      { levelId: 'L-ground', floorElevationMm: 0, entities: floor },
    ]);
    expect(effectiveBaseOf('c1')).toBe(-1000);
  });
});
