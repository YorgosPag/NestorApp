/**
 * Background-adaptive entity color — pure SSoT (ADR-509).
 *
 * AutoCAD model-space pattern: ο 2D καμβάς είναι σκούρος (default `#000000`), οπότε χρώματα
 * οντοτήτων «σχεδόν μαύρα» (π.χ. εξωτ. τοίχος `#2b2f36`) εξαφανίζονται. Αυτό το SSoT εγγυάται
 * **ελάχιστο contrast** κάθε χρώματος ενάντια στο **ζωντανό background του 2D καμβά**: αν το
 * χρώμα έχει ήδη επαρκές contrast → επιστρέφεται **αυτούσιο** (κορεσμένα beam/column μένουν)·
 * αλλιώς αναμειγνύεται **ελάχιστα** προς το αντίθετο άκρο (άσπρο σε σκούρο φόντο, μαύρο σε
 * ανοιχτό) ώσπου να φτάσει το κατώφλι — διατηρώντας τον χρωματικό χαρακτήρα όσο γίνεται.
 *
 * **Render-time, 2D-canvas-specific** (ΟΧΙ μέσα στον κοινό `resolveSubcategoryStyle`, που τον
 * μοιράζονται 3D edges + print με ΑΛΛΟ background). Reuse `color-math` (μηδέν duplicate math) +
 * `resolveDxfCanvasBackgroundHex` (live bg SSoT). Memoized (τα χρώματα είναι λίγα → cache hit).
 *
 * @see ./color-math.ts — contrastRatio / mixHex / parseHex / srgbRelativeLuminance
 * @see ./color-config.ts — resolveDxfCanvasBackgroundHex (live 2D canvas bg)
 * @see docs/centralized-systems/reference/adrs/ADR-509-adaptive-entity-color.md
 */

import {
  compositeOverHex,
  contrastRatio,
  mixHex,
  parseColor,
  parseHex,
  rgbaString,
  rgbToHex,
  saturation,
  type RgbaColor,
} from './color-math';
import { resolveDxfCanvasBackgroundHex } from './color-config';
import {
  _clearSurfaceAdaptationCache,
  adaptColorForSurface,
  inkForBackgroundRgb,
  MIN_ENTITY_CONTRAST,
} from './contrast-adaptation';
import { lineweightDisplayState } from './lineweight-display-px';
import {
  applyPlotColor,
  getPrintColorPolicy,
  PRINT_PAPER_HEX,
  type PrintColorPolicy,
} from './print-color-policy';

/**
 * **Πάνω σε τι ζωγραφίζω ΤΩΡΑ;** — χαρτί όταν τρέχει print pass, αλλιώς το ζωντανό φόντο του καμβά.
 *
 * 🔴 Μετρημένο ζωντανά (ADR-909 Β2.5, 2026-10-09): η αδιαφανής βάση κάθε σώματος BIM ρωτούσε σκέτο
 * `resolveDxfCanvasBackgroundHex()` — και στην εκτύπωση το `getComputedStyle` του `:root` λέει ακόμη
 * «σκούρο». Κάθε κολόνα έβγαινε στη δημόσια κάτοψη **συμπαγές `rgb(23,32,46)`**: το φόντο του θέματος
 * `#1d283a`, σκουρυμένο από το γέμισμα (× 0,78). Όποιος στρώνει ή μιμείται «φόντο» σε δρόμο που τυπώνεται
 * ρωτά **αυτό**, όχι τον καμβά.
 */
export function liveDrawingSurfaceHex(): string {
  return getPrintColorPolicy() !== null ? PRINT_PAPER_HEX : resolveDxfCanvasBackgroundHex();
}

/**
 * **Το μελάνι μιας γραμμής όπως ζωγραφίζεται ΤΩΡΑ** (ADR-909 Β2.6): print pass ⇒ η πολιτική εκτύπωσης
 * (ρόλος `'ink'`)· ζωντανή οθόνη ⇒ το χρώμα **αυτούσιο**, χωρίς καμία προσαρμογή.
 *
 * 🔴 Για ζωγράφους που βάζουν `ctx.strokeStyle` **μόνοι τους**, έξω από το `setupStyle` και τον
 * `bim-line-weight-resolver` — εκεί η πολιτική δεν φτάνει ποτέ. Μετρημένο ζωντανά (2026-10-09, δημόσια
 * κάτοψη `monochrome`): η ετικέτα ανοίγματος (πορτοκαλί/γκριζογάλανο), τα είδη υγιεινής (`#b45309`) και οι
 * ορθοστάτες του κιγκλιδώματος (`#607080`) ήταν τα **μόνα** χρωματιστά pixels της εικόνας.
 *
 * ⚠️ Η κλάση **δεν έκλεισε**: ~70 σημεία σε 38 αρχεία του `bim/renderers` θέτουν `strokeStyle` ωμά. Εδώ
 * περνούν όσα **μετρήθηκαν**· τα υπόλοιπα τα βλέπει μόνο πύλη pixels σε πραγματικό browser (ADR-909 §6.4).
 *
 * ## 🔴 Ημιδιαφανές μελάνι (`rgba(…)`) — ADR-909 Γ2.1
 * Το {@link applyPlotColor} διαβάζει μόνο `#hex`: ένα `rgba(139,94,52,0.55)` (ακμή επίπλου) του ήταν «άγνωστο
 * χρώμα» και έβγαινε **σκέτο μαύρο σε κάθε στάθμη**, ακόμη και στο «Έγχρωμο». Στο χαρτί η διαφάνεια μιας
 * γραμμής δεν είναι ιδιότητα — είναι ο τρόπος που η οθόνη τη δείχνει διακριτική. Άρα πρώτα γίνεται **αυτό που
 * θα έβλεπε το μάτι πάνω στο χαρτί** (σύνθεση πάνω στο {@link PRINT_PAPER_HEX}) και μετά κρίνεται ως μελάνι:
 * έτσι το δάπεδο αντίθεσης μετρά το πραγματικό αποτέλεσμα, όχι ένα χρώμα που η διαφάνεια θα ξέπλενε μετά.
 */
export function liveStrokeInk(color: string): string {
  const policy = getPrintColorPolicy();
  if (policy === null) return color;
  const c = parseColor(color);
  const opaque = c === null ? color : compositeOverHex(c, PRINT_PAPER_HEX);
  return applyPlotColor(opaque, null, policy);
}

/**
 * **Το πάχος μιας γραμμής σε px όπως ζωγραφίζεται ΤΩΡΑ**: print pass ⇒ ποτέ κάτω από το δάπεδο της
 * απόδοσης (`PrintColorPolicy.minLineWidthPx`)· ζωντανή οθόνη ⇒ **αυτούσιο**. Αδελφός του
 * {@link liveStrokeInk} για ζωγράφους με σταθερό πάχος σε px (`RENDER_LINE_WIDTHS`).
 */
export function liveStrokeWidthPx(px: number): number {
  return getPrintColorPolicy() !== null ? Math.max(lineweightDisplayState().hairlinePx, px) : px;
}

/**
 * **Γέμισμα που στην οθόνη μένει ΑΥΤΟΥΣΙΟ** (παλέτα συμβόλου, χωρίς προσαρμογή στο φόντο) αλλά σε print
 * pass περνά από την πολιτική όπως κάθε σώμα BIM ({@link adaptFillTintForCanvas} — γκρι της δικής του
 * φωτεινότητας στο `monochrome`, ίδια διαφάνεια).
 */
export function liveSymbolFill(fill: string): string {
  return getPrintColorPolicy() !== null ? adaptFillTintForCanvas(fill) : fill;
}

// ADR-909 Γ2.1 — η καθαρή προσαρμογή αντίθεσης ζει στο φύλλο `contrast-adaptation.ts` (ώστε να τη ζητά και
// η πολιτική εκτύπωσης χωρίς κύκλο εισαγωγών). Επανεξάγεται εδώ: οι καλούντες αυτού του αρχείου δεν αλλάζουν.
export {
  adaptColorForSurface,
  adaptColorToBackground,
  maxContrastInk,
  MIN_ENTITY_CONTRAST,
  type MaxContrastInk,
} from './contrast-adaptation';

/**
 * Προσαρμόζει ένα χρώμα οντότητας στην επιφάνεια όπου ζωγραφίζεται **τώρα**
 * ({@link liveDrawingSurfaceHex}: ζωντανό φόντο του καμβά, ή χαρτί σε print pass). Memoized ανά
 * `χρώμα|επιφάνεια|κατώφλι`. Καλείται από τους 2D renderers ΑΚΡΙΒΩΣ πριν το `ctx.strokeStyle`/
 * `fillStyle`. Το `minContrast` επιτρέπει σε συγκεκριμένες οντότητες (π.χ. wall outline +
 * axis, βλ. `WALL_LINE_CONTRAST`) να ζητούν **πιο έντονο** αποτέλεσμα από το default 3.0.
 *
 * 🔴 ADR-909 Γ2.1 — ρωτούσε σκέτο `resolveDxfCanvasBackgroundHex()`, και στην εκτύπωση το CSS λέει ακόμη
 * «σκούρο»: το σκούρο χρώμα «φωτιζόταν» για να φανεί σε φόντο που στο χαρτί **δεν υπάρχει**. Στην οθόνη η
 * απάντηση είναι η ίδια με πριν.
 */
export function adaptEntityColorForCanvas(
  colorHex: string,
  minContrast: number = MIN_ENTITY_CONTRAST,
): string {
  return adaptColorForSurface(colorHex, liveDrawingSurfaceHex(), minContrast);
}

// ============================================================================
// FILL TINT (Revit-grade poché) — translucent body fill, background-adaptive
// ============================================================================

/**
 * Ελάχιστο contrast του **composited** σώματος (poché) ενάντια στο φόντο. Πιο χαμηλό
 * από {@link MIN_ENTITY_CONTRAST} (γραμμές 3.0): το γέμισμα είναι background fill — αρκεί
 * να «διαβάζεται» ως ανοιχτό-γκρι, όχι να κυριαρχεί ξεπλένοντας τον χρωματικό χαρακτήρα.
 */
export const MIN_FILL_CONTRAST = 2.0;

/**
 * Ανώτατο alpha κατά το boost. Διατηρεί το **translucent CAD feel** — το σώμα δεν γίνεται
 * ποτέ opaque (οι υποκείμενες DXF γραμμές φαίνονται), απλώς αρκετά αδιαφανές για να ξεχωρίζει.
 */
export const FILL_BOOST_MAX_ALPHA = 0.6;

const _fillCache = new Map<string, string>();

/**
 * Προσαρμόζει ένα **translucent fill tint** (`rgba(...)`/hex) στο **ζωντανό** 2D canvas
 * background. Αν το composited σώμα ήδη φτάνει {@link MIN_FILL_CONTRAST} → αυτούσιο (κρατά
 * translucency + hue). Αλλιώς σπρώχνει base→αντίθετο άκρο φωτεινότητας ΚΑΙ alpha→
 * {@link FILL_BOOST_MAX_ALPHA} ώσπου το composited να γίνει ορατό. Επιστρέφει πάντα `rgba`.
 * Memoized ανά `fill|bg`. Καλείται από τους 2D BIM renderers πριν το `ctx.fillStyle`.
 */
export function adaptFillTintForCanvas(fill: string, bgHex?: string): string {
  // ADR-454 / ADR-909 Β2.5 — σε print pass η επιφάνεια είναι **χαρτί**, όχι ο ζωντανός καμβάς: το γέμισμα
  // δεν «προσαρμόζεται» στο σκοτεινό φόντο της οθόνης, περνά από την πολιτική εκτύπωσης όπως κάθε μελάνι.
  const printPolicy = getPrintColorPolicy();
  if (printPolicy !== null) return plotFillTint(fill, printPolicy);

  const bg = bgHex ?? resolveDxfCanvasBackgroundHex();
  const key = `${fill}|${bg}`;
  const hit = _fillCache.get(key);
  if (hit !== undefined) return hit;
  const out = computeAdaptedFillTint(fill, bg);
  _fillCache.set(key, out);
  return out;
}

/**
 * **Το γέμισμα όπως τυπώνεται** — το χρώμα από το {@link applyPlotColor} (ρόλος `'tint'`), η **διαφάνεια
 * αυτούσια**.
 *
 * 🔴 Μετρημένο ζωντανά (2026-10-08): το `monochrome` μαύριζε κάθε γραμμή και άφηνε **χρωματιστό** κάθε
 * γέμισμα BIM — οι ~20 αποδότες που καλούν το `adaptFillTintForCanvas` δεν ρωτούσαν ποτέ αν τυπώνουν, και
 * επιπλέον προσάρμοζαν το χρώμα στο **σκοτεινό φόντο της οθόνης** ενώ ζωγράφιζαν σε λευκό χαρτί.
 *
 * ⚠️ Η διαφάνεια **δεν** γίνεται 1: ένα ημιδιαφανές γέμισμα πλάκας που θα τυπωνόταν αδιαφανές θα
 * κατάπινε ολόκληρη την κάτοψη. Στο `monochrome` το χρώμα γίνεται **γκρι της δικής του φωτεινότητας**
 * (Revit «Black Lines»), όχι μαύρο: ανοιχτό και σκούρο υλικό μένουν διακριτά.
 */
function plotFillTint(fill: string, policy: PrintColorPolicy): string {
  const c = parseColor(fill);
  if (c === null) return fill;
  const plotted = parseHex(applyPlotColor(rgbToHex(c), null, policy, 'tint'));
  return plotted === null ? fill : rgbaString({ ...plotted, a: c.a });
}

/** Pure core του {@link adaptFillTintForCanvas} (χωρίς memo/live-bg). */
function computeAdaptedFillTint(fill: string, bg: string): string {
  const c = parseColor(fill);
  const bgRgb = parseHex(bg);
  if (!c || !bgRgb) return fill;
  if (contrastRatio(compositeOverHex(c, bg), bg) >= MIN_FILL_CONTRAST) return fill;

  // Στόχος = αντίθετο άκρο φωτεινότητας φόντου. `s∈[0,1]` σπρώχνει ΤΑΥΤΟΧΡΟΝΑ base→endpoint
  // και alpha→targetA → contrast μονότονα αυξάνει → binary-search ελάχιστου `s`.
  const endpoint = inkForBackgroundRgb(bgRgb);
  const baseHex = rgbToHex(c);
  const targetA = Math.max(c.a, FILL_BOOST_MAX_ALPHA);
  const tintAt = (s: number): RgbaColor => ({
    ...(parseHex(mixHex(baseHex, endpoint, s)) ?? c),
    a: c.a + (targetA - c.a) * s,
  });
  const meets = (s: number): boolean =>
    contrastRatio(compositeOverHex(tintAt(s), bg), bg) >= MIN_FILL_CONTRAST;

  if (!meets(1)) return rgbaString(tintAt(1));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return rgbaString(tintAt(hi));
}

// ============================================================================
// STRUCTURAL LINE COLOR — δομικό γκρι περίγραμμα/άξονας: φωτεινό αλλά hue-safe
// ============================================================================

/**
 * Πάνω από αυτόν τον κορεσμό ένα χρώμα θεωρείται «ζωηρό» (user V/G override, π.χ. κόκκινο):
 * το mix-προς-λευκό θα το ξέπλενε, άρα ΔΕΝ εφαρμόζουμε το επιθετικό κατώφλι — μόνο standard.
 */
export const SATURATED_LINE_THRESHOLD = 0.4;

/**
 * Προσαρμογή χρώματος **δομικής γραμμής** (wall outline + γραμμή άξονα) στο live 2D bg, με
 * **σαφώς φωτεινό** αποτέλεσμα για τα ουδέτερα δομικά γκρι (#2b2f36/#6b7280 → ανοιχτό γκρι),
 * αλλά **χωρίς ξέπλυμα** ζωηρών χρωμάτων: κορεσμένα (≥ {@link SATURATED_LINE_THRESHOLD}) παίρνουν
 * μόνο το standard {@link MIN_ENTITY_CONTRAST} (κόκκινο override μένει κόκκινο). `brightContrast`
 * = το επιθετικό κατώφλι για τα γκρι (βλ. `WALL_LINE_CONTRAST`).
 *
 * ⚠️ **ΛΕΠΤΟΣ WRAPPER, ΟΧΙ ΔΕΥΤΕΡΟ ΣΩΜΑ** (ADR-771 Φ.3): ο κανόνας ζει **μία φορά**, στην
 * {@link adaptStructuralLineInkForCanvas}· εδώ πετιέται μόνο η ετυμηγορία. Έτσι οι ~20 BIM
 * renderers που καλούν αυτή την υπογραφή μένουν **αμετάβλητοι**, και ταυτόχρονα είναι
 * **αδύνατο** οι δύο πόρτες να δώσουν διαφορετικό χρώμα.
 */
export function adaptStructuralLineColorForCanvas(colorHex: string, brightContrast: number): string {
  return adaptStructuralLineInkForCanvas(colorHex, brightContrast).ink;
}

// ============================================================================
// INK VERDICT — «απάντησα» ΔΕΝ σημαίνει «πέτυχα» (ADR-771 Φ.3)
// ============================================================================

/**
 * 🔴 **Η ετυμηγορία ενός μελανιού**: τι βγήκε **και** αν κρατήθηκε η υπόσχεση.
 *
 * ## Το γεγονός που τη γέννησε
 * Η {@link adaptColorToBackground} έχει έναν κλάδο που **παραδίδεται σιωπηλά**:
 *
 * ```ts
 * if (contrastRatio(target, bgHex) < minContrast) return target;   // ← καλύτερη προσπάθεια
 * ```
 *
 * Επιστρέφει χρώμα, άρα ο καλών **δεν έχει τρόπο να ρωτήσει αν πέτυχε** — νέα μορφή του
 * «0 = κανείς δεν κοίταξε»: *η συνάρτηση απαντά, άρα κανείς δεν ρώτησε αν πέτυχε*.
 *
 * Ο κλάδος **δεν είναι θεωρητικός**, μετρήθηκε (2026-08-07, με βαθμονόμηση λευκό/μαύρο = 21,00):
 * το θέμα καμβά `cinema4d` λύνεται σε **`#555555`** (`--canvas-themes-cinema4d`), όπου το
 * **μέγιστο δυνατό** είναι **7,46:1** ενώ το `WALL_LINE_CONTRAST` δηλώνει **9,0**. Δηλαδή σε
 * ένα από τα **δικά μας** preset θέματα οι τοίχοι αθετούν σιωπηλά την υπόσχεση του έργου.
 * Και το φράγμα είναι δομικό: το χειρότερο δυνατό γκρι δίνει **4,58:1**, άρα **κάθε** κατώφλι
 * πάνω από αυτό είναι αθετήσιμο από μια απλή επιλογή `custom` χρώματος.
 *
 * ## 🔴 ΤΡΕΙΣ ρητές καταστάσεις, ποτέ δύο
 * Το `sufficient: boolean` θα ήταν σιωπηλή απόρριψη με άλλο όνομα: ένα μη αναγνωρίσιμο
 * χρώμα (`rgba(...)`, σκουπίδι, άκυρο φόντο) **δεν είναι αποτυχία** — είναι **αμέτρητο**, και
 * το να το βάψεις ως αποτυχία γεννά ψευδώς θετικό ακριβώς εκεί που δεν ξέρεις τίποτα.
 *
 * | κατάσταση | σημασία | τι κάνει ο καταναλωτής |
 * |---|---|---|
 * | `sufficient` | μετρήθηκε, φτάνει το κατώφλι | ζωγραφίζει κανονικά |
 * | `shortfall` | μετρήθηκε, **δεν** το φτάνει | διάσωση (casing — δες `bim-contrast-casing.ts`) |
 * | `unmeasurable` | δεν αναλύεται μελάνι ή επιφάνεια | ζωγραφίζει κανονικά· **καμία αξίωση** |
 *
 * ## Γιατί το `achieved` υπάρχει ΚΑΙ στην επιτυχία
 * Είναι η θέση της **APCA (WCAG 3)**, ρητή στην τεκμηρίωσή της: επιστρέφει τιμή `Lc`, όχι
 * pass/fail, γιατί *«a strict pass/fail with a blanket contrast ratio is not instructive»*.
 * Μια ετυμηγορία που κρύβει τη μέτρησή της αναγκάζει τον επόμενο να την ξανακάνει.
 */
export type InkVerdict =
  | { readonly kind: 'sufficient'; readonly ink: string; readonly achieved: number; readonly required: number }
  | { readonly kind: 'shortfall'; readonly ink: string; readonly achieved: number; readonly required: number }
  | { readonly kind: 'unmeasurable'; readonly ink: string; readonly required: number };

/**
 * 🔑 **Η ΜΕΤΡΗΣΗ, ΟΧΙ Η ΘΥΜΗΣΗ.** Η ετυμηγορία υπολογίζεται από το χρώμα που **όντως
 * επιστράφηκε**, ποτέ από «ποιον κλάδο πήρα». Λογιστική κλάδων μπορεί να αποκλίνει από το
 * αποτέλεσμα (και αποκλίνει, στην πρώτη αναδιάταξη)· μια μέτρηση του αποτελέσματος **δεν
 * μπορεί** — αν η {@link adaptColorToBackground} αλλάξει αύριο, η ετυμηγορία ακολουθεί δωρεάν.
 *
 * Είναι ο ίδιος κανόνας που το ίδιο το έργο εφαρμόζει στις πύλες του: βαθμονόμησε με γνωστή
 * τιμή, μετά κρίνε — ποτέ ετυμηγορία από βιβλιοθηκάριο κατάστασης.
 */
function verdictFor(ink: string, surfaceHex: string, required: number): InkVerdict {
  if (!parseHex(ink) || !parseHex(surfaceHex)) return { kind: 'unmeasurable', ink, required };
  const achieved = contrastRatio(ink, surfaceHex);
  return achieved >= required
    ? { kind: 'sufficient', ink, achieved, required }
    : { kind: 'shortfall', ink, achieved, required };
}

const _verdictCache = new Map<string, InkVerdict>();

/**
 * Η {@link adaptColorForSurface} **με ετυμηγορία**. Ίδιο μελάνι, ίδιο κλειδί μνήμης — απλώς
 * λέει και **αν** κρατήθηκε η υπόσχεση.
 *
 * ⚠️ **Απομνημονεύεται το ΑΝΤΙΚΕΙΜΕΝΟ, όχι μόνο το χρώμα.** Ο καλών είναι ζωγράφος καμβά:
 * 3 σημεία × N τοίχοι × 60 fps. Ένα νέο αντικείμενο ανά κλήση θα ήταν δέσμευση σε βρόχο
 * καρέ — ακριβώς το σχήμα που ο ADR-040 απαγορεύει. Με τη μνήμη, η σταθερή κατάσταση είναι
 * **μηδέν δεσμεύσεις**: επιστρέφεται η ίδια αναφορά.
 */
export function adaptInkForSurface(
  colorHex: string,
  surfaceHex: string,
  minContrast: number = MIN_ENTITY_CONTRAST,
): InkVerdict {
  const key = `${colorHex}|${surfaceHex}|${minContrast}`;
  const hit = _verdictCache.get(key);
  if (hit !== undefined) return hit;
  const out = verdictFor(adaptColorForSurface(colorHex, surfaceHex, minContrast), surfaceHex, minContrast);
  _verdictCache.set(key, out);
  return out;
}

/**
 * Η {@link adaptStructuralLineColorForCanvas} **με ετυμηγορία** — και το **ΕΝΑ σώμα** των δύο.
 *
 * ⚠️ Η εκδοχή που επιστρέφει χρώμα είναι πλέον **λεπτός wrapper πάνω σε αυτή** (`.ink`), ώστε
 * οι δύο πόρτες να **μην μπορούν** να αποκλίνουν: δύο σώματα του ίδιου κανόνα είναι sibling
 * clone (CHECK 3.28) και, χειρότερα, δύο σημεία που θα δώσουν διαφορετική απάντηση στην πρώτη
 * ρύθμιση. Ίδιο σχήμα με το ζεύγος {@link adaptColorForSurface}/{@link adaptEntityColorForCanvas}.
 *
 * Μία ανάγνωση του ζωντανού CSS ανά κλήση — ακριβώς όσες και πριν.
 *
 * 🔴 ADR-909 Γ2.1 — η επιφάνεια είναι το {@link liveDrawingSurfaceHex}, όχι σκέτος ο καμβάς. Μετρημένο στην
 * πύλη pixels: το περίγραμμα **κάθε τοίχου** έβγαινε στη δημόσια κάτοψη `#aaaaaa` (2,3:1) αντί για μαύρο,
 * επειδή το μαύρο μελάνι της εκτύπωσης «φωτιζόταν» απέναντι στο σκούρο φόντο της οθόνης. Σε χαρτί η
 * ετυμηγορία δεν βγαίνει ποτέ `shortfall` (το μαύρο δίνει 21:1) ⇒ το casing εκεί δεν ζωγραφίζεται.
 */
export function adaptStructuralLineInkForCanvas(colorHex: string, brightContrast: number): InkVerdict {
  const c = parseHex(colorHex);
  // Κορεσμένο (user V/G override) ⇒ standard κατώφλι· το mix-προς-λευκό θα το ξέπλενε.
  // Μη αναγνωρίσιμο ⇒ το κατώφλι που ζητήθηκε· η ετυμηγορία θα βγει `unmeasurable` ούτως ή άλλως.
  const required = c && saturation(c) >= SATURATED_LINE_THRESHOLD ? MIN_ENTITY_CONTRAST : brightContrast;
  return adaptInkForSurface(colorHex, liveDrawingSurfaceHex(), required);
}

/** Test hook — καθαρίζει τα memo caches (π.χ. όταν αλλάζει το background στο test). */
export function _clearAdaptiveColorCache(): void {
  _clearSurfaceAdaptationCache();
  _fillCache.clear();
  _verdictCache.clear();
}
