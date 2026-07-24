/**
 * ADR-691 §7.1 — `glb-embedded-materials`. Χτίζει `.glb` in-memory (χωρίς fixture αρχείο, ίδιο
 * μοτίβο με τα άλλα pure parsers του module) και ελέγχει: join-by-index, ανώνυμα υλικά,
 * `.gltf` JSON με data-URI εικόνα, linear→sRGB μετατροπή χρώματος, και fail-closed συμπεριφορά
 * σε κατεστραμμένο/εξωτερικό input.
 *
 * @see ../glb-embedded-materials
 * @see ../../../../../docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md §7
 */

import { readEmbeddedGltfMaterials } from '../glb-embedded-materials';

const GLB_MAGIC = 0x46546c67;
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;

/** Στρογγυλεύει στο επόμενο πολλαπλάσιο του 4 (GLB chunk alignment). */
function align4(length: number): number {
  return Math.ceil(length / 4) * 4;
}

/** Ένα ελάχιστο έγκυρο `.glb` (κεφαλίδα + JSON chunk + προαιρετικό BIN chunk), χτισμένο in-memory. */
function buildGlb(json: unknown, binBytes?: Uint8Array): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPaddedLength = align4(jsonBytes.length);
  const bin = binBytes ?? new Uint8Array(0);
  const binPaddedLength = binBytes ? align4(bin.length) : 0;
  const hasBin = binBytes !== undefined;

  const totalLength =
    12 + 8 + jsonPaddedLength + (hasBin ? 8 + binPaddedLength : 0);
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, jsonPaddedLength, true);
  view.setUint32(offset + 4, CHUNK_TYPE_JSON, true);
  bytes.set(jsonBytes, offset + 8);
  for (let i = jsonBytes.length; i < jsonPaddedLength; i += 1) bytes[offset + 8 + i] = 0x20; // space padding
  offset += 8 + jsonPaddedLength;

  if (hasBin) {
    view.setUint32(offset, binPaddedLength, true);
    view.setUint32(offset + 4, CHUNK_TYPE_BIN, true);
    bytes.set(bin, offset + 8);
    offset += 8 + binPaddedLength;
  }

  return buffer;
}

/** Ψεύτικα (αλλά PNG-signed) bytes υφής, αρκετά για round-trip ελέγχου. */
const FAKE_PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);

describe('readEmbeddedGltfMaterials — GLB container', () => {
  it('διαβάζει 2 υλικά (ένα textured μέσω bufferView, ένα flat) με σωστό index/name/PBR/albedo', () => {
    const glb = buildGlb({
      images: [{ mimeType: 'image/png', bufferView: 0 }],
      bufferViews: [{ byteOffset: 0, byteLength: FAKE_PNG_BYTES.length }],
      textures: [{ source: 0 }],
      materials: [
        {
          name: 'Wood',
          pbrMetallicRoughness: {
            baseColorFactor: [1, 1, 1, 1],
            baseColorTexture: { index: 0 },
            metallicFactor: 0,
            roughnessFactor: 0.8,
          },
        },
        {
          name: 'Flat',
          pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] },
        },
      ],
    }, FAKE_PNG_BYTES);

    const materials = readEmbeddedGltfMaterials(glb);

    expect(materials).toHaveLength(2);

    expect(materials[0].index).toBe(0);
    expect(materials[0].name).toBe('Wood');
    expect(materials[0].metalness).toBe(0);
    expect(materials[0].roughness).toBe(0.8);
    expect(materials[0].colorHex).toBe('#ffffff');
    expect(materials[0].albedo).not.toBeNull();
    expect(materials[0].albedo?.mimeType).toBe('image/png');
    expect(materials[0].albedo?.fileName).toBe('gltf-mat-0.png');
    expect(Array.from(materials[0].albedo?.bytes ?? [])).toEqual(Array.from(FAKE_PNG_BYTES));

    expect(materials[1].index).toBe(1);
    expect(materials[1].name).toBe('Flat');
    expect(materials[1].albedo).toBeNull();
    // Χωρίς metallicFactor/roughnessFactor δηλωμένα → glTF spec default = 1.
    expect(materials[1].metalness).toBe(1);
    expect(materials[1].roughness).toBe(1);
  });

  it('ανώνυμο υλικό → name: null (η συνηθισμένη περίπτωση ξένων μοντέλων) — ΔΕΝ πετιέται', () => {
    const glb = buildGlb({
      materials: [{ pbrMetallicRoughness: {} }],
    });

    const materials = readEmbeddedGltfMaterials(glb);

    expect(materials).toHaveLength(1);
    expect(materials[0].index).toBe(0);
    expect(materials[0].name).toBeNull();
    expect(materials[0].colorHex).toBe('#ffffff');
    expect(materials[0].opacity).toBe(1);
    expect(materials[0].metalness).toBe(1);
    expect(materials[0].roughness).toBe(1);
    expect(materials[0].albedo).toBeNull();
  });

  it('linear→sRGB: baseColorFactor [0.2,0.2,0.2,1] → #7c7c7c (ΟΧΙ #333333, το ωμό linear hex)', () => {
    const glb = buildGlb({
      materials: [{ name: 'Grey', pbrMetallicRoughness: { baseColorFactor: [0.2, 0.2, 0.2, 1] } }],
    });

    const [material] = readEmbeddedGltfMaterials(glb);

    expect(material.colorHex).toBe('#7c7c7c');
    expect(material.colorHex).not.toBe('#333333');
  });

  it('κατεστραμμένο input (λάθος magic / σκουπίδια / άδειο) → [] χωρίς throw', () => {
    const garbage = new TextEncoder().encode('not a glb file at all').buffer;
    const empty = new ArrayBuffer(0);

    expect(() => readEmbeddedGltfMaterials(garbage)).not.toThrow();
    expect(readEmbeddedGltfMaterials(garbage)).toEqual([]);
    expect(readEmbeddedGltfMaterials(empty)).toEqual([]);
    expect(readEmbeddedGltfMaterials('')).toEqual([]);
    expect(readEmbeddedGltfMaterials('{{{ not json')).toEqual([]);
  });

  it('εξωτερικό uri (όχι data:) → albedo: null· το υπόλοιπο υλικό επιστρέφεται κανονικά', () => {
    const glb = buildGlb({
      images: [{ uri: 'textures/wood.jpg' }],
      textures: [{ source: 0 }],
      materials: [
        {
          name: 'ExternalTex',
          pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 0.5], baseColorTexture: { index: 0 } },
        },
      ],
    });

    const [material] = readEmbeddedGltfMaterials(glb);

    expect(material.name).toBe('ExternalTex');
    expect(material.albedo).toBeNull();
    expect(material.opacity).toBe(0.5);
  });
});

describe('readEmbeddedGltfMaterials — .gltf JSON κείμενο', () => {
  it('data-URI εικόνα → σωστά bytes + mimeType', () => {
    const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x11, 0x22]);
    const base64 = Buffer.from(imageBytes).toString('base64');

    const gltf = {
      images: [{ uri: `data:image/jpeg;base64,${base64}` }],
      textures: [{ source: 0 }],
      materials: [
        { name: 'Tex', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
      ],
    };

    const [material] = readEmbeddedGltfMaterials(JSON.stringify(gltf));

    expect(material.albedo).not.toBeNull();
    expect(material.albedo?.mimeType).toBe('image/jpeg');
    expect(material.albedo?.fileName).toBe('gltf-mat-0.jpg');
    expect(Array.from(material.albedo?.bytes ?? [])).toEqual(Array.from(imageBytes));
  });
});
