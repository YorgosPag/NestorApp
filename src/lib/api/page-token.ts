/**
 * @fileoverview **ΤΟ ΑΔΙΑΦΑΝΕΣ PAGE TOKEN** — η θέση της σελίδας στο σύρμα (Google AIP-158).
 * @related ADR-904 Κ7 · ADR-867 Β9β (`thread-directory`) · https://google.aip.dev/158
 * @module lib/api/page-token
 *
 * 🔑 **Αδιαφανές, όχι μυστικό.** Το AIP-158 ζητά token που ο πελάτης **δεν** αναλύει (για να αλλάζει ελεύθερα το εσωτερικό
 * του). Base64url ενός JSON με σύντομα κλειδιά: ο πελάτης το μεταφέρει αυτούσιο. **Δεν υπογράφεται, επίτηδες**: κάθε
 * χρήση του εδώ ξανακρίνει **κάθε** στοιχείο της σελίδας με τον κριτή του — ένα πειραγμένο token μετακινεί τον
 * πελάτη μόνο **μέσα** στη δική του λίστα. Όπου ένα token **δίνει πρόσβαση**, η μηχανή είναι το `lib/tokens/signed-token`.
 *
 * 🔴 **Χαλασμένο token ⇒ `null` ⇒ 400 — ΠΟΤΕ «πρώτη σελίδα» σιωπηλά**: η οθόνη θα έδειχνε διπλά στοιχεία.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα I/O.
 */

/** **Πεδία → token.** Μόνο κείμενο: ό,τι άλλο θα χρειαζόταν κανόνα σειριοποίησης που ο αναγνώστης θα όφειλε να ξέρει. */
export function encodePageToken(fields: Readonly<Record<string, string>>): string {
  return Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
}

/**
 * **Token → πεδία**, ή `null` αν λείπει **οποιοδήποτε** υποχρεωτικό κλειδί ή αν ένα δηλωμένο κλειδί δεν είναι μη κενό
 * κείμενο. Τα **προαιρετικά** μπορούν να λείπουν· τα αδήλωτα αγνοούνται (ένα παλαιότερο token με επιπλέον πεδίο δεν σπάει).
 */
export function decodePageToken<K extends string, O extends string = never>(
  raw: string,
  required: readonly K[],
  optional: readonly O[] = [],
): (Readonly<Record<K, string>> & Readonly<Partial<Record<O, string>>>) | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const source = parsed as Readonly<Record<string, unknown>>;
  const out: Record<string, string> = {};
  for (const key of [...required, ...optional]) {
    const value = source[key];
    if (value === undefined && (optional as readonly string[]).includes(key)) continue;
    if (typeof value !== 'string' || value.length === 0) return null;
    out[key] = value;
  }
  return out as Readonly<Record<K, string>> & Readonly<Partial<Record<O, string>>>;
}
