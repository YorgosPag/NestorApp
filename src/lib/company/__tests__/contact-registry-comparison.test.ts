/**
 * @fileoverview Άγκυρες της **σύγκρισης επαφής ⇄ ΓΕΜΗ ανά πεδίο** — ADR-948 §8 Βήμα 2β.
 *
 * 🔴 Τα σενάρια που φυλάνε: «διαφορά» εκεί όπου απλώς δεν συγκρίνεται (υποκατάστημα αλλοδαπής, κατάσταση
 * χωρίς λέξη στην επαφή, κωδικός που άλλαξε νόημα) · ίδια τιμή σε άλλη γραφή που βγαίνει «διαφορά»
 * (Τ.Κ. «546 24», «Α.Ε.», αριθμός με μηδενικά) · πρόταση «Δέξου» που δεν είναι στη γλώσσα της επαφής.
 */

import { registryRecord } from '@/lib/company/__fixtures__/registry-record-fixture';
import {
  compareContactWithRegistry,
  type ContactRegistryFields,
  type EntityVerdict,
} from '@/lib/company/contact-registry-comparison';
import { classifyRegistryLegalForm } from '@/lib/company/registry-legal-person';
import type { RegistryCompanyRecord } from '@/types/company-registry';

function entity(id: string, label: string): EntityVerdict {
  const verdict = classifyRegistryLegalForm({ id, label });
  if (verdict.kind !== 'entity') throw new Error(`fixture: ${id} δεν είναι οντότητα`);
  return verdict;
}

const AE = entity('1', 'ΑΕ');

const record = (overrides: Partial<RegistryCompanyRecord> = {}): RegistryCompanyRecord =>
  registryRecord({ legalForm: { id: '1', label: 'ΑΕ' }, ...overrides });

const contact = (overrides: Partial<ContactRegistryFields> = {}): ContactRegistryFields => ({
  companyName: 'ΠΑΓΩΝΗΣ Α.Ε.',
  tradeName: 'Παγώνης Κατασκευαστική',
  gemiNumber: '123 456 789 000',
  legalForm: 'ae',
  gemiStatus: 'active',
  headquarters: { street: 'Σαμοθράκης', number: '16', postalCode: '542 48', city: 'Θεσσαλονίκη' },
  ...overrides,
});

describe('Α — όλα ίδια σε άλλη γραφή ⇒ match', () => {
  it('Α1 — κάθε πεδίο match, η έδρα ανά μέρος match', () => {
    const result = compareContactWithRegistry(contact(), record(), AE);
    expect(result.legalName.state).toBe('match');
    expect(result.distinctiveTitle.state).toBe('match');
    expect(result.gemiNumber).toEqual({ state: 'match', contact: '123 456 789 000', registry: '123456789000' });
    expect(result.legalForm).toEqual({ state: 'match', contact: 'ae', registry: 'ae' });
    expect(result.status).toEqual({ state: 'match', contact: 'active', registry: 'active' });
    expect(result.seat.state).toBe('match');
    expect(result.seat.parts).toEqual({ street: 'match', number: 'match', postalCode: 'match', city: 'match' });
  });
});

describe('Β — κενή επαφή ⇒ missing, με πρόταση στη γλώσσα της επαφής', () => {
  it('Β1 — κάθε πεδίο κενό ⇒ missing', () => {
    const empty = contact({ companyName: ' ', tradeName: null, gemiNumber: '', legalForm: null, gemiStatus: '', headquarters: null });
    const result = compareContactWithRegistry(empty, record(), AE);
    expect(result.legalName).toEqual({ state: 'missing', contact: null, registry: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ' });
    expect(result.distinctiveTitle.registry).toBe('ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ');
    expect(result.gemiNumber.state).toBe('missing');
    expect(result.legalForm).toEqual({ state: 'missing', contact: null, registry: 'ae' });
    expect(result.status).toEqual({ state: 'missing', contact: null, registry: 'active' });
    expect(result.seat.state).toBe('missing');
    expect(result.seat.contact).toBeNull();
  });

  it('Β2 — έδρα με κενό μόνο τον Τ.Κ. ⇒ missing (κανένα μέρος δεν διαφέρει)', () => {
    const hq = { street: 'Σαμοθράκης', number: '16', postalCode: null, city: 'Θεσσαλονίκη' };
    const result = compareContactWithRegistry(contact({ headquarters: hq }), record(), AE);
    expect(result.seat.state).toBe('missing');
    expect(result.seat.parts.postalCode).toBe('missing');
  });
});

describe('Γ — διαφορετικές τιμές ⇒ differs', () => {
  it('Γ1 — άλλη επωνυμία, άλλος αριθμός, άλλη μορφή, άλλη κατάσταση', () => {
    const other = contact({ companyName: 'ΑΛΦΑ ΕΠΕ', gemiNumber: '999', legalForm: 'epe', gemiStatus: 'dissolved' });
    const result = compareContactWithRegistry(other, record(), AE);
    expect(result.legalName.state).toBe('differs');
    expect(result.gemiNumber.state).toBe('differs');
    expect(result.legalForm).toEqual({ state: 'differs', contact: 'epe', registry: 'ae' });
    expect(result.status).toEqual({ state: 'differs', contact: 'dissolved', registry: 'active' });
  });

  it('Γ2 — μη αριθμός ΓΕΜΗ στην επαφή ⇒ differs, πρόταση ο κανονικός', () => {
    const result = compareContactWithRegistry(contact({ gemiNumber: 'abc' }), record(), AE);
    expect(result.gemiNumber).toEqual({ state: 'differs', contact: 'abc', registry: '123456789000' });
  });

  it('Γ3 — παλιά τιμή μορφής εκτός λεξιλογίου (ΑΕ) ⇒ differs, όχι σιωπηλό match', () => {
    expect(compareContactWithRegistry(contact({ legalForm: 'ΑΕ' }), record(), AE).legalForm.state).toBe('differs');
  });

  it('Γ4 — μία διαφορά στην έδρα αρκεί, ακόμη κι αν λείπει άλλο μέρος', () => {
    const hq = { street: 'Εγνατίας', number: '16', postalCode: null, city: 'Θεσσαλονίκη' };
    const result = compareContactWithRegistry(contact({ headquarters: hq }), record(), AE);
    expect(result.seat.state).toBe('differs');
    expect(result.seat.parts).toEqual({ street: 'differs', number: 'match', postalCode: 'missing', city: 'match' });
  });
});

describe('Δ — δεν συγκρίνεται ⇒ not-comparable, ποτέ «διαφορά»', () => {
  it('Δ1 — υποκατάστημα αλλοδαπής (15): η μορφή δεν έχει κατηγορία επαφής', () => {
    const branch = entity('15', 'Υποκατάστημα Αλλοδαπής');
    const result = compareContactWithRegistry(contact({ legalForm: 'other' }), record(), branch);
    expect(result.legalForm).toEqual({ state: 'not-comparable', contact: 'other', registry: null });
  });

  it('Δ2 — κατάσταση χωρίς λέξη στην επαφή (15 Συνδιαλλαγή)', () => {
    const status = { code: { id: '15', label: 'Διαδικασία Συνδιαλλαγής' }, activity: 'inactive' as const };
    expect(compareContactWithRegistry(contact(), record({ status }), AE).status.state).toBe('not-comparable');
  });

  it('Δ3 — κατάσταση που άλλαξε νόημα στον κατάλογο (ολίσθηση) ή άγνωστος κωδικός ή καθόλου', () => {
    const drifted = { code: { id: '3', label: 'Κάτι άλλο' }, activity: 'unknown' as const };
    const unknown = { code: { id: '999', label: 'Νέα' }, activity: 'unknown' as const };
    const none = { code: null, activity: 'unknown' as const };
    for (const status of [drifted, unknown, none]) {
      expect(compareContactWithRegistry(contact(), record({ status }), AE).status.state).toBe('not-comparable');
    }
  });

  it('Δ4 — το μητρώο χωρίς τίτλους και χωρίς έδρα', () => {
    const seat = { street: null, streetNumber: null, postalCode: null, city: null, municipality: null };
    const result = compareContactWithRegistry(contact(), record({ distinctiveTitles: [], seat }), AE);
    expect(result.distinctiveTitle.state).toBe('not-comparable');
    expect(result.seat).toMatchObject({ state: 'not-comparable', registry: null });
  });

  it('Δ5 — αριθμός «0» του ΓΕΜΗ = χωρίς αριθμό: ούτε πρόταση, ούτε «λείπει» (ADR-948 §8.7.1)', () => {
    const seat = { street: 'ΣΑΜΟΘΡΑΚΗΣ', streetNumber: '0', postalCode: '54248', city: 'ΘΕΣΣΑΛΟΝΙΚΗ', municipality: null };
    const result = compareContactWithRegistry(contact({ headquarters: null }), record({ seat }), AE);
    expect(result.seat.registry?.number).toBeNull();
    expect(result.seat.parts.number).toBe('not-comparable');
    expect(result.seat.parts.street).toBe('missing');
  });
});

describe('Ε — διακριτικός τίτλος: πίνακας στο μητρώο', () => {
  it('Ε1 — ταιριάζει με τον δεύτερο τίτλο ⇒ match, πρόταση ο ταιριαστός', () => {
    const titles = ['ΑΛΛΟΣ ΤΙΤΛΟΣ', 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ'];
    const result = compareContactWithRegistry(contact(), record({ distinctiveTitles: titles }), AE);
    expect(result.distinctiveTitle).toEqual({ state: 'match', contact: 'Παγώνης Κατασκευαστική', registry: 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ' });
  });

  it('Ε2 — δεν ταιριάζει με κανέναν ⇒ differs, πρόταση ο πρώτος', () => {
    const result = compareContactWithRegistry(contact({ tradeName: 'ΒΗΤΑ' }), record({ distinctiveTitles: ['Α1', 'Α2'] }), AE);
    expect(result.distinctiveTitle).toEqual({ state: 'differs', contact: 'ΒΗΤΑ', registry: 'Α1' });
  });
});

describe('Ζ — κατάσταση: σύνολο τιμών που λένε το ίδιο', () => {
  it.each(['liquidation', 'dissolution'])('Ζ1 — «Λύση - Εκκαθάριση» (7) ⇄ %s ⇒ match, πρόταση liquidation', (value) => {
    const status = { code: { id: '7', label: 'Λύση - Εκκαθάριση' }, activity: 'inactive' as const };
    const result = compareContactWithRegistry(contact({ gemiStatus: value }), record({ status }), AE);
    expect(result.status).toEqual({ state: 'match', contact: value, registry: 'liquidation' });
  });
});
