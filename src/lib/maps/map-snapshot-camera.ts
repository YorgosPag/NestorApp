/**
 * @fileoverview **Πού κοιτάζει η κάμερα του στιγμιότυπου** — καθαρή αριθμητική, χωρίς χάρτη.
 * @related ADR-777 §8.70 (Φάση 2) · lib/maps/metric-size · lib/listings/listing-map-mark
 * @module lib/maps/map-snapshot-camera
 *
 * 🔑 **Το κάδρο ακολουθεί την ΑΒΕΒΑΙΟΤΗΤΑ, όχι σταθερό ζουμ.** Μια «Θεσσαλονίκη» (σκιασμένη
 * πόλη, 10 χλμ) σε ζουμ γειτονιάς θα γέμιζε όλο το κουτί με ομοιόμορφη σκιά — ο κάτοχος θα
 * έβλεπε «χρώμα», όχι «περιοχή». Εδώ η σκίαση πιάνει πάντα το ίδιο ποσοστό του κουτιού, άρα το
 * μάτι διαβάζει **πόσο δεν ξέρουμε** από το πόσο χάρτη φαίνεται γύρω της.
 *
 * 🔴 **Το ανώτατο ζουμ είναι ΟΡΙΟ ΑΚΡΙΒΕΙΑΣ, όχι αισθητική.** Ο δημόσιος χάρτης επιτρέπει ζουμ
 * 19 πάνω σε κάθε πινέζα· το στιγμιότυπο σταματά στο {@link SNAPSHOT_ZOOM.max}. Άρα η κάρτα
 * είναι **πάντα λιγότερο** ακριβής από ό,τι μπορεί να δει ο οποιοσδήποτε επισκέπτης.
 *
 * ⚠️ Η αριθμητική μέτρων → pixel **δεν** ξαναγράφεται εδώ: είναι το {@link metersToPixels},
 * με την ίδια σύμβαση πλακιδίου 512 της MapLibre που ζωγραφίζει και τους κύκλους αβεβαιότητας.
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import { LISTING_UNCERTAINTY_KM } from '@/lib/listings/listing-map-shape';

import { metersToPixels } from './metric-size';

/** Το μέγεθος του κουτιού της κάρτας σε CSS pixel (4:3, η στήλη `sm:w-44` = 176). */
export interface SnapshotViewport {
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface SnapshotCamera {
  readonly center: GeoPoint;
  readonly zoom: number;
}

/**
 * Τα όρια ζουμ του στιγμιότυπου.
 * - `point`: σημείο χωρίς αβεβαιότητα ⇒ κλίμακα **γειτονιάς** (~650 μ. πλάτος στα 176 px).
 * - `max`: το όριο ακρίβειας της κεφαλίδας — ποτέ ζουμ κτιρίου σε μικρογραφία.
 */
export const SNAPSHOT_ZOOM = { min: 3, point: 15, max: 16 } as const;

/** Η σκίαση (ή το περίγραμμα) πιάνει αυτό το κλάσμα της μικρότερης πλευράς του κουτιού. */
export const SNAPSHOT_AREA_SHARE = 0.8;

const METRES_PER_KM = 1000;
const METRES_PER_DEGREE_LAT = 111_320;

function clampZoom(zoom: number): number {
  return Math.min(SNAPSHOT_ZOOM.max, Math.max(SNAPSHOT_ZOOM.min, zoom));
}

/** Το ζουμ όπου `spanM` μέτρα, στο πλάτος `lat`, πιάνουν ακριβώς `targetPx` pixel. */
function zoomToFit(spanM: number, targetPx: number, lat: number): number {
  return Math.log2(targetPx / metersToPixels(spanM, 0, lat));
}

function outlineCamera(outline: readonly GeoPoint[], viewport: SnapshotViewport): SnapshotCamera {
  const lats = outline.map((p) => p.lat);
  const lngs = outline.map((p) => p.lng);
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const center = { lat: (south + north) / 2, lng: (west + east) / 2 };
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const heightM = Math.max((north - south) * METRES_PER_DEGREE_LAT, 1);
  const widthM = Math.max((east - west) * METRES_PER_DEGREE_LAT * cosLat, 1);
  const zoom = Math.min(
    zoomToFit(widthM, viewport.widthPx * SNAPSHOT_AREA_SHARE, center.lat),
    zoomToFit(heightM, viewport.heightPx * SNAPSHOT_AREA_SHARE, center.lat),
  );
  return { center, zoom: clampZoom(Number.isFinite(zoom) ? zoom : SNAPSHOT_ZOOM.point) };
}

/**
 * Σημάδι → κάμερα.
 *
 * - **περίγραμμα** ⇒ χωρά ολόκληρο στο κουτί·
 * - **περιοχή** (δακτύλιος · συνοικία · πόλη) ⇒ η **διάμετρος** της αβεβαιότητας πιάνει το
 *   {@link SNAPSHOT_AREA_SHARE} της μικρότερης πλευράς·
 * - **σημείο** ⇒ κλίμακα γειτονιάς.
 */
export function listingSnapshotCamera(mark: ListingMapMark, viewport: SnapshotViewport): SnapshotCamera {
  if (mark.shape === 'outline' && mark.outline && mark.outline.length > 0) {
    return outlineCamera(mark.outline, viewport);
  }

  const uncertaintyM = (LISTING_UNCERTAINTY_KM[mark.shape] ?? 0) * METRES_PER_KM;
  if (uncertaintyM <= 0) return { center: mark.point, zoom: SNAPSHOT_ZOOM.point };

  const targetPx = Math.min(viewport.widthPx, viewport.heightPx) * SNAPSHOT_AREA_SHARE;
  const zoom = zoomToFit(uncertaintyM * 2, targetPx, mark.point.lat);
  return { center: mark.point, zoom: clampZoom(Math.min(zoom, SNAPSHOT_ZOOM.point)) };
}
