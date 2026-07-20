/**
 * geometry-hash — ADR-683 Φ2. **ΕΝΑ SSoT** για την ερώτηση «τι σχήμα έχει αυτό το mesh;», που
 * τρέχει και στα **δύο άκρα** του round-trip: στο export γράφεται στο manifest (`.nestor.json`,
 * βλ. `./export-manifest`), στο import ξαναϋπολογίζεται από το επιστρεφόμενο αρχείο. Χωρίς αυτό
 * ο reconciler δεν ξεχωρίζει την **κατάσταση A** (ADR-683 §5 — «άλλαξε μόνο χρώμα» → αυτόματη
 * εφαρμογή) από την **κατάσταση C** («άλλαξε το σχήμα» → ρώτα τον χρήστη).
 *
 * ## Γιατί ΔΥΟ επίπεδα (hash + signature) και όχι σκέτο quantised hash
 *
 * Το ADR-683 §5 περιέγραψε «σταθερό hash επί των κορυφών, ταξινομημένο, με ανοχή epsilon».
 * **Μετρημένο πρόβλημα:** ένα quantised hash είναι εύθραυστο στα *όρια των κάδων*. Το float32
 * του glTF έχει σχετική ακρίβεια ~1.2e-7 → σε συντεταγμένη 100 m ο θόρυβος είναι ~12 μm. Με
 * κάδο 100 μm, η πιθανότητα μια κορυφή να πέσει στην άλλη πλευρά ενός ορίου είναι ~12% **ανά
 * συντεταγμένη**. Σε ένα mesh με χιλιάδες κορυφές αυτό είναι πρακτικά βεβαιότητα → **κάθε**
 * αμετάβλητο στοιχείο θα γύριζε «άλλαξε» και η κατάσταση C θα ρωτούσε για τα πάντα. Ένα gate
 * με >50% false positives δεν είναι gate — είναι θόρυβος (ίδια αρχή με τον ≤10% πήχη της Google).
 *
 * Άρα δύο επίπεδα, με ρητούς ρόλους:
 *   1. **`hash`** — ακριβές, φθηνό, ΜΗΔΕΝ false negatives. Ίδιο hash ⇒ **σίγουρα** ίδια γεωμετρία.
 *      Είναι το γρήγορο μονοπάτι για το συνηθισμένο «ο εξωτερικός δεν άγγιξε τη γεωμετρία».
 *   2. **`signature`** — αριθμητικός περιγραφέας (πλήθη, διαστάσεις, κεντροειδές, εμβαδόν) που
 *      συγκρίνεται **με ανοχή**. Τρέχει ΜΟΝΟ όταν το hash διαφέρει, και απαντά «ισοδύναμο»
 *      (θόρυβος float / άλλη τριγωνοποίηση) ή «άλλαξε» (πραγματική επέμβαση).
 *
 * ## Χώρος αναφοράς (τι ΠΙΑΝΕΙ και τι ΟΧΙ — 100% ειλικρίνεια)
 *
 * Οι κορυφές παίρνονται σε **world space** (world matrix του mesh) και μετά **μεταφέρονται ώστε
 * το bbox min να πέσει στο origin**. Δηλαδή ο περιγραφέας είναι **ανεξάρτητος θέσης**:
 *   - ✅ ΠΙΑΝΕΙ: αλλαγή σχήματος, αλλαγή διαστάσεων, κλίμακα κόμβου (ψήνεται από τη world matrix).
 *   - ❌ ΔΕΝ ΠΙΑΝΕΙ: καθαρή μετακίνηση (rigid move). **Σκόπιμο** — το floor stacking, το
 *     re-centring και τα διαφορετικά origins των DCC θα έκαναν κάθε στοιχείο false positive.
 *     Η θέση είναι δουλειά της Φ3 (`imported-mesh` transform), όχι του «άλλαξε το σχήμα;».
 *   - ❌ ΔΕΝ ΠΙΑΝΕΙ: περιστροφή ολόκληρου του μοντέλου (θα φαινόταν ως αλλαγή σε όλα).
 *
 * Μονάδα: **μέτρα** — ο three κόσμος είναι σε μέτρα (ADR-462) και το glTF είναι spec-locked σε
 * μέτρα. Ο υπολογισμός πρέπει να γίνεται **ΠΡΙΝ** το `applyExportUnit` (που κλιμακώνει τη ρίζα
 * μόνο για OBJ), αλλιώς το ίδιο μοντέλο θα έδινε άλλο fingerprint ανά επιλογή μονάδας.
 *
 * @see ./export-manifest — γράφει/διαβάζει τα fingerprints (sidecar `.nestor.json`)
 * @see ./gltf-scene-parse — τα ξαναϋπολογίζει από το επιστρεφόμενο glTF/GLB
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import type * as THREE from 'three';

import { forEachTriangle, readWorldPositions, triangleArea } from './mesh-triangles';

/** Κάδος κβαντισμού κορυφών για το ακριβές `hash` (0.1 mm). */
export const GEOMETRY_QUANTUM_M = 1e-4;

/** Ανοχή μήκους για τη σύγκριση `signature` (1 mm) — διαστάσεις & κεντροειδές. */
export const GEOMETRY_LENGTH_TOLERANCE_M = 1e-3;

/** Σχετική ανοχή εμβαδού (0.5%) — απορροφά διαφορετική τριγωνοποίηση του παραλήπτη. */
export const GEOMETRY_AREA_TOLERANCE_RATIO = 0.005;

/** Τριάδα μέτρων (διαστάσεις / κεντροειδές). */
export type Vec3M = readonly [number, number, number];

/** Αριθμητικός περιγραφέας σχήματος — συγκρίνεται **με ανοχή**, ποτέ με ισότητα. */
export interface GeometrySignature {
  readonly vertexCount: number;
  readonly triangleCount: number;
  /** Διαστάσεις bounding box (m). */
  readonly sizeM: Vec3M;
  /** Κεντροειδές κορυφών, σχετικά με το bbox min (m). */
  readonly centroidM: Vec3M;
  /** Συνολικό εμβαδόν τριγώνων (m²). */
  readonly areaM2: number;
}

export interface GeometryFingerprint {
  /** Ακριβές hash κβαντισμένων/ταξινομημένων κορυφών. Ίδιο ⇒ σίγουρα ίδια γεωμετρία. */
  readonly hash: string;
  readonly signature: GeometrySignature;
}

/**
 * `identical`  — ίδιο ακριβές hash (κατάσταση A/B του ADR-683 §5).
 * `equivalent` — άλλο hash αλλά ο περιγραφέας ταιριάζει εντός ανοχής (θόρυβος/retessellation).
 * `changed`    — πραγματική αλλαγή σχήματος (κατάσταση C → ρώτα τον χρήστη).
 */
export type GeometryComparison = 'identical' | 'equivalent' | 'changed';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MIX_PRIME = 0x85ebca6b;

/** Μεταφέρει τις κορυφές ώστε το bbox min να πέσει στο origin· επιστρέφει διαστάσεις + κεντροειδές. */
function rebaseToBoundingBox(points: Float64Array): { sizeM: Vec3M; centroidM: Vec3M } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < points.length; i += 1) {
    const axis = i % 3;
    if (points[i] < min[axis]) min[axis] = points[i];
    if (points[i] > max[axis]) max[axis] = points[i];
  }

  const sum: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < points.length; i += 1) {
    const axis = i % 3;
    points[i] -= min[axis];
    sum[axis] += points[i];
  }

  const n = points.length / 3;
  return {
    sizeM: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    centroidM: [sum[0] / n, sum[1] / n, sum[2] / n],
  };
}

/** Συνολικό εμβαδόν + πλήθος τριγώνων. Η διέλευση ζει στο `./mesh-triangles` (κοινή με το solid measure). */
function measureTriangles(
  mesh: THREE.Mesh,
  points: Float64Array,
): { areaM2: number; triangleCount: number } {
  let areaM2 = 0;
  const triangleCount = forEachTriangle(mesh, points.length / 3, (ia, ib, ic) => {
    areaM2 += triangleArea(points, ia, ib, ic);
  });
  return { areaM2, triangleCount };
}

/** Κβαντισμός σε ακέραιους κάδους των `GEOMETRY_QUANTUM_M`. */
function quantise(points: Float64Array): Int32Array {
  const q = new Int32Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    q[i] = Math.round(points[i] / GEOMETRY_QUANTUM_M);
  }
  return q;
}

/**
 * Ταξινόμηση κορυφών (λεξικογραφικά ανά τριάδα) → το hash γίνεται **ανεξάρτητο σειράς**: ο
 * παραλήπτης επιτρέπεται να αναδιατάξει buffers χωρίς να αλλάξει το σχήμα.
 */
function sortVertexTriplets(q: Int32Array): Int32Array {
  const n = q.length / 3;
  const order = new Array<number>(n);
  for (let i = 0; i < n; i += 1) order[i] = i;
  order.sort((a, b) => q[a * 3] - q[b * 3] || q[a * 3 + 1] - q[b * 3 + 1] || q[a * 3 + 2] - q[b * 3 + 2]);

  const out = new Int32Array(q.length);
  for (let i = 0; i < n; i += 1) {
    const src = order[i] * 3;
    out[i * 3] = q[src];
    out[i * 3 + 1] = q[src + 1];
    out[i * 3 + 2] = q[src + 2];
  }
  return out;
}

/** Δύο ανεξάρτητες 32-bit διαδρομές (FNV-1a + mix) → 16 hex χαρακτήρες, ντετερμινιστικά. */
function hashInts(values: Int32Array, seeds: readonly number[]): string {
  let a = FNV_OFFSET;
  let b = 0x9e3779b9;

  const feed = (v: number): void => {
    for (let s = 0; s < 32; s += 8) {
      const byte = (v >>> s) & 0xff;
      a = Math.imul(a ^ byte, FNV_PRIME) >>> 0;
      b = Math.imul((b + byte) >>> 0, MIX_PRIME) >>> 0;
      b = (b ^ (b >>> 13)) >>> 0;
    }
  };

  for (const seed of seeds) feed(seed | 0);
  for (let i = 0; i < values.length; i += 1) feed(values[i]);

  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Το fingerprint ενός mesh. `null` όταν το mesh δεν έχει αξιοποιήσιμες κορυφές (κενή γεωμετρία)
 * — ο caller το αντιμετωπίζει ως «άγνωστο σχήμα», ποτέ ως «ίδιο».
 */
export function computeGeometryFingerprint(mesh: THREE.Mesh): GeometryFingerprint | null {
  const points = readWorldPositions(mesh);
  if (points === null) return null;

  const vertexCount = points.length / 3;
  const { sizeM, centroidM } = rebaseToBoundingBox(points);
  const { areaM2, triangleCount } = measureTriangles(mesh, points);
  const sorted = sortVertexTriplets(quantise(points));

  return {
    hash: hashInts(sorted, [vertexCount, triangleCount]),
    signature: { vertexCount, triangleCount, sizeM, centroidM, areaM2 },
  };
}

function withinLength(a: number, b: number): boolean {
  return Math.abs(a - b) <= GEOMETRY_LENGTH_TOLERANCE_M;
}

function withinArea(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-6);
  return Math.abs(a - b) / scale <= GEOMETRY_AREA_TOLERANCE_RATIO;
}

/**
 * Ισοδυναμία περιγραφέων εντός ανοχής. Τα **πλήθη** κορυφών/τριγώνων επίτηδες **δεν** μετρούν
 * εδώ: ο παραλήπτης νόμιμα ξανα-τριγωνοποιεί (ίδιο σχήμα, άλλα πλήθη). Αυτά ζουν στο ακριβές
 * `hash`, όπου η αυστηρότητα είναι το ζητούμενο.
 */
function signaturesEquivalent(a: GeometrySignature, b: GeometrySignature): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    if (!withinLength(a.sizeM[axis], b.sizeM[axis])) return false;
    if (!withinLength(a.centroidM[axis], b.centroidM[axis])) return false;
  }
  return withinArea(a.areaM2, b.areaM2);
}

/**
 * Η απόφαση A/C του ADR-683 §5. Άγνωστο fingerprint σε οποιαδήποτε πλευρά ⇒ `changed`
 * (fail-closed: ρωτάμε τον χρήστη αντί να υποθέσουμε «ίδιο» και να χάσουμε σιωπηλά μια αλλαγή).
 */
export function compareGeometry(
  exported: GeometryFingerprint | null,
  returned: GeometryFingerprint | null,
): GeometryComparison {
  if (exported === null || returned === null) return 'changed';
  if (exported.hash === returned.hash) return 'identical';
  return signaturesEquivalent(exported.signature, returned.signature) ? 'equivalent' : 'changed';
}
