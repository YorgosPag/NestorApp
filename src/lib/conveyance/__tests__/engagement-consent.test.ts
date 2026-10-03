/**
 * ADR-901 Φ2 §5.2 — άγκυρες της συναίνεσης («δύο κλειδιά») και της εμβέλειας τεκμηρίων για συμμετέχοντα.
 *
 * Μεταλλάξεις που πρέπει να κοκκινίσουν:
 *   (α) ο δικηγόρος αγοραστή περνά ΧΩΡΙΣ δηλωμένη βάση · (β) ο συμβολαιογράφος παίρνει μόνο τη μία πλευρά ·
 *   (γ) η πλευρά του οικοδεσπότη ζητά δήλωση · (δ) WIP μηχανικού γίνεται τεκμήριο νομικού ελέγχου ·
 *   (ε) μη αναγνώσιμη φάση περνά.
 */

import { decideEngagedEvidenceReach } from '@/lib/auth/container-access';
import { isContainerVisible } from '@/types/container-access';
import { planConsents, requiresAttestation } from '../engagement-consent';

const AT = '2026-10-03T10:00:00.000Z';

describe('ADR-901 §5.2 — «δύο κλειδιά»', () => {
  it('δικηγόρος πωλητή: η δική μας πλευρά, καμία δήλωση', () => {
    expect(requiresAttestation('seller_lawyer')).toBe(false);
    const plan = planConsents('seller_lawyer', null, 'u_host', AT);
    expect(plan).toEqual({ ok: true, consents: [{ side: 'seller', source: 'own_side', basis: 'own_side', attestedBy: 'u_host', attestedAt: AT }] });
  });

  it('(α) δικηγόρος αγοραστή ΧΩΡΙΣ βάση ⇒ άρνηση με όνομα', () => {
    expect(requiresAttestation('buyer_lawyer')).toBe(true);
    expect(planConsents('buyer_lawyer', null, 'u_host', AT)).toEqual({ ok: false, rejection: 'consent-basis-required' });
  });

  it('(α) η βάση «own_side» ΔΕΝ δηλώνεται για την άλλη πλευρά', () => {
    expect(planConsents('buyer_lawyer', 'own_side', 'u_host', AT)).toEqual({ ok: false, rejection: 'consent-basis-required' });
  });

  it('(β) συμβολαιογράφος: ΚΑΙ οι δύο πλευρές — η μία δική μας, η άλλη δηλωμένη με βάση', () => {
    const plan = planConsents('notary', 'preliminary_contract', 'u_host', AT);
    expect(plan.ok && plan.consents.map((c) => `${c.side}:${c.source}:${c.basis}`)).toEqual([
      'seller:own_side:own_side',
      'buyer:host_attested:preliminary_contract',
    ]);
  });
});

describe('ADR-901 Φ2 — εμβέλεια τεκμηρίων για νομικό (`decideEngagedEvidenceReach`)', () => {
  const visible = (phase: Parameters<typeof decideEngagedEvidenceReach>[1]) =>
    isContainerVisible(decideEngagedEvidenceReach('legal', phase));

  it('pre-cde (η συντριπτική πλειοψηφία των ζωντανών αρχείων) ⇒ ορατό: η υπόθεση ΕΙΝΑΙ το μοίρασμα', () => {
    expect(visible('pre-cde')).toBe(true);
  });

  it('PUBLISHED ⇒ ορατό', () => {
    expect(visible('PUBLISHED')).toBe(true);
  });

  it('(δ) WIP · SHARED · SUPERSEDED ⇒ ΑΟΡΑΤΟ — ποτέ ημιτελής μελέτη ως τεκμήριο', () => {
    expect(visible('WIP')).toBe(false);
    expect(visible('SHARED')).toBe(false);
    expect(visible('SUPERSEDED')).toBe(false);
  });

  it('(ε) μη αναγνώσιμη φάση ⇒ fail-closed', () => {
    expect(visible('unreadable')).toBe(false);
  });

  it('η απαίτηση ομάδας ΔΕΝ παρακάμπτεται: ακόμη και ο μελετητής δεν βλέπει WIP μέσω υπόθεσης', () => {
    expect(isContainerVisible(decideEngagedEvidenceReach('design', 'WIP'))).toBe(false);
  });
});
