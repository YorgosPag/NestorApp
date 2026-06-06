/**
 * roof-eave-detail-mesh — ADR-417 Φ2b. Γείσο (overhang/fascia/soffit) → THREE.
 *
 * Λεπτός THREE wrapper πάνω από τον pure πυρήνα `bim/geometry/roof-eave-detail.ts`:
 * μετατρέπει κάθε `RoofEaveQuad` (roof-coord) σε `THREE.BufferGeometry`,
 * προσανατολίζοντας το winding ώστε το κανονικό να συμφωνεί με το `normalHint`
 * (το y-flip του world αλλιώς αντιστρέφει το πρόσημο). UNITS-SAFE μέσω
 * `roof-world-transform`· UVs μέσω `setBoxWorldUvs` (1 UV unit = 1 m, ADR-413).
 *
 * Pure (THREE math μόνο, zero React). Καθένα <40 γραμμές.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see bim/geometry/roof-eave-detail.ts — ο pure πυρήνας
 */

import * as THREE from 'three';
import type { RoofEaveQuad } from '../../bim/geometry/roof-eave-detail';
import type { Point3D } from '../../bim/types/bim-base';
import { setBoxWorldUvs, setSlopeAlignedTileUvs, type SlopeTileUvOptions } from './bim-uv-helpers';
import { MM_TO_M, toWorld } from './roof-world-transform';

/** Διεύθυνση roof-coord → world (γραμμικό μέρος του `toWorld`, χωρίς μετάθεση). */
function dirToWorld(d: Point3D, sceneToM: number): THREE.Vector3 {
  return new THREE.Vector3(d.x * sceneToM, (d.z ?? 0) * MM_TO_M, -d.y * sceneToM);
}

/** World κορυφές ενός quad (canvas xy + mm z → m, + baseY). */
function quadWorldVertices(quad: RoofEaveQuad, sceneToM: number, baseY: number): THREE.Vector3[] {
  return quad.outline.map((v) => {
    const p = toWorld(v.x, v.y, v.z ?? 0, sceneToM);
    p.y += baseY;
    return p;
  });
}

/** Γεωμετρικό κανονικό του τριγώνου v0,v1,v2 (μη κανονικοποιημένο). */
function triNormal(v: readonly THREE.Vector3[]): THREE.Vector3 {
  return new THREE.Vector3()
    .subVectors(v[1], v[0])
    .cross(new THREE.Vector3().subVectors(v[2], v[0]));
}

/**
 * Ένα quad γείσου → `BufferGeometry`. Δύο τρίγωνα (0-1-2, 0-2-3)· αν το κανονικό
 * δείχνει αντίθετα από το `normalHint`, αντιστρέφει το winding ώστε η όψη να
 * βλέπει σωστά (έξω/πάνω/κάτω). Null αν degenerate.
 *
 * ADR-417 #5 — όταν δοθεί `slopeTileOpts` (μόνο το overhang strip, που συνεχίζει το
 * νερό) η UV είναι slope-aligned με τα ΙΔΙΑ tile dims της κύριας στέγης ⇒ τα
 * κεραμίδια της προέκτασης συνεχίζουν αδιάλειπτα. Αλλιώς (fascia/soffit) box-UV.
 */
export function buildEaveQuadGeometry(
  quad: RoofEaveQuad,
  sceneToM: number,
  baseY: number,
  slopeTileOpts?: SlopeTileUvOptions,
): THREE.BufferGeometry | null {
  const w = quadWorldVertices(quad, sceneToM, baseY);
  if (w.length !== 4) return null;
  const normal = triNormal(w);
  if (normal.lengthSq() < 1e-12) return null;
  const flip = normal.dot(dirToWorld(quad.normalHint, sceneToM)) < 0;
  const order = flip ? [0, 3, 2, 1] : [0, 1, 2, 3];

  const positions = new Float32Array(12);
  for (let k = 0; k < 4; k++) {
    const p = w[order[k]];
    positions[k * 3] = p.x;
    positions[k * 3 + 1] = p.y;
    positions[k * 3 + 2] = p.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  if (slopeTileOpts) setSlopeAlignedTileUvs(flat, slopeTileOpts);
  else setBoxWorldUvs(flat);
  return flat;
}
