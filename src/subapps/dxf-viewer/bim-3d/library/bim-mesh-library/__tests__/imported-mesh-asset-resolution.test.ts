/**
 * ADR-683 §mesh-load — regression guard: ο άξονας **registration** ταιριάζει με τον άξονα **resolve**.
 *
 * **Το bug που φυλάει (2026-07-22):** το linked-model έχει δύο άξονες — το URL λύνεται **ανά αρχείο**
 * (`resolveMeshUrl('imported', uploadId)`, βλ. `bim-mesh-cache.loadScene`), η ανάθεση σε κόμβο γίνεται
 * **μετά** τη φόρτωση. Παλιά το `registerImportedMeshAsset` δήλωνε ανά **κόμβο** (`<uploadId>#<node>`),
 * κλειδί που ο resolver **ποτέ** δεν διάβαζε → miss → curated library fallback → 404 → μόνιμο
 * placeholder κουτί, χωρίς κανένα σφάλμα. Λειτουργικά αόρατο σε unit που ελέγχει μόνο args.
 *
 * Εδώ κλείνει ο κύκλος: δηλώνουμε μέσω του public API και ρωτάμε τον resolver **με το ίδιο κλειδί
 * που χρησιμοποιεί ο cache** (`uploadId`). Αν οι δύο άξονες αποκλίνουν ξανά, ο resolver θα γυρίσει το
 * library path και το test κοκκινίζει.
 */

const refCalls: string[] = [];

jest.mock('firebase/storage', () => ({
  __esModule: true,
  ref: (_storage: unknown, path: string) => {
    refCalls.push(path);
    return { path };
  },
  getDownloadURL: (r: { path: string }) => Promise.resolve(`https://dl.test/${r.path}`),
  uploadBytes: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({ __esModule: true, storage: {} }));

import { registerImportedMeshAsset } from '../imported-mesh-assets';
import { resolveMeshUrl } from '../bim-mesh-url-resolver';
import { IMPORTED_MESH_CATEGORY } from '../../../../bim/entities/imported-mesh/imported-mesh-types';

beforeEach(() => {
  refCalls.length = 0;
});

describe('imported mesh — register-axis ↔ resolve-axis (ADR-683 §mesh-load)', () => {
  it('η δήλωση ανά αρχείο βρίσκεται από τον resolver ΜΕ ΤΟ ΚΛΕΙΔΙ ΑΡΧΕΙΟΥ (uploadId), όχι library fallback', async () => {
    const uploadId = 'imesh_reg';
    const projectPath = 'companies/c/projects/p/imported-meshes/imesh_reg.glb';

    // Δήλωση όπως στην εισαγωγή / hydrate — ανά αρχείο.
    registerImportedMeshAsset(uploadId, projectPath);

    // Ο cache λύνει URL ανά αρχείο (bundleId = uploadId, ΧΩΡΙΣ #node).
    const url = await resolveMeshUrl(IMPORTED_MESH_CATEGORY, uploadId);

    expect(url).toBe(`https://dl.test/${projectPath}`);
    // Χτυπήθηκε το project-scoped path, ΠΟΤΕ το curated library path.
    expect(refCalls).toEqual([projectPath]);
    expect(refCalls).not.toContain('bim-mesh-library/imported/imesh_reg.glb');
  });

  it('χωρίς δήλωση, ο resolver πέφτει στη σύμβαση της curated βιβλιοθήκης (το μονοπάτι που ΔΕΝ σπάμε)', async () => {
    // Διαφορετικό κλειδί ώστε να μη μολύνεται από το προηγούμενο test (module singleton, no reset).
    const url = await resolveMeshUrl(IMPORTED_MESH_CATEGORY, 'imesh_unregistered');

    expect(url).toBe('https://dl.test/bim-mesh-library/imported/imesh_unregistered.glb');
    expect(refCalls).toEqual(['bim-mesh-library/imported/imesh_unregistered.glb']);
  });
});
