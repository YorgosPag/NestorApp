/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΑΓΟΡΑΣΤΗ** (ADR-916 Φ-Β · Δ7) — πάνω στον κοινό σκελετό.
 *
 * - **Λ** κάθε γλώσσα έχει ΟΛΑ τα λόγια (άγκυρα που εκτελείται).
 * - **Θ** το θέμα λέει το σπίτι· η ολοκλήρωση λέει «έτοιμος»· η υπενθύμιση σημαίνεται.
 * - **Σ** στοιχεία ΠΡΙΝ το κουμπί, «μόνο για αυτή τη διεύθυνση» ΜΕΤΑ.
 * - **Δ** ο σύνδεσμος οδηγεί στο `/handover-invite/`· χωρίς δημόσια διεύθυνση ⇒ `null`.
 */

jest.mock('server-only', () => ({}));

import {
  buildPropertyHandoverInvitationEmail,
  everyLanguageHasHandoverInvitationWording,
  type PropertyHandoverInvitationEmailInput,
} from '../property-handover-invitation-email';

const ORIGIN = 'https://nestorconstruct.gr';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = ORIGIN; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

const INPUT: PropertyHandoverInvitationEmailInput = {
  language: 'el',
  issuerName: 'Κατασκευαστική Α & Β',
  propertyLabel: 'Διαμέρισμα Δ3',
  occasion: 'reservation',
  reminder: false,
  expiresAt: '2026-11-18T10:00:00.000Z',
  token: 'tok/+=',
};

const build = (patch: Partial<PropertyHandoverInvitationEmailInput> = {}) => {
  const email = buildPropertyHandoverInvitationEmail({ ...INPUT, ...patch });
  if (email === null) throw new Error('αναμενόταν email');
  return email;
};

describe('ADR-916 Φ-Β — το email της πρόσκλησης αγοραστή', () => {
  it('Λ — κάθε γλώσσα έχει όλα τα λόγια', () => {
    expect(everyLanguageHasHandoverInvitationWording()).toBe(true);
  });

  it('Θ — το θέμα λέει το σπίτι· η ολοκλήρωση λέει «έτοιμος»· η υπενθύμιση σημαίνεται', () => {
    expect(build().subject).toContain('Διαμέρισμα Δ3');
    expect(build().subject).not.toContain('έτοιμος');
    expect(build({ occasion: 'completion' }).subject).toContain('έτοιμος');
    expect(build({ reminder: true }).subject).toContain('Υπενθύμιση');
    expect(build({ language: 'en', occasion: 'completion' }).subject).toContain('ready');
  });

  it('Σ — στοιχεία ΠΡΙΝ το κουμπί, «μόνο για αυτή τη διεύθυνση» ΜΕΤΑ', () => {
    const { text } = build();
    const button = text.indexOf('Αποδοχή του φακέλου');
    expect(button).toBeGreaterThan(0);
    expect(text.indexOf('Κατασκευαστική Α & Β')).toBeLessThan(button);
    expect(text.indexOf('Τι θα βρείτε')).toBeLessThan(button);
    expect(text.indexOf('μόνο για αυτή τη διεύθυνση')).toBeGreaterThan(button);
  });

  it('Δ — ο σύνδεσμος οδηγεί στη σελίδα αγοραστή· χωρίς δημόσια διεύθυνση ⇒ κανένα email', () => {
    expect(build().text).toContain(`${ORIGIN}/handover-invite/${encodeURIComponent('tok/+=')}`);
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildPropertyHandoverInvitationEmail(INPUT)).toBeNull();
  });

  it('χωρίς ονόματα ⇒ τα λόγια της γλώσσας, ποτέ κενό ή «null»', () => {
    const { text } = build({ issuerName: null, propertyLabel: null });
    expect(text).not.toContain('null');
    expect(text).toContain('Η εταιρεία που σας πούλησε το ακίνητο');
  });

  it('το αποτέλεσμα ΔΕΝ φέρει συνημμένα · HTML ασφαλές, απλό κείμενο ωμό', () => {
    const email = build();
    expect(Object.keys(email).sort()).toEqual(['html', 'subject', 'text']);
    expect(email.html).toContain('Α &amp; Β');
    expect(email.text).toContain('Α & Β');
  });
});
