/**
 * @fileoverview **ΜΙΑ ΛΙΣΤΑ ΑΠΟ ΠΟΛΛΕΣ ΠΗΓΕΣ, ΣΕ ΣΕΛΙΔΕΣ** — σελιδοποίηση Google AIP-158 πάνω σε αλυσίδα πηγών.
 * @related ADR-904 Κ7 · `page-token.ts` · https://google.aip.dev/158
 * @module lib/api/chained-pages
 *
 * 🔑 **Το πρόβλημα**: μια λίστα («σε ποια ακίνητα μπορώ να ανεβάσω») συντίθεται από **ανεξάρτητα** ερωτήματα (άδειες ·
 * δικές μου αγγελίες · του γραφείου · εταιρικά ακίνητα). Ένα ενιαίο ερώτημα δεν υπάρχει· το «όλα στη μνήμη και κόψε»
 * δεν κλιμακώνεται σε γραφείο με χιλιάδες μονάδες. Λύση: **σειρά πηγών**, και η θέση = (πηγή, δρομέας μέσα της).
 *
 * 📏 **Κανόνες (AIP-158)**: σελίδα **≤** `pageSize` — **επιτρέπεται μικρότερη** ακόμη κι αν υπάρχουν κι άλλα (η πηγή μπορεί
 * να κρίνει και να αφήσει έξω στοιχεία)· το τέλος δηλώνεται **μόνο** με κενό `nextPageToken`.
 *
 * ⏱️ **Φραγμένο κόστος**: το πολύ **μία** ανάγνωση ανά πηγή ανά αίτημα. Πηγή που δεν εξαντλήθηκε ⇒ η σελίδα κλείνει εκεί·
 * εξαντλημένη ⇒ η επόμενη πηγή συμπληρώνει. Ποτέ βρόχος «μέχρι να γεμίσει» (απρόβλεπτη καθυστέρηση στο κινητό).
 *
 * **Layering**: leaf — κανένα I/O εδώ· οι πηγές φέρνουν τα δικά τους.
 */

import { decodePageToken, encodePageToken } from './page-token';

/** Μία σελίδα μιας πηγής. `after: null` ⇒ η πηγή **εξαντλήθηκε**. */
export interface SourcePage<T> {
  readonly items: readonly T[];
  readonly after: string | null;
}

/** Μια πηγή της αλυσίδας — το `id` γράφεται στο token, άρα είναι **σταθερό** (μετονομασία = σπασμένα tokens). */
export interface PageSource<T> {
  readonly id: string;
  read(after: string | null, limit: number): Promise<SourcePage<T>>;
}

/** Η θέση στην αλυσίδα: από ποια πηγή συνεχίζουμε, και από πού μέσα της (`null` ⇒ από την αρχή της). */
export interface ChainPosition {
  readonly source: string;
  readonly after: string | null;
}

export interface ChainedPage<T> {
  readonly items: readonly T[];
  /** Κενό ⇒ τέλος της λίστας (AIP-158: ο **μόνος** τρόπος να ειπωθεί). */
  readonly nextPageToken: string;
}

export function encodeChainPosition(position: ChainPosition): string {
  return encodePageToken(position.after === null ? { s: position.source } : { s: position.source, a: position.after });
}

/** `null` ⇒ χαλασμένο token **ή** πηγή που δεν υπάρχει πια — ο καλών απαντά 400, ποτέ «πρώτη σελίδα» σιωπηλά. */
export function decodeChainPosition(raw: string, sourceIds: readonly string[]): ChainPosition | null {
  const fields = decodePageToken(raw, ['s'], ['a']);
  if (fields === null || !sourceIds.includes(fields.s)) return null;
  return { source: fields.s, after: fields.a ?? null };
}

/** **Μία σελίδα της αλυσίδας**, από τη θέση `from` (`null` ⇒ αρχή). Το `size` είναι ήδη κριμένο (> 0). */
export async function readChainedPage<T>(
  sources: readonly PageSource<T>[],
  from: ChainPosition | null,
  size: number,
): Promise<ChainedPage<T>> {
  const startIndex = from === null ? 0 : sources.findIndex((source) => source.id === from.source);
  if (startIndex === -1) throw new Error(`unknown page source "${from?.source ?? ''}"`);
  const items: T[] = [];
  let after = from?.after ?? null;
  for (let index = startIndex; index < sources.length; index += 1) {
    const source = sources[index];
    const page = await source.read(after, size - items.length);
    items.push(...page.items);
    if (page.after !== null) return { items, nextPageToken: encodeChainPosition({ source: source.id, after: page.after }) };
    after = null;
    const next = sources[index + 1];
    if (items.length >= size) {
      return { items, nextPageToken: next === undefined ? '' : encodeChainPosition({ source: next.id, after: null }) };
    }
  }
  return { items, nextPageToken: '' };
}
