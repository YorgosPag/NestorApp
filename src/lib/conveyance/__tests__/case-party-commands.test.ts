/**
 * ⚓ ADR-915 §23 — συμμεταβιβάζοντες στην υπόθεση: ο καθαρός πυρήνας (`add_sellers` · `remove_seller`), η ΜΙΑ κρίση
 * επαφής (`sellerCandidateOf`), η απαλλαγή του οικοπεδούχου (Α.1002/2019) και το ακροατήριο του σήματος.
 * Συνθετικά αναγνωριστικά — καμία πραγματική επαφή.
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { SELLER_PRIVATE } from '@/config/conveyance-checklist/visibility';
import type { ConveyanceCase, ConveyanceSellerParty } from '@/types/conveyance-case';
import { applyConveyanceCommand, type CommandContext } from '../apply-command';
import { MAX_CASE_SELLERS, sellerCandidateOf, sellerParty, type SellerCandidate } from '../case-parties';
import { checklistItemApplicability } from '../derive-checklist';
import { caseRows, partyRowsAudience, resolveCaseFacts, resolveCaseRow, rowFacts } from '../case-rows';
import { conveyanceCommandRequestSchema, type ConveyanceCommand } from '../conveyance-commands';
import { parseConveyanceCase } from '../conveyance-case-schema';
import { changeOfCommand, roleSeesChange } from '../view-signal-audience';

const PRINCIPAL = sellerParty('cont_co', 'legal_entity', 'principal');
const SOURCES = { principalContactId: 'cont_co', landownerContactIds: ['cont_lo1', 'cont_lo2'] };

function caseOf(sellers: readonly ConveyanceSellerParty[] = [PRINCIPAL], extra: Partial<ConveyanceCase> = {}): ConveyanceCase {
  return {
    id: 'cvc_1', companyId: 'comp_a',
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: null, projectId: 'proj_1', appurtenances: [] },
    profile: 'new_build_company', parties: { sellers, buyers: [{ contactId: 'cont_buyer' }] },
    facts: {}, partyFacts: {}, overrides: {}, storedState: 'open', targetSigningDate: null, catalogVersion: '0.6.0',
    version: 3, createdBy: 'u1', createdAt: '2026-10-16T09:00:00Z', updatedAt: '2026-10-16T09:00:00Z', cancellation: null,
    ...extra,
  };
}

const person = (capacity: SellerCandidate['capacity']): SellerCandidate => ({ kind: 'person', capacity });

function ctxWith(candidates: Readonly<Record<string, SellerCandidate>> = {}): CommandContext {
  return { actorUid: 'u1', now: '2026-10-16T10:00:00Z', today: '2026-10-16', evidence: [], sellerCandidates: new Map(Object.entries(candidates)) };
}

function run(record: ConveyanceCase, command: ConveyanceCommand, candidates: Readonly<Record<string, SellerCandidate>> = {}) {
  return applyConveyanceCommand(record, command, ctxWith(candidates));
}

function nextOf(result: ReturnType<typeof run>): ConveyanceCase {
  if (!result.ok) throw new Error(`rejected: ${result.rejection}`);
  return result.next;
}

describe('sellerCandidateOf — ο ΕΝΑΣ κριτής «μπορεί αυτή η επαφή να μεταβιβάσει, και πώς;»', () => {
  it('φυσικό/νομικό πρόσωπο από τον ΤΥΠΟ της επαφής · ιδιότητα από το ΕΡΓΟ', () => {
    expect(sellerCandidateOf('cont_lo1', { type: 'individual', status: 'active' }, SOURCES)).toEqual({ kind: 'person', capacity: 'landowner' });
    expect(sellerCandidateOf('cont_x', { type: 'company' }, SOURCES)).toEqual({ kind: 'legal_entity', capacity: 'other' });
    expect(sellerCandidateOf('cont_co', { type: 'company' }, SOURCES)).toEqual({ kind: 'legal_entity', capacity: 'principal' });
  });

  it('υπηρεσία · αρχειοθετημένη · διαγραμμένη · άγνωστη/ξένη ⇒ όχι', () => {
    expect(sellerCandidateOf('cont_x', { type: 'service' }, SOURCES)).toBeNull();
    expect(sellerCandidateOf('cont_x', { type: 'individual', status: 'archived' }, SOURCES)).toBeNull();
    expect(sellerCandidateOf('cont_x', { type: 'company', status: 'deleted' }, SOURCES)).toBeNull();
    expect(sellerCandidateOf('cont_x', null, SOURCES)).toBeNull();
  });
});

describe('add_sellers', () => {
  it('προσθέτει με κλειδί = επαφή, ιδιότητα και είδος ΟΠΩΣ τα έκρινε ο server · μία πράξη, ένα ίχνος ανά πρόσωπο', () => {
    const result = run(caseOf(), { type: 'add_sellers', contactIds: ['cont_lo1', 'cont_lo2'] }, { cont_lo1: person('landowner'), cont_lo2: person('landowner') });
    const next = nextOf(result);
    expect(next.parties.sellers.map((party) => [party.key, party.capacity, party.kind])).toEqual([
      ['cont_co', 'principal', 'legal_entity'], ['cont_lo1', 'landowner', 'person'], ['cont_lo2', 'landowner', 'person'],
    ]);
    expect(result.ok && result.changes).toEqual([
      { field: 'parties.sellers.cont_lo1', oldValue: null, newValue: 'landowner' },
      { field: 'parties.sellers.cont_lo2', oldValue: null, newValue: 'landowner' },
    ]);
  });

  it('ιδεμποτία: ήδη πωλητής ⇒ καμία αλλαγή, κανένα ίχνος', () => {
    const record = caseOf([PRINCIPAL, sellerParty('cont_lo1', 'person', 'landowner')]);
    expect(run(record, { type: 'add_sellers', contactIds: ['cont_lo1', 'cont_co'] })).toEqual({ ok: true, next: record, changes: [] });
  });

  it('ατομικότητα: ΜΙΑ μη κατάλληλη επαφή ⇒ καμία προσθήκη (ποτέ «μισή» λίστα)', () => {
    expect(run(caseOf(), { type: 'add_sellers', contactIds: ['cont_lo1', 'cont_foreign'] }, { cont_lo1: person('landowner') }))
      .toEqual({ ok: false, rejection: 'seller_not_eligible' });
  });

  it('ο αγοραστής της υπόθεσης δεν γίνεται και πωλητής', () => {
    expect(run(caseOf(), { type: 'add_sellers', contactIds: ['cont_buyer'] }, { cont_buyer: person('other') }))
      .toEqual({ ok: false, rejection: 'seller_is_buyer' });
  });

  it(`πάνω από ${MAX_CASE_SELLERS} μεταβιβάζοντες ⇒ άρνηση`, () => {
    const crowd = Array.from({ length: MAX_CASE_SELLERS - 1 }, (_, i) => sellerParty(`cont_${i}`, 'person', 'other'));
    expect(run(caseOf([PRINCIPAL, ...crowd]), { type: 'add_sellers', contactIds: ['cont_new'] }, { cont_new: person('other') }))
      .toEqual({ ok: false, rejection: 'too_many_sellers' });
  });

  it('κλειστή υπόθεση ⇒ not_editable', () => {
    expect(run(caseOf([PRINCIPAL], { storedState: 'cancelled' }), { type: 'add_sellers', contactIds: ['cont_lo1'] }, { cont_lo1: person('landowner') }))
      .toEqual({ ok: false, rejection: 'not_editable' });
  });

  it('σχήμα: διπλή επαφή στην ίδια εντολή ή κενή λίστα ⇒ άκυρο αίτημα', () => {
    const parse = (contactIds: string[]) => conveyanceCommandRequestSchema.safeParse({ expectedVersion: 0, command: { type: 'add_sellers', contactIds } }).success;
    expect(parse(['cont_a', 'cont_a'])).toBe(false);
    expect(parse([])).toBe(false);
    expect(parse(['cont_a', 'cont_b'])).toBe(true);
  });
});

describe('remove_seller — soft: έξω από τη λίστα, τίποτα δεν χάνεται', () => {
  const landowner = sellerParty('cont_lo1', 'person', 'landowner');
  const answer = { value: true, answeredBy: 'u1', answeredAt: '2026-10-16T09:30:00Z' };
  const review = { verdict: 'accepted' as const, fileId: null, fileFingerprint: null, issuedOn: '2026-10-01', printedValidUntil: null, reason: null, reviewedBy: 'u1', reviewedAt: '2026-10-16T09:30:00Z' };
  const withData = () => caseOf([PRINCIPAL, landowner], {
    partyFacts: { cont_lo1: { seller_by_proxy: answer } },
    overrides: { 'seller_enfia_certificate@cont_lo1': { review } },
  });

  it('η εταιρεία του έργου δεν αφαιρείται', () => {
    expect(run(withData(), { type: 'remove_seller', partyKey: 'cont_co' })).toEqual({ ok: false, rejection: 'principal_not_removable' });
  });

  it('αφαίρεση απόντος ⇒ καμία αλλαγή (ιδεμποτία)', () => {
    const record = withData();
    expect(run(record, { type: 'remove_seller', partyKey: 'cont_nobody' })).toEqual({ ok: true, next: record, changes: [] });
  });

  it('οι γραμμές του φεύγουν (και δεν λύνονται πια) — απαντήσεις και έλεγχοι ΜΕΝΟΥΝ αποθηκευμένα', () => {
    const removed = nextOf(run(withData(), { type: 'remove_seller', partyKey: 'cont_lo1' }));
    expect(removed.parties.sellers).toEqual([PRINCIPAL]);
    expect(caseRows(removed).some((row) => row.party?.key === 'cont_lo1')).toBe(false);
    expect(resolveCaseRow(removed, 'seller_enfia_certificate@cont_lo1')).toBeNull();
    expect(removed.partyFacts.cont_lo1).toEqual({ seller_by_proxy: answer });
    expect(removed.overrides['seller_enfia_certificate@cont_lo1']).toEqual({ review });
    expect(run(removed, { type: 'review', itemId: 'seller_enfia_certificate@cont_lo1', verdict: 'accepted', fileId: null, issuedOn: null, reason: null }))
      .toEqual({ ok: false, rejection: 'unknown_item' });
  });

  it('επαναφορά: ξανά μέσα ⇒ ίδιες γραμμές, ίδιες απαντήσεις, ίδιοι έλεγχοι', () => {
    const removed = nextOf(run(withData(), { type: 'remove_seller', partyKey: 'cont_lo1' }));
    const back = nextOf(run(removed, { type: 'add_sellers', contactIds: ['cont_lo1'] }, { cont_lo1: person('landowner') }));
    expect(resolveCaseRow(back, 'seller_enfia_certificate@cont_lo1')).not.toBeNull();
    expect(resolveCaseFacts({}, back).parties.cont_lo1.seller_by_proxy).toBe(true);
    expect(back.overrides['seller_enfia_certificate@cont_lo1']).toEqual({ review });
  });
});

describe('Α.1002/2019 — η φορολογική του οικοπεδούχου την προσκομίζει ο εργολάβος', () => {
  const taxItem = getChecklistItem('seller_tax_clearance');
  if (!taxItem) throw new Error('missing catalog item seller_tax_clearance');

  function taxApplies(record: ConveyanceCase, partyKey: string): boolean | 'unknown' {
    const row = caseRows(record).find((r) => r.item.id === 'seller_tax_clearance' && r.party?.key === partyKey);
    if (!row) throw new Error(`no tax row for ${partyKey}`);
    return checklistItemApplicability(row.item, rowFacts(row, resolveCaseFacts({}, record)));
  }

  it('οικοπεδούχος ΜΕ τον εργολάβο συμβαλλόμενο ⇒ καμία δική του φορολογική · ο εργολάβος έχει τη δική του', () => {
    const record = caseOf([PRINCIPAL, sellerParty('cont_lo1', 'person', 'landowner')]);
    expect(taxApplies(record, 'cont_lo1')).toBe(false);
    expect(taxApplies(record, 'cont_co')).toBe(true);
  });

  it('συνιδιοκτήτης που ΔΕΝ είναι οικοπεδούχος ⇒ φέρνει δική του — ο νόμος, όχι απάντηση', () => {
    const answer = { value: true, answeredBy: 'u1', answeredAt: '2026-10-16T09:30:00Z' };
    const record = caseOf([PRINCIPAL, sellerParty('cont_x', 'person', 'other')], { partyFacts: { cont_x: { seller_tax_clearance_by_contractor: answer } } });
    expect(taxApplies(record, 'cont_x')).toBe(true);
  });

  it('οικοπεδούχος ΧΩΡΙΣ εργολάβο στη λίστα ⇒ φέρνει δική του (λείπει η προϋπόθεση «συμβάλλεται και ο εργολάβος»)', () => {
    expect(taxApplies(caseOf([sellerParty('cont_lo1', 'person', 'landowner')]), 'cont_lo1')).toBe(true);
  });

  it('ο άνθρωπος διορθώνει το παραγόμενο (π.χ. δεν υπάρχει προσύμφωνο εργολαβίας)', () => {
    const answer = { value: false, answeredBy: 'u1', answeredAt: '2026-10-16T09:30:00Z' };
    const record = caseOf([PRINCIPAL, sellerParty('cont_lo1', 'person', 'landowner')], { partyFacts: { cont_lo1: { seller_tax_clearance_by_contractor: answer } } });
    expect(taxApplies(record, 'cont_lo1')).toBe(true);
  });
});

describe('σχήμα αποθήκευσης — πωλητής χωρίς ιδιότητα', () => {
  it('πριν από την §23 ο μόνος πωλητής ήταν η εταιρεία του έργου ⇒ `principal`', () => {
    const stored = { ...caseOf(), parties: { sellers: [{ key: 'cont_co', contactId: 'cont_co', kind: 'legal_entity' }], buyers: [] } };
    expect(parseConveyanceCase(stored)?.parties.sellers[0].capacity).toBe('principal');
  });
});

describe('σήμα όψεων — αλλαγή προσώπων', () => {
  it('το ακροατήριο ΠΑΡΑΓΕΤΑΙ από τον κατάλογο: οικοδεσπότης + όσοι βλέπουν γραμμές πωλητή · ποτέ η πλευρά του αγοραστή', () => {
    expect([...partyRowsAudience('seller')].sort()).toEqual([...SELLER_PRIVATE].sort());
    for (const command of [{ type: 'add_sellers', contactIds: ['cont_lo1'] }, { type: 'remove_seller', partyKey: 'cont_lo1' }] as const) {
      const change = changeOfCommand(command);
      expect(roleSeesChange(change, 'host')).toBe(true);
      expect(roleSeesChange(change, 'seller_lawyer')).toBe(true);
      expect(roleSeesChange(change, 'notary')).toBe(true);
      expect(roleSeesChange(change, 'buyer_lawyer')).toBe(false);
      expect(roleSeesChange(change, 'buyer')).toBe(false);
    }
  });
});
