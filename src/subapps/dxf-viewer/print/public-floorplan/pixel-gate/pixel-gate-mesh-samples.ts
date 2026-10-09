/**
 * @fileoverview Τα δείγματα της πύλης pixels που ζωγραφίζονται από **σχήμα 3Δ** (`.glb`) — έπιπλο, είδος υγιεινής, εισαγόμενο πλέγμα (CHECK 3.101).
 * @related ADR-909 §6.8 (Γ1β) · ADR-411 · ADR-683 · scripts/generate-pixel-gate-mesh-fixture.js
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/pixel-gate-mesh-samples
 *
 * 🔴 **Γιατί δικά τους αρχεία**: η σελίδα της πύλης τρέχει χωρίς σύνδεση, και το Storage δίνει τα `.glb` μόνο σε
 * συνδεδεμένο. Χωρίς δηλωμένο URL αυτά τα τρία δείγματα έβγαιναν **κουτί-εφεδρεία** σε κάθε εκτέλεση, και η πύλη
 * έκρινε το κουτί (μετρημένο: `K5 … furniture (300 px)` σε 2 από 5 — η μετάβαση διακεκομμένο → συμπαγές).
 *
 * 🔑 Τα αναγνωριστικά εδώ είναι **μόνο της πύλης** (`pixel-gate-*`): η δήλωση URL δεν αγγίζει κανένα πραγματικό
 * στοιχείο βιβλιοθήκης. Ο δρόμος είναι ο πραγματικός — `registerMeshAssetUrl` → `bimMeshCache.preload` →
 * `GLTFLoader` → σιλουέτα — και τα σχήματα είναι **Γ**, ώστε σιλουέτα και κουτί να μη μοιάζουν.
 *
 * Τρεις δρόμοι ζωγράφου, και οι τρεις μετριούνται:
 *  - έπιπλο / είδος υγιεινής με `assetId` → σιλουέτα + εσωτερικές ακμές (`drawMeshSilhouette`)·
 *  - εισαγόμενο, ένα υλικό → περίγραμμα γεμίσματος + **ακριβής ένωση στον worker** (`drawMeshContourFill`)·
 *  - εισαγόμενο, δύο υλικά → poché ανά υλικό (`drawMeshSlotSilhouettes`).
 */

import type { RenderableEntityType } from '../../../rendering/contract/renderable-entity-type';
import { registerMeshAssetUrl } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-url-resolver';
import { FURNITURE_MESH_CATEGORY } from '../../../bim/mesh-library/entity-mesh-asset';
import { resolveFixtureMeshCategory } from '../../../bim/types/mep-fixture-types';
import { IMPORTED_MESH_CATEGORY } from '../../../bim/entities/imported-mesh/imported-mesh-types';
import {
  buildImportedMeshEntity,
  type ImportedMeshSource,
} from '../../../bim/entities/imported-mesh/build-imported-mesh-entity';
import { buildDefaultFurnitureParams, buildFurnitureEntity } from '../../../hooks/drawing/furniture-completion';
import { buildDefaultMepFixtureParams, buildMepFixtureEntity } from '../../../hooks/drawing/mep-fixture-completion';
import type { CellGeometry, SampleFactory } from './pixel-gate-sample-kit';
import { LAYER_ID, built, present } from './pixel-gate-sample-kit';

/** Τα αρχεία του `scripts/generate-pixel-gate-mesh-fixture.js`, όπως τα σερβίρει η εφαρμογή. */
const SHAPE_URL = '/test-fixtures/pixel-gate/pixel-gate-shape.glb';
const BUNDLE_URL = '/test-fixtures/pixel-gate/pixel-gate-bundle.glb';

/** `assetId` του ενός αντικειμένου (έπιπλο / είδος υγιεινής) και `uploadId` της «εισαγωγής» — μόνο της πύλης. */
const SHAPE_ASSET_ID = 'pixel-gate-shape';
const BUNDLE_UPLOAD_ID = 'pixel-gate-bundle';
/** Είδος υγιεινής ⇒ κατηγορία `sanitary`: ο δρόμος «WC από τη βιβλιοθήκη», που το προεπιλεγμένο δείγμα δεν έχει. */
const SANITARY_SAMPLE_KIND = 'wc';

/** Μισή απόσταση (mm) ανάμεσα σε δύο στοιχεία του ίδιου κελιού: σχήμα 1,6 m το καθένα, κελί 5 m. */
const PAIR_OFFSET_MM = 1000;

/**
 * **Δήλωσε πού ζουν τα σχήματα της πύλης.** Καλείται από το όργανο πριν από την πρώτη λήψη. Idempotent.
 */
export function registerPixelGateMeshFixtures(): void {
  registerMeshAssetUrl(FURNITURE_MESH_CATEGORY, SHAPE_ASSET_ID, SHAPE_URL);
  registerMeshAssetUrl(resolveFixtureMeshCategory(SANITARY_SAMPLE_KIND), SHAPE_ASSET_ID, SHAPE_URL);
  // Ανά **αρχείο**, όχι ανά κόμβο — όπως το `registerImportedMeshAsset` (οι κόμβοι ευρετηριάζονται μετά τη φόρτωση).
  registerMeshAssetUrl(IMPORTED_MESH_CATEGORY, BUNDLE_UPLOAD_ID, BUNDLE_URL);
}

/** Ό,τι θα είχε μετρήσει η εισαγωγή για έναν κόμβο του αρχείου δοκιμής (τα σχήματα τα γράφει το script). */
interface BundleNode {
  readonly nodeName: string;
  readonly materialSlots: readonly string[];
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly areaM2: number;
}

const SOLID_NODE: BundleNode = {
  nodeName: 'PixelGateSolid',
  materialSlots: ['PixelGateSteel'],
  vertexCount: 48,
  triangleCount: 24,
  areaM2: 8.64,
};

const TWO_TONE_NODE: BundleNode = {
  nodeName: 'PixelGateTwoTone',
  materialSlots: ['PixelGateBase', 'PixelGateSeat'],
  vertexCount: 72,
  triangleCount: 36,
  areaM2: 10.96,
};

function importedOf(node: BundleNode, x: number, y: number) {
  const source: ImportedMeshSource = {
    uploadId: BUNDLE_UPLOAD_ID,
    storagePath: BUNDLE_URL,
    sourceFileName: 'pixel-gate-bundle.glb',
    nodeName: node.nodeName,
    sourceMaterialName: node.materialSlots[0],
    materialSlots: node.materialSlots,
    // Και οι δύο κόμβοι έχουν το ίδιο κουτί: 1,6 × 0,6 (ύψος) × 1,6 m.
    signature: {
      vertexCount: node.vertexCount,
      triangleCount: node.triangleCount,
      sizeM: [1.6, 0.6, 1.6],
      centroidM: [0.8, 0.3, 0.8],
      areaM2: node.areaM2,
    },
    // Ο όγκος δεν μετρήθηκε για το αρχείο δοκιμής — και η κάτοψη δεν τον ρωτά.
    solid: { isWatertight: false, volumeM3: null },
    position: { x, y, z: 0 },
    sceneUnits: 'mm',
    layerId: LAYER_ID,
  };
  return present('imported-mesh', buildImportedMeshEntity(source));
}

function furnitureOf(cell: CellGeometry) {
  const params = buildDefaultFurnitureParams(cell.centre, { assetId: SHAPE_ASSET_ID });
  return [built('furniture', buildFurnitureEntity(params, LAYER_ID))];
}

/** Δύο είδη στο ίδιο κελί: το **παραμετρικό** (προεπιλογή του εργαλείου) και ένα **από σχήμα** (`assetId`). */
function mepFixtureOf(cell: CellGeometry) {
  const { x, y } = cell.centre;
  const parametric = buildDefaultMepFixtureParams({ x: x - PAIR_OFFSET_MM, y });
  const fromMesh = buildDefaultMepFixtureParams(
    { x: x + PAIR_OFFSET_MM, y },
    { kind: SANITARY_SAMPLE_KIND, assetId: SHAPE_ASSET_ID },
  );
  return [
    built('mep-fixture', buildMepFixtureEntity(parametric, LAYER_ID)),
    built('mep-fixture', buildMepFixtureEntity(fromMesh, LAYER_ID)),
  ];
}

/** Δύο κόμβοι του ίδιου αρχείου: ένα υλικό (περίγραμμα + worker) και δύο υλικά (poché). */
function importedMeshOf(cell: CellGeometry) {
  const { x, y } = cell.centre;
  return [importedOf(SOLID_NODE, x - PAIR_OFFSET_MM, y), importedOf(TWO_TONE_NODE, x + PAIR_OFFSET_MM, y)];
}

export const PIXEL_GATE_MESH_SAMPLES: Readonly<
  Record<Extract<RenderableEntityType, 'furniture' | 'mep-fixture' | 'imported-mesh'>, SampleFactory>
> = {
  furniture: furnitureOf,
  'mep-fixture': mepFixtureOf,
  'imported-mesh': importedMeshOf,
};
