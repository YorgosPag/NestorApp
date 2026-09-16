/**
 * **Οι δηλώσεις ενός παγωμένου κειμένου, κατά id** (ADR-861 §7.3α · ADR-864 Α8β).
 *
 * 🔑 Χωριστό, ελαφρύ module: το χρειάζεται **και** η φόρμα στον browser **και** ο κριτής στον
 * διακομιστή. Ζούσε στον κριτή, που εισάγει το μητρώο εκδόσεων — δηλαδή κάθε έκδοση κάθε
 * εγγράφου θα κατέβαινε στον browser για να μετρηθούν έξι ids.
 *
 * ⚠️ Τα ids είναι **κοινά σε κάθε γλώσσα** (ελέγχεται στο πάγωμα) — διαβάζεται η `el`.
 *
 * @module lib/legal/legal-clauses
 */

import type { FrozenLegalDocument } from '@/lib/legal/frozen-legal-document';

export function clauseIdsOf(frozen: FrozenLegalDocument): readonly string[] {
  return frozen.locales.el.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.kind === 'clause' ? [block.id] : [])),
  );
}
