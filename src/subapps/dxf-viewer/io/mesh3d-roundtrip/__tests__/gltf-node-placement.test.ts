/**
 * ADR-683 Φ3β — `gltfNodeToPlacement`: ο αντίστροφος του `meshToObject3D`.
 *
 * **Γιατί το test καλεί την πραγματική ευθεία συνάρτηση αντί να ξαναγράψει τον τύπο:** αν το test
 * επαναλάμβανε τη μαθηματική σχέση, θα επιβεβαίωνε τον εαυτό του — και μια μελλοντική αλλαγή
 * σύμβασης αξόνων στο `mesh-to-object3d` θα περνούσε **πράσινη** ενώ η εισαγωγή θα είχε ήδη
 * σπάσει. Κλείνοντας τον κύκλο πάνω στον αληθινό converter, το test πιάνει την **απόκλιση των δύο
 * πλευρών**, που είναι ο μόνος τρόπος να σπάσει αυτό το ζευγάρι.
 *
 * Ο cache mock είναι ο ίδιος με το `mesh-to-object3d.test.ts` (miss → placeholder), ώστε να μην
 * χρειάζεται Storage/GLTFLoader.
 */

import { meshToObject3D, type MeshPlacement } from '../../../bim-3d/converters/mesh-to-object3d';
import { gltfNodeToPlacement, type GltfPlacementContext } from '../gltf-node-placement';

const getInstance = jest.fn();
const preload = jest.fn();
jest.mock('../../../bim-3d/library/bim-mesh-library/bim-mesh-cache', () => ({
  bimMeshCache: {
    getInstance: (...a: unknown[]) => getInstance(...a),
    preload: (...a: unknown[]) => preload(...a),
    getSilhouette: jest.fn(),
    getTopEdges: jest.fn(),
  },
}));

const HEIGHT_MM = 900;
const MM_TO_M = 0.001;

function forwardPlacement(overrides: Partial<MeshPlacement> = {}): MeshPlacement {
  return {
    category: 'imported',
    assetId: 'imesh_x#Rail_01',
    bimId: 'imesh_x',
    bimType: 'imported-mesh',
    matId: 'elem-imported-mesh',
    // ΑΣΥΜΜΕΤΡΑ επίτηδες: με x === y ένα λάθος πρόσημο ή μια εναλλαγή αξόνων θα περνούσε αόρατη.
    position: { x: 3000, y: 5000 },
    rotationDeg: 0,
    scale: 1,
    widthMm: 2000,
    depthMm: 100,
    heightMm: HEIGHT_MM,
    sceneUnits: 'mm',
    floorElevationMm: 3200,
    mountingElevationMm: 150,
    verticalAnchor: 'base',
    buildingBaseElevationM: 0,
    ...overrides,
  };
}

/**
 * Παίρνει ό,τι θα «έβλεπε» ο importer αν ο κόμβος είχε τοποθετηθεί με αυτές τις παραμέτρους:
 * το placeholder κουτί είναι κεντραρισμένο οριζόντια στη θέση και εδράζεται (anchor 'base') στο
 * επίπεδο στήριξης, άρα `minY = centre.y − ύψος/2`.
 */
function worldBoxFromForward(p: MeshPlacement): {
  centre: { x: number; y: number; z: number };
  minY: number;
} {
  getInstance.mockReturnValue(null);
  const obj = meshToObject3D(p);
  const halfHeightM = (p.heightMm * MM_TO_M * (p.scale || 1)) / 2;
  return {
    centre: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    minY: obj.position.y - halfHeightM,
  };
}

beforeEach(() => {
  getInstance.mockReset();
  preload.mockReset();
});

describe('gltfNodeToPlacement — round-trip με τον πραγματικό converter', () => {
  it('επιστρέφει την αρχική θέση κάτοψης και το υψόμετρο έδρασης (mm σκηνή)', () => {
    const forward = forwardPlacement();
    const context: GltfPlacementContext = {
      sceneUnits: forward.sceneUnits,
      floorElevationMm: forward.floorElevationMm,
      buildingBaseElevationM: forward.buildingBaseElevationM,
    };

    const back = gltfNodeToPlacement(worldBoxFromForward(forward), context);

    expect(back.position.x).toBeCloseTo(forward.position.x, 6);
    expect(back.position.y).toBeCloseTo(forward.position.y, 6);
    expect(back.mountingElevationMm).toBeCloseTo(forward.mountingElevationMm, 6);
  });

  it('κλείνει τον κύκλο και σε σκηνή μέτρων με βάση κτηρίου ≠ 0', () => {
    const forward = forwardPlacement({
      sceneUnits: 'm',
      position: { x: 3, y: 5 },
      floorElevationMm: 2800,
      mountingElevationMm: -40,
      buildingBaseElevationM: 12.5,
    });
    const context: GltfPlacementContext = {
      sceneUnits: 'm',
      floorElevationMm: forward.floorElevationMm,
      buildingBaseElevationM: forward.buildingBaseElevationM,
    };

    const back = gltfNodeToPlacement(worldBoxFromForward(forward), context);

    expect(back.position.x).toBeCloseTo(3, 6);
    expect(back.position.y).toBeCloseTo(5, 6);
    expect(back.mountingElevationMm).toBeCloseTo(-40, 6);
  });
});

describe('gltfNodeToPlacement — η σύμβαση αξόνων', () => {
  it('three +z (Νότος) → κάτοψη ΑΡΝΗΤΙΚΟ y· λάθος πρόσημο = καθρεφτισμένη εισαγωγή', () => {
    const back = gltfNodeToPlacement(
      { centre: { x: 2, y: 0, z: 7 }, minY: 0 },
      { sceneUnits: 'm', floorElevationMm: 0 },
    );

    expect(back.position.x).toBeCloseTo(2, 6);
    expect(back.position.y).toBeCloseTo(-7, 6);
  });

  it('χρησιμοποιεί το minY (έδρα), ΟΧΙ το κέντρο — αλλιώς κάθε αντικείμενο βυθίζεται μισό ύψος', () => {
    // Κουτί ύψους 1m που κάθεται στα 3m: centre.y = 3.5, minY = 3.
    const back = gltfNodeToPlacement(
      { centre: { x: 0, y: 3.5, z: 0 }, minY: 3 },
      { sceneUnits: 'm', floorElevationMm: 0 },
    );

    expect(back.mountingElevationMm).toBeCloseTo(3000, 6);
  });

  it('αφαιρεί τη βάση κτηρίου ώστε το υψόμετρο να είναι σχετικό με τον όροφο', () => {
    const back = gltfNodeToPlacement(
      { centre: { x: 0, y: 0, z: 0 }, minY: 10 },
      { sceneUnits: 'm', floorElevationMm: 3000, buildingBaseElevationM: 6 },
    );

    // 10m παγκόσμιο − 6m βάση = 4m πάνω από τη βάση· − 3m όροφος = 1m πάνω από το δάπεδο.
    expect(back.mountingElevationMm).toBeCloseTo(1000, 6);
  });
});
