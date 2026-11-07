/**
 * **Ταίριασμα γραμμών με ανοχή** (ADR-929 §6.9) — ο γεωμετρικός πυρήνας του βαθμολογητή ρόλων, ίδιος και για τις δύο
 * κατευθύνσεις (αναγνωριστής → CAD και CAD → αναγνωριστής), ώστε precision και recall να κρίνονται με το **ίδιο** κριτήριο.
 *
 * 🔑 Ένα δείγμα κατά μήκος της γραμμής «βρίσκει» μια γραμμή της άλλης πλευράς όταν είναι **παράλληλη** (|sin θ| ≤ sin ανοχής,
 * ανεξάρτητο φοράς) και η απόσταση από το **τμήμα** (όχι την ευθεία) είναι μέσα στην ανοχή. Νικά η πλησιέστερη.
 * 🔑 Προφίλτρο με κουτιά ανά γραμμή (όχι ανά δείγμα): κοστίζει N·M συγκρίσεις κουτιών, μία φορά, και κρατά το εσωτερικό
 * πέρασμα μόνο στους πραγματικούς υποψηφίους.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/role-scoring/match-truth
 */

import { distanceToSegment, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { RoleScoringOptions } from './role-scoring-types';

/** Μια γραμμή σε px, με ετικέτα, μοναδιαία διεύθυνση και κουτί. */
export interface LabelledLine<L> {
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
  readonly label: L;
  readonly dir: PlanarPoint;
  readonly lengthPx: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Γραμμή με ετικέτα· μηδενικό μήκος ⇒ `null` (καμία διεύθυνση, καμία κρίση). */
export function labelledLine<L>(a: PlanarPoint, b: PlanarPoint, label: L): LabelledLine<L> | null {
  const lengthPx = Math.hypot(b.x - a.x, b.y - a.y);
  if (lengthPx === 0) return null;
  const dir = { x: (b.x - a.x) / lengthPx, y: (b.y - a.y) / lengthPx };
  return {
    a, b, label, dir, lengthPx,
    minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y),
  };
}

/** Παράλληλες μέσα στην ανοχή, ανεξάρτητα από τη φορά. */
export function isParallel(u: PlanarPoint, v: PlanarPoint, angleTolRad: number): boolean {
  return Math.abs(u.x * v.y - u.y * v.x) <= Math.sin(angleTolRad);
}

function boxesNear<L, M>(p: LabelledLine<L>, q: LabelledLine<M>, pad: number): boolean {
  return p.minX - pad <= q.maxX && q.minX - pad <= p.maxX && p.minY - pad <= q.maxY && q.minY - pad <= p.maxY;
}

/** Οι γραμμές-στόχοι που μπορεί να βρει κάποιο δείγμα της `line`. */
function candidatesFor<L, M>(line: LabelledLine<L>, targets: readonly LabelledLine<M>[], o: RoleScoringOptions): LabelledLine<M>[] {
  return targets.filter((t) => boxesNear(line, t, o.distTolPx) && isParallel(line.dir, t.dir, o.angleTolRad));
}

/** Τα δείγματα μιας γραμμής: σημεία στο κέντρο ίσων διαστημάτων, και το μήκος που «εκπροσωπεί» το καθένα. */
export interface AlongSamples<M> {
  /** Η ετικέτα του στόχου που βρήκε κάθε δείγμα, ή `null`. */
  readonly labels: readonly (M | null)[];
  readonly sampleLengthPx: number;
}

/** Για κάθε δείγμα κατά μήκος της `line`: η ετικέτα της πλησιέστερης παράλληλης γραμμής-στόχου μέσα στις ανοχές. */
export function labelsAlong<L, M>(line: LabelledLine<L>, targets: readonly LabelledLine<M>[], o: RoleScoringOptions): AlongSamples<M> {
  const n = Math.max(1, Math.floor(line.lengthPx / o.sampleStepPx));
  const cands = candidatesFor(line, targets, o);
  const labels: (M | null)[] = [];
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const p = { x: line.a.x + k * (line.b.x - line.a.x), y: line.a.y + k * (line.b.y - line.a.y) };
    let best: M | null = null;
    let bestD = o.distTolPx;
    for (const c of cands) {
      const d = distanceToSegment(p, c.a, c.b);
      if (d <= bestD) {
        bestD = d;
        best = c.label;
      }
    }
    labels.push(best);
  }
  return { labels, sampleLengthPx: line.lengthPx / n };
}

/** Η ετικέτα με τα περισσότερα δείγματα (ισοβαθμία ⇒ όποια εμφανίστηκε πρώτη) και το ποσοστό της. */
export function majorityLabel<M>(labels: readonly (M | null)[]): { readonly label: M | null; readonly fraction: number } {
  const counts = new Map<M, number>();
  for (const l of labels) if (l !== null) counts.set(l, (counts.get(l) ?? 0) + 1);
  let label: M | null = null;
  let best = 0;
  for (const [l, c] of counts) {
    if (c > best) {
      best = c;
      label = l;
    }
  }
  return { label, fraction: labels.length === 0 ? 0 : best / labels.length };
}
