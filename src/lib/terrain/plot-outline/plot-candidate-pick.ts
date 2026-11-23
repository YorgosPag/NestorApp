/**
 * @fileoverview **Ποιο υποψήφιο περίγραμμα δείχνει ο άνθρωπος** — η ΜΙΑ απάντηση για κλικ, άγγιγμα και προ-τονισμό πάνω στο
 * σχέδιο (ADR-920 §14.11 Ζ4 «επιλογή πάνω στο σχέδιο»).
 * @related components/terrain/plot-outline/usePlotCandidatePointer (ο ΜΟΝΟΣ καταναλωτής) · lib/geometry/planar-polygon
 *   (`distanceToRing` · `pointInPolygon` — τα SSoT της γεωμετρίας)
 * @module lib/terrain/plot-outline/plot-candidate-pick
 *
 * 🔑 **Η γεωμετρία αποφασίζει, όχι η σειρά ζωγραφικής.** Όταν το κλικ το έκρινε το DOM, κέρδιζε ό,τι ζωγραφίστηκε τελευταίο:
 *    το γέμισμα του επιλεγμένου σκέπαζε κάθε υποψήφιο ΜΕΣΑ του (μετρημένο ζωντανά 2026-11-24), και δύο ταυτόσημοι δακτύλιοι σε
 *    δύο στρώσεις (πραγματικό DXF: «Orio» + «ktimatologio») άφηναν τον έναν ΑΠΡΟΣΙΤΟ.
 * 🔑 **Δύο βαθμίδες** (AutoCAD/Revit: η γραμμή πιάνεται από την ακμή της · GIS/Figma: το εσωτερικό δίνει το πιο μέσα σχήμα):
 *    1. `edge` — ακμή μέσα στην ανοχή· πρώτη η πλησιέστερη, σε ισοπαλία το μικρότερο εμβαδόν.
 *    2. `inside` — ο δείκτης μέσα στο σχήμα· πρώτο το ΜΙΚΡΟΤΕΡΟ που τον περιέχει (το πιο μέσα).
 *    Ακμή νικά πάντα εσωτερικό.
 * 🔑 **Κύκλος επιλογής** (AutoCAD selection cycling · Revit Tab): ξανά κλικ στο ίδιο σημείο προχωρά στο επόμενο της ΙΔΙΑΣ
 *    βαθμίδας ⇒ κανένα υποψήφιο δεν μένει απρόσιτο, όσο κι αν επικαλύπτονται. Ο προ-τονισμός δείχνει ΤΙ θα διαλέξει το κλικ.
 *
 * Pure: no I/O, no DOM.
 */

import { distanceToRing, pointInPolygon, type PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { PlotOutlineCandidate } from './plot-outline-types';

export type PlotCandidateHitTier = 'edge' | 'inside';

/** Ένα υποψήφιο κάτω από τον δείκτη, με τον λόγο που βρέθηκε εκεί. */
export interface PlotCandidateHit {
  readonly candidate: PlotOutlineCandidate;
  readonly tier: PlotCandidateHitTier;
  /** Απόσταση του δείκτη από το σύνορο του δακτυλίου, WORLD mm. */
  readonly distanceMm: number;
}

/** Σταθερή σειρά μέσα σε ισοπαλία: μικρότερο εμβαδόν, μετά ταυτότητα — ο κύκλος δεν εξαρτάται από τη σειρά εισόδου. */
function bySmallerArea(a: PlotCandidateHit, b: PlotCandidateHit): number {
  return a.candidate.areaM2 - b.candidate.areaM2 || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0);
}

/**
 * **Τα υποψήφια κάτω από ένα σημείο, με τη σειρά που θα τα διάλεγε ο άνθρωπος**: πρώτα όσα έχουν ακμή μέσα στην ανοχή
 * (πλησιέστερη πρώτη), μετά όσα περιέχουν το σημείο (μικρότερο πρώτο). Κενό = ο δείκτης δεν δείχνει τίποτα.
 */
export function plotCandidatesAt(
  point: PlanarPoint,
  candidates: readonly PlotOutlineCandidate[],
  toleranceMm: number,
): PlotCandidateHit[] {
  const edge: PlotCandidateHit[] = [];
  const inside: PlotCandidateHit[] = [];
  for (const candidate of candidates) {
    const distanceMm = distanceToRing(point, candidate.ringWorldMm);
    if (distanceMm <= toleranceMm) edge.push({ candidate, tier: 'edge', distanceMm });
    else if (pointInPolygon(point, candidate.ringWorldMm)) inside.push({ candidate, tier: 'inside', distanceMm });
  }
  edge.sort((a, b) => a.distanceMm - b.distanceMm || bySmallerArea(a, b));
  inside.sort(bySmallerArea);
  return [...edge, ...inside];
}

/**
 * **Τι διαλέγει το κλικ**: το πρώτο της καλύτερης βαθμίδας — εκτός αν το ήδη επιλεγμένο είναι σε αυτήν, οπότε το ΕΠΟΜΕΝΟ της
 * (κυκλικά). Ένα μόνο υποψήφιο στη βαθμίδα ⇒ μένει το ίδιο. `null` όταν ο δείκτης δεν δείχνει τίποτα.
 */
export function pickPlotCandidate(hits: readonly PlotCandidateHit[], selectedId: string | null): string | null {
  if (hits.length === 0) return null;
  const tier = hits.filter((hit) => hit.tier === hits[0].tier);
  const current = tier.findIndex((hit) => hit.candidate.id === selectedId);
  return tier[(current + 1) % tier.length].candidate.id;
}
