/**
 * ADR-668 — **headless** BIM → THREE build for the 3Δ export.
 *
 * Η κεντρική αρχιτεκτονική απόφαση του ADR ζει εδώ: ο exporter **χτίζει τη δική του σκηνή
 * offscreen** αντί να διαβάζει το ζωντανό `getActiveSceneManager()`.
 *
 * **Γιατί:** το dialog «Εξαγωγή Σχεδίου» τρέχει και από **2D**, όπου δεν υπάρχει mounted 3D
 * viewport. Το PoC έσκαγε εκεί (`GLB_POC_NO_ACTIVE_SCENE`) — αλλά αυτό ήταν αυτο-επιβαλλόμενο
 * όριο του PoC, όχι αρχιτεκτονική ανάγκη: ο `BimSceneLayer` θέλει μόνο `new THREE.Scene()` και
 * ο `BimToThreeConverter` είναι καθαρές συναρτήσεις — μηδέν WebGL/DOM/React (το αποδεικνύουν
 * δεκάδες υπάρχοντα `BimSceneLayer-*.test.ts` που τρέχουν χωρίς renderer). Ίδιο μοτίβο με το
 * ήδη-production `detail-3d-capture-core.ts` («fully offscreen, ADR-040 safe»).
 *
 * **Γιατί όχι ο live store:** το `useBim3DEntitiesStore` έχει μόνο τον **ενεργό** όροφο και το
 * `getMultiFloorStack()` είναι **άδειο** αν ο χρήστης δεν έχει πατήσει «Όλοι». Δηλαδή ο live
 * store δεν μπορεί καν να σερβίρει το «όλοι οι όροφοι». Τα `ExportDeps.levelScenes` μπορούν,
 * ομοιόμορφα, για κάθε εύρος.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import * as THREE from 'three';
import { BimSceneLayer } from '../../../bim-3d/scene/BimSceneLayer';
import { extractBim3DEntities } from '../../../bim-3d/scene/extract-bim3d-entities';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../../bim-3d/scene/floor-stack-elevation';
import type { FloorStackEntry } from '../../../bim-3d/scene/multi-floor-3d-source';
import type { ResolvedExportFloor } from '../export-floor-scope';
import type { ExportDeps } from '../../types';

export interface Mesh3dBuildResult {
  /** Ρίζα με τα BIM meshes. Ο caller την σερβίρει στους serialisers. */
  readonly root: THREE.Object3D;
  readonly meshCount: number;
  /**
   * ADR-668 — ids που η **οθόνη** έκρυβε (V/G, isolate, κλειστό layer, discipline) αλλά
   * χτίστηκαν ούτως ή άλλως. Ο caller τα σημαδεύει με `HIDDEN_` όνομα + διαφανές υλικό.
   */
  readonly hiddenEntityIds: ReadonlySet<string>;
  readonly warnings: string[];
}

/** Υψόμετρο FFL (mm) ανά όροφο, σχετικά με το datum του κτιρίου. */
function buildStackEntries(
  floors: readonly ResolvedExportFloor[],
  deps: ExportDeps,
): { entries: FloorStackEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const buildingFloors = deps.floors ?? [];

  // Fail-closed: σιωπηλή στοίβαξη στο Z=0 θα έβγαζε κτίριο πατημένο σε ένα επίπεδο.
  if (floors.length > 1 && buildingFloors.length === 0) {
    throw new Error('MESH3D_MISSING_FLOOR_ELEVATIONS');
  }

  const datumM = resolveBuildingDatumElevationM(buildingFloors);
  const entries: FloorStackEntry[] = [];

  for (const floor of floors) {
    const ref = buildingFloors.find((f) => f.id === floor.level.floorId);
    if (ref === undefined && floors.length > 1) {
      warnings.push(`Ο όροφος «${floor.level.name}» δεν έχει σύνδεση με κτίριο — τοποθετήθηκε στο datum.`);
    }
    entries.push({
      levelId: floor.level.id,
      floorElevationMm: resolveFloorDatumRelativeElevationMm(ref?.elevation, datumM),
      entities: extractBim3DEntities(floor.scene),
    });
  }

  return { entries: withStoreyCeilings(entries), warnings };
}

/**
 * ADR-448 Phase 1b — κάθε όροφος χρειάζεται το FFL του **επόμενου** ορόφου ως ταβάνι· χωρίς
 * αυτό οι τοίχοι πέφτουν σε fallback ύψος αντί να φτάνουν στην πλάκα από πάνω. Το «επόμενος»
 * ορίζεται κατά υψόμετρο, όχι κατά σειρά εισόδου.
 */
function withStoreyCeilings(entries: readonly FloorStackEntry[]): FloorStackEntry[] {
  const sorted = [...entries].sort((a, b) => a.floorElevationMm - b.floorElevationMm);
  return sorted.map((entry, i) => {
    const next = sorted[i + 1];
    return next === undefined ? entry : { ...entry, nextFloorElevationMm: next.floorElevationMm };
  });
}

function countMeshes(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh === true) n += 1;
  });
  return n;
}

/**
 * Χτίζει μία σκηνή για τους δοσμένους ορόφους. Ένας όροφος ή πολλοί — **ίδιο μονοπάτι**
 * (`syncMultiFloor` με stack μεγέθους 1..N), οπότε δεν υπάρχει δεύτερη σημασιολογία να
 * αποκλίνει· τα υψόμετρα στοίβαξης είναι τα ίδια που βλέπει η 3Δ όψη «Όλοι οι όροφοι».
 */
export function buildMesh3dScene(
  floors: readonly ResolvedExportFloor[],
  deps: ExportDeps,
): Mesh3dBuildResult {
  const { entries, warnings } = buildStackEntries(floors, deps);

  const scene = new THREE.Scene();
  // ADR-668 — `includeHidden`: η εξαγωγή κουβαλά **ολόκληρο** το μοντέλο, όχι ό,τι έτυχε να
  // είναι αναμμένο στην οθόνη (απόφαση Giorgio 2026-07-17). Ό,τι ήταν σβηστό ταξιδεύει
  // σημαδεμένο ως `HIDDEN_`, ώστε ο χρήστης να το ξανακρύψει ή να το εμφανίσει στο C4D.
  const layer = new BimSceneLayer(scene, { includeHidden: true });
  layer.syncMultiFloor(entries, deps.floors ?? [], deps.buildings ?? [], deps.activeBuildingId ?? null);

  const meshCount = countMeshes(layer.group);
  if (meshCount === 0) {
    warnings.push('Δεν βρέθηκε καμία 3Δ οντότητα στους επιλεγμένους ορόφους.');
  }

  // Αποσύνδεση από τη σκηνή-όχημα: οι serialisers θέλουν μόνο το BIM υποδέντρο (καθαρό από
  // grid/φώτα/helpers — εκεί ζει και το ShaderMaterial που δεν υποστηρίζει ο GLTFExporter).
  scene.remove(layer.group);
  return {
    root: layer.group,
    meshCount,
    // Αντιγραφή: το `hiddenEntityIds` του layer καθαρίζεται στο επόμενο sync.
    hiddenEntityIds: new Set(layer.hiddenEntityIds),
    warnings,
  };
}
