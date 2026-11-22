/**
 * @fileoverview **Η ΕΠΙΘΕΩΡΗΣΗ ΜΕΣΑ ΣΤΗ ΣΚΗΝΗ 3Δ** — βελόνα στο σημείο, καρφίτσα, η ισοϋψής φωτισμένη σε ΟΛΟ της το μήκος, η
 *   γραμμή προφίλ ντυμένη στο έδαφος, το νερό που κυλά (ADR-920 §14.10 Ε2 · Ε3).
 * @related `@/lib/terrain/publication/terrain-3d-geometry` (`terrain3dScenePoint` — η ΜΙΑ αντιστοίχιση snapshot → σκηνή) ·
 *   `terrain-3d-scene.ts` (ίδιο μοτίβο `LineSegments2`) · `terrain-3d-palette.ts`
 * @module components/listing-detail/terrain/3d/terrain-3d-inspect-overlay
 *
 * 🔑 **Ό,τι δείχνει, στέκεται ΠΑΝΩ στα buffers**: κάθε θέση περνά από την ίδια αντιστοίχιση με την επιφάνεια, με την
 *   τρέχουσα υπερβολή. Αλλαγή υπερβολής ⇒ ο ιδιοκτήτης της μηχανής ξανακαλεί `update` με νέο `vertical`.
 * 🔑 **Το υψόμετρο της κάρτας δεν βγαίνει ΠΟΤΕ από εδώ**: η σκηνή είναι υπερβολή, η ανάγνωση είναι του πυρήνα (Mapbox
 *   `exaggerated: false`). Εδώ μόνο ζωγραφίζεται.
 * 🔑 **Το νερό κυλά μόνο αν επιτρέπεται κίνηση** (`prefersReducedMotion`, WCAG 2.3.3): τότε η μηχανή ζητά καρέ όσο
 *   φαίνεται η διαδρομή (`tick` ⇒ `true`)· αλλιώς μένει στατικό και η σκηνή ξαναγυρίζει σε «καρέ μόνο όταν χρειάζεται».
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

import { prefersReducedMotion } from '@/lib/a11y/reduced-motion';
import type { ListingTerrainContour } from '@/lib/terrain/publication/listing-terrain-types';
import {
  terrain3dContourPairs, terrain3dPolylinePairs, terrain3dScenePoint, type Terrain3dVertical,
} from '@/lib/terrain/publication/terrain-3d-geometry';

import {
  TERRAIN_3D_INK_COLOR, TERRAIN_3D_INK_WIDTH_PX, TERRAIN_3D_INSPECT_CONTOUR_COLOR, TERRAIN_3D_INSPECT_CONTOUR_WIDTH_PX,
  TERRAIN_3D_PIN_HEAD_COLOR, TERRAIN_3D_WATER_COLOR, TERRAIN_3D_WATER_WIDTH_PX,
} from './terrain-3d-palette';

/** Σημείο του εδάφους στο πλαίσιο του snapshot (`z` = απόλυτο υψόμετρο). */
export interface GroundPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Ό,τι δείχνει η επιθεώρηση τη στιγμή αυτή — καθαρά δεδομένα, χωρίς three. */
export interface Terrain3dInspectView {
  readonly probe: GroundPoint | null;
  readonly pinned: GroundPoint | null;
  readonly contour: ListingTerrainContour | null;
  /** Τα κομμάτια της τομής πάνω στην επιφάνεια (τα κενά της ΔΕΝ γεφυρώνονται). */
  readonly profileRuns: readonly (readonly GroundPoint[])[];
  readonly flow: readonly GroundPoint[] | null;
}

export interface Terrain3dInspectOverlay {
  /** `sizeM` = μέγεθος δείκτη σε μέτρα σκηνής (ανάλογο του οικοπέδου). */
  update(view: Terrain3dInspectView, vertical: Terrain3dVertical, sizeM: number): void;
  setResolution(widthCss: number, heightCss: number): void;
  /** Προχωρά την κίνηση του νερού· `true` ⇒ θέλει κι άλλο καρέ. */
  tick(deltaMs: number): boolean;
  dispose(): void;
}

/** Η βελόνα σε πολλαπλάσια του μεγέθους δείκτη· η ταχύτητα του νερού σε κύκλους παύλας ανά δευτερόλεπτο. */
const NEEDLE_RATIO = 6;
const DASH_RATIO = 1.5;
const WATER_CYCLES_PER_S = 1.25;

interface Objects {
  readonly needle: LineSegments2;
  readonly probeHead: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly pinHead: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly pinNeedle: LineSegments2;
  readonly contour: LineSegments2;
  readonly profile: LineSegments2;
  readonly water: LineSegments2;
}

function overlayLine(color: number, widthPx: number, dashed = false): LineSegments2 {
  const line = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color, linewidth: widthPx, dashed }));
  line.renderOrder = 2;
  line.visible = false;
  return line;
}

function head(color: number): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color }));
  mesh.renderOrder = 3;
  mesh.visible = false;
  return mesh;
}

function createObjects(): Objects {
  return {
    needle: overlayLine(TERRAIN_3D_INK_COLOR, TERRAIN_3D_INK_WIDTH_PX),
    probeHead: head(TERRAIN_3D_INK_COLOR),
    pinHead: head(TERRAIN_3D_PIN_HEAD_COLOR),
    pinNeedle: overlayLine(TERRAIN_3D_INK_COLOR, TERRAIN_3D_INK_WIDTH_PX),
    contour: overlayLine(TERRAIN_3D_INSPECT_CONTOUR_COLOR, TERRAIN_3D_INSPECT_CONTOUR_WIDTH_PX),
    profile: overlayLine(TERRAIN_3D_INK_COLOR, TERRAIN_3D_INK_WIDTH_PX),
    water: overlayLine(TERRAIN_3D_WATER_COLOR, TERRAIN_3D_WATER_WIDTH_PX, true),
  };
}

/** Νέα τμήματα σε μια γραμμή· κενό ⇒ κρυφή (ένα `LineSegments2` χωρίς θέσεις δεν πρέπει να ζωγραφιστεί). */
function setPairs(line: LineSegments2, pairs: Float32Array): void {
  line.geometry.dispose();
  const geometry = new LineSegmentsGeometry();
  if (pairs.length > 0) geometry.setPositions(pairs);
  line.geometry = geometry;
  line.visible = pairs.length > 0;
}

/** Βελόνα από το έδαφος προς τα πάνω, κεφάλι στην κορυφή. */
function placePin(needle: LineSegments2, headMesh: THREE.Mesh, at: GroundPoint | null, v: Terrain3dVertical, sizeM: number): void {
  if (at === null) {
    setPairs(needle, new Float32Array(0));
    headMesh.visible = false;
    return;
  }
  const [x, y, z] = terrain3dScenePoint(at.x, at.y, at.z, v);
  const top = y + sizeM * NEEDLE_RATIO;
  setPairs(needle, Float32Array.of(x, y, z, x, top, z));
  headMesh.position.set(x, top, z);
  headMesh.scale.setScalar(sizeM);
  headMesh.visible = true;
}

function placeWater(water: LineSegments2, flow: readonly GroundPoint[] | null, v: Terrain3dVertical, sizeM: number): void {
  setPairs(water, flow === null || flow.length < 2 ? new Float32Array(0) : terrain3dPolylinePairs(flow, v));
  if (!water.visible) return;
  water.computeLineDistances();
  water.material.dashSize = sizeM * DASH_RATIO;
  water.material.gapSize = sizeM * DASH_RATIO;
}

function allOf(objects: Objects): (LineSegments2 | THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>)[] {
  return [objects.needle, objects.probeHead, objects.pinHead, objects.pinNeedle, objects.contour, objects.profile, objects.water];
}

function profilePairs(runs: Terrain3dInspectView['profileRuns'], v: Terrain3dVertical): Float32Array {
  const parts = runs.filter((run) => run.length > 1).map((run) => terrain3dPolylinePairs(run, v));
  const out = new Float32Array(parts.reduce((n, part) => n + part.length, 0));
  let o = 0;
  for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}

export function createTerrain3dInspectOverlay(scene: THREE.Scene): Terrain3dInspectOverlay {
  const objects = createObjects();
  scene.add(...allOf(objects));
  return {
    update: (view, v, sizeM) => {
      placePin(objects.needle, objects.probeHead, view.probe, v, sizeM);
      placePin(objects.pinNeedle, objects.pinHead, view.pinned, v, sizeM);
      setPairs(objects.contour, view.contour === null ? new Float32Array(0) : terrain3dContourPairs(view.contour, v));
      setPairs(objects.profile, profilePairs(view.profileRuns, v));
      placeWater(objects.water, view.flow, v, sizeM);
    },
    setResolution: (widthCss, heightCss) => {
      for (const line of [objects.needle, objects.pinNeedle, objects.contour, objects.profile, objects.water]) {
        line.material.resolution.set(widthCss, heightCss);
      }
    },
    tick: (deltaMs) => {
      if (!objects.water.visible || prefersReducedMotion()) return false;
      const cycle = objects.water.material.dashSize + objects.water.material.gapSize;
      objects.water.material.dashOffset -= (deltaMs / 1000) * WATER_CYCLES_PER_S * cycle;
      return true;
    },
    dispose: () => {
      for (const object of allOf(objects)) {
        scene.remove(object);
        object.geometry.dispose();
        object.material.dispose();
      }
    },
  };
}
