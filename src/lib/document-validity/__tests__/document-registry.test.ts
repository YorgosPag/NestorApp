/**
 * ADR-915 Φ4α — το μητρώο λήξεων ως ΠΑΡΑΓΟΜΕΝΗ όψη. Συνθετικά δεδομένα μόνο.
 */

import {
  REGISTRY_FILTERS,
  REGISTRY_ROW_STATES,
  REGISTRY_WINDOW_DAYS,
  documentRegistry,
  matchesRegistryFilter,
  type RegistryDocument,
  type RegistryFilter,
  type RegistryRow,
} from '../document-registry';
import type { DocumentRequirement } from '../document-requirement';
import { addDaysToDateKey } from '@/lib/calendar/date-key';

const ASOF = '2026-10-15';
const READ = { kind: 'document-text', reader: 'pea-text' } as const;

function pea(id: string, issuedOn: string | null, extra: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    id, kind: 'energy-certificate', propertyId: 'p1', origin: { kind: 'file', fileId: id },
    issuedOn, printedValidUntil: null, source: READ, pinned: false, ...extra,
  };
}

const signing = (day: string, propertyId = 'p1'): DocumentRequirement => ({
  documentKind: 'energy-certificate', subject: { propertyId }, process: { kind: 'conveyance', caseId: 'c1' },
  neededOn: { kind: 'on', day }, policy: 'block', warnWindowDays: 15,
  basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null },
});
const listing = (policy: 'block' | 'warn' = 'warn'): DocumentRequirement => ({
  documentKind: 'energy-certificate', subject: { propertyId: 'p1' }, process: { kind: 'listing-publication', listingId: 'p1' },
  neededOn: { kind: 'continuous' }, policy, warnWindowDays: 60, basis: { kind: 'statute', statute: 'ν.4122/2013' },
});

const registry = (documents: RegistryDocument[], requirements: DocumentRequirement[] = []) =>
  documentRegistry({ documents, requirements, asOf: ASOF });
const only = (document: RegistryDocument, requirements: DocumentRequirement[] = []): RegistryRow =>
  registry([document], requirements).rows[0];

describe('κατάσταση — ο ΙΔΙΟΣ κριτής, παράθυρο = χρόνος ανανέωσης του είδους', () => {
  it('ΠΕΑ: έληξε · λήγει μέσα στις 60 ημέρες ανανέωσης · ισχύει', () => {
    expect(only(pea('a', '2016-01-10')).state).toBe('expired');
    expect(only(pea('b', '2016-12-01')).state).toBe('expiring');
    expect(only(pea('c', '2016-12-15')).state).toBe('valid');
  });

  it('χωρίς έκδοση ή με κανόνα `unverified` ⇒ `expiry-unknown`, ποτέ `valid`', () => {
    expect(only(pea('a', null)).state).toBe('expiry-unknown');
    expect(only(pea('b', '2026-01-01', { kind: 'building-identity' })).state).toBe('expiry-unknown');
  });

  it('Α4: η τυπωμένη νωρίτερη κερδίζει, και η ασυμφωνία ταξιδεύει στη γραμμή', () => {
    const row = only(pea('a', '2025-03-01', { printedValidUntil: '2034-03-01' }));
    expect(row.expiry).toEqual({ expiresOn: '2034-03-01', source: 'printed', discrepancy: { rule: '2035-03-01', printed: '2034-03-01' } });
    expect(matchesRegistryFilter(row, 'discrepancy', ASOF)).toBe(true);
    expect(matchesRegistryFilter(only(pea('b', '2025-03-01')), 'discrepancy', ASOF)).toBe(false);
  });

  it('η δήλωση ακινήτου χωρίς αρχείο (Α3) είναι γραμμή με τον ίδιο κανόνα', () => {
    const row = only(pea('declared:p1:energy-certificate', '2016-01-10', { origin: { kind: 'declared' }, source: null }));
    expect(row.state).toBe('expired');
    expect(row.document.origin.kind).toBe('declared');
  });
});

describe('Α5 — αντικατάσταση, παραγόμενη: ποτέ «έληξε»', () => {
  it('το παλιό ΠΕΑ του ίδιου ακινήτου είναι `superseded` από το νεότερο, όχι `expired`', () => {
    const { rows } = registry([pea('old', '2014-05-01'), pea('new', '2024-05-01')]);
    const old = rows.find((row) => row.document.id === 'old');
    expect(old).toMatchObject({ state: 'superseded', supersededBy: 'new', dependents: [], blocking: false });
    expect(rows.find((row) => row.document.id === 'new')?.state).toBe('valid');
  });

  it('το αρχείο που ονομάζει το ακίνητο (`pinned`) είναι τρέχον ακόμη κι αν υπάρχει νεότερη έκδοση', () => {
    const { rows } = registry([pea('pinned', '2020-01-01', { pinned: true }), pea('newer', '2024-01-01')]);
    expect(rows.find((row) => row.document.id === 'newer')?.supersededBy).toBe('pinned');
  });

  it('άλλο ακίνητο, άλλο είδος ή χωρίς ακίνητο ⇒ καμία αντικατάσταση', () => {
    const { rows } = registry([
      pea('a', '2014-05-01'),
      pea('b', '2024-05-01', { propertyId: 'p2' }),
      pea('c', '2024-05-01', { kind: 'building-identity' }),
      pea('d', '2024-05-01', { propertyId: null }),
      pea('e', '2025-05-01', { propertyId: null }),
    ]);
    expect(rows.every((row) => row.state !== 'superseded')).toBe(true);
  });

  it('η αντικατεστημένη γραμμή δεν ταιριάζει σε ΚΑΝΕΝΑ φίλτρο — ακόμη κι αν μόνη της θα ταίριαζε', () => {
    // Μόνη της: λήγει μέσα στο παράθυρο (τυπωμένη 2026-10-20) ΚΑΙ έχει ασυμφωνία με τον κανόνα (2026-11-01).
    const lonely = pea('old', '2016-11-01', { printedValidUntil: '2026-10-20' });
    const alone: readonly RegistryFilter[] = ['within-window', 'discrepancy', 'renewal-due'];
    expect(alone.every((filter) => matchesRegistryFilter(only(lonely), filter, ASOF))).toBe(true);
    const old = registry([lonely, pea('new', '2024-05-01')]).rows.find((row) => row.document.id === 'old');
    expect(old?.state).toBe('superseded');
    for (const filter of REGISTRY_FILTERS) expect(matchesRegistryFilter(old as RegistryRow, filter, ASOF)).toBe(false);
  });
});

describe('«τι σταματά» και «μπλοκάρει»', () => {
  it('η λήξη πέφτει πριν την υπογραφή ⇒ σταματά η υπόθεση, και μπλοκάρει ήδη', () => {
    const row = only(pea('a', '2016-11-20'), [signing('2026-12-01'), listing()]);
    expect(row.dependents.map((d) => [d.requirement.process.kind, d.impact])).toEqual([
      ['conveyance', 'stops'], ['listing-publication', 'stops'],
    ]);
    expect(row.dependents[0].stopsOn).toBe('2026-11-21');
    expect(row.blocking).toBe(true);
  });

  it('ισχύει την ημέρα της υπογραφής ⇒ ανεπηρέαστη, δεν μπλοκάρει', () => {
    const row = only(pea('a', '2016-11-20'), [signing('2026-11-20')]);
    expect(row.dependents[0].impact).toBe('unaffected');
    expect(row.blocking).toBe(false);
  });

  it('διαρκής `warn` (αγγελία, Α1) δεν μπλοκάρει ποτέ — ούτε σε ληγμένο', () => {
    expect(only(pea('a', '2016-01-10'), [listing('warn')]).blocking).toBe(false);
  });

  it('διαρκής `block`: μπλοκάρει μόνο όταν έληξε ή μπήκε σε ανανέωση, όχι για λήξη το 2035', () => {
    expect(only(pea('a', '2016-01-10'), [listing('block')]).blocking).toBe(true);
    expect(only(pea('b', '2025-03-01'), [listing('block')]).blocking).toBe(false);
  });

  it('απαίτηση άλλου ακινήτου ή έγγραφο χωρίς ακίνητο ⇒ τίποτα δεν σταματά', () => {
    expect(only(pea('a', '2016-01-10'), [signing('2026-12-01', 'p2')]).dependents).toEqual([]);
    expect(only(pea('b', '2016-01-10', { propertyId: null }), [signing('2026-12-01')]).dependents).toEqual([]);
  });
});

describe('σειρά επείγοντος + μετρήσεις', () => {
  const docs = [
    pea('valid', '2025-03-01', { propertyId: 'p5' }),
    pea('unknown', null, { propertyId: 'p4' }),
    pea('expiring', '2016-12-01', { propertyId: 'p3' }),
    pea('expired', '2016-01-10', { propertyId: 'p2' }),
    pea('old', '2010-01-01', { propertyId: 'p5' }),
  ];

  it('έληξε → λήγει → άγνωστη → ισχύει → αντικαταστάθηκε, σταθερή για κάθε σειρά εισόδου', () => {
    const order = ['expired', 'expiring', 'unknown', 'valid', 'old'];
    expect(registry(docs).rows.map((row) => row.document.id)).toEqual(order);
    expect(registry([...docs].reverse()).rows.map((row) => row.document.id)).toEqual(order);
  });

  it('μέσα στην ίδια κατάσταση: ό,τι μπλοκάρει πρώτα', () => {
    const rows = registry([pea('free', '2016-01-10', { propertyId: 'p9' }), pea('blocks', '2016-01-10')], [signing('2026-12-01')]).rows;
    expect(rows.map((row) => row.document.id)).toEqual(['blocks', 'free']);
  });

  it('οι μετρήσεις έχουν ΟΛΕΣ τις καταστάσεις, και τις μηδενικές', () => {
    expect(registry([]).tally).toEqual(Object.fromEntries(REGISTRY_ROW_STATES.map((state) => [state, 0])));
    expect(registry(docs).tally).toEqual({ expired: 1, expiring: 1, 'expiry-unknown': 1, valid: 1, superseded: 1 });
  });
});

describe('φίλτρα', () => {
  const printed = (id: string, day: string) => pea(id, null, { printedValidUntil: day, propertyId: id });
  const windowEnd = addDaysToDateKey(ASOF, REGISTRY_WINDOW_DAYS) as string;
  const nextDay = addDaysToDateKey(windowEnd, 1) as string;

  it(`κυλιόμενο παράθυρο ${REGISTRY_WINDOW_DAYS} ημερών: σήμερα και τελευταία μέρα μέσα · χθες και μετά έξω`, () => {
    const within = (day: string) => matchesRegistryFilter(only(printed('x', day)), 'within-window', ASOF);
    expect([within(ASOF), within(windowEnd), within(nextDay), within('2026-10-14')]).toEqual([true, true, false, false]);
  });

  it('«ώρα ανανέωσης» = λήγει ή έληξε · «άγνωστη» = μόνο άγνωστη', () => {
    expect(matchesRegistryFilter(only(pea('a', '2016-01-10')), 'renewal-due', ASOF)).toBe(true);
    expect(matchesRegistryFilter(only(pea('b', '2016-12-01')), 'renewal-due', ASOF)).toBe(true);
    expect(matchesRegistryFilter(only(pea('c', '2025-03-01')), 'renewal-due', ASOF)).toBe(false);
    expect(matchesRegistryFilter(only(pea('d', null)), 'expiry-unknown', ASOF)).toBe(true);
    expect(matchesRegistryFilter(only(pea('e', '2016-01-10')), 'expiry-unknown', ASOF)).toBe(false);
  });
});
