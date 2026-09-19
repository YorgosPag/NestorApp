/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΝΗΜΑΤΟΣ ΜΕΣΑ ΣΕ ΣΕΛΙΔΑ** — ένας ορισμός για το `id` του DOM **και** το `#` του URL.
 * @related ADR-867 Β7 · §8 #9 (προορισμός ειδοποιήσεων) · ADR-848 (μόνιμος σύνδεσμος)
 * @module lib/network-messaging/thread-anchor
 *
 * 🔑 Το νήμα **δεν έχει δική του σελίδα** — ζει **μέσα** στη σελίδα της πράξης (Follow Up Boss: «Messages»
 * στο προφίλ του lead · Procore: απαντήσεις στη σελίδα του αντικειμένου). Η ειδοποίηση λοιπόν οδηγεί
 * στη σελίδα **και** στο σημείο. Ο ιδιοκτήτης μπορεί να έχει **πολλά** νήματα στην ίδια αγγελία (ένα ανά
 * γραφείο) ⇒ η άγκυρα κουβαλά το **id του νήματος**, όχι σκέτο «#messages».
 *
 * ⚠️ Δύο αντίγραφα της συμβολοσειράς (ένα στον σύνδεσμο, ένα στο `id`) θα απέκλιναν **σιωπηλά**: ο
 * σύνδεσμος θα άνοιγε τη σελίδα και δεν θα έβρισκε ποτέ το νήμα.
 */

const PREFIX = 'network-thread-';

/** Το `id` του στοιχείου που κρατά το νήμα — και το fragment του συνδέσμου. */
export function networkThreadAnchor(threadId: string): string {
  return `${PREFIX}${threadId}`;
}

/** Το fragment όπως γράφεται σε διεύθυνση (`#…`), κωδικοποιημένο. */
export function networkThreadFragment(threadId: string): `#${string}` {
  return `#${encodeURIComponent(networkThreadAnchor(threadId))}`;
}

/** Το νήμα που ζητά η διεύθυνση (`location.hash`) — ή `null` αν δεν ζητά νήμα. */
export function threadIdFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return decoded.startsWith(PREFIX) && decoded.length > PREFIX.length ? decoded.slice(PREFIX.length) : null;
}
