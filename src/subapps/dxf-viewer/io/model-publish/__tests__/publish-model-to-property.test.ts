/**
 * @fileoverview **Ο ΔΡΟΜΟΣ ΤΟΥ ΠΕΛΑΤΗ** — ADR-845 §7.5 (Φ4.2β/Βήμα Γ).
 * @related subapps/dxf-viewer/io/model-publish/publish-model-to-property
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Φεύγει το ΙΔΙΟ `.glb` που θα κατέβαινε — και μαθαίνει ο άνθρωπος ΓΙΑΤΙ όχι;**
 *
 * Η αδελφή `model-ledger-two-ends` φυλά τον **μετρητή**· η `property-model-route` φυλά την
 * **εγγραφή**. Εδώ ζει το ενδιάμεσο: ότι η συναρμολόγηση είναι **η υπάρχουσα** *(§2 #5: καμία
 * δεύτερη διαδρομή σκηνής)*, και ότι κάθε αποτυχία έχει **όνομα** αντί για «κάτι πήγε στραβά».
 *
 * ⚠️ Ο **μετρητής δεν μοκάρεται**: η δήλωση που φεύγει είναι μέτρηση **πραγματικών** bytes.
 * Ψεύτικα είναι μόνο ο **εξαγωγέας σκηνής** και το **δίκτυο**.
 */

import * as THREE from 'three';

import { decodeModelDeclaration } from '@/lib/listings/model-declaration-metadata';

import { serialiseGlb } from '../../../export/core/mesh3d/mesh3d-serialise';
import type { ExportArtifact, ExportDeps } from '../../../export/types';

const exportFloorsToMesh3d = jest.fn<
  Promise<{ artifacts: ExportArtifact[]; warnings: string[] }>,
  [unknown, unknown, unknown]
>();
jest.mock('../../../export/formats/mesh3d-export-adapter', () => ({
  exportFloorsToMesh3d: (...args: [unknown, unknown, unknown]) => exportFloorsToMesh3d(...args),
}));

jest.mock('../../../export/core/export-floor-scope', () => ({
  resolveExportFloors: () => [{ level: { id: 'lvl_1', name: 'Ισόγειο' }, scene: {} }],
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishModelToProperty } = require('../publish-model-to-property') as
  typeof import('../publish-model-to-property');

const PROPERTY = 'prop_a0000009-7777-4aaa-8aaa-000000000009';

function deps(): ExportDeps {
  return {
    levelScenes: [], activeLevelId: 'lvl_1', projectName: 'ΔΟΚΙΜΗ', dateStr: '2026-09-08',
    floors: [], buildings: [], activeBuildingId: 'bld_1',
  } as unknown as ExportDeps;
}

function order() {
  return {
    propertyId: PROPERTY,
    scope: 'active' as const,
    state: 'proposal' as const,
    signatory: { name: 'Α. Μηχανικός', discipline: 'αρχιτέκτονας', studiedAt: '2026-02-10' },
  };
}

/** Πραγματικά bytes GLB, από τον **ίδιο** serialiser που τρέχει η εξαγωγή. */
async function realGlbArtifacts(): Promise<ExportArtifact[]> {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const bytes = await serialiseGlb(mesh);
  return [
    { filename: 'ΔΟΚΙΜΗ.nestor.json', blob: new Blob([JSON.stringify({})]) },
    { filename: 'ΔΟΚΙΜΗ.glb', blob: new Blob([bytes]) },
  ];
}

function okResponse(): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { fileId: 'file_1', storagePath: 'p' } }),
  } as unknown as Response;
}

describe('ADR-845 Βήμα Γ — ο δρόμος του πελάτη', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('Κ1 — στέλνει το ΙΔΙΟ `.glb` της υπάρχουσας συναρμολόγησης, με μετρημένη δήλωση', async () => {
    exportFloorsToMesh3d.mockResolvedValue({ artifacts: await realGlbArtifacts(), warnings: [] });
    const fetchMock = jest.fn(async () => okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    const outcome = await publishModelToProperty(order(), deps());

    expect(outcome).toEqual({ ok: true, fileId: 'file_1' });
    // 🔑 **Ο ΙΔΙΟΣ αγωγός, όχι δεύτερη σκηνή**: αν κάποιος γράψει δικό του μονοπάτι, αυτό σβήνει.
    expect(exportFloorsToMesh3d).toHaveBeenCalledTimes(1);
    expect(exportFloorsToMesh3d.mock.calls[0][2]).toMatchObject({ format: 'gltf', unit: 'meters' });

    const body = fetchMock.mock.calls[0][1] as { body: FormData };
    const declared = decodeModelDeclaration(body.body.get('declaration'));
    expect(declared).not.toBeNull();
    expect(declared?.state).toBe('proposal');
    // Το κουτί έχει 12 τρίγωνα — **μετρημένα από τα bytes**, όχι δηλωμένα από τη δοκιμή.
    expect(declared?.geometry.triangleCount).toBe(12);
  });

  it('Κ2 — κανένα `.glb` ⇒ «δεν υπάρχει γεωμετρία», και ΤΙΠΟΤΑ δεν φεύγει', async () => {
    exportFloorsToMesh3d.mockResolvedValue({ artifacts: [], warnings: [] });
    const fetchMock = jest.fn(async () => okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await publishModelToProperty(order(), deps())).toEqual({
      ok: false, refusal: 'no-geometry',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Κ3 — bytes που δεν διαβάζονται ως μοντέλο ⇒ ονομαστική άρνηση, χωρίς ανέβασμα', async () => {
    exportFloorsToMesh3d.mockResolvedValue({
      artifacts: [{ filename: 'x.glb', blob: new Blob([new Uint8Array([9, 9, 9])]) }],
      warnings: [],
    });
    const fetchMock = jest.fn(async () => okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await publishModelToProperty(order(), deps())).toEqual({
      ok: false, refusal: 'unreadable-model',
    });
    // ⚠️ Ο άνθρωπος μαθαίνει ότι **η εξαγωγή** είναι το πρόβλημα — όχι το δίκτυο, όχι το ακίνητο.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Κ4 — άρνηση του διακομιστή ⇒ `rejected`, όχι σιωπηλή επιτυχία', async () => {
    exportFloorsToMesh3d.mockResolvedValue({ artifacts: await realGlbArtifacts(), warnings: [] });
    global.fetch = jest.fn(async () => ({
      ok: false, text: async () => 'MODEL_SIGNATORY_REQUIRED',
    })) as unknown as typeof fetch;

    const outcome = await publishModelToProperty(order(), deps());

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusal).toBe('rejected');
    expect(outcome.detail).toBe('MODEL_SIGNATORY_REQUIRED');
  });
});
