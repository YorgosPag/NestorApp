/**
 * **Απλό κείμενο ανθρώπου → ασφαλές HTML** — ΕΝΑ σημείο, **καθαρό** (χωρίς `server-only`), ώστε να το εισάγουν
 * και πρότυπα που φορτώνει ο browser (`email-templates.service.ts` ⇐ `TemplateSelector`).
 *
 * Κανόνας (OWASP · contextual output encoding): ό,τι γράφει ένας άνθρωπος (προσωπικό μήνυμα, σημείωμα) μπαίνει
 * σε email **μόνο** escaped, τη στιγμή της απόδοσης — ποτέ με «καθάρισμα» μαύρης λίστας στην είσοδο, που
 * αφήνει `<a href>`/`<img>` να περάσουν. Οι αλλαγές γραμμής του ανθρώπου κρατιούνται ως `<br />`.
 *
 * Το χρησιμοποιούν: σημείωμα πρόσκλησης RFQ · photo-share (πριν χωρίς αλλαγές γραμμής) · intro του showcase (πριν
 * αντίγραφο). ⚠️ Τα 3 πρότυπα του `email-templates.service.ts` βάζουν ακόμη το μήνυμα **ωμό** — ανοιχτό, βλ.
 * `.claude-rules/pending-ratchet-work.md`. ADR-327 §7.5.
 */

import { escapeHtml } from './escape-html';

/** Escape `& < > "` και `\n` → `<br />`. */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br />');
}
