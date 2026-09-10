/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΑΠΟΔΟΣΗ ΤΩΝ EMAIL ΕΙΔΟΠΟΙΗΣΕΩΝ, ΜΕ ΣΥΝΔΕΣΜΟΥΣ** (ADR-848)
 *
 * Τα δείγματα είναι **τα πραγματικά** του στιγμιότυπου 2026-09-10: «2 νέες ειδοποιήσεις —
 * ΝΕΣΤΩΡ», δύο γραμμές, **κανένας** σύνδεσμος. Κάθε ισχυρισμός εδώ είναι ένα από τα
 * πράγματα που έλειπαν από εκείνο το email.
 */

jest.mock('server-only', () => ({}));

import {
  NO_LINKS,
  renderDigestHtml,
  renderDigestText,
  renderSoloHtml,
  renderSoloText,
  soleRecipientOf,
  type EmailLinks,
  type RenderableMessage,
} from '@/server/notifications/notification-email-render';

const ORIGIN = 'https://nestorconstruct.gr';

const LINKS: EmailLinks = {
  permalink: (id) => `${ORIGIN}/n/${encodeURIComponent(id)}`,
  preferences: (uid) => `${ORIGIN}/email/preferences/tok-${uid}`,
  oneClickUnsubscribe: (uid) => `${ORIGIN}/api/notifications/email/subscription?t=tok-${uid}`,
};

const MATCH: RenderableMessage = {
  subject: 'Νέα αγγελία ταιριάζει στη ζήτησή σας: «Διαμέρισμα 80 τ.μ.»',
  content: '',
  notificationId: 'listing_match:u1:l1',
  recipientId: 'u1',
};

const INTEREST: RenderableMessage = {
  subject: '1 άνθρωπος ψάχνει ακίνητο σαν το δικό σας',
  content: '',
  notificationId: 'demand_interest:u1:p1',
  recipientId: 'u1',
};

const MATCH_URL = `${ORIGIN}/n/listing_match%3Au1%3Al1`;

// ============================================================================
// Α — Η ΣΥΝΟΨΗ
// ============================================================================

describe('Α — σύνοψη: κάθε γραμμή είναι σύνδεσμος προς ΤΟ ΔΙΚΟ της αντικείμενο', () => {
  const html = renderDigestHtml([MATCH, INTEREST], 'el', '2 νέες ειδοποιήσεις — ΝΕΣΤΩΡ', LINKS);
  const text = renderDigestText([MATCH, INTEREST], 'el', LINKS);

  it('Α1 🔑 — ο ΤΙΤΛΟΣ είναι το κείμενο του συνδέσμου (WebAIM: ποτέ «πάτα εδώ»)', () => {
    expect(html).toMatch(new RegExp(`<a href="${MATCH_URL}"[^>]*>[^<]*Διαμέρισμα 80 τ\\.μ\\.[^<]*</a>`));
    expect(html).toContain(`href="${ORIGIN}/n/demand_interest%3Au1%3Ap1"`);
  });

  it('Α2 — το απλό κείμενο φέρει το ΠΛΗΡΕΣ URL κάτω από κάθε τίτλο', () => {
    const lines = text.split('\n');
    const titleAt = lines.findIndex((line) => line.includes('Διαμέρισμα 80 τ.μ.'));
    expect(lines[titleAt + 1].trim()).toBe(MATCH_URL);
  });

  it('Α3 — υποσέλιδο: «γιατί το λαμβάνω» + διαχείριση, σε HTML ΚΑΙ σε κείμενο', () => {
    expect(html).toContain(`${ORIGIN}/email/preferences/tok-u1`);
    expect(text).toContain(`Διαχείριση ειδοποιήσεων email: ${ORIGIN}/email/preferences/tok-u1`);
  });

  it('Α4 🔴 — δύο λογαριασμοί στην ίδια διεύθυνση ⇒ ΚΑΝΕΝΑΣ σύνδεσμος διαχείρισης', () => {
    // Ένα token για τον πρώτο θα κατάργησε τα email του δεύτερου.
    const foreign: RenderableMessage = { ...INTEREST, recipientId: 'u2' };
    expect(soleRecipientOf([MATCH, foreign])).toBeNull();
    expect(renderDigestHtml([MATCH, foreign], 'el', 'x', LINKS)).not.toContain('/email/preferences/');
  });

  it('Α5 — ειδοποίηση ΧΩΡΙΣ προορισμό δεν γίνεται σύνδεσμος', () => {
    const noDestination: RenderableMessage = { ...INTEREST, notificationId: undefined };
    const rendered = renderDigestHtml([MATCH, noDestination], 'el', 'x', LINKS);
    expect(rendered).toContain('<strong');
    expect(rendered).not.toContain('demand_interest');
  });

  it('Α6 — χωρίς συνδέσμους: κανένα URL πουθενά (η υποβάθμιση είναι το παρελθόν)', () => {
    expect(renderDigestText([MATCH, INTEREST], 'el', NO_LINKS)).not.toContain('https://');
    expect(renderDigestHtml([MATCH, INTEREST], 'el', 'x', NO_LINKS)).not.toContain('href=');
  });
});

// ============================================================================
// Β — ΤΟ ΜΕΜΟΝΩΜΕΝΟ
// ============================================================================

describe('Β — μεμονωμένο: ένα κουμπί που αντέχει το Outlook και το σκοτεινό θέμα', () => {
  const html = renderSoloHtml(MATCH, 'el', `${MATCH.subject} — ΝΕΣΤΩΡ`, LINKS);

  it('Β1 🔑 — κουμπί VML για το Outlook ΚΑΙ <a> για τους υπόλοιπους, προς τον ίδιο προορισμό', () => {
    expect(html).toContain('v:roundrect');
    expect(html.split(`href="${MATCH_URL}"`).length - 1).toBe(2);
    expect(html).toContain('Άνοιγμα στον Νέστορα');
  });

  it('Β2 — στόχος αφής 44px, ρητό φόντο, lang, color-scheme', () => {
    expect(html).toContain('line-height:44px');
    expect(html).toContain('background-color:#1E3A5F');
    expect(html).toContain('<html lang="el">');
    expect(html).toContain('name="color-scheme" content="light dark"');
  });

  it('Β3 — απλό κείμενο: «Άνοιγμα: <URL>» + διαχείριση', () => {
    const text = renderSoloText(MATCH, 'el', LINKS);
    expect(text).toContain(`Άνοιγμα: ${MATCH_URL}`);
    expect(text).toContain('Διαχείριση ειδοποιήσεων email:');
  });

  it('Β4 🔴 — χωρίς συνδέσμους: ΑΚΡΙΒΩΣ το κείμενο πριν το ADR-848', () => {
    // Κενό σώμα ⇒ το θέμα (§8.54). Κανένα υποσέλιδο, καμία γραμμή «Άνοιγμα».
    expect(renderSoloText(MATCH, 'el', NO_LINKS)).toBe(MATCH.subject);
    expect(renderSoloText({ ...MATCH, content: 'Σώμα' }, 'el', NO_LINKS)).toBe('Σώμα');
  });

  it('Β5 — αγγλικά: lang και ετικέτα κουμπιού στη γλώσσα του παραλήπτη', () => {
    const english = renderSoloHtml(MATCH, 'en', 'x', LINKS);
    expect(english).toContain('<html lang="en">');
    expect(english).toContain('Open in Nestor');
  });
});

// ============================================================================
// Γ — ΕΓΧΥΣΗ
// ============================================================================

describe('Γ — κείμενο χρήστη και URL δεν σπάνε ποτέ τη σήμανση', () => {
  it('Γ1 — `<script>` σε θέμα ⇒ escaped, και καμία ετικέτα script στο έγγραφο', () => {
    const hostile: RenderableMessage = { ...MATCH, subject: '<script>alert(1)</script>' };
    const html = renderSoloHtml(hostile, 'el', hostile.subject, LINKS);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<script/i);
  });

  it('Γ2 🔴 — εισαγωγικό μέσα σε URL ΔΕΝ βγαίνει από το href', () => {
    const hostileLinks: EmailLinks = {
      ...LINKS,
      permalink: () => `${ORIGIN}/n/x" onmouseover="alert(1)`,
    };
    const html = renderSoloHtml(MATCH, 'el', 'x', hostileLinks);
    expect(html).not.toContain('" onmouseover="');
    expect(html).toContain('&quot; onmouseover=&quot;');
  });

  it('Γ3 — άδειο σώμα δεν γεννά κενή παράγραφο', () => {
    expect(renderSoloHtml(MATCH, 'el', 'x', LINKS)).not.toMatch(/<p[^>]*>\s*<\/p>/);
  });
});

// ============================================================================
// Δ — ADR-849: Η ΕΤΙΚΕΤΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΕΜΒΕΛΕΙΑ
// ============================================================================

describe('📧 Δ — «Να μη λαμβάνω τέτοια email» ΜΟΝΟ όπου ο σύνδεσμος αφορά έναν τύπο', () => {
  const typedMatch: RenderableMessage = { ...MATCH, eventType: 'properties.demandListingMatch' };

  it('Δ1 — μεμονωμένο με τύπο: η ετικέτα του τύπου, σε HTML ΚΑΙ κείμενο', () => {
    expect(renderSoloHtml(typedMatch, 'el', 'x', LINKS)).toContain('Να μη λαμβάνω τέτοια email');
    expect(renderSoloText(typedMatch, 'en', LINKS)).toContain('Stop emails like this:');
  });

  it('Δ2 🔴 — υποχρεωτικός τύπος ⇒ ΠΟΤΕ «σταμάτα αυτά» (η γενική ετικέτα)', () => {
    const security: RenderableMessage = { ...MATCH, eventType: 'security.newDeviceLogin' };
    expect(renderSoloHtml(security, 'el', 'x', LINKS)).not.toContain('Να μη λαμβάνω τέτοια email');
  });

  it('Δ3 — η σύνοψη κρατά τη γενική ετικέτα — τα ονόματα τύπων τα δείχνει η σελίδα', () => {
    const html = renderDigestHtml([typedMatch, { ...INTEREST, eventType: 'properties.demandInterest' }], 'el', 'x', LINKS);
    expect(html).toContain('Διαχείριση ειδοποιήσεων email');
    expect(html).not.toContain('Να μη λαμβάνω τέτοια email');
  });
});
