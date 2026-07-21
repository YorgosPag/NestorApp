/**
 * ADR-679 Φ5.1b — `bundleTextureArtifacts` unit tests.
 *
 * Το fetch είναι mocked (`fetchArtifactWithTimeout`): εδώ ελέγχουμε ΜΟΝΟ τη λογική
 * dedup / skip / warning-not-throw + ότι το artifact filename ΤΑΥΤΙΖΕΤΑΙ με το `map.fileName`
 * (το `init_from` του `.dae`). Το πραγματικό κατέβασμα + το άνοιγμα στον R15 = ground-truth.
 */

import * as THREE from 'three';
import { bundleTextureArtifacts } from '../mesh3d-texture-bundle';
import type { ExportMaterialEntry } from '../mesh3d-materials';

jest.mock('../../image-export-shared', () => ({
  fetchArtifactWithTimeout: jest.fn(),
}));
import { fetchArtifactWithTimeout } from '../../image-export-shared';

const mockFetch = fetchArtifactWithTimeout as jest.MockedFunction<typeof fetchArtifactWithTimeout>;

function entry(
  name: string,
  map?: { fileName: string; url: string | null } | null,
): ExportMaterialEntry {
  return { name, color: new THREE.Color(0x808080), opacity: 1, transparent: false, map };
}

describe('bundleTextureArtifacts (ADR-679 Φ5.1b)', () => {
  beforeEach(() => mockFetch.mockReset());

  it('κατεβάζει ένα artifact ανά μοναδικό fileName, με filename = το .dae init_from', async () => {
    mockFetch.mockImplementation(async (_url, filename) => ({ filename, blob: new Blob(['x']) }));

    const { artifacts, warnings } = await bundleTextureArtifacts([
      entry('oak', { fileName: 'textures/oak.jpg', url: 'https://s/oak.jpg' }),
    ]);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].filename).toBe('textures/oak.jpg');
    expect(mockFetch).toHaveBeenCalledWith('https://s/oak.jpg', 'textures/oak.jpg');
    expect(warnings).toHaveLength(0);
  });

  it('dedup: υλικά που μοιράζονται μία υφή → ΕΝΑ fetch, ΕΝΑ artifact', async () => {
    mockFetch.mockImplementation(async (_url, filename) => ({ filename, blob: new Blob(['x']) }));

    const { artifacts } = await bundleTextureArtifacts([
      entry('a', { fileName: 'textures/oak.jpg', url: 'https://s/oak.jpg' }),
      entry('b', { fileName: 'textures/oak.jpg', url: 'https://s/oak.jpg' }),
    ]);

    expect(artifacts).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('παραλείπει flat υλικά και ref-only (null url) entries — κανένα fetch', async () => {
    const { artifacts, warnings } = await bundleTextureArtifacts([
      entry('flat'),
      entry('refonly', { fileName: 'textures/x.jpg', url: null }),
    ]);

    expect(artifacts).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('αποτυχία κατεβάσματος → warning (ΟΧΙ throw), το ref κρατιέται στο .dae', async () => {
    mockFetch.mockResolvedValue(null);

    const { artifacts, warnings } = await bundleTextureArtifacts([
      entry('oak', { fileName: 'textures/oak.jpg', url: 'https://s/oak.jpg' }),
    ]);

    expect(artifacts).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('textures/oak.jpg');
  });
});
