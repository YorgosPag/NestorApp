/**
 * @fileoverview **Μία λήψη** — μετακίνησε την κάμερα, περίμενε να ηρεμήσει ο χάρτης, κράτα την εικόνα.
 * @related ADR-777 §8.70 (Φάση 2) · ADR-847 §9.6 · lib/maps/map-snapshot-store · lib/maps/map-attribution
 * @module lib/maps/capture-map-snapshot
 *
 * 🔑 **Το καρέ είναι το καρέ ΑΦΙΞΗΣ του ζωντανού χάρτη, κλιμακωμένο στο κουτί** (ADR-847 §9.6). Εδώ
 * **δεν** υπολογίζεται ζουμ: η MapLibre καδράρει την έκταση με το `fitBounds`, με πρόθεση `arrive`
 * (κανείς δεν είδε «από») και ταβάνι `suggested` — τα **ίδια** με το `fitMapToArea` της άφιξης σε
 * αγγελία. Μέχρι 2026-09-29 ζούσε εδώ δεύτερη μηχανή (χειρόγραφο zoom-to-fit, ταβάνι 16, `jumpTo`
 * έξω από την αρχή)· η κάρτα μπορούσε να δείχνει z16 ενώ ο χάρτης που ανοίγει σταματά στο z15.
 *
 * 🔑 **`idle`, όχι `load` ή `render`.** Το `idle` της MapLibre σημαίνει «καμία μετάβαση, όλα τα
 * πλακίδια φορτωμένα, όλες οι πηγές φορτωμένες» — δηλαδή ακριβώς «η εικόνα είναι τελική». Το
 * `render` πυροδοτεί σε κάθε καρέ, και η λήψη εκεί θα κρατούσε μισοφορτωμένο χάρτη.
 *
 * ⚠️ **Χρειάζεται `preserveDrawingBuffer: true`** στον χάρτη: χωρίς αυτό ο περιηγητής μπορεί να
 * έχει ήδη καθαρίσει τον καμβά όταν τρέχει το `toBlob`, και η εικόνα βγαίνει **μαύρη** (μαθημένο
 * ήδη στο αποθετήριο: «αντιγραφή MSAA από την οθόνη = ΜΑΥΡΟ»).
 *
 * ⚠️ **Όριο χρόνου**: ένα πλακίδιο που δεν απαντά ποτέ θα κρατούσε το `idle` για πάντα και θα
 * πάγωνε **όλη** την ουρά. Μετά το όριο η εργασία αποτυγχάνει ⇒ η κάρτα δείχνει τη δηλωμένη
 * απουσία, και η επόμενη κάρτα προχωρά.
 */

import type { Map as MapLibreMap } from 'maplibre-gl';

import { cameraFramingInBox, type FrameBox } from '@/lib/geo/camera-motion';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

import { extentBounds } from './extent-bounds';
import { mapAttribution } from './map-attribution';
import type { MapSnapshotResult } from './map-snapshot-store';

export const SNAPSHOT_TIMEOUT_MS = 10_000;
const SNAPSHOT_MIME = 'image/webp';
const SNAPSHOT_QUALITY = 0.9;

/** Η απόδοση όπως τη δηλώνουν οι πηγές του φορτωμένου στυλ — η ΜΙΑ ανάγνωση του `map-attribution.ts`. */
function readAttribution(map: MapLibreMap): MapSnapshotResult['attribution'] {
  return mapAttribution(map);
}

/**
 * Καδράρει την **έκταση** στο κουτί, ζωγραφίζει και καλεί το `done` **ακριβώς μία φορά** — με
 * αποτέλεσμα ή `null`. Επιστρέφει ακύρωση: μετά από αυτήν το `done` δεν καλείται ποτέ.
 *
 * @param extent — ό,τι ισχυρίζεται το σχήμα (`listingFeatureExtent`), **όχι** κάμερα
 * @param box — το κουτί του χάρτη σε CSS pixel· ⚠️ πρέπει να είναι το **πραγματικό** μέγεθος του
 *              δοχείου (το `fitBounds` καδράρει στο δοχείο, το περιθώριο βγαίνει από το κουτί)
 */
export function captureMapSnapshot(
  map: MapLibreMap,
  extent: GeoBoundingBox,
  box: FrameBox,
  done: (result: MapSnapshotResult | null) => void,
): () => void {
  let finished = false;

  const onIdle = (): void => {
    map.getCanvas().toBlob(
      (blob) => finish(blob === null ? null : { blob, attribution: readAttribution(map) }),
      SNAPSHOT_MIME,
      SNAPSHOT_QUALITY,
    );
  };
  const timer = setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
  const release = (): void => {
    clearTimeout(timer);
    map.off('idle', onIdle);
  };
  function finish(result: MapSnapshotResult | null): void {
    if (finished) return;
    finished = true;
    release();
    done(result);
  }

  map.fitBounds(extentBounds(extent), cameraFramingInBox('arrive', 'suggested', box));
  map.once('idle', onIdle);
  map.triggerRepaint();

  return () => {
    finished = true;
    release();
  };
}
