/**
 * # Η ΣΧΕΔΙΑΣΜΕΝΗ ΠΕΡΙΟΧΗ ΣΤΗ ΔΙΕΥΘΥΝΣΗ (ADR-885)
 *
 * `?draw=<σχήμα>&draw=<σχήμα>` — **ένα κλειδί ανά σχήμα**, κάθε σχήμα σε Google Encoded
 * Polyline (`lib/geo/geo-polyline-codec.ts`).
 *
 * 🔑 **Γιατί επαναλαμβανόμενο κλειδί και όχι διαχωριστικό.** Το αλφάβητο του polyline
 * (ASCII 63–126) περιέχει σχεδόν κάθε σύμβολο που θα διάλεγε κανείς για διαχωριστικό
 * (`|`, `~`, `_`, `^`). Το επαναλαμβανόμενο κλειδί είναι η **εγγενής** λίστα του
 * `URLSearchParams` — ο ίδιος μηχανισμός που ήδη κουβαλά τα κριτήρια λεξιλογίου.
 *
 * 🔑 **Η ΕΝΑ ΠΟΡΤΑ**: κάθε σχεδιασμένη περιοχή — από τη χειρονομία ή από τη διεύθυνση —
 * γεννιέται από το {@link drawnAreaFromShapes}. Ο ίδιος έλεγχος εγκυρότητας, τα ίδια
 * όρια, η ίδια κβάντιση: ό,τι δέχεται η Εφαρμογή το δέχεται και ο σύνδεσμος, και αντίστροφα.
 */

import { outlinesBoundingBox } from '@/lib/geo/geo-area';
import { strokeToShapes } from '@/lib/geo/geo-freehand';
import { decodeGeoPolyline, encodeGeoPolyline, quantizeGeoPoint } from '@/lib/geo/geo-polyline-codec';
import { MIN_OUTLINE_AREA_SQM, outlineDefect } from '@/lib/places/place-claim-validation';
import type { GeoArea, GeoDrawnArea, GeoOutline, GeoPoint, GeoRegionRef } from '@/types/geo/coordinates';

/** Το κλειδί της διεύθυνσης — δεσμευμένο στο `RESERVED_SEARCH_PARAMS`. */
export const SEARCH_DRAWN_PARAM = 'draw';

/**
 * **Πόσα σχήματα το πολύ.** Το Idealista δηλώνει «χωρίς όριο»· στην πράξη ο περιορισμός
 * είναι το μήκος του συνδέσμου ({@link MAX_DRAWN_URL_CHARS}). Οκτώ γειτονιές σε μία
 * αναζήτηση είναι ήδη πέρα από κάθε πραγματική χρήση — και ένα ρητό ταβάνι είναι
 * προτιμότερο από έναν σύνδεσμο που σπάει σιωπηλά σε κάποιον διακομιστή.
 */
export const MAX_DRAWN_SHAPES = 8;

/**
 * **Προϋπολογισμός χαρακτήρων για ΟΛΑ τα σχήματα μαζί.** Οι διακομιστές και οι
 * εφαρμογές μηνυμάτων κόβουν συνδέσμους κάπου πάνω από τους 2.000 χαρακτήρες· το
 * υπόλοιπο της διεύθυνσης (κριτήρια, διαμονή) χρειάζεται χώρο. Η χειρονομία δεν
 * απορρίπτεται όταν τον ξεπερνά — απλοποιείται περισσότερο (`lib/geo/geo-freehand.ts`).
 */
export const MAX_DRAWN_URL_CHARS = 1800;

/** Το μήκος που θα πιάσουν αυτά τα σχήματα στη διεύθυνση. */
export function drawnShapesUrlLength(shapes: readonly GeoOutline[]): number {
  return shapes.reduce((sum, shape) => sum + encodeGeoPolyline(shape).length, 0);
}

/**
 * **Σχήματα → σχεδιασμένη περιοχή, ή `null`.**
 *
 * 1. Κβάντιση στο πλέγμα του συνδέσμου — **πριν** την κρίση, αφού η κβάντιση μπορεί
 *    (σπάνια) να κάνει δύο πλευρές να αγγιχτούν.
 * 2. Κάθε σχήμα κρίνεται από το **υπάρχον** `outlineDefect` — τον ίδιο κριτή που
 *    ρωτούν ο ισχυρισμός τόπου και η εμβέλεια του επαγγελματία. Κανένα δεύτερο όριο
 *    εμβαδού, κανένας δεύτερος έλεγχος αυτοτομής.
 * 3. Ταβάνια πλήθους και μήκους.
 *
 * ⚠️ **Fail-closed ολόκληρο**: ένα άκυρο σχήμα ακυρώνει όλη την περιοχή. Αν κρατούσαμε
 * τα υπόλοιπα, ο σύνδεσμος θα έψαχνε **λιγότερο** απ' όσο ζήτησε ο άνθρωπος — με σιγουριά.
 */
export function drawnAreaFromShapes(shapes: readonly GeoOutline[]): GeoDrawnArea | null {
  if (shapes.length === 0 || shapes.length > MAX_DRAWN_SHAPES) return null;

  const quantized = shapes.map((shape) => shape.map(quantizeGeoPoint));
  if (quantized.some((shape) => outlineDefect(shape) !== null)) return null;
  if (drawnShapesUrlLength(quantized) > MAX_DRAWN_URL_CHARS) return null;

  const bbox = outlinesBoundingBox(quantized);
  return bbox === null ? null : { shapes: quantized, bbox };
}

/**
 * Πόσες φορές το πολύ διπλασιάζεται η ανοχή για να χωρέσει η χειρονομία στον σύνδεσμο
 * (×2, ×4, … ×32). Μετά από αυτό το σχήμα θα απείχε ορατά από τη γραμμή του ανθρώπου —
 * και η τίμια απάντηση είναι «δεν χωρά άλλο σχήμα», όχι ένα σχήμα που δεν ζωγράφισε.
 */
const MAX_TOLERANCE_DOUBLINGS = 5;

/**
 * **Χειρονομία → σχήματα που χωρούν δίπλα στα υπάρχοντα.**
 *
 * 🔑 Όταν η χειρονομία δεν χωρά στον {@link MAX_DRAWN_URL_CHARS}, **απλοποιείται
 * περισσότερο** αντί να απορριφθεί — ίδια ιδέα με το freehand του mapbox-gl-draw (ανοχή
 * που μεγαλώνει με τη σμίκρυνση), αλλά οδηγημένη από το **πραγματικό** κόστος.
 *
 * ⚠️ Βρόχοι που ο κριτής απορρίπτει (κόμπος, κβάντιση που κόλλησε δύο πλευρές) **πέφτουν
 * μεμονωμένα** — εδώ, και μόνο εδώ, γιατί εδώ ο άνθρωπος **βλέπει** το αποτέλεσμα πριν
 * την Εφαρμογή. Στη διεύθυνση ένα άκυρο σχήμα ακυρώνει όλη την περιοχή.
 *
 * @returns τα νέα σχήματα (ήδη κβαντισμένα), ή κενό αν δεν χωρά τίποτα.
 */
export function drawnShapesFromStroke(
  stroke: readonly GeoPoint[],
  toleranceM: number,
  existing: readonly GeoOutline[]
): GeoOutline[] {
  const room = MAX_DRAWN_SHAPES - existing.length;
  const budget = MAX_DRAWN_URL_CHARS - drawnShapesUrlLength(existing);
  if (room <= 0 || budget <= 0) return [];

  for (let doubling = 0; doubling <= MAX_TOLERANCE_DOUBLINGS; doubling++) {
    const shapes = strokeToShapes(stroke, {
      toleranceM: toleranceM * 2 ** doubling,
      minAreaSqm: MIN_OUTLINE_AREA_SQM,
    })
      .map((shape) => shape.map(quantizeGeoPoint))
      .filter((shape) => outlineDefect(shape) === null)
      .slice(0, room);
    if (drawnShapesUrlLength(shapes) <= budget) return shapes;
  }
  return [];
}

/** Διεύθυνση → σχεδιασμένη περιοχή, ή `null`. */
export function readSearchDrawnArea(params: URLSearchParams): GeoDrawnArea | null {
  const encoded = params.getAll(SEARCH_DRAWN_PARAM);
  if (encoded.length === 0) return null;

  const shapes: GeoOutline[] = [];
  for (const text of encoded) {
    const shape = decodeGeoPolyline(text.trim());
    if (shape === null) return null;
    shapes.push(shape);
  }
  return drawnAreaFromShapes(shapes);
}

/** Σχεδιασμένη περιοχή → διεύθυνση, ένα `append` ανά σχήμα. */
export function writeSearchDrawnArea(area: GeoDrawnArea, params: URLSearchParams): void {
  for (const shape of area.shapes) params.append(SEARCH_DRAWN_PARAM, encodeGeoPolyline(shape));
}

/**
 * Σταθερή ταυτότητα της περιοχής — για κλειδιά cache/συνδρομής. Είναι το ίδιο το
 * κείμενο της διεύθυνσης: δύο περιοχές με την ίδια ταυτότητα **είναι** ο ίδιος σύνδεσμος.
 */
export function drawnAreaKey(area: GeoDrawnArea): string {
  return area.shapes.map(encodeGeoPolyline).join(',');
}

/**
 * Η σχεδιασμένη περιοχή που ζητά η διεύθυνση, αν ζητά — ίδιο ιδίωμα με το
 * `searchRegionId`: δέχεται και την ανεπίλυτη αναφορά ορίου, που **δεν** είναι `GeoArea`.
 */
export function searchDrawnArea(near: GeoArea | GeoRegionRef | null): GeoDrawnArea | null {
  return near !== null && 'shapes' in near ? near : null;
}
