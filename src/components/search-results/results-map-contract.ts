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

import { cameraFraming } from '@/lib/geo/camera-motion';
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
  /** Πού πάτησε ο άνθρωπος, σε γεωγραφικές — η άγκυρα της λίστας διαλέγματος (§8.76). */
  readonly lngLat?: { lng: number; lat: number };
  /** Το συμβάν του περιηγητή — ταξιδεύει στην κίνηση που προκαλεί το κλικ (βλ. {@link MapMoveEvent}). */
  readonly originalEvent?: unknown;
}

/** Ένα σχήμα κάτω από τον δείκτη — **και το επίπεδο** που το ζωγράφισε (ο κριτής του §8.76 το ρωτά). */
export interface RenderedFeature {
  readonly properties?: Record<string, unknown>;
  readonly layer?: { readonly id: string };
  readonly geometry?: { readonly type: string; readonly coordinates?: unknown };
}

/**
 * **Η όψη μιας ομαδοποιημένης πηγής** που χρειάζεται το κλικ σε ομάδα (MapLibre 5: Promise).
 *
 * ⚠️ Ζητείται με `getSource`, που επιστρέφει **οποιαδήποτε** πηγή: ο έλεγχος
 * {@link isClusterSource} είναι το σύνορο, όχι ένα `as`.
 */
export interface ClusterSource {
  getClusterExpansionZoom: (clusterId: number) => Promise<number>;
  getClusterLeaves: (clusterId: number, limit: number, offset: number) => Promise<RenderedFeature[]>;
}

export function isClusterSource(source: unknown): source is ClusterSource {
  if (typeof source !== 'object' || source === null) return false;
  return 'getClusterExpansionZoom' in source && 'getClusterLeaves' in source;
}

/** Τι απαντά το `cameraForBounds`: κέντρο + ζουμ, ή `undefined` αν το κάδρο δεν χωρά. */
export interface CameraForBounds {
  readonly center: { lng: number; lat: number };
  readonly zoom: number;
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
  ) => RenderedFeature[];
  getSource: (id: string) => unknown;
  /** Ό,τι ζωγράφισε η πηγή στα φορτωμένα πλακίδια — ομάδες **και** μεμονωμένα σημεία (§8.78). */
  querySourceFeatures: (sourceId: string) => RenderedFeature[];
  /** Το τρέχον ζουμ — σήμα αλλαγής σχετικών θέσεων των πινακίδων (§8.78, κανόνας 5). */
  getZoom: () => number;
  cameraForBounds: (
    b: [[number, number], [number, number]],
    o?: Record<string, unknown>
  ) => CameraForBounds | undefined;
  /** Το δεύτερο όρισμα (`eventData`) αντιγράφεται στα συμβάντα κίνησης — βλ. {@link MapMoveEvent}. */
  flyTo: (options: Record<string, unknown>, eventData?: Record<string, unknown>) => void;
}

/** Η ταυτότητα της αγγελίας κάτω από τον δείκτη, ή `null` αν δεν είναι αγγελία. */
export function listingIdOf(event: MapPointerEvent): string | null {
  const id = event.features?.[0]?.properties?.id;
  return typeof id === 'string' ? id : null;
}
/**
 * **Πώς καδράρει ο χάρτης των αποτελεσμάτων** — μία απάντηση, **τέσσερις** καλούντες.
 *
 * 🔑 **Οι τρεις σιωπηλοί αριθμοί έγιναν τρεις δηλωμένες απαντήσεις** *(ADR κίνησης
 * κάμερας)*, και καμία τιμή δεν άλλαξε — άλλαξε **ποιος τις ξέρει**:
 *
 * | ερώτηση | απάντηση | τι σήμαινε ο αριθμός |
 * |---|---|---|
 * | είδε ο άνθρωπος από πού φεύγει; | **`arrive`** | `duration: 0` |
 * | τι κάθεται στην άκρη του κάδρου; | **`label`** | `padding: 64` — ετικέτες τιμών |
 * | τι ισχυρίζεται το κάδρο; | **`suggested`** | `maxZoom: 15` |
 *
 * 🔴 **Το `arrive` ΔΕΝ είναι «χωρίς κίνηση επειδή είναι φθηνότερο».** Και οι δύο στιγμές
 * που καδράρουν εδώ είναι στιγμές όπου ο άνθρωπος **δεν είδε ποτέ** το «από»: το πρώτο
 * βάψιμο με τα δεδομένα, και το άνοιγμα κοινοποιημένου συνδέσμου `?box=…`. Μια πτήση
 * χωρίς «από» δεν επικοινωνεί τίποτα· εδώ θα ήταν **και χειρότερα**, γιατί το κάδρο
 * ξαναϋπολογίζεται πάνω στην κίνηση του ίδιου του ανθρώπου ⇒ ορατό **τίναγμα**.
 */
const FIT_OPTIONS = cameraFraming('arrive', 'label', 'suggested');

/**
 * Κάδραρε τον χάρτη σε ένα **έτοιμο** ορθογώνιο MapLibre `[[δ,ν],[α,β]]`.
 *
 * 🔑 **Υπάρχει επειδή το `ResultsMap` έγραφε `{ padding: 64, maxZoom: 15, duration: 0 }`
 * ΔΥΟ ΦΟΡΕΣ inline** — ενώ το `FIT_OPTIONS` καθόταν σε **αυτό ακριβώς** το αρχείο,
 * δίπλα του. Τρία σημεία που έπρεπε να συμφωνούν με το χέρι, χωρίς τίποτα να το ελέγχει.
 */
export function fitMapToBounds(
  target: MapEventTarget,
  bounds: [[number, number], [number, number]],
): void {
  target.fitBounds(bounds, FIT_OPTIONS);
}

/**
 * Κάδραρε τον χάρτη σε μια **περιοχή του τομέα** (`GeoBoundingBox`).
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
  fitMapToBounds(target, [
    [area.west, area.south],
    [area.east, area.north],
  ]);
}
