/** ADR-944 §9 — ο ΕΝΑΣ κανόνας για διπλό ΑΦΜ / email επαφής: ο πίνακας αποφάσεων, γραμμή προς γραμμή. */

import {
  decideEmailDuplicate,
  decideVatDuplicate,
  formVatOf,
  strictestDecision,
  type IdentifierHolder,
} from '@/lib/contacts/contact-identifier-duplicate-policy';
import type { ContactType } from '@/types/contacts';

const holder = (type: ContactType, id = `cont_${type}`): IdentifierHolder => ({ id, name: id, type });

describe('decideVatDuplicate', () => {
  it.each<ContactType>(['individual', 'company', 'service'])('κανένας άλλος κάτοχος ⇒ allow (%s)', (candidate) => {
    expect(decideVatDuplicate(candidate, [])).toBe('allow');
  });

  it('φυσικό πρόσωπο ↔ φυσικό πρόσωπο ⇒ block — το ΑΦΜ είναι προσωπικό', () => {
    expect(decideVatDuplicate('individual', [holder('individual')])).toBe('block');
  });

  it.each<[ContactType, ContactType]>([
    ['individual', 'company'], // ατομική επιχείρηση: ο άνθρωπος καταχωρίζεται μετά την επιχείρησή του
    ['individual', 'service'],
    ['company', 'individual'], // …ή η επιχείρηση μετά τον άνθρωπο
    ['company', 'company'], // υποκατάστημα
    ['company', 'service'],
    ['service', 'individual'],
    ['service', 'company'],
    ['service', 'service'],
  ])('%s που γράφει ΑΦΜ κατόχου %s ⇒ confirm', (candidate, existing) => {
    expect(decideVatDuplicate(candidate, [holder(existing)])).toBe('confirm');
  });

  it('πολλοί κάτοχοι: ΕΝΑ φυσικό πρόσωπο ανάμεσά τους αρκεί για block — ακόμη κι αν δεν είναι ο πρώτος', () => {
    expect(decideVatDuplicate('individual', [holder('company'), holder('individual')])).toBe('block');
  });

  it('εταιρεία με κατόχους φυσικό πρόσωπο + εταιρεία ⇒ confirm (η εταιρεία δεν μπλοκάρεται ποτέ)', () => {
    expect(decideVatDuplicate('company', [holder('individual'), holder('company')])).toBe('confirm');
  });
});

describe('decideEmailDuplicate', () => {
  it('κανένας ⇒ allow', () => expect(decideEmailDuplicate([])).toBe('allow'));

  it('οποιοσδήποτε κάτοχος ⇒ confirm, ΠΟΤΕ block — κοινό γραμματοκιβώτιο (ADR-944)', () => {
    expect(decideEmailDuplicate([holder('individual')])).toBe('confirm');
    expect(decideEmailDuplicate([holder('individual'), holder('company'), holder('service')])).toBe('confirm');
  });
});

describe('strictestDecision', () => {
  it('block > confirm > allow, ανεξάρτητα από τη σειρά', () => {
    expect(strictestDecision('allow', 'allow')).toBe('allow');
    expect(strictestDecision('allow', 'confirm')).toBe('confirm');
    expect(strictestDecision('confirm', 'allow')).toBe('confirm');
    expect(strictestDecision('confirm', 'block')).toBe('block');
    expect(strictestDecision('block', 'allow')).toBe('block');
  });
});

describe('formVatOf', () => {
  const form = { vatNumber: ' 111111111 ', companyVatNumber: ' 222222222 ', serviceVatNumber: ' 333333333 ' };

  it('κάθε τύπος διαβάζει το ΔΙΚΟ του πεδίο, χωρίς κενά', () => {
    expect(formVatOf(form, 'individual')).toBe('111111111');
    expect(formVatOf(form, 'company')).toBe('222222222');
    expect(formVatOf(form, 'service')).toBe('333333333');
  });

  it('εταιρεία χωρίς `companyVatNumber` πέφτει στο `vatNumber` (η φόρμα ΓΕΜΗ γράφει εκεί)', () => {
    expect(formVatOf({ vatNumber: '111111111', companyVatNumber: '  ' }, 'company')).toBe('111111111');
  });

  it('τίποτα γραμμένο ⇒ κενό, ποτέ undefined', () => {
    expect(formVatOf({}, 'individual')).toBe('');
    expect(formVatOf({}, 'company')).toBe('');
    expect(formVatOf({}, 'service')).toBe('');
  });
});
