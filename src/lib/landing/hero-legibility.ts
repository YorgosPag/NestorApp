/**
 * @fileoverview **«ΔΙΑΒΑΖΕΤΑΙ Ο ΤΙΤΛΟΣ ΠΑΝΩ ΣΕ ΑΥΤΗ ΤΗΝ ΕΙΚΟΝΑ;»** — η αριθμητική (ADR-881 §4.5).
 * @related ADR-881 · components/shared/landing-hero/LandingHero (`HERO_SCRIM_CLASS`) · WCAG 2.2 §1.4.3
 * @module lib/landing/hero-legibility
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ — ΚΑΙ ΜΕ ΤΡΟΠΟ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΑΠΟΔΕΙΧΘΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κανένα από Shopify · Webflow · Sanity · Contentful δεν ελέγχει ενσωματωμένα την αντίθεση κειμένου
 * πάνω σε φωτογραφία (μόνο εξωτερικά εργαλεία). Εδώ:
 *   1. η εικόνα κόβεται **όπως θα την κόψει** ο ήρωας σε κάθε κάδρο (`coverSourceRect`),
 *   2. κάθε δείγμα συντίθεται με το **άλφα του σκούρου στρώματος στη θέση του** (gradient αριστερά→δεξιά),
 *   3. κρίνεται το **χειρότερο 5%** — όχι ο μέσος όρος, που κρύβει τη φωτεινή κηλίδα κάτω από μια λέξη.
 *
 * ⚠️ **Οι στάσεις του στρώματος ΔΕΝ είναι δεύτερη αλήθεια**: είναι οι αριθμοί του `HERO_SCRIM_CLASS`
 *    (`from-black/75 via-black/45 to-black/10`). Η άγκυρα `hero-legibility.test.ts` διαβάζει τις
 *    κλάσεις και απαιτεί να συμφωνούν — αλλάζει το ένα χωρίς το άλλο ⇒ κόκκινο.
 */

/** Άλφα του μαύρου στρώματος στο 0% · 50% · 100% του πλάτους (from · via · to). */
export const HERO_SCRIM_STOPS = {
  day: [0.75, 0.45, 0.1],
  dusk: [0.6, 0.3, 0],
} as const satisfies Record<string, readonly [number, number, number]>;

export type HeroScrimTheme = keyof typeof HERO_SCRIM_STOPS;

/** WCAG 1.4.3: μεγάλο κείμενο (τίτλος) 3:1 · κανονικό (υπότιτλος) 4,5:1. */
export const HERO_CONTRAST_THRESHOLDS = { large: 3, normal: 4.5 } as const;

/**
 * **Πού κάθεται το κείμενο** μέσα στο κάδρο, σε κλάσματα — τίτλος + υπότιτλος, πάνω από το πλαίσιο.
 * 📏 Μετρημένο στον browser (2026-09-24, `/stay`, ήρωας 2272×512): τίτλος y 0,27–0,38 · υπότιτλος
 *    y 0,39–0,43 · αριστερό περιθώριο 48px. Το πλάτος της στήλης = το πλαίσιο (`lg:w-3/5`), γιατί ο
 *    μακρύς υπότιτλος του `/pro` φτάνει ως εκεί (ADR-777 §8.81.5 #4). Ανά κάδρο: `hero-frames.ts`.
 */
export interface HeroTextZone {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export const HERO_TEXT_ZONE: HeroTextZone = { x0: 0.02, x1: 0.6, y0: 0.26, y1: 0.44 };

export type HeroLegibilityVerdict = 'pass' | 'large-only' | 'fail';

export interface HeroLegibility {
  /** Η αντίθεση λευκού κειμένου στο χειρότερο 5% της ζώνης. */
  readonly worstRatio: number;
  readonly verdict: HeroLegibilityVerdict;
}

// ============================================================================
// 1. ΑΡΙΘΜΗΤΙΚΗ WCAG
// ============================================================================

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Σχετική φωτεινότητα sRGB (WCAG 2.2). */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Αντίθεση **λευκού** κειμένου πάνω σε φόντο φωτεινότητας `L`. */
export function contrastOnWhite(luminance: number): number {
  return 1.05 / (luminance + 0.05);
}

/** Άλφα του στρώματος σε οριζόντια θέση `x ∈ [0,1]` — γραμμική παρεμβολή ανάμεσα στις στάσεις. */
export function scrimAlphaAt(theme: HeroScrimTheme, x: number): number {
  const [from, via, to] = HERO_SCRIM_STOPS[theme];
  const t = Math.min(1, Math.max(0, x));
  return t <= 0.5 ? from + (via - from) * (t / 0.5) : via + (to - via) * ((t - 0.5) / 0.5);
}

export function verdictFor(ratio: number): HeroLegibilityVerdict {
  if (ratio >= HERO_CONTRAST_THRESHOLDS.normal) return 'pass';
  return ratio >= HERO_CONTRAST_THRESHOLDS.large ? 'large-only' : 'fail';
}

// ============================================================================
// 2. ΚΑΔΡΟ — ΤΙ ΚΟΜΜΑΤΙ ΤΗΣ ΕΙΚΟΝΑΣ ΒΛΕΠΕΙ ΤΟ `object-fit: cover`
// ============================================================================

export interface SourceRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/**
 * Το ορθογώνιο της **πηγής** που φαίνεται σε κάδρο `frame` με `object-fit: cover` και
 * `object-position: px% py%` (κλάσματα). Ίδιος τύπος με τον browser: το υπερχειλίζον μήκος
 * μοιράζεται κατά `p`.
 */
export function coverSourceRect(
  image: { readonly width: number; readonly height: number },
  frame: { readonly width: number; readonly height: number },
  position: { readonly x: number; readonly y: number },
): SourceRect {
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const sw = frame.width / scale;
  const sh = frame.height / scale;
  return { sx: (image.width - sw) * position.x, sy: (image.height - sh) * position.y, sw, sh };
}

// ============================================================================
// 3. Η ΚΡΙΣΗ
// ============================================================================

/**
 * Κρίνει ένα **ήδη κομμένο** κάδρο (`RGBA`, `width × height`, όπως το ζωγράφισε το `drawImage` με το
 * {@link coverSourceRect}) στη ζώνη του κειμένου.
 */
export function judgeHeroLegibility(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  theme: HeroScrimTheme,
  zone: HeroTextZone = HERO_TEXT_ZONE,
): HeroLegibility {
  const luminances: number[] = [];
  const [x0, x1] = [Math.floor(zone.x0 * width), Math.ceil(zone.x1 * width)];
  const [y0, y1] = [Math.floor(zone.y0 * height), Math.ceil(zone.y1 * height)];

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      const keep = 1 - scrimAlphaAt(theme, (x + 0.5) / width);
      luminances.push(relativeLuminance(rgba[i] * keep, rgba[i + 1] * keep, rgba[i + 2] * keep));
    }
  }
  if (luminances.length === 0) return { worstRatio: Number.POSITIVE_INFINITY, verdict: 'pass' };

  luminances.sort((a, b) => a - b);
  const brightest5 = luminances[Math.min(luminances.length - 1, Math.floor(luminances.length * 0.95))];
  const worstRatio = contrastOnWhite(brightest5);
  return { worstRatio, verdict: verdictFor(worstRatio) };
}
