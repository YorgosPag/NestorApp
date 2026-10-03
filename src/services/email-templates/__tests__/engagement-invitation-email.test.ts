/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΥΠΟΘΕΣΗΣ** (ADR-901 Φ3 · §5.6) — πάνω στον κοινό σκελετό.
 *
 * - **Λ** κάθε γλώσσα έχει ΟΛΑ τα λόγια (άγκυρα που εκτελείται).
 * - **Σ** η σειρά §5.6: ποιος/ρόλος/ακίνητο · τι ζητείται · τι θα βρείτε **πριν** το κουμπί· «μόνο για αυτή τη διεύθυνση» μετά.
 * - **Δ** ο σύνδεσμος οδηγεί στο `/case-invite/`· χωρίς δημόσια διεύθυνση ⇒ `null`.
 * - **Α5** καμία μέτρηση που δεν διαβάστηκε (όχι ψεύτικο «0»)· ο σκελετός δεν φέρει πεδίο συνημμένων.
 */

jest.mock('server-only', () => ({}));

import {
  buildEngagementInvitationEmail,
  everyLanguageHasEngagementInvitationWording,
  type EngagementInvitationEmailInput,
} from '../engagement-invitation-email';

const ORIGIN = 'https://nestorconstruct.gr';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = ORIGIN; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

const INPUT: EngagementInvitationEmailInput = {
  language: 'el',
  role: 'notary',
  hostName: 'Κατασκευαστική Α & Β',
  propertyLabel: 'Διαμέρισμα Δ3',
  checklist: { applicable: 12, complete: 5, missing: 7 },
  expiresAt: '2026-10-17T10:00:00.000Z',
  token: 'tok/+=',
};

const build = (patch: Partial<EngagementInvitationEmailInput> = {}) => {
  const email = buildEngagementInvitationEmail({ ...INPUT, ...patch });
  if (email === null) throw new Error('αναμενόταν email');
  return email;
};

describe('ADR-901 §5.6 — το email της πρόσκλησης υπόθεσης', () => {
  it('Λ — κάθε γλώσσα έχει όλα τα λόγια', () => {
    expect(everyLanguageHasEngagementInvitationWording()).toBe(true);
  });

  it('το θέμα λέει ρόλο ΚΑΙ ακίνητο (διαβάζεται χωρίς άνοιγμα)', () => {
    expect(build().subject).toContain('συμβολαιογράφο');
    expect(build().subject).toContain('Διαμέρισμα Δ3');
    expect(build({ language: 'en' }).subject).toContain('the notary');
  });

  it('Σ — στοιχεία ΠΡΙΝ το κουμπί, «μόνο για αυτή τη διεύθυνση» ΜΕΤΑ', () => {
    const { text } = build();
    const button = text.indexOf('Αποδοχή και πρόσβαση στην υπόθεση');
    expect(text.indexOf('Κατασκευαστική Α & Β')).toBeLessThan(button);
    expect(text.indexOf('12 δικαιολογητικά')).toBeLessThan(button);
    expect(text.indexOf('Τι σας ζητείται')).toBeLessThan(button);
    expect(text.indexOf('μόνο για αυτή τη διεύθυνση')).toBeGreaterThan(button);
  });

  it('Δ — ο σύνδεσμος οδηγεί στη σελίδα υπόθεσης· χωρίς δημόσια διεύθυνση ⇒ κανένα email', () => {
    expect(build().text).toContain(`${ORIGIN}/case-invite/${encodeURIComponent('tok/+=')}`);
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildEngagementInvitationEmail(INPUT)).toBeNull();
  });

  it('Α5 — κατάλογος που δεν διαβάστηκε ⇒ η γραμμή ΠΑΡΑΛΕΙΠΕΤΑΙ, ποτέ «0 δικαιολογητικά»', () => {
    expect(build({ checklist: null }).text).not.toMatch(/δικαιολογητικά για τον ρόλο σας/);
  });

  it('Α5 — το αποτέλεσμα ΔΕΝ φέρει συνημμένα (μόνο θέμα · html · κείμενο)', () => {
    expect(Object.keys(build()).sort()).toEqual(['html', 'subject', 'text']);
  });

  it('escaping — HTML ασφαλές, απλό κείμενο ωμό', () => {
    const email = build();
    expect(email.html).toContain('Α &amp; Β');
    expect(email.text).toContain('Α & Β');
  });
});
