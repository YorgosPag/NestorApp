/**
 * Άγκυρες — ο ΕΝΑΣ γραφέας της έδρας (ADR-332 §D30 Φάση 2).
 *
 * Η έδρα είναι η θέση 0 της `companyAddresses` και μόνο αυτή. Κάθε πράξη της φόρμας περνά από το
 * `commitHq`: αλλάζει **μόνο** τη θέση 0 και αφήνει τα υποκαταστήματα αυτούσια (ίδια αναφορά).
 */

import { initialFormData, type CompanyAddress, type ContactFormData } from '@/types/ContactFormTypes';
import { commitHq, contactAddressList, emptyContactHq, selectContactHq, withContactAddressAt } from '../contact-hq-state';
import { applyHqEditorChange } from '../addresses-section-form-mapping';

const HQ: CompanyAddress = { id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη' };
const BRANCH_A: CompanyAddress = { id: 'addr_a', type: 'branch', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος' };
const BRANCH_B: CompanyAddress = { id: 'addr_b', type: 'warehouse', street: 'Λαγκαδά', number: '200', postalCode: '56430', city: 'Σταυρούπολη' };

function form(partial: Partial<ContactFormData> = {}): ContactFormData {
  return { ...initialFormData, type: 'company', companyName: 'ALFA', companyAddresses: [HQ, BRANCH_A, BRANCH_B], ...partial };
}

describe('commitHq — αλλάζει ΜΟΝΟ τη θέση 0', () => {
  it('ο μετασχηματισμός εφαρμόζεται στην έδρα· τα υποκαταστήματα μένουν ίδια (ίδια αναφορά)', () => {
    const next = commitHq(form(), (hq) => ({ ...hq, neighborhood: 'Κέντρο' }));
    expect(next.companyAddresses?.[0]).toEqual({ ...HQ, neighborhood: 'Κέντρο' });
    expect(next.companyAddresses?.[1]).toBe(BRANCH_A);
    expect(next.companyAddresses?.[2]).toBe(BRANCH_B);
  });

  it('κάθε γραφέας του editor (applyHqEditorChange) περνά από το commitHq — υποκαταστήματα άθικτα', () => {
    const next = applyHqEditorChange(form(), { street: 'Νέα', number: '1', neighborhood: 'Χ' });
    expect(next.companyAddresses?.slice(1)).toEqual([BRANCH_A, BRANCH_B]);
    expect(next.companyAddresses?.[0]).toMatchObject({ id: 'addr_hq', street: 'Νέα', number: '1', neighborhood: 'Χ' });
  });

  it('κενή λίστα ⇒ υλοποιεί τη θέση 0 με τον τύπο ADR-319 του είδους', () => {
    const next = commitHq(form({ type: 'individual', companyAddresses: [] }), (hq) => ({ ...hq, street: 'Τσιμισκή' }));
    expect(next.companyAddresses).toEqual([{ ...emptyContactHq('individual'), street: 'Τσιμισκή' }]);
    expect(next.companyAddresses?.[0].type).toBe('home');
  });

  it('δεν μεταλλάσσει την προηγούμενη κατάσταση (καθαρή συνάρτηση)', () => {
    const prev = form();
    const snapshot = JSON.parse(JSON.stringify(prev)) as ContactFormData;
    commitHq(prev, (hq) => ({ ...hq, street: 'Άλλη' }));
    expect(prev).toEqual(snapshot);
  });
});

describe('selectContactHq / contactAddressList / withContactAddressAt', () => {
  it('η έδρα είναι η θέση 0', () => {
    expect(selectContactHq(form())).toBe(HQ);
  });

  it('επαφή χωρίς διευθύνσεις δείχνει κενή έδρα (D20) — η υπηρεσία με τον δικό της τύπο', () => {
    expect(contactAddressList(form({ type: 'service', companyAddresses: undefined }))).toEqual([emptyContactHq('service')]);
  });

  it('αντικατάσταση υποκαταστήματος δεν αγγίζει την έδρα· εκτός ορίων ⇒ αμετάβλητο', () => {
    const replaced = { ...BRANCH_A, street: 'Άλλη' };
    const next = withContactAddressAt(form(), 1, replaced);
    expect(next.companyAddresses).toEqual([HQ, replaced, BRANCH_B]);
    const same = form();
    expect(withContactAddressAt(same, 9, replaced)).toBe(same);
  });
});
