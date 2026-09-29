/**
 * @fileoverview **Αναγνώστης σχήματος (`T | null`) → `build` που ΠΕΤΑ** — κοινό για τον διακομιστή
 * (`server-json-file.ts`) και τον περιηγητή (`lazy-json-snapshot.ts`).
 * @module lib/data/json-shape
 *
 * 🔑 Ένα αρχείο παλιού σχήματος καταλήγει στο `onFailure` (και στο `null` = «δεν ξέρω»), ποτέ σε σιωπηλά λάθος
 * στιγμιότυπο. Εξήχθη από το `market-transactions.reader.ts` (δεύτερος καταναλωτής: ζώνες, ADR-889 Φ5) και
 * μετακόμισε από το `server-only` `server-json-file.ts` όταν ήρθε ο πρώτος καταναλωτής **στον περιηγητή**
 * (χάρτης τιμών, ADR-890 §14) — N.0.2. Φύλλο χωρίς εξαρτήσεις.
 */

export function strictJsonShape<T>(read: (payload: unknown) => T | null, what: string): (payload: unknown) => T {
  return (payload) => {
    const value = read(payload);
    if (value === null) throw new TypeError(`${what}: μη αναμενόμενο σχήμα`);
    return value;
  };
}
