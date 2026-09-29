/**
 * @fileoverview **Η ΔΙΑΔΟΧΙΚΗ ΚΛΙΜΑΚΑ ΤΩΝ ΧΑΡΤΩΝ ΤΙΜΩΝ** — `--map-seq-1..5` για MapLibre **και** για CSS, από μία πηγή.
 * @related `lib/market/value-zone-classes.ts` (`rampStepOf`) · `MapRampLegend.tsx` (το υπόμνημα) · καταναλωτές:
 *   ζώνες αντικειμενικών αξιών (ADR-889 Φ5) · χάρτης τιμών αναζήτησης (ADR-890 §14)
 * @module components/market/map-ramp
 *
 * 🔑 **Εξήχθη όταν ήρθε δεύτερος χάρτης** (N.0.2): οι στατικές κλάσεις δειγμάτων ζούσαν στο `AreaValueZonePanel` και
 * η ανάγνωση χρώματος στο `value-zone-paint`. Δύο χάρτες με δική τους αντιγραφή θα απέκλιναν στην πρώτη αλλαγή
 * παλέτας — και το ίδιο χρώμα θα σήμαινε άλλη κλάση σε δύο οθόνες.
 *
 * ⚠️ Το MapLibre **δεν** αποτιμά CSS custom properties ⇒ η τιμή διαβάζεται **τη στιγμή της απόδοσης** από το θέμα
 * (`readRootCssVar`), ώστε υπόμνημα (CSS) και χάρτης (MapLibre) να δείχνουν το **ίδιο** χρώμα.
 */

import { MAX_PRICE_CLASSES, rampStepOf } from '@/lib/market/value-zone-classes';
import { readRootCssVar } from '@/subapps/dxf-viewer/config/color-config';

/** Εφεδρικό όταν δεν υπάρχει DOM (δεν συμβαίνει στον browser — ο χάρτης είναι client-only). */
const FALLBACK_HSL = '213 70% 50%';

/** Στατικές κλάσεις (το Tailwind δεν βλέπει δυναμικά ονόματα) — μία ανά απόχρωση της `--map-seq-*`. */
export const RAMP_SWATCH_CLASS: Readonly<Record<number, string>> = {
  1: 'bg-[hsl(var(--map-seq-1))]',
  2: 'bg-[hsl(var(--map-seq-2))]',
  3: 'bg-[hsl(var(--map-seq-3))]',
  4: 'bg-[hsl(var(--map-seq-4))]',
  5: 'bg-[hsl(var(--map-seq-5))]',
};

/**
 * Διαγράμμιση στο υπόμνημα — **δεύτερο κανάλι**, όχι μόνο χρώμα (CHECK 3.41): ίδιο σχέδιο με το μοτίβο του χάρτη.
 * - `inherited`: μεσαία απόχρωση + γραμμές = «τιμή του Δήμου» (λίγα δεδομένα στη Δ.Ε.).
 * - `few`: μόνο γραμμές = «λίγα δεδομένα», κανένας αριθμός.
 */
export const HATCH_SWATCH_CLASS = {
  inherited:
    '[background:repeating-linear-gradient(45deg,hsl(var(--foreground)/0.55)_0_1.5px,transparent_1.5px_5px),hsl(var(--map-seq-3))]',
  few: '[background:repeating-linear-gradient(45deg,hsl(var(--muted-foreground)/0.7)_0_1.5px,transparent_1.5px_5px),hsl(var(--muted))]',
} as const;

/** Το χρώμα μιας απόχρωσης (1…5) **τώρα**, ως `hsl(...)` για MapLibre / canvas. */
export function readRampColor(step: number): string {
  return `hsl(${readRootCssVar(`--map-seq-${step}`, FALLBACK_HSL)})`;
}

/** Ένα χρώμα ανά κλάση, απλωμένα στην κλίμακα (`rampStepOf`) — δύο κλάσεις παίρνουν τα άκρα. */
export function readRampColors(count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => readRampColor(rampStepOf(index, count)));
}

/** Οι 5 αποχρώσεις με τη σειρά — για χάρτη με σταθερές 5 κλάσεις. */
export function readFullRamp(): readonly string[] {
  return readRampColors(MAX_PRICE_CLASSES);
}

/** Χρώμα θέματος (`--foreground`, `--muted-foreground`…) ως `hsl(...)`. */
export function readThemeColor(token: string): string {
  return `hsl(${readRootCssVar(token, FALLBACK_HSL)})`;
}
