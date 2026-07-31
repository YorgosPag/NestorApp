/**
 * =============================================================================
 * SENTRY CONFIGURATION — SSoT for all Sentry init parameters
 * =============================================================================
 *
 * Shared across sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts.
 * Change values HERE — all 3 runtimes pick them up automatically.
 *
 * @module config/sentry-config
 * @enterprise ADR-259D — Production Readiness Audit
 */

/**
 * DSN για **και τα τρία** runtimes.
 *
 * Ο DSN του Sentry **δεν είναι μυστικό** — ταξιδεύει ήδη στο client bundle· είναι
 * διεύθυνση παραλαβής, όχι διαπιστευτήριο. Γι' αυτό το `NEXT_PUBLIC_SENTRY_DSN` είναι
 * θεμιτό fallback και όχι έκπτωση ασφάλειας.
 *
 * ⚠️ Γιατί υπάρχει το fallback (ADR-740): τα `sentry.server.config.ts` /
 * `sentry.edge.config.ts` διάβαζαν **μόνο** `SENTRY_DSN`, ενώ το
 * `.github/workflows/docker-build.yml` περνά μόνο `NEXT_PUBLIC_SENTRY_DSN`. Αν το
 * `SENTRY_DSN` δεν είναι ορισμένο στο Netcup, ο server αρχικοποιούσε το SDK **χωρίς
 * DSN** — δηλαδή σιωπηλά no-op. Συνδυασμένο με το απόν import στο `instrumentation.ts`,
 * η τηλεμετρία του server ήταν διπλά νεκρή ενώ ο πίνακας του Sentry έδειχνε γεγονότα
 * από τον browser. **Ένας ζωντανός πίνακας δεν αποδεικνύει ότι ο server μιλάει.**
 */
export const SENTRY_DSN =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

/** 10% performance sampling (sufficient for error detection, minimal overhead) */
export const SENTRY_TRACES_SAMPLE_RATE = 0.1;

/** Only send errors in production */
export const SENTRY_ENABLED = process.env.NODE_ENV === 'production';

/** Session replay: disabled for privacy */
export const SENTRY_REPLAYS_SESSION_SAMPLE_RATE = 0;

/** 50% replay capture on error (for debugging) */
export const SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE = 0.5;
