/**
 * ADR-683 Φ3β — ο glTF wrapper επιστρέφει τα unmatched ως **εγγραφές**, όχι ονόματα.
 *
 * Η επανασύνδεση ονόματος→εγγραφή είναι δύο γραμμές, αλλά αν σπάσει, η Φ3β σβήνει σιωπηλά: το
 * dialog δεν βρίσκει ποτέ κόμβους να προσφέρει και ο χρήστης ξαναβλέπει «3 χωρίς αντιστοίχιση»
 * που εξαφανίζονται — δηλαδή ακριβώς η συμπεριφορά πριν από αυτή τη φάση.
 */

const parseGltfScene = jest.fn();
const applyImportedAppearance = jest.fn();

jest.mock('../gltf-scene-parse', () => ({
  parseGltfScene: (...a: unknown[]) => parseGltfScene(...a),
}));
jest.mock('../../mesh3d-material-import/import-c4d-materials', () => ({
  applyImportedAppearance: (...a: unknown[]) => applyImportedAppearance(...a),
}));

import { importGltfAppearance } from '../import-gltf-appearance';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';

const levels = {} as LevelsHookReturn;
const resolveKnownId = () => null;

function object(name: string) {
  return { objectName: name, materialName: null, fingerprint: null, worldBoxM: null };
}

beforeEach(() => {
  parseGltfScene.mockReset();
  applyImportedAppearance.mockReset();
});

describe('importGltfAppearance — unmatchedRecords', () => {
  it('επιστρέφει τις ΕΓΓΡΑΦΕΣ των unmatched, όχι μόνο τα ονόματα', async () => {
    parseGltfScene.mockResolvedValue({
      objects: [object('Wall_1'), object('Rail_01'), object('Rail_02')],
      materials: new Map(),
    });
    applyImportedAppearance.mockReturnValue({
      objectCount: 3, matchedCount: 1, appliedCount: 1, finishMemberCount: 0,
      unmatched: ['Rail_01', 'Rail_02'],
    });

    const result = await importGltfAppearance(levels, new ArrayBuffer(8), resolveKnownId);

    expect(result.appearance.appliedCount).toBe(1);
    expect(result.unmatchedRecords.map((r) => r.objectName)).toEqual(['Rail_01', 'Rail_02']);
  });

  it('κενό unmatched ⇒ κενές εγγραφές (καμία λανθασμένη προσφορά εισαγωγής)', async () => {
    parseGltfScene.mockResolvedValue({ objects: [object('Wall_1')], materials: new Map() });
    applyImportedAppearance.mockReturnValue({
      objectCount: 1, matchedCount: 1, appliedCount: 1, finishMemberCount: 0, unmatched: [],
    });

    const result = await importGltfAppearance(levels, new ArrayBuffer(8), resolveKnownId);

    expect(result.unmatchedRecords).toHaveLength(0);
  });

  it('περνά charset unicode — ελληνικά ονόματα ορόφων επιβιώνουν (ADR-683 §2.1)', async () => {
    parseGltfScene.mockResolvedValue({ objects: [], materials: new Map() });
    applyImportedAppearance.mockReturnValue({
      objectCount: 0, matchedCount: 0, appliedCount: 0, finishMemberCount: 0, unmatched: [],
    });

    await importGltfAppearance(levels, new ArrayBuffer(8), resolveKnownId);

    expect(applyImportedAppearance).toHaveBeenCalledWith(
      levels,
      expect.objectContaining({ charset: 'unicode' }),
      resolveKnownId,
    );
  });
});
