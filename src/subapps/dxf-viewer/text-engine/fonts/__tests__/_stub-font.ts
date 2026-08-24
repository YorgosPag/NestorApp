/**
 * Test fixture (NOT a suite — no `.test.` suffix, so jest's testMatch skips it):
 * deterministic opentype.Font stubs so the metrics-accurate text-advance SSoT is
 * environment-independent in unit tests.
 *
 * 🔴 **ΔΙΟΡΘΩΣΗ 2026-08-25 (ADR-799).** Αυτή η παράγραφος έγραφε: *«The jest jsdom env **has
 * a live canvas backend**, so the tier-2 CSS `measureText` fallback returns REAL
 * (machine-dependent) font metrics»*. Ήταν **αληθής μέχρι το `19fbc2cc` (2026-08-24)**, που
 * πρόσθεσε `pnpm.overrides['jsdom>canvas'] = '-'` για να κοπεί η αλυσίδα CVE του `tar`
 * (ADR-598 G2). Από τότε το `getContext('2d')` επιστρέφει **`null`** ⇒ **δεν υπάρχει tier 2**
 * ⇒ ό,τι δεν φτάνει στο tier 1 πέφτει στο **tier 3**, τη μονοδιάστημη προσέγγιση, που δέχεται
 * κυριολεκτικά `(text, height)` και είναι **δομικά τυφλή σε bold / italic / οικογένεια**.
 *
 * ⚠️ **Η ΑΛΛΑΓΗ ΗΤΑΝ ΣΙΩΠΗΛΗ ΚΑΙ ΜΕΓΑΛΗ**: μετρημένο, **41** σουίτες που αγγίζουν τον μετρητή
 * δεν εγκαθιστούν stub και μετακινήθηκαν tier 2 → tier 3 **χωρίς να το πει τίποτα**. Το
 * είπαν **τρεις** ισχυρισμοί, που σύγκριναν έντονο με απλό και πήραν **ταυτόσημο** αριθμό.
 *
 * ⇒ **Η εγγραφή stub δεν είναι πλέον «για ντετερμινισμό» — είναι ο ΜΟΝΟΣ δρόμος προς βαθμίδα
 * που βλέπει το στυλ.** Είναι το μοντέλο του Flutter (`FlutterTest`, προεπιλεγμένη όψη
 * δοκιμών με γνωστές μετρικές) και του WPT (`Ahem`): *η μέτρηση κειμένου σε δοκιμή καρφώνει
 * την όψη, αλλιώς δεν μετρά τίποτα.*
 *
 * ⚠️ **Το bold θέλει ΔΕΥΤΕΡΗ εγγραφή.** Ο {@link resolveEntityFont} για `bold` **παρακάμπτει**
 * την άμεση εύρεση και ζητά `«<υποκατάστατο> Bold»` — και αν λείπει, **επιστρέφει `null`
 * επίτηδες** («un-bundled bold faces deliberately resolve to null»). Άρα ένα σκέτο
 * `installStubFont(0.6, 'arial')` αφήνει το **απλό** στο tier 1 και ρίχνει το **έντονο** στο
 * tier 3: το test γίνεται πράσινο συγκρίνοντας **opentype με μονοδιάστημη** — πράσινο για
 * λάθος λόγο. Δες {@link installStubFontPair}.
 *
 * @module text-engine/fonts/__tests__/_stub-font
 */

import type { Font } from 'opentype.js';
import { fontCache } from '../font-cache';
import { __resetTextAdvanceMeasureCtx } from '../text-advance';
import { __resetCapHeightCache, emSizeForTextHeight } from '../text-height-scale';

/** Ink-bounds override (em ratios) for the stub glyph path — see `stubProportionalFont`. */
export interface StubInkBounds {
  /** Glyph ink ascent above baseline ÷ em. Default = the font ascent (0.8) → ink == metrics. */
  inkAscentEm?: number;
  /** Glyph ink descent below baseline ÷ em. Default = the font descent (0.2) → ink == metrics. */
  inkDescentEm?: number;
  /** Glyph ink LEFT edge from the pen origin ÷ em (leading side bearing). Default 0 → no inset. */
  inkLeftEm?: number;
  /** Glyph ink RIGHT edge from the pen origin ÷ em. Default = the full advance → no inset. */
  inkRightEm?: number;
}

/**
 * A minimal opentype.Font whose advance is `emPerChar` per glyph (proportional-linear).
 *
 * `getPath(...).getBoundingBox()` returns the glyph INK box (opentype y-DOWN, baseline at 0)
 * so `measureTextGlyphInk` is deterministic. DEFAULT ink = the font metrics box vertically
 * (ascent 0.8 / descent 0.2) + the FULL advance horizontally (x1=0, x2=advance), so the
 * VISUAL text box equals the NOMINAL em box and the pre-metrics geometry tests stay unchanged.
 * Pass `ink` (cap 0.7 / descent 0, or `inkLeftEm`/`inkRightEm` side bearings) to model a real
 * font for the glyph-ink tests.
 */
export function stubProportionalFont(emPerChar: number, ink?: StubInkBounds): Font {
  const inkAscentEm = ink?.inkAscentEm ?? 0.8; // = ascender / unitsPerEm
  const inkDescentEm = ink?.inkDescentEm ?? 0.2; // = -descender / unitsPerEm
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    // ADR-635 Φ C.22 — a DECLARED cap height, deliberately ≠ the em (0.8, matching the stub's
    // ascent) so `emSizeForTextHeight` returns height × 1.25 here. A stub with capHeight == em
    // would make the conversion an identity and NO test could catch a call site that forgot it —
    // exactly the measure-vs-paint divergence that produced the Φ C.21 «ΦΕΚ405» bug.
    tables: { os2: { sCapHeight: 800 } },
    getAdvanceWidth: (text: string, size: number): number => text.length * emPerChar * size,
    getPath: (text: string, _x: number, _y: number, size: number) => {
      const advance = (text?.length ?? 0) * emPerChar * size;
      return {
        commands: [] as [],
        // y-DOWN: top (ink ascent) is negative, bottom (ink descent) is positive.
        getBoundingBox: () => ({
          x1: ink?.inkLeftEm != null ? ink.inkLeftEm * size : 0,
          y1: -inkAscentEm * size,
          x2: ink?.inkRightEm != null ? ink.inkRightEm * size : advance,
          y2: inkDescentEm * size,
        }),
      };
    },
  } as unknown as Font;
}

/**
 * The world advance the stub font produces for `charCount` characters at a DXF `textHeight` —
 * DERIVED from the height→em SSoT (ADR-635 Φ C.22), never a frozen number.
 *
 * Geometry suites used to hand-compute `len × height × 0.6`, which silently assumed «em == text
 * height». Since the cap-height rule that assumption is false, and an expectation written as a
 * literal would have to be re-typed every time the rule is refined. Written through this helper it
 * simply follows the SSoT — and still FAILS loudly if a production call site drops the conversion,
 * because the helper applies it once while the code under test would not apply it at all.
 */
export function stubAdvanceWorld(
  charCount: number,
  textHeight: number,
  emPerChar = 0.6,
  family = 'arial',
): number {
  return charCount * emPerChar * stubEmSize(textHeight, family);
}

/**
 * The FONT EM SIZE the stub is drawn at for a given DXF `textHeight` — the height→em SSoT applied
 * to the registered stub (ADR-635 Φ C.22). Use it for any expectation stated in EM units: the
 * stub's ascent+descent are 1.0 em, so its nominal em BOX height is exactly `stubEmSize(h)`.
 * Call INSIDE a test — the font is registered in `beforeAll`.
 */
export function stubEmSize(textHeight: number, family = 'arial'): number {
  const font = fontCache.get(family);
  return emSizeForTextHeight(textHeight, font ? { font, cacheName: family } : null);
}

/**
 * Register a deterministic stub font under `family` (default 'arial', the resolver
 * default) with `emPerChar` advance (default 0.6 = the monospace ratio, so existing
 * geometry tests keep their widths) and guarantee a Path2D constructor for
 * `getGlyphRun`. Returns a cleanup fn for `afterAll`.
 */
export function installStubFont(emPerChar = 0.6, family = 'arial', ink?: StubInkBounds): () => void {
  const hadPath2D = 'Path2D' in globalThis;
  if (!hadPath2D) (globalThis as { Path2D?: unknown }).Path2D = class {};
  fontCache.set(family, stubProportionalFont(emPerChar, ink));
  __resetTextAdvanceMeasureCtx();
  // The cap-height memo is keyed by FontCache name; a suite re-registering 'arial' with different
  // metrics would otherwise inherit the previous suite's ratio.
  __resetCapHeightCache();
  return () => {
    fontCache.clear();
    __resetTextAdvanceMeasureCtx();
    __resetCapHeightCache();
    if (!hadPath2D) delete (globalThis as { Path2D?: unknown }).Path2D;
  };
}

/**
 * 🔴 ADR-799 — **ΤΟ ΖΕΥΓΟΣ ΟΨΕΩΝ: η μόνη εγγραφή που κάνει το `bold` ΟΡΑΤΟ στη μέτρηση.**
 *
 * Ο {@link resolveEntityFont} για `bold` **δεν** ψάχνει την οικογένεια που ζητήθηκε: πηδά
 * κατευθείαν στο υποκατάστατο (`lookupSubstitute`) και ζητά `«<υποκατάστατο> Bold»`. Αν λείπει,
 * γυρνά **`null` επίτηδες** — τεκμηριωμένη απόφαση («un-bundled bold faces deliberately resolve
 * to null»), ώστε ο **browser** να ζωγραφίσει το έντονο μέσω CSS. Στο jest **δεν υπάρχει
 * browser**, οπότε αυτό το `null` καταλήγει στο tier 3.
 *
 * ⚠️ **Όταν η άγκυρα κρίνει ΠΛΑΤΟΣ, οι δύο όψεις ΠΡΕΠΕΙ να έχουν διαφορετικό `emPerChar`**,
 * αλλιώς είναι πράσινη
 * ό,τι κι αν κάνει ο κώδικας: με ίδιο λόγο, «έντονο» και «απλό» δίνουν **τον ίδιο αριθμό** και
 * κανένας ισχυρισμός δεν μπορεί να δει αν η διάταξη προώθησε ποτέ το στυλ. Είναι το ίδιο
 * μάθημα με το `sCapHeight: 800 ≠ em` παραπάνω: **μια ταυτότητα δεν αποδεικνύει τίποτα.**
 * Άγκυρα που κρίνει **επίλυση όψης** (ποιο `cacheName`, ποιο CSS shorthand) θεμιτά περνά
 * ίσους λόγους — εκεί το πλάτος δεν είναι το ερώτημα.
 *
 * ⚠️ **Δεν μοντελοποιεί ανά-glyph διαφορά**, και δεν πρέπει: στην πραγματική Roboto τα έντονα
 * είναι *αλλιώς* πλατιά, όχι πάντα πλατύτερα (μετρημένο: «ΤΕΣΤ» έντονο **στενότερο**, 6,222 vs
 * 6,267). Αυτό είναι **γεγονός της γραμματοσειράς**, όχι της διάταξης· η άγκυρα εδώ κρίνει τη
 * **διάταξη** — «έφτασε το στυλ στον μετρητή;» — και γι' αυτό θέλει όψεις που διαφέρουν
 * **μονότονα και ντετερμινιστικά**, όπως το `FlutterTest` του Flutter.
 *
 * @param regularEmPerChar προχώρημα ανά χαρακτήρα της κανονικής όψης
 * @param boldEmPerChar    το ίδιο για την έντονη· **πρέπει** να διαφέρει
 * @param family           η **υποκατάστατη** οικογένεια (εκεί καταλήγει και το `arial`)
 */
export function installStubFontPair(
  regularEmPerChar = 0.6,
  boldEmPerChar = 0.75,
  family = 'Liberation Sans',
  ink?: StubInkBounds,
): () => void {
  const restoreRegular = installStubFont(regularEmPerChar, family, ink);
  const restoreBold = installStubFont(boldEmPerChar, `${family} Bold`, ink);
  return () => {
    restoreBold();
    restoreRegular();
  };
}
