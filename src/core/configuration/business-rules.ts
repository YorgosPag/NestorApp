/**
 * ============================================================================
 * 🏢 OBLIGATIONS BUSINESS RULES — κατώφλια ποιότητας/προόδου/λέξεων/ανάγνωσης
 * ============================================================================
 *
 * Οι τιμές που διαβάζουν τα `lib/obligations/*`. Μία πηγή, χωρίς σκληρές τιμές σκορπισμένες.
 *
 * 🔴 **ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΤΟΤΕΛΕΣ (ADR-927 §8, 2026-11-03)**: οι τιμές ζούσαν μέσα στο `DEFAULT_SYSTEM_CONFIG` ενός
 *    «Enterprise Configuration Management System» (`core/configuration/*`, ~3.000 γραμμές) που φόρτωνε ρύθμιση από
 *    `system/settings` και είχε σελίδα «Μετεγκατάσταση Enterprise». Μετρήθηκε ότι η μόνη χρήση του συστήματος ήταν
 *    εκείνη η σελίδα. Η «μετεγκατάσταση» έγραφε από τον browser σε συλλογή με `allow write: if false` και άρα δεν
 *    μπορούσε να πετύχει ποτέ. Η σελίδα αφαιρέθηκε, και μαζί της το σύστημα. Εδώ έμειναν μόνο οι τιμές που
 *    διαβάζονται πράγματι, **ίδιες** με πριν.
 */

interface ObligationsBusinessRules {
  readonly qualityThreshold: number;
  readonly progressThresholds: {
    readonly excellent: number;
    readonly good: number;
    readonly moderate: number;
  };
  readonly wordCountThresholds: {
    readonly minimum: number;
    readonly excellent: number;
  };
  readonly defaultReadingSpeed: number;
}

const OBLIGATIONS_RULES: ObligationsBusinessRules = {
  qualityThreshold: 50,
  progressThresholds: { excellent: 90, good: 70, moderate: 50 },
  wordCountThresholds: { minimum: 10, excellent: 200 },
  defaultReadingSpeed: 200,
};

export const QUALITY_THRESHOLD = OBLIGATIONS_RULES.qualityThreshold;
export const PROGRESS_THRESHOLDS = OBLIGATIONS_RULES.progressThresholds;
export const WORD_COUNT_THRESHOLDS = OBLIGATIONS_RULES.wordCountThresholds;
export const DEFAULT_READING_SPEED = OBLIGATIONS_RULES.defaultReadingSpeed;
