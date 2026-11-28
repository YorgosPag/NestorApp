/**
 * @fileoverview **Ποια υποψήφια είναι η ΙΔΙΑ γραμμή στο σχέδιο** — ίδιο σχήμα, άλλη στρώση (ADR-920 §14.11 «Ζ4 — αμφίδρομη
 * επισήμανση», Π4).
 * @related components/terrain/plot-outline/PlotCandidateList (ο ΜΟΝΟΣ καταναλωτής: «ίδιο σχήμα με …» στην κάρτα) ·
 *   lib/terrain/publication/listing-terrain-source (`samePlotOutlineRing` — η ΑΥΣΤΗΡΗ ισότητα της πόρτας, ίδια σειρά κορυφών)
 * @module lib/terrain/plot-outline/plot-candidate-coincidence
 *
 * 🔴 **Γιατί υπάρχει**: δύο στρώσεις μπορεί να έχουν τον ΙΔΙΟ δακτύλιο (στο `evosmos-G753.dxf`: το ζεύγος των 5.879 τ.μ.,
 *    ζωντανός έλεγχος 2026-11-25). Με αμφίδρομη επισήμανση, το πέρασμα πάνω από οποιαδήποτε από τις δύο κάρτες ανάβει την ίδια
 *    γραμμή — χωρίς λέξη, ο άνθρωπος νομίζει ότι η επισήμανση «δεν δουλεύει» ή ότι οι δύο κάρτες είναι λάθος διπλότυπο. Η κάρτα
 *    το ΛΕΕΙ. ⚠️ «Orio» και «ktimatologio» του ίδιου αρχείου **ΔΕΝ** είναι ίδιος δακτύλιος: διαφέρουν ~10–20 cm (μετρημένο στις
 *    κορυφές του DXF) ⇒ σωστά ΔΕΝ δηλώνονται ίδια.
 * 🔑 **Ίδιο σχήμα ≠ ίδια γραφή**: δύο στρώσεις μπορεί να σχεδιάστηκαν από άλλη κορυφή ή αντίστροφα. Η σύγκριση είναι ανεξάρτητη
 *    από την αρχική κορυφή και τη φορά — ενώ το `samePlotOutlineRing` (πόρτα) σκόπιμα ΔΕΝ είναι.
 * 🔑 Στο ακέραιο χιλιοστό του WORLD (η ακρίβεια της μέτρησης, όπως η πόρτα) — ποτέ ανοχή float.
 *
 * Pure: no I/O, no DOM.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { PlotOutlineCandidate } from './plot-outline-types';

/** Ακέραιο χιλιοστό, χωρίς `-0` — μία γραφή ανά τιμή. */
function mmKey({ x, y }: PlanarPoint): string {
  return `${Math.round(x) + 0},${Math.round(y) + 0}`;
}

function lexicographicallyFirst(keys: readonly string[]): number {
  let first = 0;
  for (let i = 1; i < keys.length; i += 1) if (keys[i] < keys[first]) first = i;
  return first;
}

/** Ο δακτύλιος από τη «μικρότερη» κορυφή, προς τις δύο φορές — κρατά τη μικρότερη γραφή. */
function shapeKey(ring: readonly PlanarPoint[]): string {
  const keys = ring.map(mmKey);
  const n = keys.length;
  const start = lexicographicallyFirst(keys);
  const forward = keys.map((_, i) => keys[(start + i) % n]).join(';');
  const backward = keys.map((_, i) => keys[(start - i + n) % n]).join(';');
  return forward < backward ? forward : backward;
}

/**
 * Για κάθε υποψήφιο που μοιράζεται σχήμα με άλλα: ποια είναι τα ΑΛΛΑ (σειρά εισόδου). Τα μοναδικά σχήματα δεν εμφανίζονται.
 */
export function coincidentPlotCandidates(
  candidates: readonly PlotOutlineCandidate[],
): ReadonlyMap<string, readonly PlotOutlineCandidate[]> {
  const groups = new Map<string, PlotOutlineCandidate[]>();
  for (const candidate of candidates) {
    const key = shapeKey(candidate.ringWorldMm);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [candidate]);
    else group.push(candidate);
  }
  const others = new Map<string, readonly PlotOutlineCandidate[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const candidate of group) others.set(candidate.id, group.filter((other) => other.id !== candidate.id));
  }
  return others;
}
