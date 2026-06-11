/**
 * ADR-441 Slice 6b — Re-host / Migration legacy ορφανών πεδιλοδοκών.
 *
 * Pure matcher: παλιοί γραμμικοί πεδιλοδοκοί φτιαγμένοι **πριν** το Slice 3
 * (associative hosting) δεν φέρουν `guideBindings` → φορτώνονται «ορφανοί» → ο
 * follow-on-move reconciler τους αγνοεί (δεν ξέρουν σε ποιους άξονες κρέμονται).
 * Αυτό το βήμα τους **ξανα-κρεμάει** στον ΤΡΕΧΟΝΤΑ κάναβο **κατά γεωμετρία** (Revit/
 * Tekla migration): όποιος ορφανός ευθυγραμμίζεται με ένα φάτνωμα → υιοθετεί τα
 * `guideBindings` + το ακριβές start/end του αντίστοιχου target grid strip (κρατώντας
 * το **id** του + τη **διατομή** του width/thickness) → αρχίζει να ακολουθεί,
 * **χωρίς διαγραφή**.
 *
 * Γιατί υιοθετεί ΑΥΤΟΥΣΙΑ τα bindings+coords του target (όχι σκέτο binding): έτσι το
 * `gridStripSignature` του rehosted γίνεται **ταυτόσημο** με του target → ο υπάρχων
 * `reconcileGridStrips` (Slice 6) τον βλέπει ως `unchanged` → μηδέν διπλοί, μηδέν
 * διαγραφή, μηδέν αλλαγή στη λογική reconcile. Το matching γίνεται κατά **grid-
 * topology** (segmentKey από nearest-guide), όχι raw coords — δουλεύει και για
 * περιμετρικές (ο ορφανός έχει «καθαρά» endpoints = offsets· το target corner-fill
 * overhang έρχεται δωρεάν με την υιοθέτηση των target coords).
 *
 * @see ./foundation-grid-segments.ts — segmentKeyFromBindings (grid identity, SSoT)
 * @see ./foundation-grid-reconcile.ts — signature-set diff (consumer)
 * @see ../geometry/foundation-geometry.ts — geometry re-derive (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { Guide } from '../../systems/guides/guide-types';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { hasGuideBindings, type GuideBinding } from '../hosting/guide-binding-types';
import { segmentKeyFromBindings } from './foundation-grid-segments';
import type {
  FoundationEntity,
  FoundationParams,
  StripFootingParams,
  TieBeamParams,
} from '../types/foundation-types';

/** Γραμμικά (start/end) params — strip/tie-beam· το pad εξαιρείται από rehost. */
type LineParams = StripFootingParams | TieBeamParams;

/** Ένα re-host: η αρχική (ορφανή) entity + η ξανα-κρεμασμένη της εκδοχή (ίδιο id). */
export interface RehostedStrip {
  readonly original: FoundationEntity;
  readonly rehosted: FoundationEntity;
}

/**
 * Κλάσμα του τοπικού bay-spacing εντός του οποίου ένα coordinate θεωρείται «πάνω»
 * σε άξονα. Scale-free (προσαρμόζεται στην πυκνότητα κανάβου, σε mm/cm/m/in/ft) και
 * αρκετά αυστηρό ώστε να ΜΗΝ αρπάζει mid-bay χειροκίνητες λωρίδες (μάθημα Slice 6:
 * κάθε geometric tolerance εδώ πρέπει να είναι σχετική με το σημαντικό βήμα).
 */
export const REHOST_MATCH_FRACTION = 0.25;

function isLineParams(p: FoundationParams): p is LineParams {
  return p.kind === 'strip' || p.kind === 'tie-beam';
}

/** Ελάχιστη απόσταση διαδοχικών offsets ενός άξονα (Infinity αν <2 άξονες). */
function minAdjacentSpacing(guides: readonly Guide[]): number {
  const offs = guides.map((g) => g.offset).sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < offs.length; i++) min = Math.min(min, offs[i] - offs[i - 1]);
  return min;
}

/** Id του πλησιέστερου άξονα εντός `tol` (αλλιώς null — ορφανός εκτός κανάβου). */
function nearestGuideId(coord: number, guides: readonly Guide[], tol: number): string | null {
  let bestId: string | null = null;
  let bestDist = tol;
  for (const g of guides) {
    const d = Math.abs(g.offset - coord);
    if (d <= bestDist) { bestDist = d; bestId = g.id; }
  }
  return bestId;
}

/** Άξονες ταξινομημένοι κατά offset (ασφαλές για index-based adjacency). */
function sortedByOffset(guides: readonly Guide[]): readonly Guide[] {
  return [...guides].sort((a, b) => a.offset - b.offset);
}

/** Index του πλησιέστερου άξονα εντός `tol` στη sorted λίστα (αλλιώς null). */
function nearestIndex(coord: number, sorted: readonly Guide[], tol: number): number | null {
  let best: number | null = null;
  let bestDist = tol;
  for (let i = 0; i < sorted.length; i++) {
    const d = Math.abs(sorted[i].offset - coord);
    if (d <= bestDist) { bestDist = d; best = i; }
  }
  return best;
}

/**
 * Το **πρώτο (χαμηλότερο) φάτνωμα** που καλύπτει ένας ορφανός κατά τον κάθετο άξονα.
 * Πολυ-φατνωματικός ορφανός (χειροκίνητη λωρίδα σε όλο το ύψος ενός άξονα) υιοθετεί
 * αυτό το ένα segment (κρατά id+διατομή)· τα υπόλοιπα φατνώματα του άξονα τα φτιάχνει
 * κανονικά ο reconciler (target ∉ existing → create) → πλήρης κάλυψη, **μηδέν διπλό**
 * (ADR-441 Slice 6b multi-bay). `null` αν δεν εκτείνεται σε ≥1 πλήρες φάτνωμα.
 */
function firstBay(
  a: number, b: number, sorted: readonly Guide[], tol: number,
): { readonly lo: string; readonly hi: string } | null {
  const iLo = nearestIndex(Math.min(a, b), sorted, tol);
  const iHi = nearestIndex(Math.max(a, b), sorted, tol);
  if (iLo === null || iHi === null || iLo === iHi) return null;
  return { lo: sorted[iLo].id, hi: sorted[iLo + 1].id };
}

/** Συνθετικά bindings γραμμικού ορφανού (mirror builder slot-λογική, χωρίς extend). */
function lineBindings(parallelId: string, startId: string, endId: string, vertical: boolean): GuideBinding[] {
  return vertical
    ? [
        { guideId: parallelId, slot: 'start-x' }, { guideId: parallelId, slot: 'end-x' },
        { guideId: startId, slot: 'start-y' }, { guideId: endId, slot: 'end-y' },
      ]
    : [
        { guideId: parallelId, slot: 'start-y' }, { guideId: parallelId, slot: 'end-y' },
        { guideId: startId, slot: 'start-x' }, { guideId: endId, slot: 'end-x' },
      ];
}

/**
 * Grid segmentKey ενός ορφανού, ή null αν δεν ταιριάζει. Ο ορφανός ταυτοποιείται με
 * το **πρώτο φάτνωμα** της διαδρομής του (όχι ολόκληρο το άνοιγμα) → ένας
 * πολυ-φατνωματικός χειροκίνητος πεδιλοδοκός υιοθετεί ένα grid segment ενώ τα
 * υπόλοιπα φατνώματα του άξονα δημιουργούνται από τον reconciler (μηδέν διπλό).
 */
function orphanSegmentKey(
  p: LineParams,
  xGuides: readonly Guide[],
  yGuides: readonly Guide[],
  tolX: number,
  tolY: number,
): string | null {
  const vertical = Math.abs(p.start.x - p.end.x) <= tolX;
  const horizontal = Math.abs(p.start.y - p.end.y) <= tolY;
  if (vertical === horizontal) return null; // ambiguous/diagonal — skip (v1)

  if (vertical) {
    const gx = nearestGuideId((p.start.x + p.end.x) / 2, xGuides, tolX);
    const bay = firstBay(p.start.y, p.end.y, sortedByOffset(yGuides), tolY);
    if (!gx || !bay) return null;
    return segmentKeyFromBindings(lineBindings(gx, bay.lo, bay.hi, true));
  }
  const gy = nearestGuideId((p.start.y + p.end.y) / 2, yGuides, tolY);
  const bay = firstBay(p.start.x, p.end.x, sortedByOffset(xGuides), tolX);
  if (!gy || !bay) return null;
  return segmentKeyFromBindings(lineBindings(gy, bay.lo, bay.hi, false));
}

/**
 * rehosted entity: ίδιο id + διατομή (width/thickness), αλλά υιοθετεί target
 * bindings/coords **και την έδραση κανόνα** (ADR-441 5a-grid: π.χ. περιμετρικό
 * φάτνωμα → inward) → ο reconciler το βλέπει σύμφωνο με τον κανόνα (μηδέν reflow).
 * Re-derived geometry. Τυχόν έδραση του ορφανού αντικαθίσταται από τον κανόνα.
 */
function adoptTarget(orphan: FoundationEntity, target: FoundationEntity): FoundationEntity {
  const tp = target.params as LineParams;
  const { justification: _j, justificationManual: _m, ...rest } = orphan.params as LineParams;
  const base = { ...(rest as LineParams), start: tp.start, end: tp.end };
  const mergedParams: LineParams =
    tp.justification === undefined ? base : { ...base, justification: tp.justification };
  return {
    ...orphan,
    params: mergedParams,
    guideBindings: target.guideBindings,
    geometry: computeFoundationGeometry(mergedParams),
  };
}

/**
 * Ξανα-κρέμα τους ευθυγραμμισμένους ορφανούς στον τρέχοντα κάναβο. Επιστρέφει ΜΟΝΟ
 * όσους ταιριάζουν σε ένα target φάτνωμα (deterministic: πρώτος ορφανός ανά segment
 * κερδίζει· οι υπόλοιποι μένουν ελεύθεροι). Total/pure — καμία scene mutation.
 */
export function rehostOrphanStrips(
  orphans: readonly FoundationEntity[],
  targetStrips: readonly FoundationEntity[],
  xGuides: readonly Guide[],
  yGuides: readonly Guide[],
): RehostedStrip[] {
  const tolX = minAdjacentSpacing(xGuides) * REHOST_MATCH_FRACTION;
  const tolY = minAdjacentSpacing(yGuides) * REHOST_MATCH_FRACTION;

  const targetByKey = new Map<string, FoundationEntity>();
  for (const t of targetStrips) {
    const k = segmentKeyFromBindings(t.guideBindings ?? []);
    if (k !== null && !targetByKey.has(k)) targetByKey.set(k, t);
  }

  const claimed = new Set<string>();
  const out: RehostedStrip[] = [];
  for (const orphan of orphans) {
    if (hasGuideBindings(orphan) || !isLineParams(orphan.params)) continue;
    const key = orphanSegmentKey(orphan.params, xGuides, yGuides, tolX, tolY);
    if (key === null || claimed.has(key)) continue;
    const target = targetByKey.get(key);
    if (!target) continue;
    claimed.add(key);
    out.push({ original: orphan, rehosted: adoptTarget(orphan, target) });
  }
  return out;
}
