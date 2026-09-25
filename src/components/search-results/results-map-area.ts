/**
 * # Ο ΧΑΡΤΗΣ ΑΝΑΦΕΡΕΙ ΠΟΥ ΚΟΙΤΑΕΙ (ADR-777 §8.63)
 *
 * Ως σήμερα **δεν το έκανε ποτέ**: μετρημένο με grep, δεν υπήρχε ούτε `moveend`, ούτε
 * `getBounds`, ούτε καμία διαδρομή από τον χάρτη προς τα φίλτρα. Ο χάρτης **δεχόταν**
 * περιοχή (`fitBounds`) και δεν **επέστρεφε** ποτέ.
 *
 * ⚠️ **ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΤΟ ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ**: το `ResultsMap.tsx` ήταν
 * **487** γραμμές — δεκατρείς κάτω από το όριο των 500 (N.7.1). Ό,τι μπορεί να ζήσει
 * έξω από αυτό, ζει έξω από αυτό.
 *
 * ⛔ **ΜΗΝ ΤΟ ΟΝΟΜΑΣΕΙΣ `viewport`.** Στο έργο η λέξη σημαίνει **πλάτος οθόνης**
 * (`ViewportClass`), και δύο έννοιες που μοιράζονται ένα όνομα είναι κατά λέξη το
 * σχήμα ADR-749.
 */

import { matchGeoArea } from '@/lib/geo/geo-area';
import type { GeoArea, GeoBoundingBox } from '@/types/geo/coordinates';

/**
 * Η όψη του MapLibre που χρειάζεται **αυτό** το ερώτημα, και τίποτα άλλο.
 *
 * ⚠️ Το `getBounds()` επιστρέφει `LngLatBounds` — αντικείμενο με **μεθόδους**, όχι
 * πεδία. Γράφεται εδώ **μία** φορά, ονομασμένη, ώστε μια αλλαγή της βιβλιοθήκης να
 * σπάσει σε **ένα** σημείο· ίδιο ιδίωμα με το `MapEventTarget` του `ResultsMap`.
 */
export interface MapAreaSource {
  getBounds: () => {
    getSouth: () => number;
    getWest: () => number;
    getNorth: () => number;
    getEast: () => number;
  };
}

/**
 * Το τρέχον κάδρο του χάρτη ως {@link GeoBoundingBox}, ή `null` αν δεν διαβάζεται.
 *
 * 🔴 **ΕΠΙΣΤΡΕΦΕΙ `null` ΑΝΤΙ ΝΑ ΠΕΤΑΞΕΙ, ΚΑΙ Η ΕΠΙΛΟΓΗ ΕΙΝΑΙ ΣΥΝΕΙΔΗΤΗ.** Το
 * αντικείμενο έρχεται από **ξένο** κώδικα (Geo-Canvas/MapLibre) μέσα από μετάβαση
 * `as unknown` — δηλαδή ο μεταγλωττιστής **δεν** εγγυάται τίποτα εδώ. Μια εξαίρεση
 * μέσα σε ακροατή `moveend` δεν έχει ποιον να ειδοποιήσει: θα έσκαγε σιωπηλά στην
 * κονσόλα και ο χάρτης θα σταματούσε να αναφέρει **χωρίς κανείς να το μάθει**. Το
 * `null` ταξιδεύει, και ο καλών ξέρει τι σημαίνει *«δεν έχω κάδρο»*.
 *
 * ⚠️ **Μη πεπερασμένοι αριθμοί απορρίπτονται.** Ένας χάρτης που δεν έχει ακόμη
 * μετρηθεί δίνει `NaN` — και ένα ορθογώνιο με `NaN` περνά **κάθε** αριθμητική
 * σύγκριση ως `false`, δηλαδή θα άδειαζε τη λίστα σιωπηλά. Είναι το ίδιο μάθημα με
 * το `Box3.isEmpty` του τομέα 3D: το `NaN` δεν είναι «λίγο λάθος», είναι **αόρατο**.
 */
export function readMapArea(source: MapAreaSource): GeoBoundingBox | null {
  const bounds = source.getBounds?.();
  if (!bounds) return null;

  const box = {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
  const finite = Object.values(box).every((value) => Number.isFinite(value));
  return finite ? box : null;
}

/** Ίδιο ορθογώνιο; — σύγκριση **πεδίο προς πεδίο**, ποτέ ταυτότητα αντικειμένου. */
export function sameMapArea(a: GeoBoundingBox | null, b: GeoBoundingBox | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.south === b.south && a.west === b.west && a.north === b.north && a.east === b.east
  );
}

/**
 * **Ποιο ορθογώνιο καδράρει ο χάρτης για αυτή την ερώτηση** — ή `null` *(ADR-885)*.
 *
 * 🔑 Ορθογώνιο, όριο και σχέδιο καδράρονται στο δικό τους ορθογώνιο, ώστε ένας
 * κοινοποιημένος σύνδεσμος να **δείχνει** την περιοχή που φιλτράρει. Ο **κύκλος** όχι: εκείνον
 * τον καδράρει ήδη ο μηχανισμός των δεδομένων. Εξαντλητικό — κανένα σχήμα δεν πέφτει
 * σιωπηλά σε λάθος κλάδο.
 */
export function framedSearchArea(near: GeoArea | null): GeoBoundingBox | null {
  if (near === null) return null;
  return matchGeoArea<GeoBoundingBox | null>(near, {
    box: (box) => box,
    region: (region) => region.bbox,
    drawn: (drawn) => drawn.bbox,
    circle: () => null,
  });
}
