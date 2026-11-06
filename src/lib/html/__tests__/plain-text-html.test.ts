/**
 * ADR-327 §7.5 — ό,τι γράφει ένας άνθρωπος μπαίνει σε email ΜΟΝΟ escaped, με τις αλλαγές γραμμής του.
 * Ελέγχεται η ΜΙΑ συνάρτηση και κάθε πρότυπο που τη χρησιμοποιεί.
 * ⚠️ Τα 3 πρότυπα του `email-templates.service.ts` ΔΕΝ είναι εδώ: βάζουν ακόμη το μήνυμα ωμό — ανοιχτό,
 *    `.claude-rules/pending-ratchet-work.md` («ΔΥΟ ΔΡΟΜΟΙ ΚΟΙΝΟΠΟΙΗΣΗΣ ΑΚΙΝΗΤΟΥ ΜΕ EMAIL»).
 */

import { buildPhotoShareEmail } from '@/services/email-templates/photo-share';
import { personalNoteBlockHtml } from '@/services/email-templates/personal-note-block';
import { plainTextToHtml } from '../plain-text-html';

const HOSTILE = 'Δείτε εδώ:\n<a href="https://evil.test">σύνδεσμος</a><img src=x onerror=alert(1)>';
const SAFE = 'Δείτε εδώ:<br />&lt;a href=&quot;https://evil.test&quot;&gt;σύνδεσμος&lt;/a&gt;&lt;img src=x onerror=alert(1)&gt;';

describe('plainTextToHtml', () => {
  it('escapes markup and keeps line breaks', () => {
    expect(plainTextToHtml(HOSTILE)).toBe(SAFE);
    expect(plainTextToHtml('α\r\nβ & γ')).toBe('α<br />β &amp; γ');
  });
});

describe('every template that shows a personal message renders it escaped', () => {
  it('photo share', () => {
    const html = buildPhotoShareEmail({ photoUrl: 'https://cdn.test/p.jpg', title: 'Φωτο', personalMessage: HOSTILE, recipientEmail: 'a@b.test' });
    expect(html).toContain(SAFE);
    expect(html).not.toContain('<img src=x');
  });

  it('vendor invite note', () => {
    expect(personalNoteBlockHtml('Μήνυμα', HOSTILE)).toContain(SAFE);
  });
});
