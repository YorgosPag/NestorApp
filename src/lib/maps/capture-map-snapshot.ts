/**
 * @fileoverview **Μία λήψη** — μετακίνησε την κάμερα, περίμενε να ηρεμήσει ο χάρτης, κράτα την εικόνα.
 * @related ADR-777 §8.70 (Φάση 2) · lib/maps/map-snapshot-store · lib/maps/map-attribution
 * @module lib/maps/capture-map-snapshot
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

import { mergeAttributions } from './map-attribution';
import type { SnapshotCamera } from './map-snapshot-camera';
import type { MapSnapshotResult } from './map-snapshot-store';

export const SNAPSHOT_TIMEOUT_MS = 10_000;
const SNAPSHOT_MIME = 'image/webp';
const SNAPSHOT_QUALITY = 0.9;

/** Η απόδοση όπως τη δηλώνουν οι πηγές του φορτωμένου στυλ (TileJSON / `attribution`). */
function readAttribution(map: MapLibreMap): MapSnapshotResult['attribution'] {
  const ids = Object.keys(map.getStyle().sources);
  return mergeAttributions(ids.map((id) => map.getSource(id)?.attribution ?? ''));
}

/**
 * Ζωγραφίζει την κάμερα και καλεί το `done` **ακριβώς μία φορά** — με αποτέλεσμα ή `null`.
 * Επιστρέφει ακύρωση: μετά από αυτήν το `done` δεν καλείται ποτέ.
 */
export function captureMapSnapshot(
  map: MapLibreMap,
  camera: SnapshotCamera,
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

  map.jumpTo({ center: [camera.center.lng, camera.center.lat], zoom: camera.zoom });
  map.once('idle', onIdle);
  map.triggerRepaint();

  return () => {
    finished = true;
    release();
  };
}
