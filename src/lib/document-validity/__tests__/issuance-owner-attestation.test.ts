/**
 * ADR-915 §45.15 (1β-γ) — **το τεκμήριο ιδιοκτητών**: ο κανόνας (ίδιο σύνολο · ψηφίο ελέγχου · διόρθωση ίση με το τρέχον
 * = επιβεβαίωση), το σύνορο του σώματος, η μάσκα, και ο μειωτής (μόνο ο σύνδεσμος που ΕΓΚΡΙΝΕΙ κρατά τεκμήριο).
 */

import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import {
  maskedVatTail,
  ownerAttestationOf,
  pendingVatCorrectionsOf,
  type IssuanceOwnerAttestation,
} from '@/lib/document-validity/issuance-owner-attestation';
import { issuanceLinkAnswerBody } from '@/lib/document-validity/issuance-request';

/** Έγκυρα κατά mod-11 (υπολογισμένα), και ένα με λάθος ψηφίο ελέγχου. */
const VAT_A = '090000045';
const VAT_B = '123456783';
const VAT_C = '998877666';
const VAT_BAD = '123456789';

const CURRENT = new Map<string, string | null>([['cont_a', VAT_A], ['cont_b', null]]);

describe('ADR-915 §45.15 — ownerAttestationOf', () => {
  it('«Σωστά» ⇒ το ΤΡΕΧΟΝ ΑΦΜ της επαφής μπαίνει στο στιγμιότυπο (ο πελάτης δεν το στέλνει ποτέ)', () => {
    expect(ownerAttestationOf({
      owners: [{ contactId: 'cont_b', verdict: 'confirmed', vatNumber: null }, { contactId: 'cont_a', verdict: 'confirmed', vatNumber: null }],
      missingNote: null,
    }, CURRENT)).toEqual({
      // Η σειρά του μητρώου, όχι του πελάτη.
      owners: [{ contactId: 'cont_a', verdict: 'confirmed', vatNumber: VAT_A }, { contactId: 'cont_b', verdict: 'confirmed', vatNumber: null }],
      missingNote: null,
    });
  });

  it('διόρθωση ⇒ το νέο ΑΦΜ κανονικοποιημένο· διόρθωση ΙΣΗ με το τρέχον ⇒ επιβεβαίωση (καμία ψεύτικη απόκλιση)', () => {
    const attested = ownerAttestationOf({
      owners: [{ contactId: 'cont_a', verdict: 'corrected', vatNumber: ' 090 000 045 ' }, { contactId: 'cont_b', verdict: 'corrected', vatNumber: VAT_B }],
      missingNote: '  Λείπει ένας κληρονόμος  ',
    }, CURRENT);
    expect(attested).toEqual({
      owners: [{ contactId: 'cont_a', verdict: 'confirmed', vatNumber: VAT_A }, { contactId: 'cont_b', verdict: 'corrected', vatNumber: VAT_B }],
      missingNote: 'Λείπει ένας κληρονόμος',
    });
  });

  it('🔴 λάθος ψηφίο ελέγχου ⇒ `vat-invalid`, τίποτα στο στιγμιότυπο', () => {
    expect(ownerAttestationOf({
      owners: [{ contactId: 'cont_a', verdict: 'confirmed', vatNumber: null }, { contactId: 'cont_b', verdict: 'corrected', vatNumber: VAT_BAD }],
      missingNote: null,
    }, CURRENT)).toBe('vat-invalid');
  });

  it.each([
    ['λείπει ιδιοκτήτης', [{ contactId: 'cont_a', verdict: 'confirmed' as const, vatNumber: null }]],
    ['ξένο πρόσωπο', [
      { contactId: 'cont_a', verdict: 'confirmed' as const, vatNumber: null },
      { contactId: 'cont_x', verdict: 'confirmed' as const, vatNumber: null },
    ]],
    ['διπλή κρίση', [
      { contactId: 'cont_a', verdict: 'confirmed' as const, vatNumber: null },
      { contactId: 'cont_a', verdict: 'confirmed' as const, vatNumber: null },
    ]],
  ])('🔴 %s ⇒ `owners-changed` (ποτέ τεκμήριο για όσους δεν είδε)', (_label, owners) => {
    expect(ownerAttestationOf({ owners, missingNote: null }, CURRENT)).toBe('owners-changed');
  });

  it('1β-γ-2 — εκκρεμεί ΜΟΝΟ η διόρθωση που η επαφή δεν έχει· άγνωστη επαφή ⇒ καμία κρίση (ποτέ ψεύτικη εκκρεμότητα)', () => {
    const attestation = {
      owners: [
        { contactId: 'cont_a', verdict: 'confirmed' as const, vatNumber: VAT_A },
        { contactId: 'cont_b', verdict: 'corrected' as const, vatNumber: VAT_B },
        { contactId: 'cont_c', verdict: 'corrected' as const, vatNumber: VAT_C },
        { contactId: 'cont_d', verdict: 'corrected' as const, vatNumber: VAT_A },
      ],
      missingNote: null,
    };
    const current: Readonly<Record<string, string | null>> = { cont_a: VAT_C, cont_b: '123 456 783', cont_c: null };
    const pending = pendingVatCorrectionsOf(attestation, (id) => (id in current ? current[id] : undefined));
    // cont_a: επιβεβαίωση (ποτέ εκκρεμότητα) · cont_b: ίδιο κανονικοποιημένο · cont_d: δεν διαβάστηκε.
    expect(pending.map((owner) => owner.contactId)).toEqual(['cont_c']);
    expect(pendingVatCorrectionsOf(null, () => null)).toEqual([]);
  });

  it('μάσκα: μόνο τα τελευταία ψηφία', () => {
    expect(maskedVatTail(VAT_C)).toBe('666');
    expect(maskedVatTail('998 877 666')).toBe('666');
  });
});

describe('ADR-915 §45.15 — το σώμα του «Εγκρίνω»', () => {
  const base = { answer: 'approve', note: null, accessCode: null, quoteRevision: 1 };

  it('παλιά σελίδα χωρίς τεκμήριο ⇒ `ownerAttestation: null`', () => {
    expect(issuanceLinkAnswerBody.parse(base)).toMatchObject({ ownerAttestation: null });
  });

  it('🔴 διόρθωση με λάθος ψηφίο ελέγχου ⇒ το σύνορο αρνείται (400 πριν από κάθε ανάγνωση)', () => {
    const body = { ...base, ownerAttestation: { owners: [{ contactId: 'cont_a', verdict: 'corrected', vatNumber: VAT_BAD }], missingNote: null } };
    expect(issuanceLinkAnswerBody.safeParse(body).success).toBe(false);
  });

  it('«Σωστά» χωρίς ΑΦΜ + κενή σημείωση ⇒ δεκτό, η σημείωση γίνεται `null`', () => {
    const body = { ...base, ownerAttestation: { owners: [{ contactId: 'cont_a', verdict: 'confirmed' }], missingNote: '   ' } };
    expect(issuanceLinkAnswerBody.parse(body)).toMatchObject({
      ownerAttestation: { owners: [{ contactId: 'cont_a', verdict: 'confirmed', vatNumber: null }], missingNote: null },
    });
  });
});

describe('ADR-915 §45.15 — ο μειωτής κρατά το τεκμήριο ΜΟΝΟ από τον σύνδεσμο που εγκρίνει', () => {
  const NOW = '2026-10-17T09:00:00.000Z';
  const OFFICE: IssuanceActor = { kind: 'office', uid: 'uid_agent', nowIso: NOW };
  const LINK: IssuanceActor = { kind: 'link', invitationId: 'diin_1', verifiedBy: 'link', nowIso: NOW };
  const ATTESTED: IssuanceOwnerAttestation = { owners: [{ contactId: 'cont_lead', verdict: 'corrected', vatNumber: VAT_B }], missingNote: null };
  const STEPS: readonly IssuanceAction[] = [
    { kind: 'propose', professionalContactId: 'cont_pro', credential: { qualification: 'energy-inspector-registered', registryNumber: null } },
    { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: null },
    {
      kind: 'quote',
      terms: { basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null },
    },
    { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_lead', note: null, verification: 'link' },
  ];

  function quoted(): IssuanceAssignmentRecord {
    let record: IssuanceAssignmentRecord | null = null;
    for (const action of STEPS) {
      const reduced = reduceIssuance('energy-certificate', record, null, action, OFFICE);
      if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
      record = reduced.record;
    }
    if (record === null) throw new Error('no record');
    return record;
  }

  const decide = (outcome: 'approved' | 'rejected', channel: 'phone' | null): IssuanceAction => ({
    kind: 'decide', outcome, channel, note: null, ownerContactId: 'cont_lead', quoteRevision: 1, ownerAttestation: ATTESTED,
  });

  it('σύνδεσμος + «Εγκρίνω» ⇒ το τεκμήριο στην απόφαση', () => {
    const reduced = reduceIssuance('energy-certificate', quoted(), null, decide('approved', null), LINK);
    expect(reduced.ok && reduced.record.decision?.ownerAttestation).toEqual(ATTESTED);
  });

  it.each([
    ['σύνδεσμος + «Δεν εγκρίνω»', decide('rejected', null), LINK],
    ['καταγραφή του γραφείου', decide('approved', 'phone'), OFFICE],
  ])('🔴 %s ⇒ `ownerAttestation: null` (το βεβαιώνει μόνο ο ίδιος ο ιδιοκτήτης, μόνο όταν εγκρίνει)', (_label, action, actor) => {
    const reduced = reduceIssuance('energy-certificate', quoted(), null, action, actor);
    expect(reduced.ok && reduced.record.decision?.ownerAttestation).toBeNull();
  });
});
