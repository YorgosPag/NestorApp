/**
 * measureTextAdvanceWorld — THE single source for a text run's rendered advance
 * width in WORLD units (ADR-557 Φ-attachment, built on ADR-530 glyph metrics).
 *
 * WHY: the attachment-aware text box (`bim/text/text-box.ts`: grips + 2D hover
 * frame + hitTest + 3D mesh + culling) previously sized its width with a MONOSPACE
 * approximation (`len·height·CHAR_WIDTH_MONOSPACE`), while the renderer paints the
 * glyphs with the REAL proportional font advance (`getGlyphRun().metrics.width`, or
 * the CSS `ctx.measureText`). For any non-monospace font the two diverged, so the
 * box, the handles and the hover outline never coincided with the drawn text
 * (Giorgio 2026-07-06: hover outline off + grips only grabbable off to one side).
 *
 * This module makes the box measure with the SAME metrics the renderer draws with,
 * so `resolveTextBox` ≡ the glyph draw box (Revit / Figma-grade: the hit box is the
 * real font bounds, one origin shared by every consumer). Resolution tiers mirror
 * the renderer's own paint path exactly:
 *
 *   1. A loaded opentype font (`resolveEntityFont` → `getGlyphRun`) — EXACT parity
 *      with `TextRenderer.fillGlyphRun` (`run.metrics.width / GLYPH_REFERENCE_SIZE`).
 *   2. No glyph font but a DOM canvas is available — `ctx.measureText` with the SAME
 *      font string `buildUIFont` builds, mirroring the renderer's CSS `fillText`
 *      fallback (advance scales linearly with px size → measure once at a ref size).
 *   3. No font AND no DOM (jest / SSR / font not yet loaded) — the monospace
 *      approximation, so pure callers + tests keep a finite, deterministic width.
 *
 * The `text-box` SSoT stays import-time pure: the only DOM touch (tier 2) is lazy and
 * guarded by `typeof document`, evaluated at call time, never at module load.
 *
 * @module text-engine/fonts/text-advance
 * @see rendering/entities/TextRenderer.ts — fillGlyphRun (the paint path this mirrors)
 * @see text-engine/fonts/glyph-path-cache.ts — getGlyphRun / GLYPH_REFERENCE_SIZE
 */

import { resolveEntityFont } from './font-resolver';
import { getGlyphRun, GLYPH_REFERENCE_SIZE } from './glyph-path-cache';
import { emSizeForTextHeight } from './text-height-scale';
import {
  TEXT_METRICS_RATIOS,
  buildUIFont,
  cssFontFamilyToken,
} from '../../config/text-rendering-config';

const CHAR_WIDTH_MONOSPACE = TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

/** Reference px size for the tier-2 offscreen measure (advance scales linearly with size). */
const CSS_MEASURE_REF_PX = 100;

/**
 * 🔴 ADR-799 — **ΠΟΙΟ ΟΡΓΑΝΟ ΑΠΑΝΤΗΣΕ, ΚΑΙ ΤΙΜΗΣΕ ΑΥΤΟ ΠΟΥ ΤΟΥ ΖΗΤΗΘΗΚΕ;**
 *
 * Η {@link measureTextAdvanceWorld} δέχεται `{ bold, italic, fontFamily }` και στο **tier 3**
 * τα πετάει **σιωπηλά**: το {@link monospaceAdvance} δέχεται μόνο `(text, height)`. Επιστρέφει
 * απόλυτα εύλογο αριθμό για ερώτηση που **δεν μπορεί** να απαντήσει — η ίδια κλάση με την
 * `adaptColorToBackground` που επέστρεφε χρώμα ενώ *«κανείς δεν ρωτούσε αν πέτυχε»*
 * (ADR-771 Φ.3). Η θεραπεία είναι η **ίδια** που εφηύρε ήδη αυτό το έργο, όχι δεύτερος
 * μηχανισμός: **ετυμηγορία**.
 *
 * ## 🔴 ΤΡΕΙΣ ρητές καταστάσεις, ποτέ δύο
 * Ένα `exact: boolean` θα ήταν σιωπηλή απόρριψη με άλλο όνομα. Οι τρεις **είναι** οι τρεις
 * βαθμίδες, και η καθεμία λέει *με ποιο όργανο* μετρήθηκε:
 *
 * | κατάσταση | όργανο | το στυλ τιμήθηκε; |
 * |---|---|---|
 * | `glyph`   | περιγράμματα της **επιλυμένης όψης** (opentype) | ναι — **από την όψη** |
 * | `css`     | `ctx.measureText` με **το ίδιο shorthand που ζωγραφίζει** ο ζωγράφος | ναι — **από το shorthand** |
 * | `nominal` | μονοδιάστημη προσέγγιση | **όχι** — δες {@link AdvanceVerdict.dropped} |
 *
 * ## Γιατί `dropped` και όχι `styleBlind: boolean`
 * Ένα boolean θα έκρυβε **ποιος** άξονας χάθηκε, και ο επόμενος θα το ξαναμετρούσε. Το
 * `dropped` **ονομάζει** ό,τι ζητήθηκε και δεν τιμήθηκε — και είναι **παραγόμενο** από
 * (αίτημα × βαθμίδα), ποτέ θυμητό: αν αλλάξει η ανάλυση αύριο, η ετυμηγορία ακολουθεί δωρεάν.
 * Είναι η θέση της APCA που ήδη επικαλείται το `InkVerdict`: επιστρέφεις **τη μέτρηση**, όχι
 * pass/fail, γιατί μια ετυμηγορία που κρύβει τη μέτρησή της αναγκάζει τον επόμενο να την
 * ξανακάνει.
 *
 * ⚠️ **Η ΠΑΡΑΓΩΓΗ ΔΕΝ ΦΤΑΝΕΙ ΣΤΟ `nominal`** (μετρημένο, ADR-799 §3): κάθε καταναλωτής της
 * διάταξης τρέχει σε browser, όπου το `document` υπάρχει πάντα ⇒ tier 2 στη χειρότερη· και οι
 * δύο workers εισάγουν **μόνο τύπους**. Ο πληθυσμός του `nominal` είναι το **περιβάλλον των
 * δοκιμών** — και εκεί ακριβώς κόστισε: στις 2026-08-24 το `"jsdom>canvas": "-"` εξαφάνισε το
 * tier 2, **41** σουίτες άλλαξαν σιωπηλά βαθμίδα, και οι μόνες που το **είπαν** ήταν τρεις
 * ισχυρισμοί που σύγκριναν έντονο με απλό και πήραν **ταυτόσημο** αριθμό.
 */
export type AdvanceTier = 'glyph' | 'css' | 'nominal';

/** Άξονας στυλ που ζητήθηκε και **δεν** τιμήθηκε. Μη κενό **μόνο** στο `nominal`. */
export type AdvanceStyleAxis = 'bold' | 'italic' | 'family';

/** Η {@link measureTextAdvanceWorld} **με ετυμηγορία** — ίδιο σώμα, ίδιος αριθμός. */
export type AdvanceVerdict =
  | { readonly kind: 'glyph'; readonly world: number; readonly face: string }
  | { readonly kind: 'css'; readonly world: number; readonly font: string }
  | {
      readonly kind: 'nominal';
      readonly world: number;
      readonly dropped: readonly AdvanceStyleAxis[];
    };

/**
 * Out-parameter της **μίας** μηχανής — το πρότυπο `SkFont::measureText(…, SkRect* bounds)` του
 * Skia. ⚠️ **Υπάρχει για να μην γίνουν ΔΥΟ σώματα**: μια δεύτερη υλοποίηση «ίδια, αλλά που
 * επιστρέφει και τη βαθμίδα» είναι sibling clone (CHECK 3.28) και, χειρότερα, δύο σημεία που
 * θα δώσουν διαφορετική απάντηση στην πρώτη ρύθμιση. Και ⚠️ **μηδέν δεσμεύσεις όταν λείπει**:
 * η καυτή πόρτα δεν πληρώνει αντικείμενο ανά κλήση (ADR-040).
 */
interface TierProbe {
  tier: AdvanceTier;
  /** Όνομα όψης (`glyph`) ή το CSS shorthand (`css`). Κενό στο `nominal`. */
  detail: string;
}

/** Style inputs that drive font resolution + the horizontal X-scale + character tracking. */
export interface TextAdvanceStyle {
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  /** AutoCAD TEXT X-scale — the horizontal stretch the renderer applies (`ctx.scale(wf,1)`). */
  readonly widthFactor?: number;
  /** AutoCAD MTEXT `\T` character tracking — inter-glyph spacing factor (1 = normal). */
  readonly tracking?: number;
}

/**
 * Ο AutoCAD X-scale, κανονικοποιημένος. ⚠️ **ΕΝΑ σώμα για τις ΔΥΟ πόρτες** — γραμμένο δύο
 * φορές θα ήταν sibling clone (CHECK 3.28) και, χειρότερα, δύο σημεία που θα δώσουν
 * διαφορετική απάντηση στην πρώτη ρύθμιση του κανόνα «τι σημαίνει άκυρος widthFactor».
 */
function normalizedWidthFactor(style?: TextAdvanceStyle): number {
  return style?.widthFactor != null && style.widthFactor > 0 ? style.widthFactor : 1;
}

/** Monospace approximation — the no-font / no-DOM fallback (tier 3). `max(len,1)` never collapses. */
function monospaceAdvance(text: string, height: number): number {
  const len = text ? text.length : 0;
  return Math.max(len, 1) * height * CHAR_WIDTH_MONOSPACE;
}

// Lazy, memoised offscreen 2D context for the tier-2 CSS-fallback measure (browser only).
// `undefined` = not yet probed; `null` = no DOM / no 2D context (→ tier 3).
let measureCtx: CanvasRenderingContext2D | null | undefined;
function cssMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === 'undefined') {
    measureCtx = null;
    return measureCtx;
  }
  try {
    // jsdom (jest) has no 2D backend — getContext returns null (or throws "Not
    // implemented"); either way we memoise `null` and degrade to the monospace tier.
    measureCtx = document.createElement('canvas').getContext('2d');
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/** The natural (widthFactor = 1) advance, in world units, via the 3-tier resolution. */
function baseAdvanceWorld(
  text: string,
  height: number,
  style?: TextAdvanceStyle,
  probe?: TierProbe,
): number {
  // Empty / missing content → a minimum (1-char) box so the geometry never degenerates.
  if (!text) return monospaceAdvance(text, height);

  const family = style?.fontFamily || 'arial';
  const tracking = style?.tracking != null && style.tracking > 0 ? style.tracking : 1;

  // Tier 1 — loaded opentype font: byte-for-byte the renderer's glyph-paint advance
  // (getGlyphRun bakes the SAME tracking the renderer uses → measure ≡ paint).
  const resolved = resolveEntityFont(family, { bold: style?.bold, italic: style?.italic });
  if (resolved) {
    const run = getGlyphRun(resolved.font, resolved.cacheName, text, tracking);
    // ADR-635 Φ C.22 — `height` is a DXF TEXT HEIGHT; the run is cached at GLYPH_REFERENCE_SIZE em
    // units, so it scales by the EM the renderer will actually draw at, not by the height itself.
    // `TextRenderer.paintText` converts with the SAME call ⇒ measured advance ≡ painted advance.
    if (probe) {
      probe.tier = 'glyph';
      probe.detail = resolved.cacheName;
    }
    return (run.metrics.width / GLYPH_REFERENCE_SIZE) * emSizeForTextHeight(height, resolved);
  }

  // Tier 2 — CSS fillText parity: same font string, measured at a reference px size.
  // Tracking → `ctx.letterSpacing` (mirrors TextRenderer's CSS fallback), so the measured
  // width matches the drawn text in the no-opentype-font case too.
  const ctx = cssMeasureContext();
  if (ctx) {
    // 🔴 ADR-786 — **το ίδιο αλφαριθμητικό γράφει και ο ζωγράφος.** Χωρίς τα εισαγωγικά, ένα
    // όνομα οικογένειας που δεν είναι έγκυρο CSS identifier (ξεκινά με ψηφίο, έχει στίξη —
    // δεδομένα χρήστη) παράγει shorthand που ο καμβάς **αγνοεί σιωπηλά**: ο μετρητής θα
    // μετρούσε την εφεδρική γραμματοσειρά ενώ ο ζωγράφος ζωγραφίζει τη σωστή.
    ctx.font = buildUIFont(
      CSS_MEASURE_REF_PX,
      cssFontFamilyToken(family),
      style?.bold ? 'bold' : 'normal',
      style?.italic,
    );
    const ls = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    const applySpacing = tracking !== 1 && 'letterSpacing' in ctx;
    const prevLs = applySpacing ? ls.letterSpacing : undefined;
    if (applySpacing) ls.letterSpacing = `${(tracking - 1) * CSS_MEASURE_REF_PX}px`;
    const px = ctx.measureText(text).width;
    if (applySpacing) ls.letterSpacing = prevLs ?? '0px';
    if (Number.isFinite(px) && px > 0) {
      if (probe) {
        probe.tier = 'css';
        probe.detail = ctx.font;
      }
      return (px / CSS_MEASURE_REF_PX) * height;
    }
  }

  // Tier 3 — no font, no DOM: monospace approximation × tracking.
  return monospaceAdvance(text, height) * tracking;
}

/**
 * The rendered advance width of `text` at `height` (world units), including the
 * AutoCAD X-scale (`widthFactor`). Matches EXACTLY what `TextRenderer` paints, so a
 * box sized with this coincides with the drawn glyphs.
 */
export function measureTextAdvanceWorld(
  text: string,
  height: number,
  style?: TextAdvanceStyle,
): number {
  const widthFactor = normalizedWidthFactor(style);
  return baseAdvanceWorld(text, height, style) * widthFactor;
}

/**
 * Οι άξονες στυλ που **ζητήθηκαν** και τους οποίους η μονοδιάστημη προσέγγιση δεν βλέπει.
 * ⚠️ **Παραγόμενο από το αίτημα, όχι θυμητό** — `monospaceAdvance(text, height)` δέχεται
 * κυριολεκτικά δύο ορίσματα, οπότε ό,τι άλλο ζητήθηκε **έπεσε**.
 */
function droppedAxes(style?: TextAdvanceStyle): readonly AdvanceStyleAxis[] {
  const out: AdvanceStyleAxis[] = [];
  if (style?.bold) out.push('bold');
  if (style?.italic) out.push('italic');
  if (style?.fontFamily && style.fontFamily.trim()) out.push('family');
  return out;
}

/**
 * Η {@link measureTextAdvanceWorld} **με ετυμηγορία**: ίδιο σώμα, ίδιος αριθμός, συν *ποιο
 * όργανο απάντησε*. Δες {@link AdvanceVerdict}.
 *
 * ⚠️ **Ο αριθμός βγαίνει από την ΙΔΙΑ κλήση που παράγει τη βαθμίδα** — ποτέ δεύτερος
 * υπολογισμός «για να δούμε τι θα έβγαινε»: δύο περάσματα μπορούν να αποκλίνουν (και
 * αποκλίνουν, μόλις μπει μνήμη ή αλλάξει η σειρά ανάλυσης).
 */
export function measureTextAdvanceVerdict(
  text: string,
  height: number,
  style?: TextAdvanceStyle,
): AdvanceVerdict {
  const probe: TierProbe = { tier: 'nominal', detail: '' };
  const widthFactor = normalizedWidthFactor(style);
  const world = baseAdvanceWorld(text, height, style, probe) * widthFactor;
  if (probe.tier === 'glyph') return { kind: 'glyph', world, face: probe.detail };
  if (probe.tier === 'css') return { kind: 'css', world, font: probe.detail };
  return { kind: 'nominal', world, dropped: droppedAxes(style) };
}

/** Test-only: reset the memoised measure context (so a jsdom canvas mock can be re-probed). */
export function __resetTextAdvanceMeasureCtx(): void {
  measureCtx = undefined;
}
