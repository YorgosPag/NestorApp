/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΦΩΤΟΓΡΑΦΟΥ** (ADR-884 Φ0.5 · §4.5 Κ3α) — πάνω στον κοινό σκελετό.
 *
 * - **Λ** κάθε γλώσσα έχει ΟΛΑ τα λόγια (άγκυρα που εκτελείται).
 * - **Σ** η σειρά: ποιος · ακίνητο · λόγος · «ανεβάζετε έως» **πριν** το κουμπί· «μόνο για αυτή τη διεύθυνση» μετά.
 * - **Δ** ο σύνδεσμος οδηγεί στη σελίδα φωτογράφου· χωρίς δημόσια διεύθυνση ⇒ `null`.
 * - **Ε** escaping: το HTML τιμών είναι ασφαλές, το απλό κείμενο **ωμό** (όχι «&amp;»).
 * - **Κ** αγγελία ιδιώτη / ακίνητο χωρίς όνομα ⇒ ετικέτες, ποτέ κενό ή id.
 */

jest.mock('server-only', () => ({}));

import {
  buildTourCaptureInvitationEmail,
  everyLanguageHasTourCaptureInvitationWording,
  type TourCaptureInvitationEmailInput,
} from '../tour-capture-invitation-email';

const ORIGIN = 'https://nestorconstruct.gr';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = ORIGIN; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

const INPUT: TourCaptureInvitationEmailInput = {
  language: 'el',
  hostName: 'Μεσιτικό Α & Β',
  propertyLabel: 'Διαμέρισμα Α2',
  reason: 'λήψη πριν κλείσουν οι τοίχοι',
  grantExpiresAt: '2026-10-30T12:00:00.000Z',
  expiresAt: '2026-10-03T12:00:00.000Z',
  token: 'tok/+=',
  nowISOValue: '2026-09-26T12:00:00.000Z',
};

const build = (patch: Partial<TourCaptureInvitationEmailInput> = {}) => {
  const email = buildTourCaptureInvitationEmail({ ...INPUT, ...patch });
  if (email === null) throw new Error('αναμενόταν email');
  return email;
};

it('Λ — κάθε γλώσσα έχει ΟΛΑ τα λόγια', () => {
  expect(everyLanguageHasTourCaptureInvitationWording()).toBe(true);
});

it('Σ — ποιος · ακίνητο · λόγος · «έως» ΠΡΙΝ το κουμπί· η δέσμευση παραλήπτη ΜΕΤΑ', () => {
  const { html, text } = build();
  const at = (needle: string) => html.indexOf(needle);
  expect(at('Διαμέρισμα Α2')).toBeGreaterThan(-1);
  expect(at('λήψη πριν κλείσουν οι τοίχοι')).toBeLessThan(at('Δείτε την πρόσκληση'));
  expect(at('30/10/2026')).toBeLessThan(at('Δείτε την πρόσκληση'));
  expect(at('μόνο')).toBeGreaterThan(at('Δείτε την πρόσκληση'));
  expect(text).toContain('Ο σύνδεσμος ισχύει για 7 ημέρες.');
});

it('Δ — ο σύνδεσμος οδηγεί στη σελίδα φωτογράφου (κωδικοποιημένο token)· χωρίς δημόσια διεύθυνση ⇒ null', () => {
  expect(build().text).toContain(`${ORIGIN}/tour-invite/${encodeURIComponent('tok/+=')}`);
  delete process.env.NEXT_PUBLIC_APP_URL;
  expect(buildTourCaptureInvitationEmail(INPUT)).toBeNull();
});

it('Ε — HTML με escape, απλό κείμενο ΩΜΟ', () => {
  const { html, text, subject } = build();
  expect(html).toContain('Μεσιτικό Α &amp; Β');
  expect(text).toContain('Μεσιτικό Α & Β');
  expect(text).not.toContain('&amp;');
  expect(subject).toContain('Μεσιτικό Α & Β');
});

it('Κ — ιδιώτης / ακίνητο χωρίς όνομα ⇒ ετικέτες· αγγλικά ⇒ αγγλικό κείμενο', () => {
  const { text } = build({ hostName: null, propertyLabel: '  ' });
  expect(text).toContain('Ο ιδιοκτήτης σας καλεί');
  expect(text).toContain('της αγγελίας');
  expect(build({ language: 'en' }).text).toContain('invites you to upload 360° panoramas');
});
