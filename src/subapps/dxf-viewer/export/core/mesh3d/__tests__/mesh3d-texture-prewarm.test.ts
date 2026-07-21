/**
 * ADR-679 Φ5.1b — `buildTexturedMesh3dScene` gate tests.
 *
 * Το `buildMesh3dScene` + τα δύο cache drains είναι mocked: εδώ ελέγχουμε ΜΟΝΟ τη λογική του
 * gate — «τίποτα in-flight → ΕΝΑ build· κάτι φόρτωσε → rebuild (build#2)». Η πραγματική
 * texture-resolution = integration (ground-truth στον R15).
 */

import { buildTexturedMesh3dScene } from '../mesh3d-texture-prewarm';

jest.mock('../build-mesh3d-scene', () => ({ buildMesh3dScene: jest.fn() }));
jest.mock('../../../../bim-3d/materials/bim-texture-cache', () => ({
  awaitInFlightTextureSets: jest.fn(),
}));
jest.mock('../../../../bim-3d/materials/user-material-registry', () => ({
  awaitInFlightUserMaterialTextures: jest.fn(),
}));

import { buildMesh3dScene } from '../build-mesh3d-scene';
import { awaitInFlightTextureSets } from '../../../../bim-3d/materials/bim-texture-cache';
import { awaitInFlightUserMaterialTextures } from '../../../../bim-3d/materials/user-material-registry';

const mockBuild = buildMesh3dScene as jest.MockedFunction<typeof buildMesh3dScene>;
const mockSlugDrain = awaitInFlightTextureSets as jest.MockedFunction<typeof awaitInFlightTextureSets>;
const mockUserDrain = awaitInFlightUserMaterialTextures as jest.MockedFunction<
  typeof awaitInFlightUserMaterialTextures
>;

// Minimal stand-ins — the gate never inspects the result shape, only which build it returns.
const RESULT_1 = { root: { tag: 'build1' }, meshCount: 1, hiddenEntityIds: new Set(), warnings: [] };
const RESULT_2 = { root: { tag: 'build2' }, meshCount: 1, hiddenEntityIds: new Set(), warnings: [] };

beforeEach(() => {
  mockBuild.mockReset();
  mockSlugDrain.mockReset();
  mockUserDrain.mockReset();
});

describe('buildTexturedMesh3dScene gate (ADR-679 Φ5.1b)', () => {
  it('τίποτα in-flight (drains = 0) → ΕΝΑ build, επιστρέφει το build#1 (μηδέν rebuild)', async () => {
    mockBuild.mockReturnValue(RESULT_1 as never);
    mockSlugDrain.mockResolvedValue(0);
    mockUserDrain.mockResolvedValue(0);

    const out = await buildTexturedMesh3dScene([] as never, {} as never);

    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(out).toBe(RESULT_1);
  });

  it('φορτώθηκαν built-in textures (slug drain > 0) → rebuild, επιστρέφει το build#2', async () => {
    mockBuild.mockReturnValueOnce(RESULT_1 as never).mockReturnValueOnce(RESULT_2 as never);
    mockSlugDrain.mockResolvedValue(2);
    mockUserDrain.mockResolvedValue(0);

    const out = await buildTexturedMesh3dScene([] as never, {} as never);

    expect(mockBuild).toHaveBeenCalledTimes(2);
    expect(out).toBe(RESULT_2);
  });

  it('φορτώθηκαν ΜΟΝΟ user (bmat_*) textures (user drain > 0) → rebuild', async () => {
    mockBuild.mockReturnValueOnce(RESULT_1 as never).mockReturnValueOnce(RESULT_2 as never);
    mockSlugDrain.mockResolvedValue(0);
    mockUserDrain.mockResolvedValue(1);

    const out = await buildTexturedMesh3dScene([] as never, {} as never);

    expect(mockBuild).toHaveBeenCalledTimes(2);
    expect(out).toBe(RESULT_2);
  });
});
