/**
 * ADR-929 Φ5.4 — **ρόλος κάθε τμήματος**: παρειά τοίχου · γραμμή διάστασης · γραμμή επέκτασης · σημείωση · αβέβαιο.
 *
 * 🔑 **Σύντηξη πολλών τεκμηρίων με όνομα, όχι ένα κριτήριο.** Η διάσταση αναγνωρίζεται και **χωρίς βέλη** (κείμενο που
 * διακόπτει τη γραμμή), και τα βέλη χωρίς κείμενο. Κάθε τεκμήριο είναι λογάριθμος λόγου πιθανοτήτων με όνομα, και το
 * άθροισμα περνά από λογιστική συνάρτηση ⇒ `dimensionScore` στο [0, 1].
 * 🔑 **Κομμάτια απόληξης.** Η βάση και οι πλευρές ενός βέλους γίνονται ζώνες στη Φ2· ανήκουν στη διάσταση τους.
 * 🔑 **Τριμερής απόφαση, ποτέ σιωπηλή.** `≥ DIMENSION_MIN` ⇒ διάσταση · `≤ WALL_MAX` ⇒ τοίχος · ανάμεσα ⇒ `unknown`. Το
 * `unknown` μένει υποψήφια παρειά: ένας πραγματικός τοίχος δεν χάνεται ποτέ σιωπηλά.
 * 🔑 **Το γέμισμα (poché) είναι πάντα τοίχος.** Καμία διάσταση δεν σχεδιάζεται ως γεμάτη περιοχή.
 *
 * ⚠️ **Τα βάρη και τα κατώφλια ΔΕΝ είναι ακόμη βαθμονομημένα.** Ορίστηκαν από τη γεωμετρία του προβλήματος και
 * βαθμονομούνται στο χρυσό σύνολο (Δ13), με μέτρηση. Ζουν όλα εδώ, με όνομα.
 *
 * Καθαρό, για Worker.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/segment-role-classifier
 */

import type { Homography } from '@/lib/geometry/homography';
import type { InkMask } from '@/lib/geometry/raster/ink-probe';
import { glyphCandidates, medianGlyphSize, type Glyph } from '@/lib/geometry/raster/text-graphics';
import type {
  PlanExtensionAnchor,
  PlanRoleFactor,
  PlanSegmentRole,
  PlanSegmentRoleVerdict,
  PlanTerminatorKind,
  RasterSegment,
} from '../plan-recognition-types';
import { detectTerminator, type TerminatorScale } from './dimension-terminators';
import { textEvidence, type TextEvidence } from './dimension-text';
import { extensionMatches, type ExtensionMatch } from './extension-lines';
import { framedSegments, localOf, type FramedSegment } from './segment-frame';

/** Λογάριθμοι λόγου πιθανοτήτων ανά τεκμήριο (μη βαθμονομημένοι, βλ. κεφαλίδα). */
export const ROLE_WEIGHTS = {
  bias: -2,
  textInterrupt: 3,
  textAdjacent: 1.4,
  strongTerminatorPerEnd: 1.4,
  crossTerminatorPerEnd: 0.25,
  extensionPerEnd: 1,
  thin: 0.6,
} as const;

export const DIMENSION_MIN = 0.7;
export const WALL_MAX = 0.3;
/** Πινελιά έως τόσες φορές την τυπική είναι «λεπτή». */
const THIN_MAX_STROKES = 1.25;
/** Χωρίς γλύφους, το ύψος κειμένου εκτιμάται ως τόσες πινελιές (μόνο για την εμβέλεια αναζήτησης απολήξεων). */
const FALLBACK_TEXT_STROKES = 6;
/** Η εμβέλεια αναζήτησης απόληξης: ≥ τόσες πινελιές, και ≥ `REACH_TEXT_HEIGHTS` ύψη κειμένου (ένα βέλος ≈ ένας χαρακτήρας). */
const MIN_REACH_STROKES = 4;
const REACH_TEXT_HEIGHTS = 1.1;
/** Κομμάτι απόληξης (π.χ. η βάση ή οι πλευρές ενός βέλους που έγιναν ζώνες): μήκος ≤ τόσες εμβέλειες. */
const FRAGMENT_MAX_REACHES = 1.5;
const FRAGMENT_HALF_WIDTH_REACHES = 0.6;
const STRONG: ReadonlySet<PlanTerminatorKind> = new Set<PlanTerminatorKind>(['arrow', 'tick', 'dot']);

export interface SegmentRoleInput {
  readonly segments: readonly RasterSegment[];
  readonly originalToAligned: Homography;
  /** Το μελάνι του σχεδίου (ευθυγραμμισμένο, χωρίς πινακίδες), το **ίδιο** που έδωσε τα τμήματα. */
  readonly ink: InkMask;
  /** Η τυπική πινελιά (px εργασίας) της Φ2. */
  readonly strokePx: number;
  /** Το ελάχιστο μήκος γραμμής της Φ2 (px εργασίας). */
  readonly minLengthPx: number;
}

export interface PlanSegmentClassification {
  readonly verdicts: readonly PlanSegmentRoleVerdict[];
  /** Το εκτιμημένο ύψος κειμένου (`null` ⇒ κανένας γλύφος). */
  readonly textHeightPx: number | null;
  readonly glyphCount: number;
}

interface Evidence {
  readonly framed: readonly FramedSegment[];
  readonly terminators: ReadonlyMap<string, readonly [PlanTerminatorKind, PlanTerminatorKind]>;
  readonly text: TextEvidence;
  readonly extension: ReadonlyMap<string, ExtensionMatch>;
  /** Πινελιές μέσα σε γλύφο: κομμάτια χαρακτήρων που έγιναν ζώνες (το «1» ενός αριθμού, το «Ι» ενός ονόματος). */
  readonly annotation: ReadonlySet<string>;
  readonly strokePx: number;
  /** Η εμβέλεια αναζήτησης απόληξης (px). */
  readonly reachPx: number;
}

/**
 * Οι γλύφοι στο **πλήρες** μελάνι (Fletcher–Kasturi): οι τοίχοι και οι γραμμές διάστασης με τα βέλη τους είναι τεράστιες
 * συνεκτικές συνιστώσες και φεύγουν με το όριο μεγέθους, ενώ κάθε χαρακτήρας είναι μικρή χωριστή συνιστώσα.
 * ⚠️ ΟΧΙ στο υπόλοιπο μετά το σβήσιμο των τμημάτων: οι πινελιές των ψηφίων είναι μακρύτερες από το ελάχιστο μήκος γραμμής
 * και η Φ2 τις «εξηγεί» ως γραμμές. Μετρημένο: 0–4 γλύφοι αντί για 4 ανά αριθμό, ύψος κειμένου 4 px αντί για 15.
 */
function findGlyphs(ink: InkMask, strokePx: number, minLengthPx: number): Glyph[] {
  return glyphCandidates(ink.mask, ink.cols, ink.rows, {
    minAreaPx: Math.max(3, strokePx * strokePx),
    minSidePx: Math.max(3, 2 * strokePx),
    maxSidePx: Math.max(6 * strokePx, 4 * minLengthPx),
    minDensity: 0.2,
  });
}

function gatherEvidence(input: SegmentRoleInput, framed: readonly FramedSegment[], glyphs: readonly Glyph[]): Evidence {
  const strokePx = Math.max(1, input.strokePx);
  const textPx = medianGlyphSize(glyphs) ?? FALLBACK_TEXT_STROKES * strokePx;
  const term: TerminatorScale = { strokePx, reachPx: Math.max(MIN_REACH_STROKES * strokePx, REACH_TEXT_HEIGHTS * textPx) };
  const strokes = framed.filter((s) => s.style === 'stroke');
  const terminators = new Map(strokes.map((s) => [s.id, [
    detectTerminator(input.ink, s, 'start', term).kind,
    detectTerminator(input.ink, s, 'end', term).kind,
  ] as const]));
  const text = textEvidence(framed, glyphs, { textPx, strokePx, endZonePx: term.reachPx });
  const extension = extensionMatches(input.ink, strokes, framed, { strokePx, textPx });
  const annotation = new Set(strokes.filter((s) => isInsideGlyph(s, glyphs, strokePx)).map((s) => s.id));
  return { framed, terminators, text, extension, annotation, strokePx, reachPx: term.reachPx };
}

/** Και τα δύο άκρα της πινελιάς μέσα στο πλαίσιο (± μία πινελιά) του ίδιου γλύφου: είναι κομμάτι χαρακτήρα. */
function isInsideGlyph(s: FramedSegment, glyphs: readonly Glyph[], strokePx: number): boolean {
  const inside = (g: Glyph, p: { x: number; y: number }): boolean =>
    Math.abs(p.x - g.cx) <= g.width / 2 + strokePx && Math.abs(p.y - g.cy) <= g.height / 2 + strokePx;
  return glyphs.some((g) => inside(g, s.a) && inside(g, s.b));
}

const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

/** Οι παράγοντες ενός τμήματος-πινελιάς, πριν την αλυσίδα. */
function factorsOf(s: FramedSegment, ev: Evidence): Partial<Record<PlanRoleFactor, number>> {
  const ends = ev.terminators.get(s.id) ?? ['none', 'none'];
  const W = ROLE_WEIGHTS;
  const text = ev.text.interrupted.has(s.id) ? W.textInterrupt : ev.text.adjacent.has(s.id) ? W.textAdjacent : 0;
  const terminators = ends.reduce((acc, k) => acc + (STRONG.has(k) ? W.strongTerminatorPerEnd : k === 'cross' ? W.crossTerminatorPerEnd : 0), 0);
  const extension = (ev.extension.get(s.id)?.ends ?? 0) * W.extensionPerEnd;
  const thinness = s.width <= THIN_MAX_STROKES * ev.strokePx ? W.thin : 0;
  return { text, terminators, extension, thinness };
}

const scoreOf = (factors: Partial<Record<PlanRoleFactor, number>>): number =>
  logistic(ROLE_WEIGHTS.bias + Object.values(factors).reduce<number>((acc, v) => acc + (v ?? 0), 0));

const roleOfScore = (score: number): PlanSegmentRole =>
  score >= DIMENSION_MIN ? 'dimension-line' : score <= WALL_MAX ? 'wall-face' : 'unknown';

/** Οι τελικές κρίσεις: όσες πινελιές είναι γραμμές επέκτασης βέβαιων διαστάσεων (και όχι οι ίδιες διάσταση) τις παίρνουν. */
interface DimensionEnd {
  readonly dim: FramedSegment;
  readonly which: 'start' | 'end';
}

/** Τα άκρα των βέβαιων διαστάσεων που έχουν ισχυρή απόληξη (βέλος · παύλα · κουκκίδα). */
function strongDimensionEnds(ev: Evidence, dims: ReadonlySet<string>): DimensionEnd[] {
  return ev.framed.filter((s) => dims.has(s.id)).flatMap((dim): DimensionEnd[] => {
    const [start, end] = ev.terminators.get(dim.id) ?? ['none', 'none'];
    return [...(STRONG.has(start) ? [{ dim, which: 'start' as const }] : []), ...(STRONG.has(end) ? [{ dim, which: 'end' as const }] : [])];
  });
}

/** Μέσα στον διάδρομο της απόληξης: κατά μήκος της διάστασης ≤ `FRAGMENT_MAX_REACHES`·R από το άκρο, κάθετα ≤ `FRAGMENT_HALF_WIDTH_REACHES`·R. */
function inTerminatorCorridor(e: DimensionEnd, p: { x: number; y: number }, reachPx: number): boolean {
  const { t, d } = localOf(e.dim, p);
  const fromEnd = e.which === 'start' ? t : e.dim.length - t;
  return fromEnd >= -FRAGMENT_HALF_WIDTH_REACHES * reachPx && fromEnd <= FRAGMENT_MAX_REACHES * reachPx
    && Math.abs(d) <= FRAGMENT_HALF_WIDTH_REACHES * reachPx;
}

/**
 * Κομμάτι απόληξης: κοντή πινελιά με **και τα δύο** άκρα μέσα στον διάδρομο του ίδιου ισχυρού άκρου διάστασης. Η βάση και
 * οι πλευρές ενός βέλους γίνονται ζώνες στη Φ2 (μετρημένο: τρίγωνο 18 × 11 px ⇒ 4 τμήματα). Ανήκουν στη διάσταση.
 * ⚠️ Διάδρομος κατά μήκος της διάστασης, ΟΧΙ ακτίνα γύρω από το άκρο: χωρίς κείμενο η εμβέλεια (13 px) είναι μικρότερη από
 * το βέλος (18 px), και το μακρινό άκρο της πλευράς του (15,8 px ακτινικά) έμενε έξω (μετρημένο).
 */
function isTerminatorFragment(s: FramedSegment, ends: readonly DimensionEnd[], reachPx: number): boolean {
  if (s.length > FRAGMENT_MAX_REACHES * reachPx) return false;
  return ends.some((e) => e.dim !== s && inTerminatorCorridor(e, s.a, reachPx) && inTerminatorCorridor(e, s.b, reachPx));
}

function verdictsOf(ev: Evidence, factors: ReadonlyMap<string, Partial<Record<PlanRoleFactor, number>>>): PlanSegmentRoleVerdict[] {
  const dims = new Set([...factors].filter(([, f]) => scoreOf(f) >= DIMENSION_MIN).map(([id]) => id));
  const extensions = new Set([...dims].flatMap((id) => ev.extension.get(id)?.extensionIds ?? []).filter((id) => !dims.has(id)));
  const ends = strongDimensionEnds(ev, dims);
  return ev.framed.map((s) => {
    const f = factors.get(s.id);
    if (f === undefined) return { segmentId: s.id, role: 'wall-face', dimensionScore: 0, factors: {}, terminators: ['none', 'none'] };
    const score = scoreOf(f);
    const base = roleOfScore(score);
    // Σειρά: χαρακτήρας (μια γραμμή διάστασης δεν χωρά ποτέ μέσα σε γλύφο) → διάσταση → κομμάτι απόληξης → επέκταση.
    const role: PlanSegmentRole = ev.annotation.has(s.id) ? 'annotation'
      : base === 'dimension-line' ? base
        : isTerminatorFragment(s, ends, ev.reachPx) ? 'dimension-line'
          : extensions.has(s.id) ? 'extension-line' : base;
    const verdict: PlanSegmentRoleVerdict = { segmentId: s.id, role, dimensionScore: score, factors: f, terminators: ev.terminators.get(s.id) ?? ['none', 'none'] };
    return dims.has(s.id) && role === 'dimension-line' ? { ...verdict, extensionAnchors: anchorsOf(ev, s.id, dims) } : verdict;
  });
}

/** ADR-929 Φ5.5 — οι άγκυρες μιας βέβαιης διάστασης: οι επεκτάσεις της που **δεν** είναι οι ίδιες διάσταση. */
function anchorsOf(ev: Evidence, id: string, dims: ReadonlySet<string>): readonly PlanExtensionAnchor[] {
  return (ev.extension.get(id)?.anchors ?? []).filter((a) => !dims.has(a.extensionId));
}

/** Entry point: ο ρόλος κάθε τμήματος μιας αναγνώρισης. Ντετερμινιστικό: ίδια είσοδος ⇒ ίδιες κρίσεις. */
export function classifySegmentRoles(input: SegmentRoleInput): PlanSegmentClassification {
  const framed = framedSegments(input.segments, input.originalToAligned);
  const glyphs = findGlyphs(input.ink, Math.max(1, input.strokePx), input.minLengthPx);
  const ev = gatherEvidence(input, framed, glyphs);
  const factors = new Map(framed.filter((s) => s.style === 'stroke').map((s) => [s.id, factorsOf(s, ev)]));
  return { verdicts: verdictsOf(ev, factors), textHeightPx: medianGlyphSize(glyphs), glyphCount: glyphs.length };
}
