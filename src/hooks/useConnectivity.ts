'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useFirestoreStatus } from '@/hooks/useFirestoreStatus';

/**
 * **«Φτάνουν οι εγγραφές μου στον server αυτή τη στιγμή;»** — η ΜΙΑ απάντηση (ADR-367 §2.7).
 *
 * Δύο σήματα, γιατί κανένα δεν αρκεί μόνο του:
 * - `navigator.onLine` λέει ψέματα προς τα πάνω («lie-fi»: κάρτα δικτύου συνδεδεμένη, χωρίς
 *   internet) αλλά είναι **άμεσο** όταν κοπεί το καλώδιο.
 * - Το κανάλι του Firestore είναι η **αλήθεια** για το δικό μας backend, αλλά το καταλαβαίνει
 *   με καθυστέρηση (timeout του stream).
 *
 * Ήταν γραμμένο δύο φορές (`procurement/quotes`, `procurement/rfqs/[id]`) — N.0.2.
 */
export function useConnectivity(): boolean {
  const isOnline = useOnlineStatus();
  const isFirestoreConnected = useFirestoreStatus();
  return isOnline && isFirestoreConnected;
}
