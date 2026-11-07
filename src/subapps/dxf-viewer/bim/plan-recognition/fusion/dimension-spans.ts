/**
 * ADR-929 Φ5.5 — **ανοίγματα διαστάσεων από τις γραμμές επέκτασης**: ποιες δύο παρειές μετρά κάθε διάσταση, όπως το λέει
 * το ίδιο το σχέδιο — **χωρίς** ανάγνωση.
 *
 * 🔑 **Οι γραμμές επέκτασης ΕΙΝΑΙ η δήλωση του σχεδιαστή** (ISO 129-1): «μετρώ από εδώ ως εκεί». Το κείμενο δίνει την
 * **τιμή**· το «πού» το δίνουν οι επεκτάσεις. Η Φ4 το μάντευε από τη θέση του κειμένου· εδώ διαβάζεται.
 * 🔑 **Μία αρχή για «η e είναι επέκταση της D»:** ο ταξινομητής (`extension-lines.ts`, έχει το μελάνι και το ελεύθερο
 * άκρο). Εδώ φτάνουν μόνο ids· η γεωμετρία ξαναδιαβάζεται από τα `RasterSegment`, ποτέ από αντίγραφο.
 * 🔑 **Γραμμή διάστασης ⇒ ανοίγματα.** Τα τμήματα `dimension-line` ομαδοποιούνται σε συνευθειακές γραμμές με τον **ίδιο**
 * κανόνα που χτίζει τις παρειές (`clusterByOffset`). Οι επεκτάσεις τους, ταξινομημένες κατά μήκος, ορίζουν **στοιχειώδη
 * ανοίγματα**: αλυσίδα = πολλά ανοίγματα στην ίδια γραμμή, στοιβαγμένες = άλλες γραμμές με κοινές παρειές. Το «άθροισμα
 * αλυσίδας = ολική» το ελέγχει ήδη ο λύτης (`adjustment-network.ts`) μέσα από τους κοινούς αγνώστους.
 * 🔑 **Πόδι → παρειά.** Η επέκταση είναι **παράλληλη** με τη μετρούμενη παρειά και στην **ίδια μετατόπιση**· η παρειά είναι
 * εκείνη της ίδιας οικογένειας, εντός ανοχής συνευθειακότητας, που φτάνει πιο κοντά στο πόδι. Καμία ⇒ `lineId: null`
 * (άξονας, επέκταση που ακουμπά τον τοίχο — γνωστό όριο του §6.7): ποτέ μαντεψιά.
 *
 * Καθαρό, ντετερμινιστικό.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/dimension-spans
 */

import { applyHomography, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import type { PlanExtensionAnchor, PlanSegmentRole, RasterSegment } from '../plan-recognition-types';
import { clusterByOffset, familyDirection, familyNormal, familyOfAngle, lineReachGap, type FusionFrame } from './fusion-frame';
import type { DimensionSpan, DimensionSpanEnd, FaceLine, PlanDirectionFamily, PlanFusionOptions } from './plan-fusion-types';

export interface DimensionSpanInput {
  readonly segments: readonly RasterSegment[];
  readonly roles: ReadonlyMap<string, PlanSegmentRole>;
  readonly anchors: ReadonlyMap<string, readonly PlanExtensionAnchor[]>;
  readonly frame: FusionFrame;
  readonly originalToAligned: Homography;
}

/** Ένα τμήμα γραμμής διάστασης στο ευθυγραμμισμένο πλαίσιο. */
interface RunPiece {
  readonly id: string;
  readonly offsetPx: number;
  readonly t0: number;
  readonly t1: number;
  readonly run: PlanDirectionFamily;
  readonly measured: PlanDirectionFamily;
}

/** Μια επέκταση πάνω σε μια γραμμή: θέση κατά μήκος της γραμμής, μετατόπιση στη μετρούμενη οικογένεια, θέση του ποδιού. */
interface PlacedAnchor {
  readonly extensionId: string;
  readonly t: number;
  readonly offsetPx: number;
  readonly footQ: number;
  readonly lengthPx: number;
}

const dot = (a: PlanePoint, b: PlanePoint): number => a.x * b.x + a.y * b.y;

function alignedEnds(s: RasterSegment, h: Homography): readonly [PlanePoint, PlanePoint] {
  return [applyHomography(h, s.start.x, s.start.y), applyHomography(h, s.end.x, s.end.y)];
}

/** Τμήμα διάστασης ⇒ κομμάτι γραμμής, όταν και η διεύθυνσή του και η κάθετή της είναι οικογένειες του πλαισίου. */
function pieceOf(s: RasterSegment, frame: FusionFrame, h: Homography, o: PlanFusionOptions): RunPiece | null {
  const [a, b] = alignedEnds(s, h);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const run = familyOfAngle(frame, angle, o);
  const measured = familyOfAngle(frame, angle + Math.PI / 2, o);
  if (run === null || measured === null) return null;
  const u = familyDirection(run);
  const n = familyNormal(run);
  const [ta, tb] = [dot(u, a), dot(u, b)];
  return { id: s.id, offsetPx: (dot(n, a) + dot(n, b)) / 2, t0: Math.min(ta, tb), t1: Math.max(ta, tb), run, measured };
}

function placeAnchor(a: PlanExtensionAnchor, ext: RasterSegment, piece: RunPiece, h: Homography): PlacedAnchor {
  const [p, q] = alignedEnds(ext, h);
  const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const foot = a.foot === 'start' ? p : q;
  return {
    extensionId: a.extensionId,
    t: dot(familyDirection(piece.run), mid),
    offsetPx: dot(familyNormal(piece.measured), mid),
    footQ: dot(familyDirection(piece.measured), foot),
    lengthPx: Math.hypot(q.x - p.x, q.y - p.y),
  };
}

/** Οι επεκτάσεις μιας γραμμής, μία ανά θέση, κατά μήκος. Δύο άγκυρες μέσα σε μία ανοχή είναι η **ίδια** σχεδιασμένη επέκταση. */
function runAnchors(pieces: readonly RunPiece[], input: DimensionSpanInput, byId: ReadonlyMap<string, RasterSegment>): PlacedAnchor[] {
  const seen = new Set<string>();
  const placed = pieces.flatMap((piece) => (input.anchors.get(piece.id) ?? []).flatMap((a) => {
    const ext = byId.get(a.extensionId);
    if (ext === undefined || seen.has(a.extensionId)) return [];
    seen.add(a.extensionId);
    return [placeAnchor(a, ext, piece, input.originalToAligned)];
  })).sort((x, y) => x.t - y.t);
  return placed.filter((a, i) => i === 0 || a.t - placed[i - 1].t > input.frame.collinearTolPx);
}

/** Πόσο από το διάστημα `[t0, t1]` καλύπτει το μελάνι της γραμμής (ένωση των κομματιών της). */
function coverage(pieces: readonly RunPiece[], t0: number, t1: number): number {
  const clipped = pieces.map((p) => [Math.max(p.t0, t0), Math.min(p.t1, t1)] as const).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let reached = t0;
  for (const [a, b] of clipped) {
    if (b <= reached) continue;
    covered += b - Math.max(a, reached);
    reached = b;
  }
  return t1 > t0 ? covered / (t1 - t0) : 0;
}

/** Η παρειά όπου καταλήγει το πόδι: ίδια οικογένεια, ίδια μετατόπιση (± ανοχή), η πιο κοντινή στο πόδι κατά μήκος. */
function faceAtFoot(a: PlacedAnchor, familyId: number, frame: FusionFrame, o: PlanFusionOptions): FaceLine | null {
  const reach = o.anchorReachRel * a.lengthPx;
  const near = frame.lines.filter((l) => l.familyId === familyId
    && Math.abs(l.offsetPx - a.offsetPx) <= frame.collinearTolPx && lineReachGap(l, a.footQ) <= reach);
  const rank = (l: FaceLine): readonly [number, number] => [lineReachGap(l, a.footQ), Math.abs(l.offsetPx - a.offsetPx)];
  return near.sort((p, q) => rank(p)[0] - rank(q)[0] || rank(p)[1] - rank(q)[1])[0] ?? null;
}

function spanEnd(a: PlacedAnchor, familyId: number, frame: FusionFrame, o: PlanFusionOptions): { readonly end: DimensionSpanEnd; readonly line: FaceLine | null } {
  const line = faceAtFoot(a, familyId, frame, o);
  return { end: { extensionId: a.extensionId, lineId: line?.id ?? null, offsetPx: a.offsetPx }, line };
}

/** Το άνοιγμα ανάμεσα σε δύο διαδοχικές επεκτάσεις, ή `null` όταν δεν είναι άνοιγμα (λίγο μελάνι, ίδια παρειά και στα δύο). */
function spanBetween(pieces: readonly RunPiece[], p: PlacedAnchor, q: PlacedAnchor, input: DimensionSpanInput, o: PlanFusionOptions): Omit<DimensionSpan, 'id'> | null {
  if (coverage(pieces, p.t, q.t) < o.spanCoverageMin) return null;
  const { run, measured } = pieces[0];
  const [a, b] = [spanEnd(p, measured.id, input.frame, o), spanEnd(q, measured.id, input.frame, o)]
    .sort((x, y) => (x.line?.offsetPx ?? x.end.offsetPx) - (y.line?.offsetPx ?? y.end.offsetPx));
  if (a.line !== null && a.line === b.line) return null;
  const gapPx = a.line !== null && b.line !== null ? b.line.offsetPx - a.line.offsetPx : Math.abs(b.end.offsetPx - a.end.offsetPx);
  const offset = pieces.reduce((sum, s) => sum + s.offsetPx * (s.t1 - s.t0), 0) / Math.max(1e-9, pieces.reduce((sum, s) => sum + (s.t1 - s.t0), 0));
  return { segmentIds: pieces.map((s) => s.id), runFamilyId: run.id, runOffsetPx: offset, familyId: measured.id, ends: [a.end, b.end], gapPx };
}

/** Τα ανοίγματα όλων των γραμμών διάστασης. Χωρίς άγκυρες ⇒ κανένα. */
export function dimensionSpans(input: DimensionSpanInput, o: PlanFusionOptions): DimensionSpan[] {
  if (input.anchors.size === 0) return [];
  const byId = new Map(input.segments.map((s) => [s.id, s]));
  const pieces = input.segments
    .filter((s) => input.roles.get(s.id) === 'dimension-line')
    .flatMap((s) => pieceOf(s, input.frame, input.originalToAligned, o) ?? []);
  const out: DimensionSpan[] = [];
  for (const family of input.frame.families) {
    for (const run of clusterByOffset(pieces.filter((p) => p.run.id === family.id), input.frame.collinearTolPx)) {
      const anchors = runAnchors(run, input, byId);
      for (let i = 1; i < anchors.length; i++) {
        const span = spanBetween(run, anchors[i - 1], anchors[i], input, o);
        if (span !== null) out.push({ id: `ds${out.length}`, ...span });
      }
    }
  }
  return out;
}
