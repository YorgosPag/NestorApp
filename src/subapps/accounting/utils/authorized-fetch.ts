/**
 * Αυθεντικοποιημένο `fetch` προς τα API routes του accounting — **ΕΝΑ** σημείο
 * που ξέρει πώς μπαίνει το bearer token.
 *
 * 🔑 **Γιατί υπάρχει**: το μοτίβο
 * `const token = await user.getIdToken(); fetch(url, { headers: { Authorization: ... } })`
 * ήταν γραμμένο **33 φορές** μέσα στο `src/subapps/accounting/`. Δεν ήταν στιλ:
 * το CHECK 3.28 (jscpd, token-based) το μετρά ως **πραγματικό κλώνο** και
 * μπλοκάρει κάθε commit που σταδιοποιεί δύο τέτοια αρχεία μαζί.
 *
 * ⚠️ **ΔΕΝ κρίνει το `res.ok` — και είναι ΑΠΟΦΑΣΗ, όχι παράλειψη.** Οι δύο
 * πρώτοι καταναλωτές έχουν **αντίθετη** σημασιολογία σφάλματος: το
 * `EditInvoicePageContent` κάνει `throw` σε μη-ok (δείχνει μήνυμα σφάλματος),
 * ενώ το `InvoiceDetails` το **αγνοεί σιωπηλά** (κρατά την προηγούμενη προβολή).
 * Ένας βοηθός που «απλοποιεί» επιβάλλοντας μία από τις δύο θα άλλαζε **ζωντανή
 * συμπεριφορά** σε μια αλλαγή που υποτίθεται ότι αφαιρεί μόνο διπλοτυπία.
 * Επιστρέφει το `Response` **αυτούσιο**· ο καλών κρατά την ετυμηγορία του.
 *
 * ⚠️ Τα `headers` του `init` **μπαίνουν πρώτα** ώστε το `Authorization` να μην
 * μπορεί να παρακαμφθεί κατά λάθος από τον καλούντα.
 *
 * 🔶 **Μένουν 31 ακόμη σημεία** με το ίδιο μοτίβο (apy-certificates, documents,
 * dashboard, dialogs, forms). Μεταναστεύουν με τον κανόνα του προσκόπου, όταν
 * τα ακουμπήσει κάποιος — καταγεγραμμένα στο `.claude-rules/pending-ratchet-work.md`.
 *
 * @module subapps/accounting/utils/authorized-fetch
 */

import type { User } from 'firebase/auth';

export async function authorizedFetch(
  user: User,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}
