/**
 * ADR-909 Γ1β — τα σχήματα 3Δ ενός σχεδίου, έτοιμα **πριν** από τη σύγχρονη απόδοση — και ό,τι λείπει, με όνομα.
 *
 * Καθρέφτης των Ζ5–Ζ7 της Β2.6 (εικόνες). Το `bimMeshCache` είναι ψεύτικο: εδώ κρίνεται **τι του ζητά** η
 * προφόρτωση (ίδιο κλειδί με τον ζωγράφο, μία αναμονή, όριο χρόνου), όχι το πώς φορτώνει.
 */

const preload = jest.fn();
const awaitSettled = jest.fn();
const getLoadState = jest.fn();
const retryFailed = jest.fn();

jest.mock('../../../bim-3d/library/bim-mesh-library/bim-mesh-cache', () => ({
  __esModule: true,
  bimMeshCache: {
    preload: (...args: unknown[]) => preload(...args),
    awaitSettled: (...args: unknown[]) => awaitSettled(...args),
    getLoadState: (...args: unknown[]) => getLoadState(...args),
    retryFailed: (...args: unknown[]) => retryFailed(...args),
  },
}));

import { DXF_TIMING } from '../../../config/dxf-timing';
import {
  MESH_NOT_LOADED_WARNING,
  missingSceneMeshWarnings,
  preloadSceneMeshes,
  retryFailedSceneMeshes,
} from '../preload-scene-meshes';
import { summarizePrintFidelity } from '../../print-fidelity';

const CHAIR = { type: 'furniture', params: { assetId: 'chair_01' } };
const WC = { type: 'mep-fixture', params: { kind: 'wc', assetId: 'wc_01' } };
const LAMP = { type: 'mep-fixture', params: { kind: 'light-fixture' } };
const RAIL = { type: 'imported-mesh', params: { uploadId: 'imesh_a', nodeName: 'Rail_01' } };
const WALL = { type: 'wall', params: {} };

beforeEach(() => {
  jest.clearAllMocks();
  awaitSettled.mockResolvedValue(undefined);
  getLoadState.mockReturnValue('ready');
});

describe('preloadSceneMeshes (ADR-909 Γ1β)', () => {
  it('Π1 🔴 ζητά κάθε σχήμα με το ΙΔΙΟ κλειδί που ζητά ο ζωγράφος, και περιμένει ΜΙΑ φορά', async () => {
    await preloadSceneMeshes([CHAIR, WC, LAMP, RAIL, WALL]);

    expect(preload.mock.calls).toStrictEqual([
      ['furniture', 'chair_01'],
      ['sanitary', 'wc_01'],
      ['imported', 'imesh_a#Rail_01'],
    ]);
    expect(awaitSettled).toHaveBeenCalledTimes(1);
    // Όλα τα αιτήματα ΠΡΙΝ από την αναμονή — αλλιώς η αποστράγγιση δεν θα έβλεπε τα τελευταία.
    expect(Math.max(...preload.mock.invocationCallOrder)).toBeLessThan(awaitSettled.mock.invocationCallOrder[0]);
  });

  it('Π2 σχέδιο χωρίς σχήματα 3Δ ⇒ καμία αναμονή', async () => {
    await preloadSceneMeshes([LAMP, WALL]);

    expect(preload).not.toHaveBeenCalled();
    expect(awaitSettled).not.toHaveBeenCalled();
  });

  it('Π3 🔴 σχήμα που δεν καταλήγει ΠΟΤΕ ⇒ η λήψη συνεχίζει μετά το όριο χρόνου, δεν κρεμά και δεν πετά', async () => {
    jest.useFakeTimers();
    try {
      awaitSettled.mockReturnValue(new Promise(() => undefined));
      let done = false;
      const pending = preloadSceneMeshes([CHAIR]).then(() => { done = true; });

      await jest.advanceTimersByTimeAsync(DXF_TIMING.lifecycle.MESH_PRELOAD_TIMEOUT - 1);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await pending;
      expect(done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('missingSceneMeshWarnings (ADR-909 Γ1β)', () => {
  it('Α1 ό,τι δεν είναι `ready` ονομάζεται — ένας κωδικός ανά στοιχείο, με το κλειδί του ζωγράφου', () => {
    getLoadState.mockImplementation((category: string) => (category === 'furniture' ? 'ready' : 'error'));

    expect(missingSceneMeshWarnings([CHAIR, WC, LAMP, RAIL, WALL])).toStrictEqual([
      MESH_NOT_LOADED_WARNING,
      MESH_NOT_LOADED_WARNING,
    ]);
    expect(getLoadState.mock.calls).toStrictEqual([
      ['furniture', 'chair_01'],
      ['sanitary', 'wc_01'],
      ['imported', 'imesh_a#Rail_01'],
    ]);
  });

  it.each(['loading', 'error', 'idle'])('Α2 κατάσταση `%s` ⇒ απώλεια (μόνο το `ready` είναι σχήμα)', (state) => {
    getLoadState.mockReturnValue(state);
    expect(missingSceneMeshWarnings([CHAIR])).toStrictEqual([MESH_NOT_LOADED_WARNING]);
  });

  it('Α3 όλα έτοιμα, ή κανένα σχήμα ⇒ καμία απώλεια', () => {
    expect(missingSceneMeshWarnings([CHAIR, RAIL])).toStrictEqual([]);
    expect(missingSceneMeshWarnings([LAMP, WALL])).toStrictEqual([]);
  });

  it('Α4 ο κωδικός φτάνει στον άνθρωπο ως `mesh-shape-missing`, με πλήθος', () => {
    getLoadState.mockReturnValue('error');
    expect(summarizePrintFidelity(missingSceneMeshWarnings([CHAIR, RAIL]))).toStrictEqual([
      { code: 'mesh-shape-missing', count: 2 },
    ]);
  });
});

describe('retryFailedSceneMeshes (ADR-909 Γ1β)', () => {
  it('Ρ1 ζητά νέα προσπάθεια για κάθε σχήμα της σκηνής — και μόνο για σχήματα', () => {
    retryFailedSceneMeshes([CHAIR, LAMP, RAIL, WALL]);

    expect(retryFailed.mock.calls).toStrictEqual([
      ['furniture', 'chair_01'],
      ['imported', 'imesh_a#Rail_01'],
    ]);
    expect(preload).not.toHaveBeenCalled();
  });
});
