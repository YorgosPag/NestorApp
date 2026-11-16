/**
 * @fileoverview **Ο ΕΝΑΣ κατασκευαστής συνδέσμου προς εξωτερική εφαρμογή χαρτών** (Google Maps URLs, `api=1`).
 * @related ADR-915 §45.20 (διεύθυνση αυτοψίας στον χώρο του επαγγελματία) · components/crm/inbox/attachment-parts.tsx
 * @module lib/geo/external-map-link
 *
 * 🔑 **Γιατί εξωτερικός και όχι δικός μας χάρτης**: όποιος βλέπει διεύθυνση αυτοψίας θέλει να **πάει** εκεί — διαδρομή
 *    και πλοήγηση, που ο δικός μας χάρτης δεν δίνει. Η μορφή `https://www.google.com/maps/search/?api=1&query=…` είναι
 *    η τεκμηριωμένη, **χωρίς κλειδί**, ίδια σε κάθε πλατφόρμα (στο κινητό ανοίγει την εφαρμογή χαρτών).
 *    📘 https://developers.google.com/maps/documentation/urls/get-started
 * ⚠️ Το `/` πριν από το `?api=1` **δεν** είναι ύφος: χωρίς αυτό, ερώτημα συντεταγμένων έχει αναφερθεί να δίνει 404.
 * ⛔ **Δεν** είναι πηγή πλακιδίων (CHECK 3.95): μόνο σύνδεσμος που ανοίγει σε νέα καρτέλα — κανένα αίτημα από εμάς.
 * 🔑 Ο σύνδεσμος ανοίγει με `rel="noopener noreferrer"` (ο καλών): καμία διαρροή της σελίδας μας στον προορισμό.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, μηδέν I/O.
 */

const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/' as const;

/** Τι ψάχνουμε: γραπτή διεύθυνση **ή** σημείο. */
export type ExternalMapTarget =
  | { readonly kind: 'address'; readonly address: string }
  | { readonly kind: 'point'; readonly lat: number; readonly lng: number };

function queryOf(target: ExternalMapTarget): string | null {
  if (target.kind === 'point') {
    return Number.isFinite(target.lat) && Number.isFinite(target.lng) ? `${target.lat},${target.lng}` : null;
  }
  const address = target.address.trim();
  return address === '' ? null : address;
}

/** Ο σύνδεσμος — ή `null` όταν δεν υπάρχει τίποτα να αναζητηθεί (κενή διεύθυνση · μη πεπερασμένες συντεταγμένες). */
export function externalMapSearchUrl(target: ExternalMapTarget): string | null {
  const query = queryOf(target);
  if (query === null) return null;
  const params = new URLSearchParams({ api: '1', query });
  return `${GOOGLE_MAPS_SEARCH_BASE}?${params.toString()}`;
}
