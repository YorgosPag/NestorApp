/**
 * ADR-909 Γ1β — `registerMeshAssetUrl`: σχήμα που σερβίρεται **εκτός Storage** (στατικό αρχείο της εφαρμογής).
 *
 * **Γιατί υπάρχει:** η σελίδα της πύλης pixels τρέχει χωρίς σύνδεση, και το Storage δίνει τα `.glb` μόνο σε
 * συνδεδεμένο. Αν ο επιλυτής ρωτήσει έστω και μία φορά το Storage για δηλωμένο URL, το σχήμα δεν φορτώνει ποτέ
 * εκεί και η πύλη μετρά κουτί-εφεδρεία — σιωπηλά.
 */

const refCalls: string[] = [];

jest.mock('firebase/storage', () => ({
  __esModule: true,
  ref: (_storage: unknown, path: string) => {
    refCalls.push(path);
    return { path };
  },
  getDownloadURL: (r: { path: string }) => Promise.resolve(`https://dl.test/${r.path}`),
}));

jest.mock('@/lib/firebase', () => ({ __esModule: true, storage: {} }));

import { registerMeshAssetPath, registerMeshAssetUrl, resolveMeshUrl } from '../bim-mesh-url-resolver';

beforeEach(() => {
  refCalls.length = 0;
});

describe('registerMeshAssetUrl (ADR-909 Γ1β)', () => {
  it('Υ1 🔴 δηλωμένο URL επιστρέφεται αυτούσιο και το Storage ΔΕΝ ρωτιέται ποτέ', async () => {
    registerMeshAssetUrl('furniture', 'url_only', '/test-fixtures/shape.glb');

    await expect(resolveMeshUrl('furniture', 'url_only')).resolves.toBe('/test-fixtures/shape.glb');
    expect(refCalls).toStrictEqual([]);
  });

  it('Υ2 το URL προηγείται δηλωμένου Storage path για το ίδιο κλειδί', async () => {
    registerMeshAssetPath('imported', 'both', 'companies/c/projects/p/imported-meshes/both.glb');
    registerMeshAssetUrl('imported', 'both', '/test-fixtures/bundle.glb');

    await expect(resolveMeshUrl('imported', 'both')).resolves.toBe('/test-fixtures/bundle.glb');
    expect(refCalls).toStrictEqual([]);
  });

  it('Υ3 ό,τι ΔΕΝ δηλώθηκε ακολουθεί τη σύμβαση της βιβλιοθήκης, όπως πριν', async () => {
    await expect(resolveMeshUrl('furniture', 'undeclared')).resolves.toBe(
      'https://dl.test/bim-mesh-library/furniture/undeclared.glb',
    );
    expect(refCalls).toStrictEqual(['bim-mesh-library/furniture/undeclared.glb']);
  });

  it('Υ4 το κλειδί είναι κατηγορία + asset: ίδιο asset σε άλλη κατηγορία δεν κληρονομεί το URL', async () => {
    registerMeshAssetUrl('sanitary', 'shared_id', '/test-fixtures/shape.glb');

    await expect(resolveMeshUrl('furniture', 'shared_id')).resolves.toBe(
      'https://dl.test/bim-mesh-library/furniture/shared_id.glb',
    );
  });
});
