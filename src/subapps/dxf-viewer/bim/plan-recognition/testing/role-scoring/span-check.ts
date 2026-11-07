/**
 * **Έλεγχος των ανοιγμάτων διάστασης** της Φ5.5 (`DimensionSpan`) έναντι της αλήθειας του CAD (ADR-929 §6.9): μετρά κάθε
 * άνοιγμα **τις ίδιες δύο παρειές** με τη διάσταση του CAD;
 *
 * 🔑 Οι βάσεις των γραμμών επέκτασης του CAD (`CadTruthDimension.measured`) πρέπει να πέφτουν πάνω στις **ευθείες** των δύο
 * επεκτάσεων του ανοίγματος. Ευθεία και όχι τμήμα: η επέκταση στην εικόνα μπορεί να σταματά λίγο πριν από τον τοίχο.
 * 🔑 Τρεις απαντήσεις, ποτέ σιωπηλή: `matched` (με σφάλμα σε px) · `wrong-pair` (πάνω σε γραμμή διάστασης του CAD, αλλά
 * άλλο ζεύγος παρειών — π.χ. ο γείτονας στην αλυσίδα) · `no-truth`. Και αντίστροφα: οι διαστάσεις του CAD χωρίς άνοιγμα.
 * 🔑 Τα άκρα του ανοίγματος έρχονται από τα **τμήματα** (αρχικά px), όχι από το `offsetPx` του ευθυγραμμισμένου πλαισίου:
 * έτσι η σύγκριση γίνεται στον ίδιο χώρο με την καταγραφή, χωρίς δεύτερη ομογραφία.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/role-scoring/span-check
 */

import { applyAffine, type Affine2x3 } from '@/lib/geometry/affine-2x3';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { DimensionSpan } from '../../fusion/plan-fusion-types';
import type { RasterSegment } from '../../plan-recognition-types';
import type { CadTruthDimension } from '../cad-truth/cad-truth-types';
import { isParallel } from './match-truth';
import { DEFAULT_ROLE_SCORING, type RoleScoringOptions } from './role-scoring-types';

export type SpanVerdict =
  | { readonly kind: 'matched'; readonly spanId: string; readonly dimensionIndex: number; readonly errorPx: number }
  | { readonly kind: 'wrong-pair'; readonly spanId: string; readonly nearestDimensionIndex: number; readonly errorPx: number }
  | { readonly kind: 'no-truth'; readonly spanId: string }
  /** Το άνοιγμα δείχνει σε τμήμα που δεν υπάρχει στην είσοδο — σφάλμα εισόδου, όχι κρίση. */
  | { readonly kind: 'unresolved'; readonly spanId: string };

export interface SpanCheck {
  readonly verdicts: readonly SpanVerdict[];
  /** Δείκτες των διαστάσεων του CAD που κανένα άνοιγμα δεν ταίριαξε. */
  readonly missedDimensions: readonly number[];
}

export interface SpanCheckInput {
  readonly spans: readonly DimensionSpan[];
  readonly segments: readonly RasterSegment[];
  readonly dimensions: readonly CadTruthDimension[];
  readonly drawingToPx: Affine2x3;
}

interface PxLine {
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
}

interface PxDimension {
  readonly line: PxLine;
  readonly measured: readonly [PlanarPoint, PlanarPoint];
}

const unit = (l: PxLine): PlanarPoint => {
  const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y) || 1;
  return { x: (l.b.x - l.a.x) / len, y: (l.b.y - l.a.y) / len };
};

/** Απόσταση σημείου από την **ευθεία** της `l` (px). */
function lineDistance(p: PlanarPoint, l: PxLine): number {
  const u = unit(l);
  return Math.abs(u.x * (p.y - l.a.y) - u.y * (p.x - l.a.x));
}

const toLine = (s: RasterSegment): PxLine => ({ a: s.start, b: s.end });

function projectDimension(d: CadTruthDimension, t: Affine2x3): PxDimension {
  return {
    line: { a: applyAffine(t, d.line[0]), b: applyAffine(t, d.line[1]) },
    measured: [applyAffine(t, d.measured[0]), applyAffine(t, d.measured[1])],
  };
}

/** Πάνω στην ίδια γραμμή διάστασης: παράλληλα, και τα δύο άκρα του τμήματος κοντά στην ευθεία του CAD. */
function sameLine(seg: PxLine, cad: PxLine, o: RoleScoringOptions): boolean {
  return isParallel(unit(seg), unit(cad), o.angleTolRad) && lineDistance(seg.a, cad) <= o.distTolPx && lineDistance(seg.b, cad) <= o.distTolPx;
}

/** Σφάλμα ζεύγους (px): οι δύο βάσεις του CAD πάνω στις δύο επεκτάσεις, με την καλύτερη αντιστοίχιση. */
function pairError(m: readonly [PlanarPoint, PlanarPoint], e0: PxLine, e1: PxLine): number {
  const straight = Math.max(lineDistance(m[0], e0), lineDistance(m[1], e1));
  const crossed = Math.max(lineDistance(m[0], e1), lineDistance(m[1], e0));
  return Math.min(straight, crossed);
}

interface SpanLines {
  readonly run: PxLine;
  readonly ext: readonly [PxLine, PxLine];
}

function spanLines(span: DimensionSpan, byId: ReadonlyMap<string, RasterSegment>): SpanLines | null {
  const run = span.segmentIds.map((id) => byId.get(id)).find((s) => s !== undefined);
  const e0 = byId.get(span.ends[0].extensionId);
  const e1 = byId.get(span.ends[1].extensionId);
  if (run === undefined || e0 === undefined || e1 === undefined) return null;
  return { run: toLine(run), ext: [toLine(e0), toLine(e1)] };
}

function judgeSpan(span: DimensionSpan, lines: SpanLines, dims: readonly PxDimension[], o: RoleScoringOptions): SpanVerdict {
  let bestIndex = -1;
  let bestError = Number.POSITIVE_INFINITY;
  for (let index = 0; index < dims.length; index++) {
    if (!sameLine(lines.run, dims[index].line, o)) continue;
    const errorPx = pairError(dims[index].measured, lines.ext[0], lines.ext[1]);
    if (errorPx < bestError) {
      bestError = errorPx;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return { kind: 'no-truth', spanId: span.id };
  if (bestError <= o.distTolPx) return { kind: 'matched', spanId: span.id, dimensionIndex: bestIndex, errorPx: bestError };
  return { kind: 'wrong-pair', spanId: span.id, nearestDimensionIndex: bestIndex, errorPx: bestError };
}

/** **Έλεγξε** τα ανοίγματα διάστασης έναντι των διαστάσεων του CAD (ήδη καταγεγραμμένων στα pixel). */
export function checkSpans(input: SpanCheckInput, o: RoleScoringOptions = DEFAULT_ROLE_SCORING): SpanCheck {
  const byId = new Map(input.segments.map((s) => [s.id, s]));
  const dims = input.dimensions.map((d) => projectDimension(d, input.drawingToPx));
  const verdicts = input.spans.map((span): SpanVerdict => {
    const lines = spanLines(span, byId);
    return lines === null ? { kind: 'unresolved', spanId: span.id } : judgeSpan(span, lines, dims, o);
  });
  const matched = new Set(verdicts.flatMap((v) => (v.kind === 'matched' ? [v.dimensionIndex] : [])));
  return { verdicts, missedDimensions: dims.map((_, i) => i).filter((i) => !matched.has(i)) };
}
