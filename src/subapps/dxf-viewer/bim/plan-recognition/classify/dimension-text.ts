/**
 * ADR-929 Φ5.4 — **κείμενο ως τεκμήριο διάστασης**: ο αριθμός που **διακόπτει** τη γραμμή, ή που κάθεται **παράλληλα**
 * δίπλα της. Είναι το ισχυρότερο τεκμήριο, γιατί δεν εξαρτάται από την ποιότητα της απόληξης: η βιβλιογραφία σε
 * αρχιτεκτονικά σχέδια ξεκινά από το κείμενο ακριβώς επειδή το «πρώτα το βέλος» σπάει σε κακή εικόνα.
 *
 * 🔑 **Διακοπή.** Δύο συγγραμμικά κομμάτια με κενό, και μέσα στο κενό ≥ 2 γλύφοι πάνω στην ευθεία, που γεμίζουν μεγάλο
 * μέρος του. Το άνοιγμα πόρτας είναι επίσης κενό σε ευθεία, αλλά άδειο. Γι' αυτό μετρά η **κάλυψη** του κενού.
 * 🔑 **Παράλληλα δίπλα.** ≥ 2 γλύφοι στην ίδια πλευρά, σε απόσταση ≤ `ADJACENT_MAX_OFFSET` ύψη, στοιχισμένοι, μέσα στην
 * έκταση της γραμμής και **μακριά από τα άκρα** της. Οι πτέρυγες ενός βέλους που μένουν μετά το σβήσιμο της γραμμής
 * μοιάζουν με γλύφους στο άκρο, και αυτοί εξαιρούνται.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/dimension-text
 */

import type { Glyph } from '@/lib/geometry/raster/text-graphics';
import { collinearGap, localOf, type FramedSegment } from './segment-frame';

export interface TextScale {
  /** Τυπικό ύψος κειμένου (διάμεσος γλύφων), σε ευθυγραμμισμένα px. */
  readonly textPx: number;
  readonly strokePx: number;
  /** Ζώνη γύρω από κάθε άκρο όπου ό,τι μοιάζει με γλύφο είναι πιθανότατα κομμάτι της απόληξης. */
  readonly endZonePx: number;
}

/** Ένα ζεύγος συγγραμμικών κομματιών που ενώνει κείμενο: η μισή-μισή γραμμή μιας διάστασης με τον αριθμό στη μέση. */
export interface TextLink {
  readonly a: string;
  readonly b: string;
}

export interface TextEvidence {
  readonly interrupted: ReadonlySet<string>;
  readonly adjacent: ReadonlySet<string>;
  readonly links: readonly TextLink[];
}

/** Ο μακρύτερος αριθμός διάστασης («12.345») είναι λίγοι χαρακτήρες: το κενό δεν ξεπερνά τόσα ύψη. */
const MAX_GAP_TEXT_HEIGHTS = 8;
/** Οι γλύφοι μέσα στο κενό κάθονται πάνω στην ευθεία: |d| ≤ τόσα ύψη. */
const ON_LINE_TEXT_HEIGHTS = 0.75;
/** Το κείμενο γεμίζει τουλάχιστον τόσο από το κενό. */
const MIN_GAP_COVER = 0.4;
/** Κείμενο δίπλα στη γραμμή: το κέντρο του απέχει από 0,3 ως 1,8 ύψη. */
const ADJACENT_MIN_OFFSET = 0.3;
const ADJACENT_MAX_OFFSET = 1.8;
/** Γλύφοι της ίδιας λέξης: διασπορά της κάθετης θέσης ≤ τόσα ύψη, κενό ανάμεσά τους ≤ τόσα ύψη. */
const ADJACENT_MAX_SPREAD = 0.35;
const WORD_GAP_TEXT_HEIGHTS = 1.2;
const MIN_GLYPHS = 2;
/** Συγγραμμικά: παράλληλα ως sin 3°. */
const COLLINEAR_MAX_SIN = Math.sin((3 * Math.PI) / 180);

/** Το μήκος που καλύπτουν οι γλύφοι κατά μήκος της ευθείας του `s` (ένωση των προβολών τους). */
function coverAlong(s: FramedSegment, glyphs: readonly Glyph[]): number {
  const spans = glyphs.map((g) => {
    const { t } = localOf(s, { x: g.cx, y: g.cy });
    const half = (Math.abs(s.u.x) * g.width + Math.abs(s.u.y) * g.height) / 2;
    return [t - half, t + half] as const;
  }).sort((p, q) => p[0] - q[0]);
  let total = 0;
  let end = -Infinity;
  for (const [a, b] of spans) {
    if (b <= end) continue;
    total += b - Math.max(a, end);
    end = b;
  }
  return total;
}

/** Οι γλύφοι μέσα στο κενό ανάμεσα σε `p` και `q` (με `q` μετά το `p`), πάνω στην ευθεία. */
function glyphsInGap(p: FramedSegment, gap: number, glyphs: readonly Glyph[], sc: TextScale): Glyph[] {
  return glyphs.filter((g) => {
    const { t, d } = localOf(p, { x: g.cx, y: g.cy });
    return t > p.length && t < p.length + gap && Math.abs(d) <= ON_LINE_TEXT_HEIGHTS * sc.textPx;
  });
}

/** Διακοπή από κείμενο: τα ζεύγη (p, q), με το `q` μετά το `p`, που ενώνει αριθμός. */
function interruptLinks(segs: readonly FramedSegment[], glyphs: readonly Glyph[], sc: TextScale): TextLink[] {
  const links: TextLink[] = [];
  const tol = Math.max(1.5, sc.strokePx);
  const maxGap = MAX_GAP_TEXT_HEIGHTS * sc.textPx;
  for (const p of segs) {
    for (const q of segs) {
      if (p === q) continue;
      const rel = collinearGap(p, q, tol, COLLINEAR_MAX_SIN);
      if (rel === null || !rel.qAfter || rel.gap <= 0 || rel.gap > maxGap) continue;
      const inGap = glyphsInGap(p, rel.gap, glyphs, sc);
      if (inGap.length >= MIN_GLYPHS && coverAlong(p, inGap) >= MIN_GAP_COVER * rel.gap) links.push({ a: p.id, b: q.id });
    }
  }
  return links;
}

/** Οι γλύφοι στην πλευρά `side` του `s`, στη ζώνη «δίπλα», έξω από τις ζώνες των άκρων. */
function sideGlyphs(s: FramedSegment, glyphs: readonly Glyph[], side: 1 | -1, sc: TextScale): { t: number; d: number }[] {
  return glyphs
    .map((g) => localOf(s, { x: g.cx, y: g.cy }))
    .filter(({ t, d }) => {
      const off = side * d;
      return off >= ADJACENT_MIN_OFFSET * sc.textPx && off <= ADJACENT_MAX_OFFSET * sc.textPx
        && t >= sc.endZonePx && t <= s.length - sc.endZonePx;
    })
    .sort((p, q) => p.t - q.t);
}

/** Υπάρχει λέξη ≥ 2 γλύφων, στοιχισμένη, σε αυτή τη λίστα (ταξινομημένη κατά `t`); */
function hasAlignedWord(local: readonly { t: number; d: number }[], sc: TextScale): boolean {
  let word: { t: number; d: number }[] = [];
  const check = (): boolean => {
    if (word.length < MIN_GLYPHS) return false;
    const mean = word.reduce((acc, g) => acc + g.d, 0) / word.length;
    const spread = Math.sqrt(word.reduce((acc, g) => acc + (g.d - mean) ** 2, 0) / word.length);
    return spread <= ADJACENT_MAX_SPREAD * sc.textPx;
  };
  for (const g of local) {
    if (word.length > 0 && g.t - word[word.length - 1].t > WORD_GAP_TEXT_HEIGHTS * sc.textPx) {
      if (check()) return true;
      word = [];
    }
    word.push(g);
  }
  return check();
}

/** Τα τεκμήρια κειμένου για όλα τα τμήματα-πινελιές. */
export function textEvidence(segs: readonly FramedSegment[], glyphs: readonly Glyph[], sc: TextScale): TextEvidence {
  const strokes = segs.filter((s) => s.style === 'stroke');
  const links = interruptLinks(strokes, glyphs, sc);
  const interrupted = new Set(links.flatMap((l) => [l.a, l.b]));
  const adjacent = new Set(strokes
    .filter((s) => hasAlignedWord(sideGlyphs(s, glyphs, 1, sc), sc) || hasAlignedWord(sideGlyphs(s, glyphs, -1, sc), sc))
    .map((s) => s.id));
  return { interrupted, adjacent, links };
}
