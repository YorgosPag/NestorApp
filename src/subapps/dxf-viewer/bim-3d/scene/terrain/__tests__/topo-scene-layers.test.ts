/**
 * ADR-920 Β4.8 Β2.4 — το ΣΥΝΟΛΟ των topo layers: χτίζεται και αποδεσμεύεται ως ένα.
 *
 * Πριν, κάθε layer ήταν ένα πεδίο σε τρία αρχεία (κατασκευή · manager · dispose). Η άγκυρα κρατά τα
 * δύο συμβόλαια που μετακόμισαν εδώ: ΟΛΑ χτίζονται (με τον ίδιο late-bound clip callback όσα κόβονται),
 * και ΟΛΑ αποδεσμεύονται ακριβώς μία φορά, με τη σειρά κατασκευής.
 */

import * as THREE from 'three';

const mockEvents: string[] = [];
const mockClipCallbacks = new Map<string, unknown>();

/** Ψεύτικο layer που καταγράφει κατασκευή + dispose + τι clip callback πήρε. */
function mockLayer(name: string) {
  return class {
    constructor(_scene: unknown, _markDirty: unknown, onRebuilt?: unknown) {
      mockEvents.push(`new:${name}`);
      mockClipCallbacks.set(name, onRebuilt);
    }
    dispose(): void {
      mockEvents.push(`dispose:${name}`);
    }
  };
}

jest.mock('../TerrainSceneLayer', () => ({ TerrainSceneLayer: mockLayer('terrain') }));
jest.mock('../TerrainContourLayer', () => ({ TerrainContourLayer: mockLayer('contours') }));
jest.mock('../TerrainCutCapLayer', () => ({ TerrainCutCapLayer: mockLayer('cutCap') }));
jest.mock('../PointCloudSceneLayer', () => ({ PointCloudSceneLayer: mockLayer('pointCloud') }));
jest.mock('../TopoAutoBreaklineCandidateLayer', () => ({ TopoAutoBreaklineCandidateLayer: mockLayer('candidates') }));
jest.mock('../TopoBreaklineLayer', () => ({ TopoBreaklineLayer: mockLayer('breaklines') }));

// eslint-disable-next-line import/first -- τα mocks πρέπει να προηγούνται
import { createTopoSceneLayers } from '../topo-scene-layers';

const ORDER = ['terrain', 'contours', 'cutCap', 'pointCloud', 'candidates', 'breaklines'];

beforeEach(() => {
  mockEvents.length = 0;
  mockClipCallbacks.clear();
});

describe('createTopoSceneLayers', () => {
  it('χτίζει και τα έξι, με την ιστορική σειρά (+ δεσμευμένες ασυνέχειες τελευταίες)', () => {
    createTopoSceneLayers(new THREE.Scene(), () => {}, () => {});
    expect(mockEvents).toEqual(ORDER.map((n) => `new:${n}`));
  });

  it('κάθε layer που κόβεται παίρνει τον ΙΔΙΟ clip callback· το νέφος κανέναν (δεν κόβεται)', () => {
    const reapply = (): void => {};
    createTopoSceneLayers(new THREE.Scene(), () => {}, reapply);
    for (const name of ORDER.filter((n) => n !== 'pointCloud')) expect(mockClipCallbacks.get(name)).toBe(reapply);
    expect(mockClipCallbacks.get('pointCloud')).toBeUndefined();
  });

  it('dispose ⇒ το καθένα ΜΙΑ φορά, με τη σειρά κατασκευής', () => {
    const layers = createTopoSceneLayers(new THREE.Scene(), () => {}, () => {});
    mockEvents.length = 0;
    layers.dispose();
    expect(mockEvents).toEqual(ORDER.map((n) => `dispose:${n}`));
  });
});
