/**
 * @fileoverview **Κλειδιά σειράς για ό,τι ζει σε πολλά έγγραφα** — ομάδες, ιδιότητες, κατηγορίες (ADR-923 §5.2).
 * @module components/catalog/shared/catalog-ordering
 *
 * 🔑 Η μετακίνηση γράφει **ένα** έγγραφο: το νέο κλειδί είναι ανάμεσα στα κλειδιά των γειτόνων (`keyBetween`,
 *    Figma/tldraw) — καμία επαναρίθμηση των αδελφών. Οι γείτονες έρχονται από το `SortableList`/`SortableTree`.
 */

import { keyBetween } from '@/lib/ordering/fractional-index';
import type { SortableNeighbors } from '@/components/ui/sortable/sortable-model';

interface Ordered {
  readonly id: string;
  readonly orderKey: string;
}

/** Κλειδί **στο τέλος** μιας ήδη ταξινομημένης λίστας (χωρίς το `excludeId`). */
export function orderKeyAtEnd(sorted: readonly Ordered[], excludeId: string | null = null): string {
  const rest = sorted.filter((item) => item.id !== excludeId);
  return keyBetween(rest[rest.length - 1]?.orderKey ?? null, null);
}

/**
 * Κλειδί ανάμεσα στους γείτονες της μετακίνησης.
 * ⚠️ Γείτονες με **ίσα** κλειδιά (δεδομένα που γράφτηκαν χωρίς τη μηχανή σειράς — π.χ. εισαγωγή) δεν έχουν «ανάμεσα»:
 *    τότε ο κόμβος μπαίνει αμέσως **μετά** τον προηγούμενο. Ποτέ εξαίρεση που θα πάγωνε το σύρσιμο.
 */
export function orderKeyBetween(items: readonly Ordered[], neighbors: SortableNeighbors): string {
  const keyOf = (id: string | null) => (id === null ? null : items.find((item) => item.id === id)?.orderKey ?? null);
  const before = keyOf(neighbors.beforeId);
  const after = keyOf(neighbors.afterId);
  return before !== null && after !== null && before >= after ? keyBetween(before, null) : keyBetween(before, after);
}
