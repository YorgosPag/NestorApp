/**
 * @fileoverview **Κλάσεις τιμής ζώνης για τον χάρτη** — ποσοστημόρια της **περιοχής**, με όρια πάνω σε πραγματικές τιμές.
 * @related ADR-889 §10 · `components/area-market/AreaValueZoneLayer.tsx` (ο καταναλωτής) · `--map-seq-1..5` (globals.css)
 * @module lib/market/value-zone-classes
 *
 * 🔑 **Ποσοστημόρια της περιοχής, όχι πανελλαδικά σταθερά όρια**: η ερώτηση του χάρτη είναι «**πού μέσα σε αυτή την
 * περιοχή** είναι ακριβά;». Με εθνικά όρια, ένας ορεινός δήμος θα ήταν ολόκληρος μία απόχρωση και η Αθήνα άλλη — μηδέν
 * πληροφορία. Το υπόμνημα γράφει τους **αριθμούς**, άρα δύο περιοχές δεν συγκρίνονται ποτέ «κατά χρώμα».
 *
 * 🔑 **Κάθε όριο ΕΙΝΑΙ τιμή της πηγής** (πολλαπλάσια των 50 €): καμία στρογγύλευση, καμία κλάση που υπόσχεται εύρος
 * χωρίς ζώνη μέσα. Το υπόμνημα δείχνει το **πραγματικό** ελάχιστο–μέγιστο κάθε κλάσης.
 */

/** Όσες και οι αποχρώσεις του `--map-seq-*`. */
export const MAX_PRICE_CLASSES = 5;

export interface PriceClass {
  /** Η μικρότερη τιμή της κλάσης (€/τ.μ.) — και το κατώφλι της για το `step` του χάρτη. */
  readonly low: number;
  /** Η μεγαλύτερη τιμή της κλάσης. */
  readonly high: number;
}

/** Τα κατώφλια (κατώτερα όρια κλάσεων 2…n) από τα ποσοστημόρια — μόνο όσα χωρίζουν πραγματικά. */
function thresholds(sorted: readonly number[], classes: number): number[] {
  const cuts = new Set<number>();
  for (let k = 1; k < classes; k += 1) cuts.add(sorted[Math.floor((sorted.length * k) / classes)]);
  return [...cuts].filter((cut) => cut > sorted[0]).sort((a, b) => a - b);
}

/**
 * **Οι κλάσεις τιμής** των ζωνών — `[]` όταν δεν υπάρχει καμία. Κάθε ζώνη μετρά **μία** φορά (όχι κατά εμβαδόν:
 * το ερώτημα είναι «πόσες ζώνες», και μια τεράστια αγροτική ζώνη δεν πρέπει να καταπιεί την κλίμακα).
 */
export function valueZonePriceClasses(prices: readonly number[], maxClasses = MAX_PRICE_CLASSES): readonly PriceClass[] {
  if (prices.length === 0) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const cuts = thresholds(sorted, maxClasses);
  const lows = [sorted[0], ...cuts];
  return lows.map((low, i) => {
    const next = lows[i + 1];
    const inClass = sorted.filter((price) => price >= low && (next === undefined || price < next));
    return { low, high: inClass[inClass.length - 1] };
  });
}

/**
 * Ποια απόχρωση της κλίμακας (1…`MAX_PRICE_CLASSES`) φορά η κλάση `index` από `count` — **απλωμένες**, ώστε δύο
 * κλάσεις να παίρνουν τα άκρα και όχι δύο γειτονικές, σχεδόν ίδιες, αποχρώσεις.
 */
export function rampStepOf(index: number, count: number): number {
  if (count <= 1) return Math.ceil(MAX_PRICE_CLASSES / 2);
  return 1 + Math.round((index * (MAX_PRICE_CLASSES - 1)) / (count - 1));
}
