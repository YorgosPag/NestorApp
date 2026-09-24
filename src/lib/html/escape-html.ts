/**
 * HTML text escaping — ΕΝΑ SSoT, **καθαρό** (χωρίς `server-only`), ώστε να το εισάγουν και πρότυπα που
 * τρέχουν σε client (τιμολόγιο) χωρίς αντίγραφο (ADR-877 §6 · CHECK 3.28).
 *
 * Πριν: ζούσε στο `server-only` `base-email-template.ts`, και γι' αυτό τα πρότυπα τιμολογίου και
 * παραγγελίας κρατούσαν **δικό τους** αντίγραφο («inlined — avoid server-only import»).
 *
 * ⚠️ ΟΧΙ `escapeXml` (`lib/xml/escape-xml`): εκείνο γράφει και `'` → `&apos;`, που **δεν** είναι οντότητα
 * της HTML 4 — πελάτες αλληλογραφίας με μηχανή HTML4 (Outlook/Word) το δείχνουν αυτούσιο.
 */

/** Escape HTML special chars to prevent XSS in dynamic content (`& < > "`). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
