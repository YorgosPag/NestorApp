/**
 * ADR-929 Φ5.2ε — **ομάδες πάχους από εικόνα = κορυφές πυκνότητας με βάρος μήκους**.
 *
 * Το πρόβλημα (ζωντανή επαλήθευση 2026-11-06): μια σάρωση έβγαλε 32 ομάδες 50 → 910 mm ανά ~25 mm. Η αλυσίδα ±ανοχής της
 * Φ5.2δ ενώνει μόνο γειτονικές τιμές· δεν ρωτά **πόσο στηρίζεται** ένα πάχος, οπότε ένα αυτοκίνητο γίνεται απόφαση.
 *
 * Τι κάνουν οι μεγάλοι [Π]: Revit/ArchiCAD δουλεύουν με **λίγους διακριτούς τύπους** τοίχων· το Allplan αντιστοιχίζει
 * κάθε μετρημένο πάχος σε τύπο με **εύρος** (όριο στο μέσο ανάμεσα σε διαδοχικούς τύπους) και κρατά το μετρημένο πάχος.
 * Καλύτερα εδώ: οι τύποι **βγαίνουν από τα δεδομένα**, τα όρια πέφτουν στα **ελάχιστα** της πυκνότητας (όχι στο μέσο),
 * και τα πάχη χωρίς στήριξη **δεν γίνονται απόφαση** (όπως ο θόρυβος στο DBSCAN).
 *
 *   1. Γκαουσιανός πυρήνας σε πλέγμα 1 mm, βάρος = μήκος του ορθογωνίου (ένας μακρύς τοίχος είναι περισσότερη απόδειξη
 *      από ένα κοντό σκουπίδι), εύρος = ο θόρυβος pixel σε mm.
 *   2. Λεκάνη κάθε δείγματος: ανάβαση στο πλέγμα ως την τοπική κορυφή (mean-shift σε διακριτή, ντετερμινιστική μορφή).
 *   3. Στήριξη: μερίδιο του συνολικού μήκους (όχι πλήθος — ένας μόνο εσωτερικός τοίχος είναι πραγματικός τύπος, δέκα
 *      κοντά σκουπίδια όχι)· η ισχυρότερη κορυφή στηρίζεται πάντα (≥ 1 ομάδα σε κάθε σκίτσο).
 *   4. Αστήρικτη κορυφή ⇒ η πλησιέστερη στηριγμένη, αν είναι εντός σύλληψης· αλλιώς **σπάνιο**.
 *   5. Ετικέτα = σταθμισμένος διάμεσος των μελών, στρογγυλεμένος. Συνάρτηση μόνο των δεδομένων ⇒ σταθερή ανάμεσα σε
 *      επανυπολογισμούς (η επιβεβαίωση του ανθρώπου είναι δεμένη στην ετικέτα).
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store. Ανεξάρτητο από τη σειρά των δειγμάτων.
 *
 * @see ./wall-proposal.ts (ο μόνος καταναλωτής)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.6 Φ5.2ε
 */

import { weightedMedian } from '../../utils/statistics';

export interface ThicknessSample {
  readonly thicknessMm: number;
  /** Το βάρος της απόδειξης: το μήκος του ορθογωνίου κατά τον άξονα, σε mm. */
  readonly weightMm: number;
}

export interface ThicknessModeOptions {
  /** Εύρος του πυρήνα (σ), σε mm — ο θόρυβος ψηφιοποίησης. */
  readonly bandwidthMm: number;
  /** Ελάχιστο μερίδιο του συνολικού μήκους για να γίνει μια κορυφή απόφαση. */
  readonly minShare: number;
  /** Μέγιστη απόσταση δείγματος από την κορυφή του, σε εύρη πυρήνα. */
  readonly captureBandwidths: number;
  readonly roundMm: number;
}

export type ThicknessModeAssignment =
  | { readonly kind: 'mode'; readonly labelMm: number }
  | { readonly kind: 'rare' };

const KERNEL_REACH_BANDWIDTHS = 4;

interface DensityGrid {
  /** Η τιμή σε mm του κελιού 0· κελί `j` = `origin + j` mm. */
  readonly origin: number;
  readonly values: Float64Array;
}

const weightOf = (s: ThicknessSample): number => Math.max(s.weightMm, 1);

function densityGrid(samples: readonly ThicknessSample[], h: number): DensityGrid {
  const reach = KERNEL_REACH_BANDWIDTHS * h;
  const ts = samples.map((s) => s.thicknessMm);
  const origin = Math.floor(Math.min(...ts) - reach);
  const values = new Float64Array(Math.ceil(Math.max(...ts) + reach) - origin + 1);
  for (const s of samples) {
    const from = Math.max(0, Math.ceil(s.thicknessMm - reach - origin));
    const to = Math.min(values.length - 1, Math.floor(s.thicknessMm + reach - origin));
    for (let j = from; j <= to; j++) {
      const z = (origin + j - s.thicknessMm) / h;
      values[j] += weightOf(s) * Math.exp(-0.5 * z * z);
    }
  }
  return { origin, values };
}

/**
 * Ανάβαση ως την τοπική κορυφή. Πρώτα αυστηρή άνοδος (ισοπαλία πλευρών ⇒ δεξιά)· σε **οροπέδιο** (κανένας γείτονας
 * ψηλότερος, ο δεξιός ίσος) ⇒ δεξιά ως το άκρο του. Έτσι η κορυφή ενός οροπεδίου είναι ΕΝΑ κελί (το δεξί άκρο),
 * όποια πλευρά κι αν έρθει κανείς — αλλιώς μια συμμετρική πυκνότητα θα έσπαγε σε δύο «ομάδες». Τερματίζει: η τιμή
 * δεν μειώνεται ποτέ, η κίνηση αριστερά γίνεται μόνο με αυστηρή άνοδο, και δεξιά σε ίση τιμή δεν γυρίζει πίσω.
 */
function climb(values: Float64Array, start: number): number {
  let i = start;
  for (;;) {
    const here = values[i];
    const left = i > 0 ? values[i - 1] : -Infinity;
    const right = i < values.length - 1 ? values[i + 1] : -Infinity;
    if (right > here && right >= left) i += 1;
    else if (left > here) i -= 1;
    else if (right === here) i += 1;
    else return i;
  }
}

/** Οι κορυφές (σε mm) που στηρίζονται αρκετά για να γίνουν απόφαση. */
function supportedPeaks(peaks: readonly number[], samples: readonly ThicknessSample[], o: ThicknessModeOptions): number[] {
  const support = new Map<number, number>();
  peaks.forEach((p, i) => support.set(p, (support.get(p) ?? 0) + weightOf(samples[i])));
  const total = samples.reduce((s, x) => s + weightOf(x), 0);
  const ranked = [...support.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const kept = ranked.filter(([, weight]) => weight / total >= o.minShare).map(([p]) => p);
  return kept.length > 0 ? kept : [ranked[0][0]];
}

/** Η κορυφή που υιοθετεί ένα δείγμα (η δική του αν στηρίζεται, αλλιώς η πλησιέστερη), ή `null` = σπάνιο. */
function adoptedPeak(t: number, own: number, kept: readonly number[], capture: number): number | null {
  const target = kept.includes(own)
    ? own
    : kept.reduce((best, p) => (Math.abs(p - t) < Math.abs(best - t) || (Math.abs(p - t) === Math.abs(best - t) && p < best) ? p : best));
  return Math.abs(target - t) <= capture ? target : null;
}

/** Ετικέτα ομάδας: σταθμισμένος διάμεσος των μελών, στρογγυλεμένος (ποτέ κάτω από ένα βήμα). */
function labelOf(members: readonly ThicknessSample[], roundMm: number): number {
  const mid = weightedMedian(members.map((m) => m.thicknessMm), members.map(weightOf));
  return Math.max(roundMm, Math.round(mid / roundMm) * roundMm);
}

/** Για κάθε δείγμα (στη σειρά της εισόδου): η ομάδα του, ή «σπάνιο». */
export function assignThicknessModes(
  samples: readonly ThicknessSample[],
  o: ThicknessModeOptions,
): ThicknessModeAssignment[] {
  if (samples.length === 0) return [];
  const h = Math.max(o.bandwidthMm, 1);
  const grid = densityGrid(samples, h);
  const last = grid.values.length - 1;
  const peaks = samples.map((s) => {
    const cell = Math.min(last, Math.max(0, Math.round(s.thicknessMm - grid.origin)));
    return grid.origin + climb(grid.values, cell);
  });
  const kept = supportedPeaks(peaks, samples, o);
  const adopted = samples.map((s, i) => adoptedPeak(s.thicknessMm, peaks[i], kept, o.captureBandwidths * h));
  const members = new Map<number, ThicknessSample[]>();
  adopted.forEach((p, i) => {
    if (p === null) return;
    const list = members.get(p);
    if (list) list.push(samples[i]);
    else members.set(p, [samples[i]]);
  });
  const labels = new Map([...members].map(([p, m]) => [p, labelOf(m, o.roundMm)] as const));
  return adopted.map((p) => (p === null ? { kind: 'rare' } : { kind: 'mode', labelMm: labels.get(p) ?? o.roundMm }));
}
