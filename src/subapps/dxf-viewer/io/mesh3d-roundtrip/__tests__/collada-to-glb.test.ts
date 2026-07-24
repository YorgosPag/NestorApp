/**
 * ADR-690 — collada-to-glb: το `.dae` γίνεται in-memory `.glb` ώστε να τρέξει το υπάρχον glTF
 * geometry pipeline (ΜΗΔΕΝ διπλότυπο).
 *
 * Τι κλειδώνεται εδώ:
 *  1. Το `setURLModifier` λύνει την υφή στο σωστό αρχείο **ανεξάρτητα φακέλου/κεφαλαίων** (basename).
 *  2. Υφή που ο χρήστης ΔΕΝ έδωσε → μπαίνει στο `missingTextures` (actionable warning, όχι crash).
 *  3. Ο SSoT `serialiseGlb` καλείται με τη σκηνή του ColladaLoader — δεν ξαναγράφεται GLTFExporter.
 *  4. Τα object URLs που δημιουργήθηκαν γίνονται revoke (κανένα leak).
 *
 * Ο πραγματικός `THREE.LoadingManager` μένει· mockάρονται μόνο ο `ColladaLoader` (οδηγεί τον manager
 * όπως ο αληθινός: itemStart → resolveURL → itemEnd) και ο `serialiseGlb` (καθαρή THREE→bytes SSoT).
 */

import * as THREE from 'three';

const serialiseGlbMock = jest.fn<Promise<ArrayBuffer>, [THREE.Object3D]>();

jest.mock('../../../export/core/mesh3d/mesh3d-serialise', () => ({
  serialiseGlb: (root: THREE.Object3D) => serialiseGlbMock(root),
}));

interface FakeManager {
  itemStart(url: string): void;
  itemEnd(url: string): void;
  resolveURL(url: string): string;
}

interface DaeSpec {
  textures?: string[];
  /** Ένα mesh με texture slots· κάθε τιμή = πλάτος εικόνας (0 = broken/δεν φόρτωσε, >0 = OK). */
  maps?: Record<string, number>;
}

jest.mock('three/examples/jsm/loaders/ColladaLoader.js', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require('three') as typeof THREE;
  return {
    ColladaLoader: class {
      private readonly manager: FakeManager;
      constructor(manager: FakeManager) {
        this.manager = manager;
      }
      // Οδηγούμε τον ΠΡΑΓΜΑΤΙΚΟ manager ακριβώς όπως ο αληθινός ColladaLoader (TextureLoader.load →
      // itemStart + resolveURL) και επιστρέφουμε ΠΡΑΓΜΑΤΙΚΗ THREE.Scene ώστε το `traverse` να δουλεύει.
      parse(text: string) {
        const spec: DaeSpec = JSON.parse(text);
        const names = spec.textures ?? [];
        for (const name of names) {
          this.manager.itemStart(name);
          this.manager.resolveURL(name);
        }
        const scene = new three.Scene();
        if (spec.maps) {
          const material = new three.MeshStandardMaterial();
          const slots = material as unknown as Record<string, THREE.Texture>;
          for (const [slot, width] of Object.entries(spec.maps)) {
            const texture = new three.Texture();
            texture.image = { naturalWidth: width, width };
            slots[slot] = texture;
          }
          scene.add(new three.Mesh(new three.BufferGeometry(), material));
        }
        // Το πέρας φόρτωσης είναι ασύγχρονο — αλλιώς το onLoad θα πυροδοτούσε πριν το await.
        void Promise.resolve().then(() => names.forEach((name) => this.manager.itemEnd(name)));
        return { scene, library: {}, kinematics: {} };
      }
    },
  };
});

import {
  colladaToGlb,
  textureBasename,
  indexImagesByBasename,
} from '../collada-to-glb';

function dae(...textures: string[]): string {
  return JSON.stringify({ textures });
}

function daeWithMaps(maps: Record<string, number>, ...textures: string[]): string {
  return JSON.stringify({ textures, maps });
}

const GLB = new ArrayBuffer(8);

beforeEach(() => {
  serialiseGlbMock.mockReset();
  serialiseGlbMock.mockResolvedValue(GLB);
  (URL.createObjectURL as unknown) = jest.fn(() => 'blob:obj-url');
  (URL.revokeObjectURL as unknown) = jest.fn();
});

describe('textureBasename', () => {
  it('κρατά μόνο το basename, πεζά, από path με / ή \\', () => {
    expect(textureBasename('F:\\Shared\\Υλικά\\HMI_3D01.JPG')).toBe('hmi_3d01.jpg');
    expect(textureBasename('textures/3D01_OPC.jpg')).toBe('3d01_opc.jpg');
    expect(textureBasename('plain.PNG')).toBe('plain.png');
  });
});

describe('indexImagesByBasename', () => {
  it('χαρτογραφεί basename(πεζά) → File', () => {
    const a = new File(['x'], 'HMI_3D01.jpg');
    const b = new File(['y'], 'sub/3D01_OPC.jpg');
    const map = indexImagesByBasename([a, b]);
    expect(map.get('hmi_3d01.jpg')).toBe(a);
    expect(map.get('3d01_opc.jpg')).toBe(b);
    expect(map.size).toBe(2);
  });
});

describe('colladaToGlb', () => {
  it('λύνει την υφή στο δοθέν αρχείο (case/φάκελος-agnostic) και σειριοποιεί με serialiseGlb', async () => {
    const image = new File(['jpg'], 'HMI_3D01.jpg');
    const result = await colladaToGlb(dae('textures/hmi_3d01.JPG'), [image]);

    expect(URL.createObjectURL).toHaveBeenCalledWith(image);
    expect(result.missingTextures).toEqual([]);
    expect(result.glb).toBe(GLB);
    // Ο serialiseGlb πήρε τη σκηνή του ColladaLoader — όχι ξαναγραμμένος exporter.
    expect(serialiseGlbMock).toHaveBeenCalledWith(
      expect.objectContaining({ isScene: true }),
    );
    // Κανένα leak.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:obj-url');
  });

  it('υφή που δεν δόθηκε → μπαίνει στο missingTextures, το glb βγαίνει κανονικά', async () => {
    const result = await colladaToGlb(dae('missing_map.jpg'), []);

    expect(result.missingTextures).toEqual(['missing_map.jpg']);
    expect(result.glb).toBe(GLB);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('χωρίς καμία υφή → σειριοποιεί άμεσα (δεν περιμένει manager)', async () => {
    const result = await colladaToGlb(dae(), []);

    expect(result.missingTextures).toEqual([]);
    expect(result.glb).toBe(GLB);
    expect(serialiseGlbMock).toHaveBeenCalledTimes(1);
  });

  it('αφαιρεί το broken texture slot ΠΡΙΝ τη σειριοποίηση (αλλιώς ο GLTFExporter σκάει)', async () => {
    // map = broken (width 0, ο χρήστης δεν έδωσε την υφή), normalMap = OK (width 4).
    await colladaToGlb(daeWithMaps({ map: 0, normalMap: 4 }), []);

    const scene = serialiseGlbMock.mock.calls[0][0];
    const mesh = scene.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    // Το broken map καθαρίστηκε (→ null), το υγιές normalMap διατηρήθηκε → η γεωμετρία επιβιώνει.
    expect(material.map).toBeNull();
    expect(material.normalMap).not.toBeNull();
  });
});
