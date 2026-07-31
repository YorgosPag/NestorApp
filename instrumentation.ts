/**
 * Next.js instrumentation hook (runs once per runtime at server start).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 *
 * Δύο ανεξάρτητες ευθύνες:
 *
 * 1. **React 19.2.1 dev-mode guard** — `describeNode` bug: indent-- → -1 → repeat(-1)
 *    → RangeError. Browser-side patched in public/react-bugfix-guards.js; server
 *    SSR/RSC renderer hits the same code path and needs the same guard.
 *
 * 2. **Αρχικοποίηση Sentry ανά runtime** (ADR-739). Στο `@sentry/nextjs` v8+ τα αρχεία
 *    `sentry.server.config.ts` / `sentry.edge.config.ts` **δεν φορτώνονται μόνα τους**:
 *    το `withSentryConfig()` στο `next.config.js` ρυθμίζει build-time πράγματα (source
 *    maps, webpack plugin) — δεν κάνει runtime init. Ο μόνος μηχανισμός είναι αυτό εδώ
 *    το `register()`.
 *
 *    ⚠️ Μέχρι 2026-07-31 το import έλειπε. Αποτέλεσμα: το client SDK δούλευε (φορτώνεται
 *    από το bundle), ενώ **ο server δεν έστελνε τίποτα** — ούτε σφάλματα API routes, ούτε
 *    cron check-ins. Το `NEXT_PUBLIC_SENTRY_DSN` ήταν συμπληρωμένο και ο πίνακας του
 *    Sentry έδειχνε γεγονότα, άρα η σιωπή του server ήταν **αόρατη**: κοιτούσες ένα
 *    ζωντανό dashboard και συμπέραινες ότι η τηλεμετρία δουλεύει. Μην αφαιρέσεις το
 *    import — ο dead-man's switch του ADR-739 κρέμεται από αυτό.
 */
export async function register(): Promise<void> {
  const origRepeat = String.prototype.repeat;
  String.prototype.repeat = function (count: number): string {
    if (typeof count === 'number' && count < 0) return '';
    return origRepeat.call(this, count);
  };

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Αναφορά σφαλμάτων από server components / route handlers στο Sentry.
 * Το Next.js 15 καλεί αυτό το hook· χωρίς αυτό τα nested React server errors χάνονται.
 */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
