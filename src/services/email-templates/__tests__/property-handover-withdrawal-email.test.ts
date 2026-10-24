/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΑΝΑΚΛΗΣΗΣ** (ADR-916 §5.19 Φ-Δ.5) — πάνω στον κοινό σκελετό ενημέρωσης χωρίς πράξη.
 *
 * - **Λ** κάθε γλώσσα έχει ΟΛΑ τα λόγια (άγκυρα που εκτελείται).
 * - **Θ** το θέμα λέει το σπίτι· το «ό,τι παραδόθηκε μένει» λέγεται ΠΡΙΝ από το «τι αλλάζει».
 * - **Κ** κανένα κουμπί, κανένας σύνδεσμος — ούτε στο HTML ούτε στο απλό κείμενο· δουλεύει και χωρίς δημόσια διεύθυνση.
 * - **Ε** τιμές με `&`/`<` φτάνουν ωμές στο κείμενο και escaped στο HTML.
 */

jest.mock('server-only', () => ({}));

import {
  buildPropertyHandoverWithdrawalEmail,
  everyLanguageHasHandoverWithdrawalWording,
} from '../property-handover-withdrawal-email';

const INPUT = { language: 'el', issuerName: 'Κατασκευαστική Α & Β', propertyLabel: 'Διαμέρισμα <Α1>' };

describe('Λ — λόγια σε κάθε γλώσσα', () => {
  it('καμία γλώσσα χωρίς λόγια', () => {
    expect(everyLanguageHasHandoverWithdrawalWording()).toBe(true);
  });
});

describe('Θ — το θέμα και η σειρά', () => {
  it('το θέμα λέει το σπίτι· «μένει» πριν από «αλλάζει»', () => {
    const email = buildPropertyHandoverWithdrawalEmail(INPUT);
    expect(email.subject).toContain('Διαμέρισμα <Α1>');
    expect(email.text.indexOf('παραμένει δικό σας')).toBeGreaterThan(-1);
    expect(email.text.indexOf('παραμένει δικό σας')).toBeLessThan(email.text.indexOf('δεν θα προστίθενται'));
  });

  it('άγνωστη γλώσσα ⇒ προεπιλογή· αγγλικά όταν ζητηθούν', () => {
    expect(buildPropertyHandoverWithdrawalEmail({ ...INPUT, language: 'xx' }).text).toContain('παραμένει');
    expect(buildPropertyHandoverWithdrawalEmail({ ...INPUT, language: 'en' }).text).toContain('remains yours');
  });

  it('χωρίς ονόματα ⇒ ουδέτερη διατύπωση, ποτέ κενό', () => {
    const email = buildPropertyHandoverWithdrawalEmail({ language: 'el', issuerName: null, propertyLabel: null });
    expect(email.text).toContain('Η εταιρεία που σας πούλησε το ακίνητο');
  });
});

describe('Κ — ενημέρωση, όχι πράξη', () => {
  it('κανένας σύνδεσμος και κανένα κουμπί', () => {
    const email = buildPropertyHandoverWithdrawalEmail(INPUT);
    expect(email.text).not.toMatch(/https?:\/\//);
    expect(email.html).not.toMatch(/<a\s/i);
  });
});

describe('Ε — escaping', () => {
  it('ωμό στο κείμενο, escaped στο HTML', () => {
    const email = buildPropertyHandoverWithdrawalEmail(INPUT);
    expect(email.text).toContain('Κατασκευαστική Α & Β');
    expect(email.html).toContain('Κατασκευαστική Α &amp; Β');
    expect(email.html).not.toContain('<Α1>');
  });
});
