/**
 * ADR-512 (Tekton .TEK export) — γεωμετρικές μετατροπές (pure SSoT).
 *
 * Ο Τέκτων δουλεύει σε **μέτρα**. Οι BIM συντεταγμένες (start/end/position) ζουν σε
 * **scene units** (canvas)· οι διαστάσεις (thickness/height) σε **mm**. ΟΛΕΣ οι
 * μετατροπές scene→μέτρα γίνονται μέσω του SSoT `sceneUnitsToMeters` (scene-units.ts)
 * — μηδέν re-impl (ίδιο που χρησιμοποιούν οι bim-3d converters).
 *
 * xmatrix DECODED + CALIBRATED (browser-verified σε λοξούς τοίχους 2026-06-21).
 * Ο Τέκτων διαβάζει τον πίνακα **column-major**: ο point (u,v) του μοναδιαίου κελιού →
 *   X = x00·u + x10·v + x20,  Y = x01·u + x11·v + x21
 * άρα ο **άξονας μήκους** (u) = (x00,x01) και ο **άξονας πάχους** (v) = (x10,x11):
 *   (x00,x01) = E−S            (διάνυσμα μήκους)
 *   (x10,x11) = n̂ · thickness   (n̂ = μοναδιαίο κάθετο)
 *   (x20,x21) = σημείο εκκίνησης (γωνία/παρειά)
 * ΠΡΟΣΟΧΗ: το δείγμα ήταν οριζόντιο (x01=x10=0 → degenerate)· οι λοξοί τοίχοι έδειξαν
 * ότι χρειάζεται transpose (αλλιώς ο Τέκτων ζωγραφίζει ΡΟΜΒΟ αντί ορθογωνίου).
 */

import { sceneUnitsToMeters } from '../../../utils/scene-units';
import type { Point3D } from '../../../bim/types/bim-base';
import type { TekXMatrix, TekPlanePoint, TekRoofPoint } from './tek-types';

/** mm → μέτρα. Reuse του SSoT (sceneUnitsToMeters('mm') = 0.001) αντί magic /1000. */
export const MM_TO_M = sceneUnitsToMeters('mm');

/** mm → μέτρα (διαστάσεις params αποθηκεύονται σε mm). */
export function mmToMeters(mm: number): number {
  return mm * MM_TO_M;
}

/**
 * Γενικό affine SSoT (column-major): origin + άξονας-u (x00,x01) + άξονας-v (x10,x11).
 * ΟΛΟΙ οι builders (wall/opening/object) περνούν από εδώ — μηδέν 2ος affine από το μηδέν.
 * Ο Τέκτων διαβάζει point(u,v) → X=x00·u+x10·v+x20, Y=x01·u+x11·v+x21.
 */
export function buildXMatrix(
  ox: number, oy: number, ux: number, uy: number, vx: number, vy: number,
): TekXMatrix {
  return { x00: ux, x01: uy, x10: vx, x11: vy, x20: ox, x21: oy };
}

/**
 * xmatrix τοίχου από centerline άκρα (ΜΕΤΡΑ) + πάχος (ΜΕΤΡΑ). Το origin μετατοπίζεται
 * −n̂·(t/2) ώστε το δικό μας centerline να αντιστοιχεί στην παρειά-αναφορά του Τέκτονα
 * (το πρόσημο επιβεβαιώνεται στο 1ο browser round-trip).
 */
export function buildWallXMatrix(
  sx: number, sy: number, ex: number, ey: number, thicknessM: number,
): TekXMatrix {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // μοναδιαίο κάθετο
  const ny = dx / len;
  const half = thicknessM / 2;
  // column-major: άξονας μήκους u=(dx,dy)=E−S· άξονας πάχους v=n̂·t· origin=centerline→παρειά.
  return buildXMatrix(sx - nx * half, sy - ny * half, dx, dy, nx * thicknessM, ny * thicknessM);
}

/**
 * Affine κουφώματος (ΜΕΤΡΑ) από το **κέντρο** + **γωνία άξονα** του host τοίχου + πλάτος.
 *
 * SSoT: το κέντρο (`centerX/Y`) και η `rotationRad` ΔΕΝ υπολογίζονται εδώ — έρχονται από το
 * `computeOpeningGeometry` (`bim/geometry/opening-geometry.ts`), τη μοναδική πηγή θέσης/άξονα
 * κουφώματος (την ίδια που τρέφει renderers/3D/grips· χειρίζεται straight+curved+polyline hosts).
 * Εδώ μένει ΜΟΝΟ η Tekton-specific σύνθεση του xmatrix:
 *   - origin = κέντρο − â·(width/2)   (κοντινή ακμή πάνω στον άξονα)
 *   - άξονας-u = â·width              (x00,x01 = πλάτος κατά μήκος του τοίχου)
 *   - άξονας-v = n̂ = (−sin,cos)       (x10,x11 = ΜΟΝΑΔΙΑΙΟ κάθετο — όπως το δείγμα x11=−1·
 *     ο Τέκτων κόβει το άνοιγμα στο πάχος του host, άρα v=unit, ΟΧΙ ·thickness)
 * Λοξό-safe by construction (â=(cosθ,sinθ) από τον verified SSoT άξονα).
 */
export function buildOpeningXMatrix(
  centerXm: number, centerYm: number, rotationRad: number, widthM: number,
): TekXMatrix {
  const ax = Math.cos(rotationRad); // μοναδιαίος άξονας τοίχου
  const ay = Math.sin(rotationRad);
  const half = widthM / 2;
  // origin = κέντρο − â·(w/2)· u = â·w· v = n̂ μοναδιαίο.
  return buildXMatrix(centerXm - ax * half, centerYm - ay * half, ax * widthM, ay * widthM, -ay, ax);
}

/**
 * Footprint ring ενός BIM entity (κορυφές σε **scene units**, από τον γενικό export
 * extractor `extractEntityFootprintRing` — ΙΔΙΟ που τρέφει DXF/IFC) → `<point3d>` κορυφές
 * σε **world μέτρα**. Το X/Y μετατρέπεται με `metersPerSceneUnit` (ο ΙΔΙΟΣ παράγοντας με
 * τους τοίχους)· το Z = `elevationM` (στάθμη βάσης) — το footprint είναι επίπεδο, η εξώθηση
 * κατά το ύψος γίνεται από το `<width>` του plane. Γενικό: έπιπλα (Φ2b) + structural slabs (Φ3).
 */
export function footprintRingToMeters(
  ring: readonly Point3D[], metersPerSceneUnit: number, elevationM: number,
): TekPlanePoint[] {
  return ring.map((v) => ({
    x: v.x * metersPerSceneUnit,
    y: v.y * metersPerSceneUnit,
    z: elevationM,
  }));
}

/** Ανοχή ισότητας κορυφών σε μέτρα (1 micron) για το dedup των face rings. */
const VERTEX_EPSILON_M = 1e-6;

function samePoint3D(a: TekPlanePoint, b: TekPlanePoint): boolean {
  return (
    Math.abs(a.x - b.x) < VERTEX_EPSILON_M &&
    Math.abs(a.y - b.y) < VERTEX_EPSILON_M &&
    Math.abs(a.z - b.z) < VERTEX_EPSILON_M
  );
}

/**
 * Καθαρίζει ένα face ring από **διαδοχικές διπλές κορυφές** + το **κλείσιμο** (τελευταία ==
 * πρώτη). Ο roof solver παράγει closed rings με degenerate επαναλήψεις (π.χ. ακμές μηδενικού
 * μήκους)· ο Τέκτων **απορρίπτει** τέτοια `<v3list>` faces → η στέγη δεν ζωγραφίζεται. Τα
 * έγκυρα faces του δείγματος είναι **απλά ανοιχτά πολύγωνα** (καμία επανάληψη). 3D σύγκριση
 * (xy ίδιο αλλά z διαφορετικό = γνήσια κορυφή στην κλίση, ΟΧΙ διπλή).
 */
export function dedupeFaceRing(ring: readonly TekPlanePoint[]): TekPlanePoint[] {
  const out: TekPlanePoint[] = [];
  for (const p of ring) {
    if (out.length === 0 || !samePoint3D(out[out.length - 1], p)) out.push(p);
  }
  // Drop trailing closing vertex (== first) ώστε το face να μείνει ανοιχτό όπως το δείγμα.
  while (out.length > 1 && samePoint3D(out[0], out[out.length - 1])) out.pop();
  return out;
}

/**
 * Προσημασμένο εμβαδό XY ενός ring (shoelace). > 0 = CCW, < 0 = CW (math convention,
 * Y προς τα πάνω = ο τρόπος που διαβάζει ο Τέκτων).
 */
export function signedAreaXY(ring: readonly { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * Αντιστρέφει το winding ενός roof footprint **διατηρώντας σωστά την κλίση ανά ακμή**. Η
 * `angleRad` κάθε κορυφής είναι η κλίση της **εξερχόμενης** ακμής (vertex i → i+1). Όταν
 * αντιστρέφεται η σειρά, η εξερχόμενη ακμή της νέας κορυφής `j` είναι η αντίστροφη μιας
 * παλιάς ακμής → η κλίση πρέπει να μετατοπιστεί (όχι απλό `reverse()`):
 *   reversed[j] = { κορυφή p[n-1-j],  angle p[(n-2-j) mod n] }.
 */
export function reverseRoofFootprint(points: readonly TekRoofPoint[]): TekRoofPoint[] {
  const n = points.length;
  return points.map((_, j) => {
    const vertex = points[n - 1 - j];
    const angleSrc = points[(((n - 2 - j) % n) + n) % n];
    return { x: vertex.x, y: vertex.y, angleRad: angleSrc.angleRad };
  });
}

/**
 * 3D ring ενός roof «νερού» (face outline· **canvas-unit xy + mm z absolute**, από το
 * `RoofGeometry.faces[].outline`) → `<v3>` κορυφές σε **world μέτρα**. Σε αντίθεση με το
 * `footprintRingToMeters` (που ισοπεδώνει το Z), εδώ το **Z διατηρείται per-vertex** (mm→m)
 * γιατί το κεκλιμένο face έχει διαφορετικό ύψος σε κάθε κορυφή (γείσο→κορφιάς). Το ring
 * περνά από `dedupeFaceRing` (αφαίρεση degenerate επαναλήψεων — απαραίτητο για να το δεχτεί ο Τέκτων).
 */
export function roofFaceRingToMeters(
  ring: readonly Point3D[], metersPerSceneUnit: number,
): TekPlanePoint[] {
  return dedupeFaceRing(
    ring.map((v) => ({
      x: v.x * metersPerSceneUnit,
      y: v.y * metersPerSceneUnit,
      z: (v.z ?? 0) * MM_TO_M,
    })),
  );
}
