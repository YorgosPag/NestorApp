/**
 * ⚓ ADR-915 §22 — μία γραμμή ανά συμπωλητή.
 *
 * Ο νόμος ζητά τα προσωπικά έγγραφα από **κάθε** συμβαλλόμενο (Α.1008/2021 άρθρο 1 παρ. 1 · άρθρο 3 παρ. 8). Κάθε
 * τεστ ρωτά ΕΝΑ από τα αμετάβλητα: ταυτότητα γραμμής · αρχεία του σωστού προσώπου · γεγονότα του σωστού προσώπου ·
 * καμία συγχώνευση στις απαιτήσεις · καμία μαντεψιά ανάμεσα σε συμπωλητές. Συνθετικά αναγνωριστικά — καμία πραγματική επαφή.
 */

import { CONVEYANCE_CHECKLIST, getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { parseRowKey, rowKeyOf, ROW_PARTY_SEPARATOR } from '@/config/conveyance-checklist/row-key';
import { isPartyFact } from '@/config/conveyance-checklist/types';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { ConveyanceCase, ConveyanceSellerParty, EvidenceFile } from '@/types/conveyance-case';
import { sellerParty } from '../case-parties';
import { canonicalRowKey, caseRows, resolveCaseFacts, resolveCaseRow, rowFiles, type CaseRow } from '../case-rows';
import { caseDocumentRequirements } from '../case-document-requirements';
import { deriveCaseChecklist } from '../case-checklist';

const COMPANY = sellerParty('cont_co', 'legal_entity');
const PERSON = sellerParty('cont_p', 'person');

function caseOf(sellers: readonly ConveyanceSellerParty[], over: Partial<ConveyanceCase> = {}): ConveyanceCase {
  return {
    id: 'cvc_1', companyId: 'comp_a',
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: null, projectId: null, appurtenances: [] },
    profile: 'new_build_company', parties: { sellers, buyers: [] },
    facts: {}, partyFacts: {}, overrides: {}, storedState: 'open', targetSigningDate: null, catalogVersion: '0.5.0',
    version: 1, createdBy: 'u1', createdAt: 't0', updatedAt: 't0', cancellation: null, ...over,
  };
}

function sellerFile(contactId: string, entryPointId: string, fileId: string): EvidenceFile {
  const purpose = findEntryPoint('contact', entryPointId)?.purpose ?? 'missing-entry-point';
  return {
    source: { kind: 'owned' }, fileId, displayName: `${fileId}.pdf`, entityType: 'contact', entityId: contactId, purpose,
    level: 'seller_contact', fingerprint: `${fileId}:0:t`, createdAt: '2026-10-01T00:00:00Z', documentFacts: null,
  };
}

const rowOf = (record: ConveyanceCase, key: string): CaseRow => {
  const row = resolveCaseRow(record, key);
  if (row === null) throw new Error(`no row ${key}`);
  return row;
};

describe('ταυτότητα γραμμής (`row-key`)', () => {
  it('γραμμή υπόθεσης = σκέτο itemId (μηδέν μετάπτωση) · γραμμή προσώπου = itemId@key · round-trip', () => {
    expect(rowKeyOf('title_deed', null)).toBe('title_deed');
    expect(rowKeyOf('seller_e9', 'cont_p')).toBe(`seller_e9${ROW_PARTY_SEPARATOR}cont_p`);
    expect(parseRowKey(rowKeyOf('seller_e9', 'cont_p'))).toEqual({ itemId: 'seller_e9', partyKey: 'cont_p' });
    expect(parseRowKey('title_deed')).toEqual({ itemId: 'title_deed', partyKey: null });
  });

  it('⚓ κανένα itemId του καταλόγου δεν περιέχει τον διαχωριστή', () => {
    expect(CONVEYANCE_CHECKLIST.filter((item) => item.id.includes(ROW_PARTY_SEPARATOR))).toEqual([]);
  });

  it('⚓ γραμμή που ρωτά γεγονός προσώπου ΕΙΝΑΙ πρότυπο προσώπου — αλλιώς «ποιανού;» χωρίς απάντηση', () => {
    const orphans = CONVEYANCE_CHECKLIST.filter((item) =>
      item.requirement.kind === 'when' && isPartyFact(item.requirement.fact) && item.partyRole === undefined);
    expect(orphans.map((item) => item.id)).toEqual([]);
  });

  it('⚓ όλα τα έγγραφα της ενότητας πωλητή είναι ανά πρόσωπο', () => {
    expect(CONVEYANCE_CHECKLIST.filter((item) => item.section === 'seller' && item.partyRole !== 'seller')).toEqual([]);
  });
});

describe('γραμμές της υπόθεσης (κατάλογος × πρόσωπα)', () => {
  it('δύο πωλητές ⇒ κάθε γραμμή πωλητή δύο φορές, οι γραμμές της υπόθεσης μία', () => {
    const one = caseRows(caseOf([COMPANY]));
    const two = caseRows(caseOf([COMPANY, PERSON]));
    const sellerItems = CONVEYANCE_CHECKLIST.filter((item) => item.partyRole === 'seller').length;
    expect(two.length - one.length).toBe(sellerItems);
    expect(two.filter((row) => row.item.id === 'seller_tax_clearance').map((row) => row.key))
      .toEqual(['seller_tax_clearance@cont_co', 'seller_tax_clearance@cont_p']);
    expect(two.filter((row) => row.item.id === 'title_deed').map((row) => [row.key, row.party])).toEqual([['title_deed', null]]);
  });

  it('`resolveCaseRow`: πρόσωπο εκτός υπόθεσης · σκέτο κλειδί προτύπου · άγνωστη γραμμή ⇒ null', () => {
    const record = caseOf([COMPANY, PERSON]);
    expect(resolveCaseRow(record, 'seller_e9@cont_p')?.party).toEqual(PERSON);
    expect(resolveCaseRow(record, 'seller_e9@cont_stranger')).toBeNull();
    expect(resolveCaseRow(record, 'seller_e9')).toBeNull();
    expect(resolveCaseRow(record, 'no_such_item')).toBeNull();
  });

  it('`canonicalRowKey`: παλιό σκέτο κλειδί ⇒ στον ΜΟΝΑΔΙΚΟ πωλητή · με δύο ⇒ αμετάβλητο (ποτέ μαντεψιά)', () => {
    expect(canonicalRowKey('seller_e9', { sellers: [COMPANY] })).toBe('seller_e9@cont_co');
    expect(canonicalRowKey('seller_e9', { sellers: [COMPANY, PERSON] })).toBe('seller_e9');
    expect(canonicalRowKey('title_deed', { sellers: [COMPANY] })).toBe('title_deed');
    expect(canonicalRowKey('seller_e9@cont_p', { sellers: [COMPANY] })).toBe('seller_e9@cont_p');
  });
});

describe('αρχεία της γραμμής (`rowFiles`)', () => {
  const record = caseOf([COMPANY, PERSON]);
  const evidence = [sellerFile('cont_co', 'tax-clearance', 'f_co'), sellerFile('cont_p', 'tax-clearance', 'f_p')];

  it('η φορολογική του ενός ΔΕΝ καλύπτει τον άλλον', () => {
    expect(rowFiles(rowOf(record, 'seller_tax_clearance@cont_co'), evidence).map((f) => f.fileId)).toEqual(['f_co']);
    expect(rowFiles(rowOf(record, 'seller_tax_clearance@cont_p'), evidence).map((f) => f.fileId)).toEqual(['f_p']);
  });

  it('πωλητής χωρίς επαφή ⇒ κανένα προσωπικό αρχείο (ποτέ «του πρώτου που βρέθηκε»)', () => {
    const unknown = caseOf([sellerParty(null, 'legal_entity')]);
    expect(rowFiles(rowOf(unknown, 'seller_tax_clearance@seller'), evidence)).toEqual([]);
  });
});

describe('γεγονότα ανά πρόσωπο', () => {
  it('εταιρεία + ιδιώτης: ΕΦΚΑ από τον νόμο ΜΟΝΟ για την εταιρεία · καμία τιμή προσώπου στο επίπεδο υπόθεσης', () => {
    const record = caseOf([COMPANY, PERSON], { facts: { seller_by_proxy: { value: true, answeredBy: 'u', answeredAt: 't' } } });
    const facts = resolveCaseFacts({ seller_is_legal_entity: true }, record);
    expect(facts.parties.cont_co).toMatchObject({ seller_is_legal_entity: true, seller_insurance_liable: true });
    expect(facts.parties.cont_p).toMatchObject({ seller_is_legal_entity: false });
    expect(facts.parties.cont_p.seller_insurance_liable).toBeUndefined();
    expect(Object.keys(facts.case).filter(isPartyFact)).toEqual([]);
  });

  it('κατάλογος: ταυτότητα μόνο για τον ιδιώτη · καταστατικό μόνο για την εταιρεία · ερώτηση ανά πρόσωπο', () => {
    const { rows, summary } = deriveCaseChecklist({
      record: caseOf([COMPANY, PERSON]), derivedFacts: {}, evidence: [], sealed: [], today: '2026-10-16', viewer: 'host',
    });
    const statusOf = (key: string) => rows.find((row) => row.itemId === key)?.status;
    expect([statusOf('seller_identity@cont_co'), statusOf('seller_identity@cont_p')]).toEqual(['not_applicable', 'missing']);
    expect([statusOf('seller_corporate_documents@cont_co'), statusOf('seller_corporate_documents@cont_p')]).toEqual(['missing', 'not_applicable']);
    expect([statusOf('seller_insurance_clearance@cont_co'), statusOf('seller_insurance_clearance@cont_p')]).toEqual(['missing', 'needs_answer']);
    expect(summary.openQuestions).toEqual(expect.arrayContaining([
      { factId: 'seller_insurance_liable', partyKey: 'cont_p' },
      { factId: 'seller_by_proxy', partyKey: 'cont_co' },
      { factId: 'seller_by_proxy', partyKey: 'cont_p' },
    ]));
  });

  it('η απάντηση του ενός προσώπου δεν απαντά για τον άλλον', () => {
    const answered = caseOf([COMPANY, PERSON], { partyFacts: { cont_p: { seller_by_proxy: { value: true, answeredBy: 'u', answeredAt: 't' } } } });
    const { rows } = deriveCaseChecklist({ record: answered, derivedFacts: {}, evidence: [], sealed: [], today: '2026-10-16', viewer: 'host' });
    const statusOf = (key: string) => rows.find((row) => row.itemId === key)?.status;
    expect([statusOf('seller_power_of_attorney@cont_p'), statusOf('seller_power_of_attorney@cont_co')]).toEqual(['missing', 'needs_answer']);
  });
});

describe('απαιτήσεις του μητρώου λήξεων', () => {
  it('δύο πωλητές ⇒ δύο απαιτήσεις φορολογικής, με ΔΙΑΦΟΡΕΤΙΚΗ βάση (ποτέ συγχωνευμένες)', () => {
    const record = caseOf([COMPANY, PERSON]);
    const requirements = caseDocumentRequirements(record, resolveCaseFacts({}, record));
    const tax = requirements.filter((r) => r.documentKind === 'tax-clearance');
    expect(tax.map((r) => (r.basis.kind === 'checklist-item' ? r.basis.itemId : null)))
      .toEqual(['seller_tax_clearance@cont_co', 'seller_tax_clearance@cont_p']);
    expect(tax.every((r) => r.presence === 'required')).toBe(true);
  });

  it('ΕΦΚΑ: απαιτείται για την εταιρεία · για τον αναπάντητο ιδιώτη μόνο παρακολουθείται', () => {
    const record = caseOf([COMPANY, PERSON]);
    const efka = caseDocumentRequirements(record, resolveCaseFacts({}, record)).filter((r) => r.documentKind === 'insurance-clearance');
    expect(efka.map((r) => r.presence)).toEqual(['required', 'tracked']);
  });

  it('«δεν εφαρμόζεται» στη γραμμή του ενός ΔΕΝ βγάζει από το μητρώο τη γραμμή του άλλου', () => {
    const record = caseOf([COMPANY, PERSON], {
      overrides: { 'seller_tax_clearance@cont_p': { notApplicable: { reason: 'r', markedBy: 'u', markedAt: 't' } } },
    });
    const tax = caseDocumentRequirements(record, resolveCaseFacts({}, record)).filter((r) => r.documentKind === 'tax-clearance');
    expect(tax).toHaveLength(1);
    expect(getChecklistItem('seller_tax_clearance')?.partyRole).toBe('seller');
  });
});
