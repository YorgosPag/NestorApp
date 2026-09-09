/**
 * bim-uv-helpers — world-meter UV utilities for PBR texturing (ADR-413).
 *
 * PBR textures tile by `repeat = 1 / tileSizeM` (see `bim-texture-cache.ts`). For
 * tiling to be physically correct, geometry UVs must be expressed in WORLD METERS
 * (1 UV unit = 1 metre). These helpers either reuse the existing auto-UVs (already
 * ~world-scale for ExtrudeGeometry/Box/Tube in 'm' scenes) or generate fresh
 * planar UVs in meters for custom BufferGeometry builders that have none.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΝΑ UV SET, ΚΑΙ ΜΟΝΟ ΕΝΑ — το `uv2` ΑΦΑΙΡΕΘΗΚΕ (2026-09-09, ADR-845 Ο-15)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως σήμερα κάθε helper έγραφε **και** `uv2`, ως *«αντίγραφο του `uv`, required by aoMap»*.
 * Αυτό ήταν αληθές σε three **< r152**. Ο επίσημος οδηγός μετάβασης r151→r152 το άλλαξε
 * **δύο φορές**, και τα δύο σιωπηλά για εμάς:
 *
 *   1. *«`uv`, `uv2`, `uv3`, `uv4` are now `uv`, `uv1`, `uv2`, `uv3`»* — το όνομα `uv2`
 *      **μετακινήθηκε** στο **τρίτο** set.
 *   2. *«`aoMap` and `lightMap` no longer use `uv2`. Set `material.lightMap.channel`»* —
 *      και εμείς **ποτέ** δεν ορίσαμε `channel`, άρα η προεπιλογή `0` σημαίνει ότι το
 *      `aoMap` διάβαζε **ήδη** το `uv`.
 *
 * ⇒ Το `uv2` ήταν **αντίγραφο που κανείς δεν διάβαζε** — και **δηλητηρίαζε την εξαγωγή**: ο
 * `GLTFExporter` r170 χαρτογραφεί `uv2 → TEXCOORD_2`, αφήνοντας **τρύπα στο TEXCOORD_1**. Το
 * glTF 2.0 απαιτεί ρητά τα `TEXCOORD_n` να ξεκινούν στο 0 **χωρίς κενά**, οπότε **κάθε**
 * μοντέλο που εξήγαμε ήταν **άκυρο**. Μετρημένο ζωντανά: 13 σφάλματα σε πραγματικό ανέβασμα.
 *
 * ⛔ **ΜΗΝ ΤΟ ΞΑΝΑΒΑΛΕΙΣ ΩΣ `uv2`.** Αν κάποτε χρειαστεί **πραγματικά** δεύτερο UV set
 * *(δηλαδή UV **διαφορετικά** από το πρώτο — π.χ. lightmap atlas)*, το όνομα είναι **`uv1`**
 * και απαιτεί ρητό `texture.channel = 1`. Αντίγραφο του `uv` **δεν** είναι δεύτερο set: είναι
 * διπλάσια μνήμη ανά geometry για **μηδέν** πληροφορία.
 *
 * 🔑 Το φυλά άγκυρα που **εκτελεί** τον επίσημο κριτή της Khronos πάνω σε ό,τι παράγουν αυτά
 * εδώ τα helpers: `export/core/mesh3d/__tests__/mesh3d-gltf-validity.test.ts`.
 *
 * Converters helper — pure, no THREE materials, each fn <40 lines.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import * as THREE from 'three';

/** Dominant-axis options for planar UV projection. */
export interface PlanarUvOptions {
  /**
   * Which world axis the surface mostly faces. The two ORTHOGONAL axes become the
   * U/V plane. Default 'y' (top-down) — suitable for slabs/floors. Use 'x'/'z' for
   * walls facing those axes.
   */
  readonly dominantAxis?: 'x' | 'y' | 'z';
}

/**
 * Ensure a geometry carries texture-ready UVs. If it already has a `uv`
 * attribute (ExtrudeGeometry / BoxGeometry / TubeGeometry auto-UVs, already
 * ~world-scale in meters for 'm' scenes), leave it untouched. If it has NO `uv`,
 * fall back to planar world UVs.
 *
 * ⚠️ **Παραμένει, παρότι το σκέλος αντιγραφής έφυγε**: η ερώτηση *«έχει UV;»* είναι
 * πραγματική και η απάντηση *«όχι → φτιάξε planar»* είναι όλη η αξία της. Μια κλήση
 * αντικαταστάθηκε από **καμία** μόνο εκεί που δεν ρωτούσε τίποτα άλλο.
 */
export function ensureWorldUvs(geo: THREE.BufferGeometry): void {
  if (!geo.getAttribute('uv')) {
    setPlanarWorldUvs(geo, {});
  }
}

/** Pick the two position components (in meters) for the U/V plane of an axis. */
function planeComponents(axis: 'x' | 'y' | 'z'): readonly [number, number] {
  if (axis === 'y') return [0, 2]; // top-down → (x, z)
  if (axis === 'x') return [2, 1]; // facing X  → (z, y)
  return [0, 1]; // facing Z → (x, y)
}

// ─── Ο κοινός σκελετός ────────────────────────────────────────

/**
 * **ΓΡΑΨΕ UV ΑΝΑ ΚΟΡΥΦΗ** — ο σκελετός που μοιράζονται και οι τέσσερις γεννήτορες.
 *
 * 🔴 **ΕΞΗΧΘΗ ΕΠΕΙΔΗ ΤΟ ΜΕΤΡΗΣΕ ΠΥΛΗ** *(CHECK 3.28 / jscpd, 2026-09-09)*: τα
 * `setPlanarWorldUvs` · `setBoxWorldUvs` · `setPlanarTileUvs` · `setSlopeAlignedTileUvs`
 * είχαν **ταυτόσημο** σώμα σε **τρία** σημεία — φύλακας, `Float32Array(count*2)`,
 * βρόχος, `setAttribute('uv', …)` — και διέφεραν **μόνο** στο πώς βγαίνει το
 * ζεύγος `(u,v)` για την κορυφή `i`.
 *
 * ⚠️ **Το ρίσκο δεν ήταν αισθητικό**: τέσσερα αντίγραφα του ίδιου σκελετού
 * σημαίνει ότι μια διόρθωση στη γραφή του attribute *(π.χ. `uv2` — δες την
 * επικεφαλίδα)* πρέπει να θυμηθεί **και τα τέσσερα**. Το `uv2` έφυγε από
 * τέσσερα σημεία σήμερα ακριβώς γι' αυτό.
 *
 * @param needsNormal Οι γεννήτορες που διαβάζουν `normal` πέφτουν σε **επίπεδο** UV
 *   όταν λείπει, αντί να γράψουν σκουπίδια — η συμπεριφορά που είχαν ήδη,
 *   τώρα σε **ένα** σημείο.
 */
function writeVertexUvs(
  geo: THREE.BufferGeometry,
  needsNormal: boolean,
  computeUv: (
    i: number,
    pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    nor: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
  ) => readonly [number, number],
): void {
  const pos = geo.getAttribute('position');
  if (!pos) return;
  const nor = geo.getAttribute('normal');
  if (needsNormal && !nor) {
    setPlanarWorldUvs(geo, {});
    return;
  }

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = computeUv(i, pos, nor);
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Το `rotate90` των δύο tile γεννητόρων — «περιστροφή υφής 90°», μία γραφή. */
function orient(u: number, v: number, rotate90: boolean | undefined): readonly [number, number] {
  return rotate90 ? [v, u] : [u, v];
}

/**
 * Generate planar UVs in WORLD METERS by projecting vertex positions onto a
 * plane. Used by custom BufferGeometry builders (column prism, sloped wall wedge,
 * loft band) that carry no `uv`. Writes `uv` (1 UV unit = 1 m, so
 * `repeat = 1/tileSizeM` tiles physically).
 */
export function setPlanarWorldUvs(geo: THREE.BufferGeometry, opts: PlanarUvOptions): void {
  const [iu, iv] = planeComponents(opts.dominantAxis ?? 'y');
  // ⚠️ `needsNormal: false` — ΚΑΙ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ, ΟΧΙ ΤΥΧΗ: αυτός είναι ο **fallback**
  //    των άλλων τριών. Αν ζητούσε normal, ένα geometry χωρίς normals θα έμπαινε σε
  //    **άπειρη αναδρομή** μέσω του `writeVertexUvs`.
  writeVertexUvs(geo, false, (i, pos) => [pos.getComponent(i, iu), pos.getComponent(i, iv)]);
}

/**
 * Box-projected WORLD-METER UVs — per-FACE projection chosen by each vertex's
 * normal, so every face of an axis-aligned box tiles physically (1 UV unit = 1 m)
 * like the main 3D's ExtrudeGeometry auto-UVs. Unlike `setPlanarWorldUvs`, which
 * projects ALL faces onto a single axis (correct only on the faces parallel to
 * it, and STRETCHED into stripes on the perpendicular top/side faces), this maps
 * each face with the two world axes orthogonal to its normal. Used by the «Edit
 * Type» preview band boxes so their textures match the 3D scene (ADR-414).
 */
export function setBoxWorldUvs(geo: THREE.BufferGeometry): void {
  writeVertexUvs(geo, true, (i, pos, nor) => {
    const n = nor as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    // Face normal ~X → (z,y) · ~Y (top/bottom) → (x,z) · ~Z (front/back) → (x,y).
    const [iu, iv] = ax >= ay && ax >= az ? [2, 1] : ay >= az ? [0, 2] : [0, 1];
    return [pos.getComponent(i, iu), pos.getComponent(i, iv)];
  });
}

// ─── Planar tile UVs (floors / horizontal surfaces) ──────────────────────────

/**
 * Texcoord scale + rotation for `setPlanarTileUvs` (ADR-419).
 * Mirrors `SlopeTileUvOptions` for roof but projected on the XZ (horizontal) plane.
 */
export interface PlanarTileUvOptions {
  /** Texcoord scale U (world X axis). 1 = 1 UV unit per metre. */
  readonly scaleU: number;
  /** Texcoord scale V (world −Z axis, so V increases northward). 1 = 1 m. */
  readonly scaleV: number;
  /** Swap U↔V — «texture rotation 90°» (e.g. wood grain along Y instead of X). */
  readonly rotate90?: boolean;
}

/**
 * ADR-419 — Planar world-meter UVs for horizontal BIM surfaces (floor finishes).
 * Projects each vertex position onto the world XZ plane (U = world X, V = −world Z),
 * then scales by `scaleU`/`scaleV` so one texture tile maps to the physical tile
 * size. `rotate90` swaps U↔V — useful for wood plank direction. Writes `uv` only.
 *
 * Replaces the unscaled `setPlanarWorldUvs` when the user has specified physical tile
 * dimensions; otherwise the geometry's auto-UVs (already world-scale from ExtrudeGeometry)
 * are used as-is via `ensureWorldUvs`.
 */
export function setPlanarTileUvs(geo: THREE.BufferGeometry, opts: PlanarTileUvOptions): void {
  writeVertexUvs(geo, false, (i, pos) =>
    orient(pos.getX(i) * opts.scaleU, -pos.getZ(i) * opts.scaleV, opts.rotate90),
  );
}

// ─── Slope-aligned tile UVs (roofs) ──────────────────────────────────────────

/** World up — the reference for resolving a face's up-slope vs across-slope axes. */
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Texcoord scale + rotation for `setSlopeAlignedTileUvs` (ADR-417 #5). */
export interface SlopeTileUvOptions {
  /** Texcoord scale ACROSS the slope (along the ridge). 1 = 1 UV unit per metre. */
  readonly scaleU: number;
  /** Texcoord scale UP the slope (the water-flow direction). 1 = 1 metre. */
  readonly scaleV: number;
  /** Swap U↔V — Revit «texture rotation 90°» (tile grooves on the other image axis). */
  readonly rotate90?: boolean;
}

/**
 * ADR-417 #5 — SLOPE-ALIGNED world-meter UVs for pitched-roof tiles. Unlike
 * `setBoxWorldUvs` (world-AXIS projection — tile grooves run along the ridge,
 * never down-slope, and the normal-map tangent is mis-aligned → reads flat), this
 * builds a per-vertex in-plane frame from the vertex normal: `across` = horizontal
 * ⊥ to the slope (along the ridge), `up` = steepest ascent IN the face plane. The
 * V axis therefore follows the water-flow direction on EVERY «νερό» (hip/gable/
 * mono), so the grooves drain down-slope and the relief tangents are correct.
 *
 * `scaleU`/`scaleV` apply the tile's physical width/length (caller divides the
 * material's base tile size by the desired tile size — see `roof-to-three.ts`), so
 * one shared texture singleton still tiles physically. Near-horizontal faces (flat
 * deck / degenerate) fall back to world (x,z), matching `setBoxWorldUvs`. Vertical
 * side faces get a box-like (horizontal, vertical) frame — they sit behind the
 * fascia/soffit so their tiling is not visually critical. Writes `uv` only.
 */
export function setSlopeAlignedTileUvs(geo: THREE.BufferGeometry, opts: SlopeTileUvOptions): void {
  // 🔑 Τα τέσσερα `Vector3` ζούν ΕΞΩ από τον βρόχο — μία κατανομή ανά geometry, όχι
  //    ανά κορυφή. Ήταν έτσι πριν την εξαγωγή και μένει έτσι: ζεστός δρόμος (ADR-048).
  const n = new THREE.Vector3();
  const across = new THREE.Vector3();
  const up = new THREE.Vector3();
  const p = new THREE.Vector3();

  writeVertexUvs(geo, true, (i, pos, nor) => {
    const nAttr = nor as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    n.set(nAttr.getX(i), nAttr.getY(i), nAttr.getZ(i));
    across.crossVectors(WORLD_UP, n);
    if (across.lengthSq() < 1e-10) {
      across.set(1, 0, 0); // face ~horizontal → world (x,z), like setBoxWorldUvs top
      up.set(0, 0, 1);
    } else {
      across.normalize();
      up.crossVectors(n, across).normalize(); // up-slope, in the face plane
    }
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    return orient(p.dot(across) * opts.scaleU, p.dot(up) * opts.scaleV, opts.rotate90);
  });
}
