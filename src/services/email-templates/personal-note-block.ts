/**
 * @fileoverview **ΤΟ ΠΡΟΣΩΠΙΚΟ ΣΗΜΕΙΩΜΑ ΜΕΣΑ ΣΕ EMAIL — ΜΙΑ απόδοση** (ADR-327 §7.5).
 * @module services/email-templates/personal-note-block
 *
 * Ο άνθρωπος γράφει **απλό κείμενο**· εδώ γίνεται σήμανση, με **escape** και αλλαγές γραμμής → `<br />`.
 * Ποτέ HTML από τον χρήστη, ποτέ αυτόματοι σύνδεσμοι: το σημείωμα φεύγει από το domain της πλατφόρμας
 * (anti-phishing, ADR-327 §11) και η επικεφαλίδα λέει ρητά ότι **δεν** είναι λόγια του συστήματος.
 *
 * ⚠️ Μέχρι σήμερα το ίδιο μπλοκ ζει τοπικά σε τέσσερα σημεία (`email-templates.service.ts` ×3 — **χωρίς**
 * escape — · `photo-share.ts`). Η μεταφορά τους εδώ είναι **ξεχωριστή** εργασία, μόνο με εντολή.
 */

import 'server-only';

import { BRAND, escapeHtml } from './base-email-template';

/** Το σημείωμα μετά από trim· κενό ⇒ `null` (δεν αποδίδεται πλαίσιο). */
export function normalizePersonalNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** HTML του σημειώματος — `''` όταν δεν υπάρχει. Escaped, `\n` → `<br />`. */
export function personalNoteBlockHtml(heading: string, note: string | null | undefined): string {
  const body = normalizePersonalNote(note);
  if (body === null) return '';
  const paragraphs = escapeHtml(body).replace(/\r?\n/g, '<br />');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    <td style="background-color:${BRAND.bgLight};border-left:3px solid ${BRAND.accent};padding:16px 20px;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${BRAND.grayLight};text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(heading)}</p>
      <p style="margin:0;font-size:14px;color:${BRAND.gray};line-height:1.6;">${paragraphs}</p>
    </td>
  </tr>
</table>`;
}

/** Το ίδιο σημείωμα για το text/plain — `''` όταν δεν υπάρχει· τελειώνει με μία κενή γραμμή. */
export function personalNoteBlockText(heading: string, note: string | null | undefined): string {
  const body = normalizePersonalNote(note);
  return body === null ? '' : `${heading}:\n${body}\n`;
}
