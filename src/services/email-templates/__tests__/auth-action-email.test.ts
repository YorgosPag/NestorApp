/**
 * @jest-environment node
 *
 * @fileoverview **ΤΑ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ** (ADR-851) — άγκυρες.
 * @related services/email-templates/auth-action-email.ts · auth-action-email-texts.ts
 *
 * - **Α** — το δικό μας email μιλά **τη γλώσσα του παραλήπτη**, με το `<html lang>` της.
 * - **Φ** — το πρότυπο της Firebase: όλες οι γλώσσες, η προεπιλεγμένη πρώτη, τα σωστά
 *   placeholders — και **όχι** το θέμα «Επαναφορά κωδικού» πάνω στην αλλαγή email.
 */

jest.mock('server-only', () => ({}));

import { buildAuthActionEmail, buildFirebaseAuthTemplate } from '../auth-action-email';
import { everyLanguageHasAuthActionWording } from '../auth-action-email-texts';

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeAll(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr'; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

const LINK = 'https://nestorconstruct.gr/auth/action?mode=resetPassword&oobCode=abc';

describe('Α — το δικό μας email, στη γλώσσα του παραλήπτη', () => {
  it('Α1 — κάθε γλώσσα έχει ΟΛΑ τα λόγια', () => {
    expect(everyLanguageHasAuthActionWording()).toBe(true);
  });

  it('Α2 — ελληνικά: θέμα με την υπογραφή, `lang="el"`, ο σύνδεσμος, η διεύθυνση', () => {
    const email = buildAuthActionEmail({ kind: 'resetPassword', language: 'el', address: 'maria@example.com', link: LINK });
    expect(email.subject).toBe('Ορισμός νέου κωδικού πρόσβασης — ΝΕΣΤΩΡ');
    expect(email.html).toContain('<html lang="el">');
    expect(email.html).toContain('Ορισμός νέου κωδικού');
    expect(email.html).toContain('maria@example.com');
    expect(email.text).toContain(LINK);
  });

  it('🔑 Α3 — αγγλικά: ΟΛΟ το μήνυμα αγγλικά, και το `<html lang>` το λέει (WCAG 3.1.1)', () => {
    const email = buildAuthActionEmail({ kind: 'verifyEmail', language: 'en', address: 'john@example.com', link: LINK });
    expect(email.subject).toBe('Verify your email address — Nestor');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('Verify email');
    expect(email.html).not.toContain('Επιβεβαίωση');
  });

  it('Α4 — άγνωστη γλώσσα (ή `pseudo`) ⇒ η προεπιλογή, ποτέ `undefined`', () => {
    for (const language of ['xx', undefined, 'pseudo']) {
      const email = buildAuthActionEmail({ kind: 'resetPassword', language, address: 'a@example.com', link: LINK });
      expect(email.html).toContain('<html lang="el">');
    }
  });

  it('🔒 Α5 — η διεύθυνση διαφεύγει (XSS από δεδομένα)', () => {
    const email = buildAuthActionEmail({ kind: 'resetPassword', language: 'el', address: '<script>x</script>@e.com', link: LINK });
    expect(email.html).not.toContain('<script>x</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

describe('Φ — το πρότυπο της Firebase', () => {
  it('🔴 Φ1 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: η ειδοποίηση αλλαγής email ΔΕΝ λέει «Επαναφορά κωδικού»', () => {
    const template = buildFirebaseAuthTemplate('changeEmail');
    expect(template.subject).not.toMatch(/Επαναφορά κωδικού/);
    expect(template.subject).toBe(
      'Η διεύθυνση email του λογαριασμού σας άλλαξε / Your account email address was changed — ΝΕΣΤΩΡ',
    );
  });

  it('Φ2 — η ειδοποίηση αλλαγής ονομάζει τη ΝΕΑ διεύθυνση (`%NEW_EMAIL%`)· οι άλλες τη δική τους', () => {
    expect(buildFirebaseAuthTemplate('changeEmail').body).toContain('%NEW_EMAIL%');
    expect(buildFirebaseAuthTemplate('resetPassword').body).toContain('%EMAIL%');
    expect(buildFirebaseAuthTemplate('resetPassword').body).not.toContain('%NEW_EMAIL%');
  });

  it('🔑 Φ3 — όλες οι γλώσσες, η προεπιλεγμένη ΠΡΩΤΗ, η άλλη δηλωμένη με `lang`', () => {
    const { body } = buildFirebaseAuthTemplate('resetPassword');
    expect(body).toContain('%LINK%');
    expect(body.indexOf('Ορισμός νέου κωδικού')).toBeLessThan(body.indexOf('Set new password'));
    expect(body).toContain('<div lang="en"');
    expect(body).toContain('<html lang="el">');
  });
});
