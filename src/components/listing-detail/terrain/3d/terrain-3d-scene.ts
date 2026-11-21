/**
 * @fileoverview **Η ΣΚΗΝΗ ΤΟΥ ΕΔΑΦΟΥΣ** — επιφάνεια, όγκος χώματος, ισοϋψείς, φως, από τα buffers του Β6.4 (ADR-920 §14.5).
 * @related `@/lib/terrain/publication/terrain-3d-geometry` (κάθε γεωμετρική απόφαση) · `terrain-3d-palette.ts`
 * @module components/listing-detail/terrain/3d/terrain-3d-scene
 *
 * 🔑 **Μόνο ανέβασμα, καμία γεωμετρία εδώ**: τα typed arrays μπαίνουν όπως είναι. Τα χρώματα είναι ήδη γραμμικά.
 * 🔑 **Επίπεδη σκίαση από το υλικό** (`flatShading`): η κάθετη ανά τρίγωνο βγαίνει από τις παραγώγους στο shader. Ο
 *   viewer κάνει `toNonIndexed()` + `computeVertexNormals()` — ίδια εικόνα, αλλά τριπλάσιες κορυφές· εδώ, σε κινητό
 *   επισκέπτη, οι κορυφές μένουν όσες είναι και δεν χρειάζεται καν πίνακας καθέτων.
 * 🔑 **Οι ισοϋψείς ποτέ «μέσα» στο έδαφος**: `polygonOffset` σπρώχνει την επιφάνεια και το χώμα ελάχιστα πίσω στο βάθος,
 *   οπότε η γραμμή στο ακριβές `levelM` κερδίζει χωρίς να «αιωρείται».
 * 🔑 **Κάθε πόρος έχει κάτοχο**: `replace` απελευθερώνει τις παλιές γεωμετρίες, `dispose` τα πάντα.
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

import type { Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

import {
  TERRAIN_3D_CONTOUR_MAJOR_COLOR,
  TERRAIN_3D_CONTOUR_MAJOR_WIDTH_PX,
  TERRAIN_3D_CONTOUR_MINOR_COLOR,
  TERRAIN_3D_CONTOUR_MINOR_WIDTH_PX,
  TERRAIN_3D_GROUND_COLOR,
  TERRAIN_3D_HEMI_INTENSITY,
  TERRAIN_3D_SKY_COLOR,
  TERRAIN_3D_SOIL_COLOR,
  TERRAIN_3D_SUN_ALTITUDE_DEG,
  TERRAIN_3D_SUN_AZIMUTH_DEG,
  TERRAIN_3D_SUN_INTENSITY,
} from './terrain-3d-palette';

export interface Terrain3dScene {
  readonly scene: THREE.Scene;
  readonly objects: Terrain3dObjects;
  /** Νέα γεωμετρία (αλλαγή υπερβολής): ίδια υλικά, οι παλιές γεωμετρίες απελευθερώνονται. */
  replace(geometry: Terrain3dGeometry): void;
  /** Το μέγεθος του καμβά σε CSS px — το `LineMaterial` μετρά το πάχος πάνω του. */
  setLineResolution(widthCss: number, heightCss: number): void;
  dispose(): void;
}

/** Τα αντικείμενα της σκηνής — εξάγεται για τα tests. */
export interface Terrain3dObjects {
  readonly surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  readonly soil: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  readonly major: LineSegments2;
  readonly minor: LineSegments2;
}

/** Μετατόπιση βάθους των στερεών, ώστε η ισοϋψής στο ίδιο ύψος να βγαίνει πάντα μπροστά. */
const SOLID_POLYGON_OFFSET = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } as const;

function indexedGeometry(positions: Float32Array, indices: Uint32Array, colors?: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function contourGeometry(pairs: Float32Array): LineSegmentsGeometry {
  const geometry = new LineSegmentsGeometry();
  if (pairs.length > 0) geometry.setPositions(pairs);
  return geometry;
}

function contourLine(color: number, widthPx: number): LineSegments2 {
  const line = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color, linewidth: widthPx }));
  line.renderOrder = 1;
  return line;
}

/** Γεμίζει (ή ξαναγεμίζει) τα αντικείμενα από τη γεωμετρία· οι προηγούμενες γεωμετρίες απελευθερώνονται. */
function fill(objects: Terrain3dObjects, geometry: Terrain3dGeometry): void {
  const { surface, soil, contours } = geometry;
  swapGeometry(objects.surface, indexedGeometry(surface.positions, surface.indices, surface.colors));
  swapGeometry(objects.soil, indexedGeometry(soil.positions, soil.indices));
  swapGeometry(objects.major, contourGeometry(contours.major));
  swapGeometry(objects.minor, contourGeometry(contours.minor));
  objects.major.visible = contours.major.length > 0;
  objects.minor.visible = contours.minor.length > 0;
}

function swapGeometry<G extends THREE.BufferGeometry>(object: { geometry: G }, next: G): void {
  object.geometry.dispose();
  object.geometry = next;
}

function createObjects(): Terrain3dObjects {
  return {
    surface: new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...SOLID_POLYGON_OFFSET }),
    ),
    soil: new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshLambertMaterial({ color: TERRAIN_3D_SOIL_COLOR, flatShading: true, ...SOLID_POLYGON_OFFSET }),
    ),
    major: contourLine(TERRAIN_3D_CONTOUR_MAJOR_COLOR, TERRAIN_3D_CONTOUR_MAJOR_WIDTH_PX),
    minor: contourLine(TERRAIN_3D_CONTOUR_MINOR_COLOR, TERRAIN_3D_CONTOUR_MINOR_WIDTH_PX),
  };
}

/** Ήλιος από ΒΔ (−X, −Z), στο ύψος της σύμβασης hillshade. Οι συντεταγμένες είναι ήδη κεντραρισμένες στο οικόπεδο. */
function createLights(): THREE.Object3D[] {
  const hemi = new THREE.HemisphereLight(TERRAIN_3D_SKY_COLOR, TERRAIN_3D_GROUND_COLOR, TERRAIN_3D_HEMI_INTENSITY);
  const sun = new THREE.DirectionalLight(0xffffff, TERRAIN_3D_SUN_INTENSITY);
  const azimuth = THREE.MathUtils.degToRad(TERRAIN_3D_SUN_AZIMUTH_DEG);
  const altitude = THREE.MathUtils.degToRad(TERRAIN_3D_SUN_ALTITUDE_DEG);
  // Αζιμούθιο από τον βορρά (−Z) δεξιόστροφα προς την ανατολή (+X).
  sun.position.set(Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude), -Math.cos(azimuth) * Math.cos(altitude));
  return [hemi, sun];
}

/** Η σκηνή του εδάφους (τα `objects` εκτίθενται για τα tests). */
export function createTerrain3dScene(geometry: Terrain3dGeometry): Terrain3dScene {
  const scene = new THREE.Scene();
  const objects = createObjects();
  fill(objects, geometry);
  scene.add(objects.surface, objects.soil, objects.major, objects.minor, ...createLights());
  return {
    scene,
    objects,
    replace: (next) => fill(objects, next),
    setLineResolution: (widthCss, heightCss) => {
      objects.major.material.resolution.set(widthCss, heightCss);
      objects.minor.material.resolution.set(widthCss, heightCss);
    },
    dispose: () => {
      for (const object of [objects.surface, objects.soil, objects.major, objects.minor]) {
        object.geometry.dispose();
        object.material.dispose();
      }
    },
  };
}
