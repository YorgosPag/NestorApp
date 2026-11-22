/**
 * ADR-949 Α-2 — από γραμμή εγγράφου σε πρόταση, από αποδοχή σε αλλαγή προχείρου + δήλωση προέλευσης.
 */

import { E9_A_PAGES } from '@/lib/document-validity/__tests__/e9-text.fixture';

import { mergeDeclaredReadings, type ObjectiveValueDeclaredReading } from '../objective-value-declared-reading';
import {
  deviceReaderOf,
  readingApplicationOf,
  readingProposalOf,
  type ObjectiveValueDocumentRow,
} from '../objective-value-document-reading';
import { INITIAL_DRAFT, type ObjectiveValueDraft } from '../objective-value-draft';

const E9 = 'owner-e9';

function row(overrides: Partial<ObjectiveValueDocumentRow> = {}): ObjectiveValueDocumentRow {
  return {
    page: 2,
    form: 'residence',
    floor: 1,
    area: 93.51,
    ownership: { kind: 'full', pct: 100 },
    encumbrance: null,
    conditionToCheck: false,
    unfinished: false,
    constructionYear: 2003,
    address: null,
    ...overrides,
  };
}

describe('μητρώο αναγνωστών συσκευής', () => {
  it('το Ε9 διαβάζεται· τα υπόλοιπα έγγραφα του οδηγού όχι ακόμη (Α-3)', () => {
    expect(deviceReaderOf('owner-e9')).not.toBeNull();
    expect(deviceReaderOf('owner-enfia-assessment')).toBeNull();
    expect(deviceReaderOf('unit-permit')).toBeNull();
    expect(deviceReaderOf('title-deed')).toBeNull();
  });

  it('Ε9 → γραμμές στη γλώσσα του υπολογιστή: κατοικία όροφος 1 · αποθήκη υπόγειο = −1', () => {
    const rows = deviceReaderOf(E9)?.read(E9_A_PAGES);
    expect(rows).toEqual([
      expect.objectContaining({ page: 2, form: 'residence', floor: 1, area: 93.51, unfinished: false, ownership: { kind: 'full', pct: 100 } }),
      expect.objectContaining({ page: 2, form: 'storage', floor: -1, area: 8.61, encumbrance: null, conditionToCheck: false }),
    ]);
  });
});

describe('readingProposalOf', () => {
  it('κατοικία σε κενό πρόχειρο: όροφος + επιφάνεια, τρέχουσες κενές', () => {
    const proposal = readingProposalOf(E9, row(), INITIAL_DRAFT);
    expect(proposal).toEqual({
      source: { document: E9, page: 2 },
      form: 'residence',
      fields: [
        { field: 'floor', value: 1, current: null },
        { field: 'area', value: 93.51, current: null },
      ],
      flags: [],
    });
  });

  it('αποθήκη ενώ το πρόχειρο είναι κατοικία ⇒ μόνο επιφάνεια + σημαία «αλλάζει το είδος»', () => {
    const proposal = readingProposalOf(E9, row({ form: 'storage', floor: -1, area: 8.61 }), INITIAL_DRAFT);
    expect(proposal.fields).toEqual([{ field: 'area', value: 8.61, current: null }]);
    expect(proposal.flags).toEqual(['form-changes']);
  });

  it('μεζονέτα στο πρόχειρο ⇒ καμία πρόταση ορόφου/επιφάνειας, σημαία', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, levels: [{ floor: 1, area: 50 }, { floor: 2, area: 40 }] };
    const proposal = readingProposalOf(E9, row(), draft);
    expect(proposal.fields).toEqual([]);
    expect(proposal.flags).toEqual(['maisonette-single-row']);
  });

  it('είδος που δεν αποτιμάται ⇒ καμία πρόταση· ημιτελές ⇒ σημαία', () => {
    const proposal = readingProposalOf(E9, row({ form: null, unfinished: true }), INITIAL_DRAFT);
    expect(proposal).toMatchObject({ form: null, fields: [], flags: ['unfinished', 'form-unsupported'] });
  });

  it('πλήρης κυριότητα 100% σε κενό πρόχειρο ⇒ καμία πρόταση κυριότητας (κενό = 100%)', () => {
    const fields = readingProposalOf(E9, row(), INITIAL_DRAFT).fields.map(({ field }) => field);
    expect(fields).toEqual(['floor', 'area']);
  });

  it('πλήρης κυριότητα 50% ⇒ ποσοστό 50 + συνιδιοκτησία', () => {
    const proposal = readingProposalOf(E9, row({ ownership: { kind: 'full', pct: 50 } }), INITIAL_DRAFT);
    expect(proposal.fields.slice(2)).toEqual([
      { field: 'ownershipPct', value: 50, current: null },
      { field: 'coOwned', value: true, current: false },
    ]);
  });

  it('ψιλή κυριότητα / επικαρπία ⇒ καμία πρόταση κυριότητας, σημαία', () => {
    const proposal = readingProposalOf(E9, row({ ownership: { kind: 'other' } }), INITIAL_DRAFT);
    expect(proposal.fields.map(({ field }) => field)).toEqual(['floor', 'area']);
    expect(proposal.flags).toEqual(['right-not-full']);
  });

  it('δικαίωμα αδιάβαστο ⇒ σημαία', () => {
    expect(readingProposalOf(E9, row({ ownership: { kind: 'unread' } }), INITIAL_DRAFT).flags).toEqual(['ownership-unread']);
  });

  it('διατηρητέο ⇒ πρόταση ειδικής κατάστασης· απαλλοτρίωση ή κατεδάφιση ⇒ μόνο σημαία', () => {
    const listed = readingProposalOf(E9, row({ encumbrance: 'listed' }), INITIAL_DRAFT);
    expect(listed.fields).toContainEqual({ field: 'encumbrance', value: 'listed', current: 'none' });
    const check = readingProposalOf(E9, row({ conditionToCheck: true }), INITIAL_DRAFT);
    expect(check.fields.map(({ field }) => field)).toEqual(['floor', 'area']);
    expect(check.flags).toEqual(['condition-to-check']);
  });
});

describe('readingApplicationOf', () => {
  const proposal = readingProposalOf(E9, row(), INITIAL_DRAFT);

  it('αποδοχή όλων ⇒ επίπεδο 1 με όροφο και επιφάνεια + δύο δηλώσεις', () => {
    const application = readingApplicationOf(proposal, new Set(['floor', 'area'] as const), INITIAL_DRAFT);
    expect(application.patch).toEqual({ form: 'residence', levels: [{ floor: 1, area: 93.51 }] });
    expect(application.declared).toEqual([
      { target: { input: 'levelFloor', level: 0 }, value: 1, source: { document: E9, page: 2 } },
      { target: { input: 'levelArea', level: 0 }, value: 93.51, source: { document: E9, page: 2 } },
    ]);
  });

  it('μόνο επιφάνεια ⇒ ο όροφος του προχείρου μένει', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, levels: [{ floor: 3, area: null }] };
    const application = readingApplicationOf(readingProposalOf(E9, row(), draft), new Set(['area'] as const), draft);
    expect(application.patch).toEqual({ form: 'residence', levels: [{ floor: 3, area: 93.51 }] });
  });

  it('αποθήκη ⇒ είδος + επιφάνεια', () => {
    const storage = readingProposalOf(E9, row({ form: 'storage', floor: -1, area: 8.61 }), INITIAL_DRAFT);
    expect(readingApplicationOf(storage, new Set(['area'] as const), INITIAL_DRAFT).patch).toEqual({ form: 'storage', area: 8.61 });
  });

  it('μόνο τα κοινά πεδία ⇒ ποσοστό + συνιδιοκτησία + κατάσταση, χωρίς είδος και χωρίς δήλωση προέλευσης', () => {
    const shared = readingProposalOf(E9, row({ ownership: { kind: 'full', pct: 50 }, encumbrance: 'listed' }), INITIAL_DRAFT);
    const application = readingApplicationOf(shared, new Set(['ownershipPct', 'coOwned', 'encumbrance'] as const), INITIAL_DRAFT);
    expect(application).toEqual({ patch: { ownershipPct: 50, coOwned: true, encumbrance: 'listed' }, declared: [] });
  });

  it('ποσοστό 100 γράφεται ως κενό (σύμβαση του προχείρου)', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, ownershipPct: 50, coOwned: true };
    const full = readingProposalOf(E9, row(), draft);
    const application = readingApplicationOf(full, new Set(['ownershipPct', 'coOwned'] as const), draft);
    expect(application.patch).toEqual({ ownershipPct: null, coOwned: false });
  });

  it('καμία αποδοχή ⇒ καμία αλλαγή (ούτε το είδος)', () => {
    expect(readingApplicationOf(proposal, new Set(), INITIAL_DRAFT)).toEqual({ patch: {}, declared: [] });
  });
});

describe('mergeDeclaredReadings', () => {
  const source = { document: E9, page: 2 } as const;
  const floor: ObjectiveValueDeclaredReading = { target: { input: 'levelFloor', level: 0 }, value: 1, source };
  const area: ObjectiveValueDeclaredReading = { target: { input: 'area' }, value: 8.61, source };

  it('ίδια είσοδος ⇒ κερδίζει η νεότερη', () => {
    const newer = { ...floor, value: 2 };
    expect(mergeDeclaredReadings([floor], [newer])).toEqual([newer]);
  });

  it('αλλαγή είδους ⇒ οι δηλώσεις του παλιού είδους φεύγουν', () => {
    expect(mergeDeclaredReadings([floor], [area])).toEqual([area]);
    expect(mergeDeclaredReadings([area], [floor])).toEqual([floor]);
  });

  it('τίποτα νέο ⇒ τίποτα δεν αλλάζει', () => {
    expect(mergeDeclaredReadings([floor], [])).toEqual([floor]);
  });
});
