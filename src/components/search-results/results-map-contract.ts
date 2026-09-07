/**
 * # ΤΟ ΣΥΝΟΡΟ ΠΡΟΣ ΤΟ MapLibre — **Η ΟΨΗ ΠΟΥ ΧΡΕΙΑΖΟΜΑΣΤΕ, ΓΡΑΜΜΕΝΗ ΜΙΑ ΦΟΡΑ**
 *
 * 🔴 **ΕΞΗΧΘΗ ΑΠΟ ΤΟ `ResultsMap.tsx` ΓΙΑΤΙ ΕΚΕΙΝΟ ΞΑΝΑΠΕΡΑΣΕ ΤΟ ΟΡΙΟ** *(ADR-777
 * §8.63)*: με το καδράρισμα στη δηλωμένη περιοχή έφτασε **539** γραμμές, πάνω από το
 * όριο των 500 (N.7.1), που είναι **δεσμευτικό στο pre-commit**.
 *
 * 🔑 **Η κοπή δεν είναι αριθμητική.** Εδώ ζει *«τι σχήμα έχει το αντικείμενο που μας
 * δίνει η βιβλιοθήκη»* — γνώση που αλλάζει όταν αλλάζει **η βιβλιοθήκη**. Στο
 * `ResultsMap` μένει *«τι κάνει ο χάρτης όταν τον αγγίξεις»* — γνώση που αλλάζει όταν
 * αλλάζει **το προϊόν**. Δύο ρυθμοί αλλαγής, δύο αρχεία.
 *
 * ⚠️ Ζει δίπλα στο `results-map-area.ts` και **όχι μέσα του** επίτηδες: εκείνο απαντά
 * *«πού κοιτάει ο χάρτης»* — μία ερώτηση του **προϊόντος**, που τυχαίνει να χρειάζεται
 * μια μέθοδο της βιβλιοθήκης. Συγχωνευμένα, το σύνορο θα κουβαλούσε σημασιολογία.
 */

import type { GeoBoundingBox } from '@/types/geo/coordinates';

import type { MapAreaSource } from './results-map-area';

/**
 * Η όψη του MapLibre που **χρειάζεται πραγματικά** ο `ResultsMap`.
 *
 * ⚠️ Το `MapInstance` του Geo-Canvas δεν εκθέτει τη διεπαφή συμβάντων ανά επίπεδο, και
 * η μετάβαση γινόταν ήδη με `as unknown`. Γράφεται **μία** φορά, ονομασμένη, αντί να
 * επαναληφθεί σε κάθε χειριστή — έτσι μια αλλαγή της βιβλιοθήκης σπάει σε **ένα**
 * σημείο αντί για πέντε.
 */
export interface MapPointerEvent {
  readonly features?: Array<{ properties?: Record<string, unknown> }>;
  readonly point: { x: number; y: number };
}

/**
 * Το συμβάν κίνησης του χάρτη — **και το ένα πεδίο που μας ενδιαφέρει**.
 *
 * 🔑 **Το `originalEvent` απαντά «ποιος το ζήτησε;»** και είναι το καθιερωμένο ιδίωμα
 * του MapLibre: υπάρχει όταν την κίνηση την προκάλεσε **άνθρωπος** (σύρσιμο, ρόδα,
 * κουμπί ζουμ) και **λείπει** όταν την προκάλεσε ο κώδικάς μας (`fitBounds`).
 *
 * 🔴 **Χωρίς αυτόν τον έλεγχο, το ΑΡΧΙΚΟ καδράρισμα θα γραφόταν στη διεύθυνση σαν να
 * το ζήτησε ο επισκέπτης** — δηλαδή κάθε άνθρωπος που απλώς **άνοιξε** τη σελίδα θα
 * αποκτούσε αμέσως φίλτρο περιοχής που δεν διάλεξε ποτέ, και ο κοινοποιημένος
 * σύνδεσμος θα κουβαλούσε ένα ερώτημα που κανείς δεν έθεσε.
 */
export interface MapMoveEvent {
  readonly originalEvent?: unknown;
}

export interface MapEventTarget extends MapAreaSource {
  on: (
    ev: string,
    layerOrHandler: string | ((e: MapPointerEvent) => void) | ((e: MapMoveEvent) => void),
    cb?: (e: MapPointerEvent) => void
  ) => void;
  getCanvas: () => HTMLCanvasElement;
  getContainer: () => HTMLElement;
  resize: () => void;
  fitBounds: (b: [[number, number], [number, number]], o?: Record<string, unknown>) => void;
  queryRenderedFeatures: (
    point: { x: number; y: number },
    options?: { layers?: readonly string[] }
  ) => Array<{ properties?: Record<string, unknown> }>;
}

/** Η ταυτότητα της αγγελίας κάτω από τον δείκτη, ή `null` αν δεν είναι αγγελία. */
export function listingIdOf(event: MapPointerEvent): string | null {
  const id = event.features?.[0]?.properties?.id;
  return typeof id === 'string' ? id : null;
}
/** Πόσο κενό αφήνει κάθε καδράρισμα, και ως πού ζουμάρει. **Μία** απάντηση, τρεις καλούντες. */
const FIT_OPTIONS = { padding: 64, maxZoom: 15, duration: 0 } as const;

/**
 * Κάδραρε τον χάρτη σε ένα ορθογώνιο.
 *
 * 🔑 **Υπάρχει επειδή οι καλούντες είναι ΤΡΕΙΣ** *(αρχικό καδράρισμα στα δεδομένα ·
 * καδράρισμα στη δηλωμένη περιοχή · η ίδια πράξη τη στιγμή που ετοιμάζεται ο χάρτης)*
 * και η μετατροπή `GeoBoundingBox → [[δ,ν],[α,β]]` είναι **σιωπηλά αντιστρέψιμη**: μια
 * εναλλαγή γεωγραφικού μήκους/πλάτους δεν σπάει τίποτα, απλώς στέλνει τον χάρτη
 * **αλλού** — και ο τρίτος καλών θα την έγραφε ανάποδα.
 *
 * ⚠️ **Το `maxZoom` δεν είναι αισθητικό**: ΕΝΑ αποτέλεσμα δίνει ορθογώνιο μηδενικού
 * εμβαδού, και ο χάρτης θα ζουμάριζε σε **επίπεδο δρόμου** — ισχυρισμός ακρίβειας που
 * το ίδιο το σχήμα μπορεί να μην κάνει (Α5).
 */
export function fitMapToArea(target: MapEventTarget, area: GeoBoundingBox): void {
  target.fitBounds(
    [
      [area.west, area.south],
      [area.east, area.north],
    ],
    FIT_OPTIONS
  );
}
