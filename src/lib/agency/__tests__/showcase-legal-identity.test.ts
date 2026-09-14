/**
 * @fileoverview Άγκυρες του **κριτή της νομικής ταυτότητας της βιτρίνας** — ADR-841 §7 Α23 (Δ5–Δ7).
 * @related lib/agency/showcase-legal-identity.ts
 *
 * 🔴 Οι άγκυρες που μετρούν περισσότερο:
 *   • **Ο1/Ο3** — το όνομα είναι του προφίλ ή του ΓΕΜΗ, και ο τίτλος **μόνο** του ΓΕΜΗ.
 *   • **Ε1** — ατομική/ΟΕ **χωρίς προεπιλογή** έδρας (GDPR 25(2)).
 *   • **Ε3** — `municipality` δεν διαρρέει **ούτε ένα γράμμα** της οδού.
 */

import {
  declarationOfStored,
  defaultSeatDisclosure,
  reresolveShowcaseLegalIdentity,
  resolveShowcaseLegalIdentity,
  type LegalIdentityInputs,
  type LegalIdentityResolution,
} from '@/lib/agency/showcase-legal-identity';
import { REGISTRY_CHECKED_AT, registryCheck } from '@/lib/company/__fixtures__/registry-record-fixture';
import { COMPANY_PROFILE } from '@/services/mandate/__tests__/showcase-legal-fixture';
import type { RegistryCompanyRecord } from '@/types/company-registry';
import type { ShowcaseLegalDeclaration, ShowcaseLegalIdentity } from '@/types/showcase-legal-identity';

const LEGAL_NAME: ShowcaseLegalDeclaration = { publicName: { kind: 'legal-name' }, seatDisclosure: null };

function inputs(
  overrides: Partial<LegalIdentityInputs> = {},
  record: Partial<RegistryCompanyRecord> | null = {},
): LegalIdentityInputs {
  return {
    declaration: { entityType: 'ae', businessName: COMPANY_PROFILE.businessName, gemiNumber: COMPANY_PROFILE.gemiNumber },
    seat: { address: COMPANY_PROFILE.address, city: COMPANY_PROFILE.city, postalCode: COMPANY_PROFILE.postalCode },
    stored:
      record === null
        ? { kind: 'absent' }
        : { kind: 'present', check: registryCheck(record) },
    headquarters: { street: 'Τσιμισκή', number: '12', postalCode: '54624' },
    ...overrides,
  };
}

function resolved(result: LegalIdentityResolution): { identity: ShowcaseLegalIdentity; displayName: string } {
  if ('reason' in result) throw new Error(`Περίμενα ταυτότητα, πήρα άρνηση ${result.reason}`);
  return result;
}

function reasonOf(result: LegalIdentityResolution): string | null {
  return 'reason' in result ? result.reason : null;
}

describe('Ο — το ΟΝΟΜΑ λύνεται από τον διακομιστή', () => {
  it('🔑 Ο1 — επαληθευμένη: επωνυμία ΜΕ ΤΗΝ ΟΡΘΟΓΡΑΦΙΑ ΤΟΥ ΓΕΜΗ, σήμα με ημερομηνία ελέγχου', () => {
    const { identity, displayName } = resolved(resolveShowcaseLegalIdentity(inputs(), LEGAL_NAME));

    expect(displayName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
    expect(identity).toEqual({
      publicName: 'legal-name',
      legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
      legalForm: 'ae',
      gemiNumber: '123456789000',
      seat: { disclosure: 'full', streetLine: 'Σαμοθράκης 16', postalCode: '54248', locality: 'Θεσσαλονίκη' },
      attestation: { state: 'verified', issuer: 'gemi', checkedAt: REGISTRY_CHECKED_AT },
      registryClosure: null,
    });
  });

  it('🔴 Ο2 — χωρίς απάντηση μητρώου: επωνυμία του ΠΡΟΦΙΛ, σήμα `declared` — ποτέ «επαληθευμένη»', () => {
    const { identity, displayName } = resolved(resolveShowcaseLegalIdentity(inputs({}, null), LEGAL_NAME));

    expect(displayName).toBe(COMPANY_PROFILE.businessName);
    expect(identity.attestation).toEqual({ state: 'declared' });
  });

  it('🔴 Ο3 — διακριτικός τίτλος: ΜΟΝΟ του ΓΕΜΗ, με την ορθογραφία του μητρώου (τόνοι/πεζά δεν μετρούν)', () => {
    const choice: ShowcaseLegalDeclaration = {
      publicName: { kind: 'distinctive-title', title: 'Παγώνης Κατασκευαστική' },
      seatDisclosure: null,
    };

    const { identity, displayName } = resolved(resolveShowcaseLegalIdentity(inputs(), choice));

    expect(displayName).toBe('ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ');
    expect(identity.publicName).toBe('distinctive-title');
    // Η επωνυμία ΜΕΝΕΙ στη νομική ταυτότητα — ο τίτλος δεν την αντικαθιστά (schema.org `name` ≠ `legalName`).
    expect(identity.legalName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
  });

  it.each([
    ['τίτλος που δεν υπάρχει στο ΓΕΜΗ', inputs(), 'ΔΟΚΙΜΑΣΤΙΚΟ ΓΡΑΦΕΙΟ Ο1-Ο9'],
    ['κανένας έλεγχος ΓΕΜΗ', inputs({}, null), 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ'],
    ['απάντηση για ΑΛΛΟΝ αριθμό', inputs({}, { registrationNumber: '555555555000' }), 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ'],
    ['άγνωστη κατάσταση μητρώου', inputs({}, { status: { code: null, activity: 'unknown' } }), 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ'],
    ['κενός τίτλος', inputs(), '   '],
  ])('🔴 Ο4 — %s ⇒ title-not-in-registry', (_label, given, title) => {
    const choice: ShowcaseLegalDeclaration = { publicName: { kind: 'distinctive-title', title }, seatDisclosure: null };

    expect(reasonOf(resolveShowcaseLegalIdentity(given, choice))).toBe('agency-profile-title-not-in-registry');
  });

  it('🏆 Ο5 — ο τίτλος δένεται με τον ΑΡΙΘΜΟ: επωνυμία γραμμένη αλλιώς ρίχνει το σήμα, ΟΧΙ τον τίτλο', () => {
    const given = inputs({ declaration: { entityType: 'ae', businessName: 'ΑΛΛΗ ΓΡΑΦΗ Α.Ε.', gemiNumber: '123456789000' } });
    const choice: ShowcaseLegalDeclaration = {
      publicName: { kind: 'distinctive-title', title: 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ' },
      seatDisclosure: null,
    };

    const { identity, displayName } = resolved(resolveShowcaseLegalIdentity(given, choice));

    expect(displayName).toBe('ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ');
    expect(identity.legalName).toBe('ΑΛΛΗ ΓΡΑΦΗ Α.Ε.');
    expect(identity.attestation).toEqual({ state: 'declared' });
  });

  it.each([
    ['κανένα προφίλ', inputs({ declaration: null, seat: null })],
    ['προφίλ χωρίς επωνυμία', inputs({ declaration: { entityType: 'ae', businessName: null, gemiNumber: null } })],
  ])('🔴 Ο6 — %s ⇒ name-missing', (_label, given) => {
    expect(reasonOf(resolveShowcaseLegalIdentity(given, LEGAL_NAME))).toBe('agency-profile-name-missing');
  });

  it('🔴 Ο7 — ΑΝΕΝΕΡΓΗ στο ΓΕΜΗ ⇒ ταυτότητα ΜΕ κλείσιμο (πηγή + ημερομηνία), σήμα `declared` — ΟΧΙ άρνηση (Φ3.2)', () => {
    const given = inputs({}, { status: { code: { id: '9', label: 'Διαγραμμένη' }, activity: 'inactive' } });

    const { identity } = resolved(resolveShowcaseLegalIdentity(given, LEGAL_NAME));

    expect(identity.registryClosure).toEqual({ issuer: 'gemi', checkedAt: REGISTRY_CHECKED_AT });
    expect(identity.attestation).toEqual({ state: 'declared' });
    // 🔴 Ίδια επωνυμία ⇒ ορθογραφία του ΜΗΤΡΩΟΥ: το κλείσιμο δεν μετονομάζει (Google κρατά το όνομα).
    expect(identity.legalName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
  });

  it('🔑 Ο7γ — κλειστή με ΑΛΛΗ επωνυμία στο προφίλ ⇒ η επωνυμία του ΠΡΟΦΙΛ (το μητρώο δεν τη στηρίζει)', () => {
    const given = inputs(
      { declaration: { entityType: 'ae', businessName: 'ΑΛΛΗ ΕΠΩΝΥΜΙΑ Α.Ε.', gemiNumber: '123456789000' } },
      { status: { code: null, activity: 'inactive' } },
    );

    expect(resolved(resolveShowcaseLegalIdentity(given, LEGAL_NAME)).identity.legalName).toBe('ΑΛΛΗ ΕΠΩΝΥΜΙΑ Α.Ε.');
  });

  it('🔑 Ο7α — κλειστή κρατά τον ΤΙΤΛΟ της: ανήκει στην εγγραφή του αριθμού', () => {
    const given = inputs({}, { status: { code: null, activity: 'inactive' } });
    const choice: ShowcaseLegalDeclaration = {
      publicName: { kind: 'distinctive-title', title: 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ' },
      seatDisclosure: null,
    };

    expect(resolved(resolveShowcaseLegalIdentity(given, choice)).displayName).toBe('ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ');
  });

  it.each([
    ['ενεργή', inputs()],
    ['άγνωστη κατάσταση', inputs({}, { status: { code: null, activity: 'unknown' } })],
    ['κανένας έλεγχος', inputs({}, null)],
    ['απάντηση για ΑΛΛΟΝ αριθμό, ανενεργή', inputs({}, { registrationNumber: '555555555000', status: { code: null, activity: 'inactive' } })],
  ])('🔴 Ο7β — %s ⇒ `registryClosure: null` (κλείσιμο ΜΟΝΟ για αυτόν τον αριθμό)', (_label, given) => {
    expect(resolved(resolveShowcaseLegalIdentity(given, LEGAL_NAME)).identity.registryClosure).toBeNull();
  });

  it('🔑 Ο8 — ελεύθερος επαγγελματίας χωρίς ΓΕΜΗ: δημοσιεύει με επωνυμία, `gemiNumber: null`, `declared`', () => {
    const given = inputs({ declaration: { entityType: 'sole_proprietor', businessName: 'Γ. Παγώνης', gemiNumber: null } }, null);
    const choice: ShowcaseLegalDeclaration = { publicName: { kind: 'legal-name' }, seatDisclosure: 'municipality' };

    const { identity } = resolved(resolveShowcaseLegalIdentity(given, choice));

    expect(identity.gemiNumber).toBeNull();
    expect(identity.attestation).toEqual({ state: 'declared' });
  });
});

describe('Ε — η ΕΔΡΑ: πόση δημοσιεύεται (Δ7)', () => {
  it.each([
    ['sole_proprietor', null],
    ['oe', null],
    ['epe', 'full'],
    ['ae', 'full'],
    [null, null],
  ] as const)('🔴 Ε1 — μορφή «%s» ⇒ προεπιλογή %s', (legalForm, expected) => {
    expect(defaultSeatDisclosure(legalForm)).toBe(expected);
  });

  it.each(['sole_proprietor', 'oe'] as const)('🔴 Ε1α — %s ΧΩΡΙΣ ρητή επιλογή ⇒ seat-disclosure-missing', (entityType) => {
    const given = inputs({ declaration: { entityType, businessName: 'Γ. Παγώνης', gemiNumber: null } }, null);

    expect(reasonOf(resolveShowcaseLegalIdentity(given, LEGAL_NAME))).toBe('agency-profile-seat-disclosure-missing');
  });

  it('🔑 Ε2 — business-address: οδός της ΚΑΡΤΑΣ, δήμος του ΓΕΜΗ όταν επαληθεύτηκε', () => {
    const choice: ShowcaseLegalDeclaration = { publicName: { kind: 'legal-name' }, seatDisclosure: 'business-address' };

    expect(resolved(resolveShowcaseLegalIdentity(inputs(), choice)).identity.seat).toEqual({
      disclosure: 'business-address',
      streetLine: 'Τσιμισκή 12',
      postalCode: '54624',
      locality: 'ΘΕΣΣΑΛΟΝΙΚΗΣ',
    });
    // Χωρίς επαλήθευση ο δήμος είναι η πόλη του προφίλ — ποτέ του ΓΕΜΗ που δεν ταίριαξε.
    expect(resolved(resolveShowcaseLegalIdentity(inputs({}, null), choice)).identity.seat.locality).toBe('Θεσσαλονίκη');
  });

  it('🔴 Ε3 — municipality: ΟΥΤΕ ΕΝΑ γράμμα οδού ή Τ.Κ. στο αποτέλεσμα', () => {
    const choice: ShowcaseLegalDeclaration = { publicName: { kind: 'legal-name' }, seatDisclosure: 'municipality' };

    const { identity } = resolved(resolveShowcaseLegalIdentity(inputs(), choice));

    expect(identity.seat).toEqual({ disclosure: 'municipality', streetLine: null, postalCode: null, locality: 'ΘΕΣΣΑΛΟΝΙΚΗΣ' });
    const serialized = JSON.stringify(identity);
    for (const leak of ['Σαμοθράκης', '54248', 'Τσιμισκή', '54624']) expect(serialized).not.toContain(leak);
  });

  it.each([
    ['full χωρίς διεύθυνση στο προφίλ', inputs({ seat: { address: null, city: 'Θεσσαλονίκη', postalCode: null } }), 'full'],
    ['business-address χωρίς οδό στην κάρτα', inputs({ headquarters: null }), 'business-address'],
    ['municipality χωρίς κανέναν δήμο', inputs({ seat: null }, null), 'municipality'],
  ] as const)('🔴 Ε4 — %s ⇒ seat-address-missing', (_label, given, seatDisclosure) => {
    const choice: ShowcaseLegalDeclaration = { publicName: { kind: 'legal-name' }, seatDisclosure };

    expect(reasonOf(resolveShowcaseLegalIdentity(given, choice))).toBe('agency-profile-seat-address-missing');
  });
});

describe('Α — η ανανέωση ξαναλύνει την ΙΔΙΑ επιλογή', () => {
  it.each([
    ['επωνυμία', { publicName: { kind: 'legal-name' }, seatDisclosure: 'business-address' }],
    ['τίτλος', { publicName: { kind: 'distinctive-title', title: 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ' }, seatDisclosure: 'municipality' }],
  ] as const)('🔑 Α1 — %s: αποθηκευμένη ταυτότητα ⇒ ίδια επιλογή ⇒ ίδια ταυτότητα (ιδεμποτής)', (_label, choice) => {
    const first = resolved(resolveShowcaseLegalIdentity(inputs(), choice));

    const again = resolveShowcaseLegalIdentity(inputs(), declarationOfStored(first.identity, first.displayName));

    expect(again).toEqual(first);
  });

  const TITLE: ShowcaseLegalDeclaration = {
    publicName: { kind: 'distinctive-title', title: 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ' },
    seatDisclosure: null,
  };

  it.each([
    ['το ΓΕΜΗ αφαίρεσε τον τίτλο', inputs({}, { distinctiveTitles: [] })],
    ['ο αριθμός «δεν υπάρχει» πια (αντίγραφο σβήστηκε)', inputs({}, null)],
  ])('🔴 Α2 — %s ⇒ όνομα = ΕΠΩΝΥΜΙΑ, επιλογή `legal-name` (Stripe · GBP)', (_label, later) => {
    const first = resolved(resolveShowcaseLegalIdentity(inputs(), TITLE));

    const again = resolved(reresolveShowcaseLegalIdentity(later, first.identity, first.displayName));

    expect(again.identity.publicName).toBe('legal-name');
    expect(again.displayName).toBe(again.identity.legalName);
  });

  it('🔑 Α3 — ΜΟΝΟ ο τίτλος υποχωρεί: σβησμένη επωνυμία μένει άρνηση (καμία επινόηση)', () => {
    const first = resolved(resolveShowcaseLegalIdentity(inputs(), TITLE));
    const later = inputs({ declaration: { entityType: 'ae', businessName: null, gemiNumber: '123456789000' } });

    expect(reasonOf(reresolveShowcaseLegalIdentity(later, first.identity, first.displayName))).toBe(
      'agency-profile-name-missing',
    );
  });
});
