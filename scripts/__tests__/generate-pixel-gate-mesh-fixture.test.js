/**
 * ADR-909 Γ1β — τα `.glb` της πύλης pixels (CHECK 3.101) είναι **αυτά που γράφει ο γεννήτορας**.
 *
 * Τα αρχεία είναι δεσμευμένα (η σελίδα της πύλης τα ζητά ως στατικά)· ο γεννήτορας είναι η αυθεντία τους. Χωρίς
 * αυτή την άγκυρα, αλλαγή στο script που δεν ξαναγράφει τα αρχεία (ή το αντίστροφο) περνά σιωπηλά, και η πύλη
 * κρίνει σχήμα που κανείς δεν περιγράφει πια.
 */

const fs = require('fs');
const path = require('path');

const { buildPixelGateMeshFixtures } = require('../generate-pixel-gate-mesh-fixture');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'public', 'test-fixtures', 'pixel-gate');

/** Το JSON chunk ενός GLB (header 12 bytes · chunk header 8 bytes · JSON). */
function gltfJsonOf(bytes) {
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
}

describe('pixel-gate mesh fixtures (ADR-909 Γ1β)', () => {
  const fixtures = buildPixelGateMeshFixtures();

  it('Φ1 ντετερμινιστικά: δύο εκτελέσεις ⇒ ίδια bytes', () => {
    const again = buildPixelGateMeshFixtures();
    for (const [name, bytes] of Object.entries(fixtures)) {
      expect(again[name].equals(bytes)).toBe(true);
    }
  });

  it.each(Object.keys(fixtures))('Φ2 🔴 το δεσμευμένο `%s` είναι αυτό που γράφει ο γεννήτορας', (name) => {
    const committed = fs.readFileSync(path.join(FIXTURE_DIR, name));
    // Αν κοκκινίσει: `node scripts/generate-pixel-gate-mesh-fixture.js`
    expect(committed.equals(fixtures[name])).toBe(true);
  });

  it('Φ3 το bundle έχει τους ΔΥΟ κόμβους που ζητούν τα δείγματα — και ο δίχρωμος δηλώνει τα υλικά του', () => {
    const json = gltfJsonOf(fixtures['pixel-gate-bundle.glb']);
    expect(json.nodes.map((node) => node.name)).toEqual(['PixelGateSolid', 'PixelGateTwoTone']);
    expect(json.meshes[0].primitives).toHaveLength(1);
    expect(json.meshes[1].primitives).toHaveLength(2);
    // Χωρίς αυτό το `extras` ο δίχρωμος κόμβος σπάει σε δύο ανεξάρτητα αντικείμενα (`collectAddressableGltfNodes`).
    expect(json.nodes[1].extras.faceKeyByMaterialIndex).toHaveLength(2);
    expect(json.materials.map((material) => material.name)).toEqual([
      'PixelGateSteel',
      'PixelGateBase',
      'PixelGateSeat',
    ]);
  });

  it('Φ4 το μονό αρχείο έχει ΕΝΑ αντικείμενο (έπιπλο / είδος υγιεινής: `assetId` ⇒ ολόκληρο το αρχείο)', () => {
    const json = gltfJsonOf(fixtures['pixel-gate-shape.glb']);
    expect(json.nodes).toHaveLength(1);
    expect(json.buffers[0].byteLength % 4).toBe(0);
  });
});
