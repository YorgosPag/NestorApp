/**
 * @fileoverview **ΔΙΑΜΕΣΟΣ** (SSoT για το `src/lib`) — εύρωστο κέντρο και διασπορά.
 * @module lib/statistics/median
 *
 * ⚠️ Το `src/subapps/dxf-viewer/utils/statistics.ts` έχει ίδιο `median`, αλλά το `src/lib` **δεν** εισάγει από subapp
 * (τρέχει σε Worker, διακομιστή, jest). Η ενοποίηση των δύο είναι ανοιχτή πρόταση (ADR-929 §6.9 #15).
 */

/** Διάμεσος· κενό ⇒ 0. Δεν αλλάζει την είσοδο. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Διάμεση απόλυτη απόκλιση από τον διάμεσο (MAD, χωρίς τον συντελεστή 1,4826)· κενό ⇒ 0. */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}
