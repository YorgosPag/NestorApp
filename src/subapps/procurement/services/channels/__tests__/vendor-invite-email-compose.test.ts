/**
 * ADR-327 §7.5 — το email πρόσκλησης όπως το λαμβάνει ο προμηθευτής (Ε2 · Ε3 · Ε1).
 * Ο ΙΔΙΟΣ composer τρέχει στην αποστολή και στην προεπισκόπηση, άρα εδώ ελέγχεται και τι βλέπει ο αγοραστής.
 */

import type { VendorInviteMessage } from '../types';
import { composeVendorInviteEmail } from '../vendor-invite-email-compose';

function message(overrides: Partial<VendorInviteMessage> = {}): VendorInviteMessage {
  return {
    inviteId: 'vi_1',
    vendorName: 'Ηλεκτρική Α.Ε.',
    recipient: 'vendor@example.test',
    rfqTitle: 'Καλώδια Β΄ φάσης',
    projectName: 'Πολυκατοικία Λάρισας',
    portalUrl: 'https://app.test/q#tok',
    expiresAt: '2026-11-20T21:59:59.999Z',
    responseDueAt: null,
    buyerNote: null,
    locale: 'el',
    declineUrl: 'https://app.test/d#tok',
    ...overrides,
  };
}

describe('Ε2 — αίτημα προσφοράς «X» για το έργο Y', () => {
  it('names the RFQ as the request and the project as the project — never the RFQ title as «the project»', () => {
    const { subject, html, text } = composeVendorInviteEmail(message());
    expect(subject).toBe('Αίτημα προσφοράς: Καλώδια Β΄ φάσης — Πολυκατοικία Λάρισας');
    expect(html).toContain('αίτημα προσφοράς «<strong>Καλώδια Β΄ φάσης</strong>» για το έργο <strong>Πολυκατοικία Λάρισας</strong>.');
    expect(text).toContain('Σας έχει σταλεί αίτημα προσφοράς «Καλώδια Β΄ φάσης» για το έργο Πολυκατοικία Λάρισας.');
  });

  it('without a project the project line disappears from subject, HTML and text', () => {
    const { subject, html, text } = composeVendorInviteEmail(message({ projectName: null }));
    expect(subject).toBe('Αίτημα προσφοράς: Καλώδια Β΄ φάσης');
    expect(html).not.toContain('για το έργο');
    expect(text).toContain('Σας έχει σταλεί αίτημα προσφοράς «Καλώδια Β΄ φάσης».');
  });

  it('the English invite follows the same structure', () => {
    const { subject, html } = composeVendorInviteEmail(message({ locale: 'en' }));
    expect(subject).toBe('Quote request: Καλώδια Β΄ φάσης — Πολυκατοικία Λάρισας');
    expect(html).toContain('for the project <strong>Πολυκατοικία Λάρισας</strong>');
  });

  it('escapes project and RFQ titles', () => {
    const { html } = composeVendorInviteEmail(message({ rfqTitle: '<b>x</b>', projectName: 'A & B' }));
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('A &amp; B');
  });
});

describe('Ε3 — ο χαιρετισμός', () => {
  it('greets by name when there is one', () => {
    expect(composeVendorInviteEmail(message()).text.startsWith('Γεια σας Ηλεκτρική Α.Ε.,')).toBe(true);
  });

  it('without a name it is neutral and formal — in both languages', () => {
    expect(composeVendorInviteEmail(message({ vendorName: null })).text.startsWith('Αξιότιμοι κύριοι/κυρίες,')).toBe(true);
    expect(composeVendorInviteEmail(message({ vendorName: null, locale: 'en' })).text.startsWith('Dear Sir or Madam,')).toBe(true);
  });
});

describe('Ε1 — σημείωμα αγοραστή και προθεσμία', () => {
  it('the note appears escaped, line breaks kept, under its own heading — in HTML and text', () => {
    const { html, text } = composeVendorInviteEmail(message({ buyerNote: 'Γραμμή 1\n<script>alert(1)</script>' }));
    expect(html).toContain('Μήνυμα από τον αποστολέα');
    expect(html).toContain('Γραμμή 1<br />&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(text).toContain('Μήνυμα από τον αποστολέα:\nΓραμμή 1\n<script>alert(1)</script>');
  });

  it('no note ⇒ no note box', () => {
    const { html, text } = composeVendorInviteEmail(message({ buyerNote: null }));
    expect(html).not.toContain('Μήνυμα από τον αποστολέα');
    expect(text).not.toContain('Μήνυμα από τον αποστολέα');
  });

  it('the RFQ deadline appears only when it exists', () => {
    expect(composeVendorInviteEmail(message()).text).not.toContain('Προθεσμία υποβολής');
    const { html, text } = composeVendorInviteEmail(message({ responseDueAt: '2026-11-18T10:00:00.000Z' }));
    expect(html).toContain('Προθεσμία υποβολής προσφορών');
    expect(text).toMatch(/Προθεσμία υποβολής προσφορών: 18\/11\/2026/);
  });

  it('the link, expiry and anti-phishing warning are always system text', () => {
    const { html, text } = composeVendorInviteEmail(message({ buyerNote: 'κάτι' }));
    expect(html).toContain('href="https://app.test/q#tok"');
    expect(text).toContain('Σύνδεσμος: https://app.test/q#tok');
    expect(text).toContain('Ο σύνδεσμος λήγει στις:');
    expect(text).toContain('Αυτός ο σύνδεσμος είναι προσωπικός');
  });
});
