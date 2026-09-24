/**
 * @fileoverview **«ΜΠΟΡΕΙ ΑΥΤΗ Η ΕΙΚΟΝΑ ΝΑ ΓΙΝΕΙ ΗΡΩΑΣ;»** — ο ένας κριτής (ADR-881 §4.6).
 * @related ADR-881 · lib/landing/landing-hero-vocabulary (`LANDING_HERO_UPLOAD_SPEC`)
 * @module lib/landing/hero-upload-check
 *
 * 🔑 **ΕΝΑΣ ΚΡΙΤΗΣ, ΔΥΟ ΣΗΜΕΙΑ**: ο browser τον ρωτά **πριν** ανεβεί byte (άμεση απάντηση), ο
 *    διακομιστής **ξανά** πάνω στο καθαρισμένο κανονικό παράγωγο (belt-and-suspenders, N.7.2 #4) —
 *    ένας πελάτης που παρακάμπτει την οθόνη δεν παρακάμπτει τον κανόνα.
 *
 * ⚠️ **Δύο βαθμίδες, επίτηδες**: `block` = το κάδρο **δεν μπορεί** να δουλέψει· `warn` = δουλεύει
 *    αλλά κάτι αξίζει να το ξέρει ο άνθρωπος. Η κρίση «αρκετά καλό» μένει **ανθρώπινη**.
 */

import { LANDING_HERO_UPLOAD_SPEC as SPEC } from './landing-hero-vocabulary';

export const HERO_UPLOAD_ISSUE_SEVERITY = {
  'type-not-accepted': 'block',
  'too-large': 'block',
  'too-small': 'block',
  'aspect-out-of-range': 'block',
  'below-target-width': 'warn',
  'aspect-not-target': 'warn',
  'pair-size-mismatch': 'warn',
} as const;

export type HeroUploadIssueCode = keyof typeof HERO_UPLOAD_ISSUE_SEVERITY;
export type HeroUploadSeverity = (typeof HERO_UPLOAD_ISSUE_SEVERITY)[HeroUploadIssueCode];

export interface HeroDimensions {
  readonly width: number;
  readonly height: number;
}

/** Τα **μεταδεδομένα** του αρχείου — πριν καν αποκωδικοποιηθεί. */
export function checkHeroFile(file: { readonly type: string; readonly size: number }): HeroUploadIssueCode[] {
  const issues: HeroUploadIssueCode[] = [];
  if (!(SPEC.acceptedTypes as readonly string[]).includes(file.type)) issues.push('type-not-accepted');
  if (file.size > SPEC.maxBytes) issues.push('too-large');
  return issues;
}

/** Οι **διαστάσεις** μίας εκδοχής. */
export function checkHeroDimensions(size: HeroDimensions): HeroUploadIssueCode[] {
  const issues: HeroUploadIssueCode[] = [];
  const aspect = size.width / size.height;
  if (size.width < SPEC.minWidth || size.height < SPEC.minHeight) issues.push('too-small');
  if (!Number.isFinite(aspect) || aspect < SPEC.minAspect || aspect > SPEC.maxAspect) {
    issues.push('aspect-out-of-range');
  } else if (Math.abs(aspect - SPEC.targetAspect) / SPEC.targetAspect > SPEC.aspectTolerance) {
    issues.push('aspect-not-target');
  }
  if (size.width < SPEC.targetWidth) issues.push('below-target-width');
  return issues;
}

/**
 * **Το ζεύγος** — μέρα και σούρουπο είναι το **ίδιο** κάδρο (ADR-777 §8.81.2). Διαφορετικός λόγος
 * σημαίνει ότι η εναλλαγή θέματος θα **μετακινήσει** τη σκηνή. Προειδοποίηση: ίδιος λόγος σε άλλη
 * ανάλυση (2400 έναντι 1774) είναι αθώο, και το ελέγχουμε με λόγο, όχι με pixel.
 */
export function checkHeroPair(day: HeroDimensions, dusk: HeroDimensions): HeroUploadIssueCode[] {
  const dayAspect = day.width / day.height;
  const duskAspect = dusk.width / dusk.height;
  return Math.abs(dayAspect - duskAspect) / dayAspect > 0.01 ? ['pair-size-mismatch'] : [];
}

export function severityOf(code: HeroUploadIssueCode): HeroUploadSeverity {
  return HERO_UPLOAD_ISSUE_SEVERITY[code];
}

export function hasBlockingIssue(issues: readonly HeroUploadIssueCode[]): boolean {
  return issues.some((code) => severityOf(code) === 'block');
}
