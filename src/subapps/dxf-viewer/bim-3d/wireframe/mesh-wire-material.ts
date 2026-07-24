/**
 * mesh-wire-material — το ΕΝΑ material που ζωγραφίζει τις ακμές πλέγματος (ADR-689 Φ3).
 *
 * Στηρίζεται σε stock `MeshBasicMaterial` + `onBeforeCompile`, ώστε να **κρατήσει τα
 * `<clipping_planes_*>` chunks** και να παραμείνει στο allowlist του `section-clip-applicator`
 * (ADR-452). Ένα `ShaderMaterial` θα ήταν πιο «καθαρό» στα χαρτιά και θα έσπαγε το Section Box.
 *
 * ## Δύο εμφανίσεις, ένα pass
 *
 *   - **Συρμάτινο** (`faceMode: 'none'`) — μόνο οι γραμμές· ό,τι δεν είναι γραμμή γίνεται `discard`.
 *     x-ray (`depthTest:false`), όπως ορίζει το ADR-446 για το `edgeMode:'all'`: χωρίς όψεις δεν
 *     υπάρχει τίποτα να κρύψει τις πίσω ακμές.
 *   - **Κρυφή Γραμμή** (`faceMode: 'hidden-line'`) — αδιαφανείς λευκές όψεις-occluder **μαζί** με
 *     τις ακμές τους σε ένα draw. Η κλασική υλοποίηση θέλει δύο περάσματα (occluder + edge overlay)·
 *     εδώ το `mix()` στο fragment τα ενώνει.
 *
 * ## Χρώμα χωρίς tone mapping
 *
 * `toneMapped:false`: αυτές είναι **σχεδιαστικές** γραμμές, όχι φωτορεαλιστική επιφάνεια. Ο χρήστης
 * πρέπει να παίρνει ακριβώς την απόχρωση του `bim-edge-colors`, όχι μια εκδοχή περασμένη από ACES.
 *
 * ## Πάχος και DPR
 *
 * Το `fwidth` του shader δουλεύει σε **framebuffer pixels**, που ήδη ενσωματώνουν το
 * `devicePixelRatio` — γι' αυτό το πάχος πολλαπλασιάζεται εδώ με το DPR και δεν χρειάζεται
 * uniform ανάλυσης οθόνης (σε αντίθεση με το `LineMaterial` του `buildEdgeOverlay`, που κάνει τη
 * διαστολή μόνο του και ΓΙ' ΑΥΤΟ χρειάζεται το `bimEdgeResolutionStore`).
 *
 * @see ./mesh-wire-shader — τα GLSL κομμάτια που εγχέονται
 * @see ../materials/face-mode-materials — ο λευκός occluder των δομικών (ίδια σημασιολογία)
 */

import * as THREE from 'three';
import { FACE_POLYGON_OFFSET_FACTOR, FACE_POLYGON_OFFSET_UNITS } from '../materials/material-depth-priority';
import {
  WIRE_FRAGMENT_COVERAGE,
  WIRE_FRAGMENT_HEADER,
  WIRE_FRAGMENT_RESOLVE,
  WIRE_VERTEX_BODY,
  WIRE_VERTEX_HEADER,
} from './mesh-wire-shader';

/** Οι δύο εμφανίσεις — αντιστοιχούν 1:1 στα face modes `none` και `hidden-line` του ADR-446. */
export type MeshWireFill = 'wireframe' | 'hidden-line';

/** Το χρώμα των όψεων στην «Κρυφή Γραμμή» (λευκός occluder, mirror του `buildHiddenLineFaceMaterial`). */
const HIDDEN_LINE_FILL_COLOR = '#ffffff';

/**
 * Κλειδί program cache. **Υποχρεωτικό** όταν χρησιμοποιείται `onBeforeCompile`: χωρίς αυτό το three
 * θεωρεί δύο `MeshBasicMaterial` με ίδια defines ισοδύναμα και μπορεί να δώσει σε αυτό εδώ το
 * μεταγλωττισμένο πρόγραμμα ενός ΑΛΛΟΥ basic material (π.χ. ενός snap marker) — δηλαδή wireframe
 * χωρίς τον κώδικα του wireframe.
 */
const WIRE_PROGRAM_CACHE_KEY = 'bim-mesh-wire';

/** Το wireframe ζωγραφίζεται μετά τις κανονικές όψεις (mirror του edge overlay renderOrder). */
const WIRE_RENDER_ORDER = 2;

/** Σήμανση για tests / idempotency — «αυτό το material το έφτιαξε το ADR-689 Φ3». */
export const MESH_WIRE_MATERIAL_FLAG = 'bimMeshWireMaterial';

export interface MeshWireMaterialOptions {
  /** Χρώμα ακμής (CSS hex) — από το `bim-edge-colors` SSoT. */
  readonly color: string;
  /** Ποια από τις δύο εμφανίσεις. */
  readonly fill: MeshWireFill;
  /** Πάχος σε CSS pixels (πριν το DPR). */
  readonly widthPx: number;
  /** Προ-επιλυμένο DPR (test injection). Default: `window.devicePixelRatio`. */
  readonly devicePixelRatio?: number;
}

/** Το DPR του περιβάλλοντος, με SSR-safe fallback. */
function resolveDpr(explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  return typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
    ? window.devicePixelRatio
    : 1;
}

/** Οι ρυθμίσεις βάθους/διαφάνειας που διαφέρουν ανά εμφάνιση. */
function depthParamsFor(fill: MeshWireFill): THREE.MeshBasicMaterialParameters {
  if (fill === 'hidden-line') {
    return {
      transparent: false,
      depthTest: true,
      depthWrite: true,
      // Ίδιο offset με τις δομικές όψεις, ώστε τα coplanar edge overlays να μη z-fight-άρουν.
      polygonOffset: true,
      polygonOffsetFactor: FACE_POLYGON_OFFSET_FACTOR,
      polygonOffsetUnits: FACE_POLYGON_OFFSET_UNITS,
    };
  }
  // Συρμάτινο: x-ray (ADR-446 edgeMode 'all') — καμία όψη δεν υπάρχει για να κρύψει ακμές.
  return { transparent: true, depthTest: false, depthWrite: false };
}

/**
 * Χτίζει ΑΠΟΚΛΕΙΣΤΙΚΟ (μη-memoised) wire material. Αποκλειστικό επίτηδες: το three.js clipping
 * είναι per-material, οπότε ένα κοινό singleton θα έκοβε ολόκληρο το κτίριο με τα planes ενός mesh
 * (ADR-665). Ένα material ανά mesh, όπως ήδη κάνει το `buildInvisibleFaceMaterial`.
 */
export function buildMeshWireMaterial(opts: MeshWireMaterialOptions): THREE.MeshBasicMaterial {
  const wireColor = new THREE.Color(opts.color);
  // Στο Συρμάτινο το «γέμισμα» είναι το ίδιο το χρώμα γραμμής, ώστε η ζώνη anti-aliasing να σβήνει
  // σε διαφάνεια και όχι σε ξένη απόχρωση (halo).
  const fillColor = opts.fill === 'hidden-line' ? new THREE.Color(HIDDEN_LINE_FILL_COLOR) : wireColor;
  const widthPx = Math.max(opts.widthPx, 0) * resolveDpr(opts.devicePixelRatio);

  const material = new THREE.MeshBasicMaterial({
    // Το winding των εισαγόμενων πλεγμάτων είναι αναξιόπιστο (ADR-683 §10.10): μονόπλευρο render θα
    // άφηνε τρύπες στο περίγραμμα, camera-relative.
    side: THREE.DoubleSide,
    toneMapped: false,
    ...depthParamsFor(opts.fill),
  });

  material.customProgramCacheKey = () => WIRE_PROGRAM_CACHE_KEY;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWireColor = { value: wireColor };
    shader.uniforms.uWireFillColor = { value: fillColor };
    shader.uniforms.uWireWidthPx = { value: widthPx };
    shader.uniforms.uWireFillMode = { value: opts.fill === 'hidden-line' ? 1 : 0 };
    shader.vertexShader = WIRE_VERTEX_HEADER + shader.vertexShader.replace(
      'void main() {',
      `void main() {\n${WIRE_VERTEX_BODY}`,
    );
    shader.fragmentShader = WIRE_FRAGMENT_HEADER + shader.fragmentShader
      .replace('void main() {', `void main() {\n${WIRE_FRAGMENT_COVERAGE}`)
      // Μετά το `opaque_fragment` το χρώμα είναι ακόμη σε linear working space, οπότε τα επόμενα
      // tonemapping/colorspace chunks κάνουν σωστά τη μετατροπή εξόδου.
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${WIRE_FRAGMENT_RESOLVE}`);
  };
  material.userData[MESH_WIRE_MATERIAL_FLAG] = opts.fill;
  return material;
}

/** Το renderOrder που πρέπει να πάρει ένα mesh βαμμένο με wire material. */
export const MESH_WIRE_RENDER_ORDER = WIRE_RENDER_ORDER;
