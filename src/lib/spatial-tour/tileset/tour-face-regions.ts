/**
 * @fileoverview **ΑΠΟ ΤΑ ΠΛΑΙΣΙΑ ΠΡΟΣΩΠΩΝ ΣΤΟΥΣ ΚΥΚΛΟΥΣ ΤΗΣ ΣΦΑΙΡΑΣ** — πλαίσιο σε όψη κύβου → κύκλος yaw/pitch, διπλά πάνω στη
 * σφαίρα, «καλύπτεται ήδη», συγχώνευση ως το όριο περιοχών (ADR-884 Φ2ζ ζ4 · §4.15). Καθαρό — καμία εικόνα, κανένα μοντέλο.
 * @related `equirect-to-cube.ts` (`faceUvOfPixel` — η ΜΙΑ αντιστοίχιση pixel όψης → uv) · `viewer/tour-cube-faces.ts` (η ΜΙΑ
 *   σύμβαση uv → κατεύθυνση) · `tour-redaction-mask.ts` (`angularDistance` — η ΜΙΑ απόσταση) ·
 *   `server/spatial-tour/tour-face-scan.ts` (ο καταναλωτής)
 * @module lib/spatial-tour/tileset/tour-face-regions
 *
 * 🔑 **Κύκλος στη σφαίρα, όχι ορθογώνιο**: η ίδια γεωμετρία με το πινέλο και τον ψήστη (§4.15 Απόφαση 6) — ο άνθρωπος βλέπει και
 *   διορθώνει τα `auto` με το ίδιο εργαλείο. Κέντρο = η κατεύθυνση του κέντρου του πλαισίου· ακτίνα = η **μέγιστη** γωνιακή
 *   απόσταση προς τις γωνίες του × περιθώριο — ποτέ λιγότερο από το πλαίσιο.
 * 🔑 **Διπλά πάνω στη σφαίρα**: το ίδιο πρόσωπο εμφανίζεται σε δύο όψεις (επικάλυψη ακμών) και σε πολλές κλίμακες ⇒ η ένωση
 *   γίνεται με γωνιακή απόσταση, όχι σε pixel μιας εικόνας. Η ένωση κρατά τον **περιγεγραμμένο** κύκλο — ποτέ δεν μικραίνει.
 */

import {
  TOUR_FACE_RADIUS_MARGIN,
  TOUR_REDACTION_MAX_RADIUS_RAD,
  TOUR_REDACTION_MIN_RADIUS_RAD,
} from '@/constants/spatial-tour-vocabulary';
import type { TourRedactionRegion } from '@/types/spatial-tour';

import { cubeFaceUvToDirection, directionToYawPitch, yawPitchToDirection, type TourCubeFace } from '../viewer/tour-cube-faces';
import { faceUvOfPixel } from './equirect-to-cube';
import { angularDistance } from './tour-redaction-mask';

/** Ένα πλαίσιο προσώπου σε pixel μιας εικόνας (πάνω-αριστερά, πλάτος, ύψος) με τον βαθμό του ανιχνευτή. */
export interface FaceBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly score: number;
}

/** Ένα πρόσωπο πάνω στη σφαίρα: κύκλος + ο βαθμός του. */
export interface FaceOnSphere extends TourRedactionRegion {
  readonly score: number;
}

/** Η απόδοση όψης στην οποία βρέθηκε ένα πλαίσιο — ό,τι χρειάζεται το αντίστροφο pixel → κατεύθυνση. */
export interface FaceRaster {
  readonly face: TourCubeFace;
  readonly size: number;
  readonly overscan: number;
}

/**
 * Δύο πρόσωπα είναι **το ίδιο** όταν τα κέντρα τους απέχουν λιγότερο από αυτό το κλάσμα της μικρότερης ακτίνας. Γειτονικά
 * πρόσωπα πλήθους απέχουν ~1 πλάτος προσώπου (≈ μία ακτίνα) ⇒ μένουν χωριστά· το ίδιο πρόσωπο σε δύο όψεις/κλίμακες σχεδόν συμπίπτει.
 */
const SAME_FACE_FRACTION = 0.5;

function yawPitchAtPixel(raster: FaceRaster, x: number, y: number): { readonly yaw: number; readonly pitch: number } {
  const { u, v } = faceUvOfPixel(x, y, raster.size, raster.overscan);
  return directionToYawPitch(cubeFaceUvToDirection(raster.face, u, v));
}

const clampRadius = (radius: number): number =>
  Math.min(TOUR_REDACTION_MAX_RADIUS_RAD, Math.max(TOUR_REDACTION_MIN_RADIUS_RAD, radius));

/** **Πλαίσιο όψης → κύκλος στη σφαίρα** (κέντρο = κέντρο πλαισίου, ακτίνα = μέγιστη απόσταση προς τις γωνίες × περιθώριο). */
export function faceOnSphereOf(raster: FaceRaster, box: FaceBox): FaceOnSphere {
  const centre = yawPitchAtPixel(raster, box.x + box.w / 2, box.y + box.h / 2);
  const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]] as const;
  const reach = Math.max(...corners.map(([x, y]) => {
    const corner = yawPitchAtPixel(raster, x, y);
    return angularDistance(centre.yaw, centre.pitch, corner.yaw, corner.pitch);
  }));
  return { yawRad: centre.yaw, pitchRad: centre.pitch, radiusRad: clampRadius(reach * TOUR_FACE_RADIUS_MARGIN), score: box.score };
}

const distanceOf = (a: TourRedactionRegion, b: TourRedactionRegion): number =>
  angularDistance(a.yawRad, a.pitchRad, b.yawRad, b.pitchRad);

/** Ο **μικρότερος κύκλος που περιέχει και τους δύο** (πάνω στον μέγιστο κύκλο που τους ενώνει). */
export function enclosingRegion(a: TourRedactionRegion, b: TourRedactionRegion): TourRedactionRegion {
  const d = distanceOf(a, b);
  if (d + b.radiusRad <= a.radiusRad) return a;
  if (d + a.radiusRad <= b.radiusRad) return b;
  const radius = (d + a.radiusRad + b.radiusRad) / 2;
  const t = (radius - a.radiusRad) / d;
  const [pa, pb] = [yawPitchToDirection(a.yawRad, a.pitchRad), yawPitchToDirection(b.yawRad, b.pitchRad)];
  const [wa, wb] = [Math.sin((1 - t) * d) / Math.sin(d), Math.sin(t * d) / Math.sin(d)];
  const { yaw, pitch } = directionToYawPitch({ x: wa * pa.x + wb * pb.x, y: wa * pa.y + wb * pb.y, z: wa * pa.z + wb * pb.z });
  return { yawRad: yaw, pitchRad: pitch, radiusRad: radius };
}

const isSameFace = (a: TourRedactionRegion, b: TourRedactionRegion): boolean =>
  distanceOf(a, b) < SAME_FACE_FRACTION * Math.min(a.radiusRad, b.radiusRad);

/**
 * **Ένα πρόσωπο, μία φορά** — από τον μεγαλύτερο βαθμό προς τον μικρότερο· το διπλό **ενώνεται** με όσο κράτησε (περιγεγραμμένος
 * κύκλος, με σύσφιξη στο όριο): δύο όψεις που είδαν μισό-μισό το πρόσωπο δεν αφήνουν ακάλυπτη τη διαφορά τους.
 */
export function distinctFaces(faces: readonly FaceOnSphere[]): readonly FaceOnSphere[] {
  const kept: FaceOnSphere[] = [];
  for (const face of [...faces].sort((a, b) => b.score - a.score)) {
    const index = kept.findIndex((k) => isSameFace(k, face));
    if (index < 0) {
      kept.push(face);
      continue;
    }
    const merged = enclosingRegion(kept[index], face);
    kept[index] = { ...merged, radiusRad: clampRadius(merged.radiusRad), score: kept[index].score };
  }
  return kept;
}

/** Ο κύκλος βρίσκεται **ολόκληρος** μέσα σε κάποιον από τους υπάρχοντες (π.χ. χειροκίνητη περιοχή που τον σκεπάζει ήδη). */
export function isCoveredBy(region: TourRedactionRegion, existing: readonly TourRedactionRegion[]): boolean {
  return existing.some((e) => distanceOf(e, region) + region.radiusRad <= e.radiusRad);
}

/** Το ζεύγος με τον μικρότερο περιγεγραμμένο κύκλο που **χωρά** στο όριο ακτίνας — `null` αν κανένα. */
function cheapestMerge(regions: readonly TourRedactionRegion[]): { readonly i: number; readonly j: number; readonly merged: TourRedactionRegion } | null {
  let best: { readonly i: number; readonly j: number; readonly merged: TourRedactionRegion } | null = null;
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const merged = enclosingRegion(regions[i], regions[j]);
      if (merged.radiusRad > TOUR_REDACTION_MAX_RADIUS_RAD) continue;
      if (best === null || merged.radiusRad < best.merged.radiusRad) best = { i, j, merged };
    }
  }
  return best;
}

/**
 * **Χώρεσε στο όριο** (`capacity` = όσες θέσεις μένουν στη λήψη): ενώνει κάθε φορά το ζεύγος με τον μικρότερο περιγεγραμμένο κύκλο
 * (ποτέ πάνω από 45° — το θόλωμα δεν κρύβει χώρο). Αν ούτε έτσι χωρούν ⇒ κρατά τους **μεγαλύτερους** (τα κοντινά, πιο αναγνωρίσιμα
 * πρόσωπα) και δηλώνει `saturated` ώστε να κοιτάξει άνθρωπος.
 */
export function fitRegions(
  regions: readonly TourRedactionRegion[],
  capacity: number,
): { readonly regions: readonly TourRedactionRegion[]; readonly saturated: boolean } {
  const current = [...regions];
  while (current.length > capacity) {
    const merge = cheapestMerge(current);
    if (merge === null) break;
    current.splice(merge.j, 1);
    current[merge.i] = merge.merged;
  }
  if (current.length <= capacity) return { regions: current, saturated: false };
  const largest = [...current].sort((a, b) => b.radiusRad - a.radiusRad).slice(0, Math.max(0, capacity));
  return { regions: largest, saturated: true };
}
