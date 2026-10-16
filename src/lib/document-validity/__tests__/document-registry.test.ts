/**
 * ADR-915 Φ4α — το μητρώο λήξεων ως ΠΑΡΑΓΟΜΕΝΗ όψη. Συνθετικά δεδομένα μόνο.
 */

import {
  REGISTRY_FILTERS,
  REGISTRY_ROW_STATES,
  REGISTRY_WINDOW_DAYS,
  documentRegistry,
  matchesRegistryFilter,
  registryRowIdOf,
  type RegistryDocument,
  type RegistryDocumentRow,
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
  basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
});
const listing = (policy: 'block' | 'warn' = 'warn'): DocumentRequirement => ({
  documentKind: 'energy-certificate', subject: { propertyId: 'p1' }, process: { kind: 'listing-publication', listingId: 'p1' },
  neededOn: { kind: 'continuous' }, policy, warnWindowDays: 60, basis: { kind: 'statute', statute: 'ν.4122/2013' },
  presence: 'required', attestation: null,
});

const registry = (documents: RegistryDocument[], requirements: DocumentRequirement[] = []) =>
  documentRegistry({ documents, requirements, asOf: ASOF });
/** Η γραμμή ως ΕΓΓΡΑΦΟ — κενό εδώ θα ήταν λάθος της άγκυρας, όχι του πυρήνα. */
function asDocument(row: RegistryRow | undefined): RegistryDocumentRow {
  if (row?.kind !== 'document') throw new Error('αναμενόταν γραμμή εγγράφου');
  return row;
}
const only = (document: RegistryDocument, requirements: DocumentRequirement[] = []): RegistryDocumentRow =>
  asDocument(registry([document], requirements).rows[0]);
const byId = (rows: readonly RegistryRow[], id: string): RegistryRow | undefined => rows.find((row) => registryRowIdOf(row) === id);
const ids = (rows: readonly RegistryRow[]): string[] => rows.map(registryRowIdOf);

describe('κατάσταση — ο ΙΔΙΟΣ κριτής, παράθυρο = χρόνος ανανέωσης του είδους', () => {
  it('ΠΕΑ: έληξε · λήγει μέσα στις 60 ημέρες ανανέωσης · ισχύει', () => {
    expect(only(pea('a', '2016-01-10')).state).toBe('expired');
    expect(only(pea('b', '2016-12-01')).state).toBe('expiring');
    expect(only(pea('c', '2016-12-15')).state).toBe('valid');
  });

  it('χωρίς έκδοση ⇒ `expiry-unknown`, ποτέ `valid`', () => {
    expect(only(pea('a', null)).state).toBe('expiry-unknown');
  });

  it('βεβαίωση άρθρου 83: 2 μήνες από την υπογραφή (παρ. 6 — ADR-915 §13), όχι πια `expiry-unknown`', () => {
    const row = only(pea('b', '2026-01-01', { kind: 'building-identity' }));
    expect([row.state, row.expiry.expiresOn]).toEqual(['expired', '2026-03-01']);
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
    const old = asDocument(byId(rows, 'old'));
    expect(old).toMatchObject({ state: 'superseded', supersededBy: 'new', dependents: [], blocking: false });
    expect(byId(rows, 'new')?.state).toBe('valid');
  });

  it('το αρχείο που ονομάζει το ακίνητο (`pinned`) είναι τρέχον ακόμη κι αν υπάρχει νεότερη έκδοση', () => {
    const { rows } = registry([pea('pinned', '2020-01-01', { pinned: true }), pea('newer', '2024-01-01')]);
    expect(asDocument(byId(rows, 'newer')).supersededBy).toBe('pinned');
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
    const old = byId(registry([lonely, pea('new', '2024-05-01')]).rows, 'old');
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

  it('απαίτηση άλλου ακινήτου ή έγγραφο χωρίς ακίνητο (χωρίς έγκριση) ⇒ τίποτα δεν σταματά', () => {
    expect(asDocument(byId(registry([pea('a', '2016-01-10')], [signing('2026-12-01', 'p2')]).rows, 'a')).dependents).toEqual([]);
    expect(asDocument(byId(registry([pea('b', '2016-01-10', { propertyId: null })], [signing('2026-12-01')]).rows, 'b')).dependents).toEqual([]);
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
    expect(ids(registry(docs).rows)).toEqual(order);
    expect(ids(registry([...docs].reverse()).rows)).toEqual(order);
  });

  it('μέσα στην ίδια κατάσταση: ό,τι μπλοκάρει πρώτα', () => {
    const rows = registry([pea('free', '2016-01-10', { propertyId: 'p9' }), pea('blocks', '2016-01-10')], [signing('2026-12-01')]).rows;
    expect(ids(rows)).toEqual(['blocks', 'free']);
  });

  it('οι μετρήσεις έχουν ΟΛΕΣ τις καταστάσεις, και τις μηδενικές', () => {
    expect(registry([]).tally).toEqual(Object.fromEntries(REGISTRY_ROW_STATES.map((state) => [state, 0])));
    expect(registry(docs).tally).toEqual({ expired: 1, missing: 0, expiring: 1, 'expiry-unknown': 1, valid: 1, superseded: 1 });
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

// =============================================================================
// Φ4δ — το μητρώο λέει και ό,τι ΛΕΙΠΕΙ
// =============================================================================

const caseOn = (caseId: string, propertyId: string, extra: Partial<DocumentRequirement> = {}): DocumentRequirement =>
  ({ ...signing('2026-12-01', propertyId), process: { kind: 'conveyance', caseId }, ...extra });
const gapOf = (rows: readonly RegistryRow[], propertyId: string, kind = 'energy-certificate') =>
  rows.find((row) => row.kind === 'gap' && row.gap.propertyId === propertyId && row.gap.kind === kind);
/** Πόσες φορές εμφανίζεται κάθε απαίτηση σε ΟΛΕΣ τις γραμμές — ο «ένας κάτοχος». */
const holdings = (rows: readonly RegistryRow[]) => rows.flatMap((row) => row.dependents.map((d) => d.requirement));

describe('Φ4δ Ε7 — «λείπει»: απαίτηση `required` χωρίς έγγραφο', () => {
  it('ακίνητο με υπόθεση και ΚΑΝΕΝΑ ΠΕΑ ⇒ μία γραμμή `missing` που μπλοκάρει, στο `tally`', () => {
    const { rows, tally } = registry([], [caseOn('c1', 'p9')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'gap', state: 'missing', blocking: true, gap: { id: 'missing:p9:energy-certificate', propertyId: 'p9' } });
    expect(rows[0].dependents.map((d) => d.impact)).toEqual(['absent']);
    expect(tally.missing).toBe(1);
  });

  it('δύο διαδικασίες για το ίδιο (ακίνητο, είδος) ⇒ ΜΙΑ γραμμή με δύο «ποιος το ζητά»· μόνο `warn` ⇒ δεν μπλοκάρει', () => {
    const both = registry([], [caseOn('c1', 'p1'), listing('warn')]).rows;
    expect(both).toHaveLength(1);
    expect(both[0].dependents.map((d) => d.requirement.process.kind)).toEqual(['conveyance', 'listing-publication']);
    expect(registry([], [listing('warn')]).rows[0]).toMatchObject({ state: 'missing', blocking: false });
  });

  it('`tracked` (άγνωστο γεγονός · ανοιχτή ερώτηση) ⇒ ΚΑΜΙΑ γραμμή — «λείπει» από άγνοια δεν λέγεται', () => {
    expect(registry([], [caseOn('c1', 'p9', { presence: 'tracked' })]).rows).toEqual([]);
  });

  it('υπάρχει έγγραφο — ακόμη και άγνωστης λήξης ή ληγμένο ⇒ κανένα κενό, η απαίτηση στη γραμμή του', () => {
    for (const issuedOn of [null, '2016-01-10', '2025-03-01']) {
      const { rows } = registry([pea('a', issuedOn)], [caseOn('c1', 'p1')]);
      expect(rows.map((row) => row.kind)).toEqual(['document']);
      expect(rows[0].dependents).toHaveLength(1);
    }
  });

  it('φίλτρα: το κενό ταιριάζει ΜΟΝΟ στο «λείπουν» και στο «μπλοκάρουν» · σειρά: αμέσως μετά το «έληξε»', () => {
    const gap = registry([], [caseOn('c1', 'p9')]).rows[0];
    expect(REGISTRY_FILTERS.filter((filter) => matchesRegistryFilter(gap, filter, ASOF))).toEqual(['missing', 'blocking']);
    expect(matchesRegistryFilter(only(pea('a', '2016-01-10')), 'missing', ASOF)).toBe(false);
    const order = registry([pea('x', '2016-01-10', { propertyId: 'p2' }), pea('y', '2016-12-01', { propertyId: 'p3' })], [caseOn('c1', 'p9')]).rows;
    expect(order.map((row) => row.state)).toEqual(['expired', 'missing', 'expiring']);
  });
});

describe('Φ4δ Ε8 — η έγκριση επαγγελματία είναι έγγραφο (ποτέ ψευδές «λείπει»)', () => {
  const approved = (fileId: string | null, issuedOn: string | null) => ({ attestation: { fileId, issuedOn } });

  it('ταυτότητα κτιρίου εγκεκριμένη ΕΚΤΟΣ πλατφόρμας ⇒ γραμμή `attested` με λήξη από την έκδοση του ελεγκτή, κανένα κενό', () => {
    const { rows } = registry([], [caseOn('c1', 'p1', { documentKind: 'building-identity', ...approved(null, '2026-09-01') })]);
    expect(rows).toHaveLength(1);
    expect(asDocument(rows[0]).document).toMatchObject({ id: 'attested:c1:building-identity', origin: { kind: 'attested', caseId: 'c1', fileId: null } });
    expect([rows[0].state, asDocument(rows[0]).expiry.expiresOn]).toEqual(['valid', '2026-11-01']);
  });

  it('ΠΕΑ εγκεκριμένο με αρχείο που το μητρώο δεν διάβασε ⇒ γραμμή με την έκδοση του ελεγκτή', () => {
    const row = asDocument(registry([], [caseOn('c1', 'p1', approved('f-unread', '2016-01-10'))]).rows[0]);
    expect([row.state, row.expiry.expiresOn, row.document.origin]).toEqual(['expired', '2026-01-10', { kind: 'attested', caseId: 'c1', fileId: 'f-unread' }]);
  });

  it('το ΙΔΙΟ έγγραφο ήδη γνωστό (ίδιο ακίνητο, ίδια έκδοση) ⇒ ΚΑΜΙΑ δεύτερη γραμμή', () => {
    const { rows } = registry([pea('declared:p1:energy-certificate', '2020-05-01', { origin: { kind: 'declared' } })], [caseOn('c1', 'p1', approved(null, '2020-05-01'))]);
    expect(ids(rows)).toEqual(['declared:p1:energy-certificate']);
  });

  it('δύο υποθέσεις που ενέκριναν το ίδιο αρχείο ⇒ μία γραμμή, και τις κρατά και τις δύο', () => {
    const { rows } = registry([], [caseOn('c1', 'p1', approved('f-x', null)), caseOn('c2', 'p1', approved('f-x', null))]);
    expect(rows).toHaveLength(1);
    expect(rows[0].dependents).toHaveLength(2);
  });
});

describe('Φ4δ Ε9 — Δ3: ΠΕΑ επιπέδου έργου, ένας κάτοχος ανά απαίτηση', () => {
  const projectPea = pea('f-project', '2016-01-10', { propertyId: null });
  const bound = (caseId: string, propertyId: string) => caseOn(caseId, propertyId, { attestation: { fileId: 'f-project', issuedOn: null } });

  it('ένα αρχείο έργου ⇒ ΜΙΑ γραμμή που κρατά τις υποθέσεις που το ενέκριναν, όσα ακίνητα κι αν αφορούν', () => {
    const { rows, tally } = registry([projectPea], [bound('c1', 'p1'), bound('c2', 'p2')]);
    expect(ids(rows)).toEqual(['f-project']);
    expect(rows[0]).toMatchObject({ state: 'expired', blocking: true });
    expect(rows[0].dependents.map((d) => d.requirement.subject.propertyId)).toEqual(['p1', 'p2']);
    expect(tally.expired + tally.missing).toBe(1);
  });

  it('υπόθεση που ΔΕΝ το ενέκρινε (άλλο ακίνητο του ίδιου έργου) ⇒ «λείπει», όχι σιωπηρή κάλυψη από το έργο', () => {
    const { rows } = registry([projectPea], [bound('c1', 'p1'), caseOn('c2', 'p2')]);
    expect(gapOf(rows, 'p2')).toBeDefined();
    expect(asDocument(byId(rows, 'f-project')).dependents.map((d) => d.requirement.process)).toEqual([{ kind: 'conveyance', caseId: 'c1' }]);
  });

  it('το ακίνητο έχει ΚΑΙ δικό του ΠΕΑ ⇒ η υπόθεση μετρά ΜΟΝΟ κάτω από το εγκεκριμένο αρχείο', () => {
    const { rows } = registry([projectPea, pea('own', '2025-03-01')], [bound('c1', 'p1'), listing('warn')]);
    expect(asDocument(byId(rows, 'f-project')).dependents.map((d) => d.requirement.process.kind)).toEqual(['conveyance']);
    expect(asDocument(byId(rows, 'own')).dependents.map((d) => d.requirement.process.kind)).toEqual(['listing-publication']);
  });

  it('εγκεκριμένο αρχείο ακινήτου που αντικαταστάθηκε (Α5) ⇒ την υπόθεση την κουβαλά το τρέχον, ποτέ κανείς', () => {
    const old = pea('old', '2014-01-01');
    const { rows } = registry([old, pea('new', '2024-01-01')], [caseOn('c1', 'p1', { attestation: { fileId: 'old', issuedOn: null } })]);
    expect(asDocument(byId(rows, 'new')).dependents).toHaveLength(1);
    expect(asDocument(byId(rows, 'old')).dependents).toEqual([]);
  });

  it('αμετάβλητο: κάθε απαίτηση `required` εμφανίζεται ΑΚΡΙΒΩΣ μία φορά σε όλο το μητρώο', () => {
    const requirements = [bound('c1', 'p1'), bound('c2', 'p2'), caseOn('c3', 'p3'), listing('warn'), caseOn('c4', 'p4', { documentKind: 'building-identity' })];
    const { rows } = registry([projectPea, pea('own', '2025-03-01'), pea('p3-old', '2014-01-01', { propertyId: 'p3' })], requirements);
    const held = holdings(rows);
    for (const requirement of requirements) expect(held.filter((r) => r === requirement)).toHaveLength(1);
  });
});
