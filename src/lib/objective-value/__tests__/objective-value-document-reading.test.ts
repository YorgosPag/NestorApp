/**
 * ADR-949 Α-2 · Α-3 — από γραμμή εγγράφου σε πρόταση (+ σημαίες, διασταύρωση τιμής ζώνης), από αποδοχή σε αλλαγή
 * προχείρου + δήλωση προέλευσης.
 */

import { mergeDeclaredReadings, type ObjectiveValueDeclaredReading } from '../objective-value-declared-reading';
import type { ObjectiveValuePermitRow, ObjectiveValuePropertyRow } from '../objective-value-device-readers';
import { readingApplicationOf, readingProposalOf, zoneCheckOf } from '../objective-value-document-reading';
import { INITIAL_DRAFT, type ObjectiveValueDraft } from '../objective-value-draft';

const E9 = 'owner-e9';
const ENFIA = 'owner-enfia-assessment';
const PERMIT = 'unit-permit';

function row(overrides: Partial<ObjectiveValuePropertyRow> = {}): ObjectiveValuePropertyRow {
  return {
    kind: 'property',
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
    zoneEvidence: null,
    ...overrides,
  };
}

function permit(overrides: Partial<ObjectiveValuePermitRow> = {}): ObjectiveValuePermitRow {
  return { kind: 'permit', page: 1, act: 'initial', issuedOn: '2020-06-09', originalPermit: null, ...overrides };
}

describe('readingProposalOf — γραμμή ακινήτου', () => {
  it('κατοικία σε κενό πρόχειρο: όροφος + επιφάνεια, τρέχουσες κενές', () => {
    const proposal = readingProposalOf(E9, row(), INITIAL_DRAFT, null);
    expect(proposal).toEqual({
      source: { document: E9, page: 2 },
      form: 'residence',
      fields: [
        { field: 'floor', value: 1, current: null },
        { field: 'area', value: 93.51, current: null },
      ],
      flags: [],
      zoneCheck: null,
      originalPermit: null,
    });
  });

  it('αποθήκη ενώ το πρόχειρο είναι κατοικία ⇒ μόνο επιφάνεια + σημαία «αλλάζει το είδος»', () => {
    const proposal = readingProposalOf(E9, row({ form: 'storage', floor: -1, area: 8.61 }), INITIAL_DRAFT, null);
    expect(proposal.fields).toEqual([{ field: 'area', value: 8.61, current: null }]);
    expect(proposal.flags).toEqual(['form-changes']);
  });

  it('μεζονέτα στο πρόχειρο ⇒ καμία πρόταση ορόφου/επιφάνειας, σημαία', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, levels: [{ floor: 1, area: 50 }, { floor: 2, area: 40 }] };
    const proposal = readingProposalOf(E9, row(), draft, null);
    expect(proposal.fields).toEqual([]);
    expect(proposal.flags).toEqual(['maisonette-single-row']);
  });

  it('είδος που δεν αποτιμάται ⇒ καμία πρόταση· ημιτελές ⇒ σημαία', () => {
    const proposal = readingProposalOf(E9, row({ form: null, unfinished: true }), INITIAL_DRAFT, null);
    expect(proposal).toMatchObject({ form: null, fields: [], flags: ['unfinished', 'form-unsupported'] });
  });

  it('πλήρης κυριότητα 100% σε κενό πρόχειρο ⇒ καμία πρόταση κυριότητας (κενό = 100%)', () => {
    const fields = readingProposalOf(E9, row(), INITIAL_DRAFT, null).fields.map(({ field }) => field);
    expect(fields).toEqual(['floor', 'area']);
  });

  it('πλήρης κυριότητα 50% ⇒ ποσοστό 50 + συνιδιοκτησία', () => {
    const proposal = readingProposalOf(E9, row({ ownership: { kind: 'full', pct: 50 } }), INITIAL_DRAFT, null);
    expect(proposal.fields.slice(2)).toEqual([
      { field: 'ownershipPct', value: 50, current: null },
      { field: 'coOwned', value: true, current: false },
    ]);
  });

  it('ψιλή κυριότητα / επικαρπία ⇒ καμία πρόταση κυριότητας, σημαία', () => {
    const proposal = readingProposalOf(E9, row({ ownership: { kind: 'other' } }), INITIAL_DRAFT, null);
    expect(proposal.fields.map(({ field }) => field)).toEqual(['floor', 'area']);
    expect(proposal.flags).toEqual(['right-not-full']);
  });

  it('δικαίωμα αδιάβαστο ⇒ σημαία', () => {
    expect(readingProposalOf(E9, row({ ownership: { kind: 'unread' } }), INITIAL_DRAFT, null).flags).toEqual(['ownership-unread']);
  });

  it('διατηρητέο ⇒ πρόταση ειδικής κατάστασης· απαλλοτρίωση ή κατεδάφιση ⇒ μόνο σημαία', () => {
    const listed = readingProposalOf(E9, row({ encumbrance: 'listed' }), INITIAL_DRAFT, null);
    expect(listed.fields).toContainEqual({ field: 'encumbrance', value: 'listed', current: 'none' });
    const check = readingProposalOf(E9, row({ conditionToCheck: true }), INITIAL_DRAFT, null);
    expect(check.fields.map(({ field }) => field)).toEqual(['floor', 'area']);
    expect(check.flags).toEqual(['condition-to-check']);
  });

  it('ΕΝΦΙΑ: η τιμή ζώνης ΔΕΝ γίνεται ποτέ πεδίο — μόνο διασταύρωση', () => {
    const proposal = readingProposalOf(ENFIA, row({ zoneEvidence: { price: 650, year: 2020 } }), INITIAL_DRAFT, { price: 650, validFrom: '2018-06-01' });
    expect(proposal.fields.map(({ field }) => field)).toEqual(['floor', 'area']);
    expect(proposal.zoneCheck).toEqual({ kind: 'agrees', year: 2020, price: 650 });
  });
});

describe('zoneCheckOf — τεκμήριο με «ισχύει κατά»', () => {
  const evidence = { price: 650, year: 2020 };

  it('χωρίς τεκμήριο (Ε9) ⇒ καμία διασταύρωση', () => {
    expect(zoneCheckOf(null, { price: 650, validFrom: '2022-01-01' })).toBeNull();
  });

  it('χωρίς ζώνη χάρτη ⇒ «δείξτε τη θέση»', () => {
    expect(zoneCheckOf(evidence, null)).toEqual({ kind: 'needs-location', year: 2020, documentPrice: 650 });
  });

  it('ίδια τιμή ⇒ συμφωνεί, ακόμη κι αν η ζώνη αναθεωρήθηκε αργότερα', () => {
    expect(zoneCheckOf(evidence, { price: 650, validFrom: '2022-01-01' })).toEqual({ kind: 'agrees', year: 2020, price: 650 });
  });

  it('ΕΝΦΙΑ 2020 πριν από ζώνη «ισχύει από 1/1/2022», άλλη τιμή ⇒ παλαιότερη (superseded)', () => {
    expect(zoneCheckOf(evidence, { price: 1000, validFrom: '2022-01-01' })).toEqual({
      kind: 'superseded', year: 2020, documentPrice: 650, validFrom: '2022-01-01',
    });
  });

  it('ίδια περίοδος, άλλη τιμή ⇒ διαφέρει (μέτωπο; λάθος σημείο;)', () => {
    expect(zoneCheckOf(evidence, { price: 800, validFrom: '2020-01-01' })).toEqual({
      kind: 'differs', year: 2020, documentPrice: 650, mapPrice: 800,
    });
  });
});

describe('readingProposalOf — πράξη άδειας', () => {
  it('αρχική οικοδομική άδεια ⇒ πρόταση ημερομηνίας άδειας, χωρίς είδος', () => {
    expect(readingProposalOf(PERMIT, permit(), INITIAL_DRAFT, null)).toEqual({
      source: { document: PERMIT, page: 1 },
      form: null,
      fields: [{ field: 'permitDate', value: '2020-06-09', current: null }],
      flags: [],
      zoneCheck: null,
      originalPermit: null,
    });
  });

  it('ίδια ημερομηνία με το πρόχειρο ⇒ τίποτα να προταθεί', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, permitDate: '2020-06-09' };
    expect(readingProposalOf(PERMIT, permit(), draft, null).fields).toEqual([]);
  });

  it('αρχική άδεια χωρίς αναγνώσιμη ημερομηνία ⇒ σημαία, καμία πρόταση', () => {
    const proposal = readingProposalOf(PERMIT, permit({ issuedOn: null }), INITIAL_DRAFT, null);
    expect(proposal).toMatchObject({ fields: [], flags: ['permit-date-unread'] });
  });

  it('ενημέρωση ⇒ ΚΑΜΙΑ ημερομηνία (θα ήταν της ενημέρωσης) + σημαία που ονομάζει την αρχική', () => {
    const original = { number: '417', year: 2008 };
    const proposal = readingProposalOf(PERMIT, permit({ act: 'update', issuedOn: '2026-11-10', originalPermit: original }), INITIAL_DRAFT, null);
    expect(proposal).toMatchObject({ fields: [], flags: ['permit-update'], originalPermit: original });
    const unnamed = readingProposalOf(PERMIT, permit({ act: 'update', issuedOn: '2026-11-10' }), INITIAL_DRAFT, null);
    expect(unnamed.flags).toEqual(['permit-update-unnamed']);
  });

  it('μικρή κλίμακα · άγνωστος τύπος ⇒ καμία ημερομηνία, σημαία', () => {
    expect(readingProposalOf(PERMIT, permit({ act: 'minor-works', issuedOn: '2018-11-27' }), INITIAL_DRAFT, null))
      .toMatchObject({ fields: [], flags: ['permit-minor-works'] });
    expect(readingProposalOf(PERMIT, permit({ act: 'unsupported' }), INITIAL_DRAFT, null).flags).toEqual(['permit-unsupported']);
  });
});

describe('readingApplicationOf', () => {
  const proposal = readingProposalOf(E9, row(), INITIAL_DRAFT, null);

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
    const application = readingApplicationOf(readingProposalOf(E9, row(), draft, null), new Set(['area'] as const), draft);
    expect(application.patch).toEqual({ form: 'residence', levels: [{ floor: 3, area: 93.51 }] });
  });

  it('αποθήκη ⇒ είδος + επιφάνεια', () => {
    const storage = readingProposalOf(E9, row({ form: 'storage', floor: -1, area: 8.61 }), INITIAL_DRAFT, null);
    expect(readingApplicationOf(storage, new Set(['area'] as const), INITIAL_DRAFT).patch).toEqual({ form: 'storage', area: 8.61 });
  });

  it('μόνο τα κοινά πεδία ⇒ ποσοστό + συνιδιοκτησία + κατάσταση, χωρίς είδος και χωρίς δήλωση προέλευσης', () => {
    const shared = readingProposalOf(E9, row({ ownership: { kind: 'full', pct: 50 }, encumbrance: 'listed' }), INITIAL_DRAFT, null);
    const application = readingApplicationOf(shared, new Set(['ownershipPct', 'coOwned', 'encumbrance'] as const), INITIAL_DRAFT);
    expect(application).toEqual({ patch: { ownershipPct: 50, coOwned: true, encumbrance: 'listed' }, declared: [] });
  });

  it('ποσοστό 100 γράφεται ως κενό (σύμβαση του προχείρου)', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, ownershipPct: 50, coOwned: true };
    const full = readingProposalOf(E9, row(), draft, null);
    const application = readingApplicationOf(full, new Set(['ownershipPct', 'coOwned'] as const), draft);
    expect(application.patch).toEqual({ ownershipPct: null, coOwned: false });
  });

  it('ημερομηνία άδειας ⇒ μόνο αυτή στο πρόχειρο (ποτέ το είδος) + δήλωση προέλευσης', () => {
    const fromPermit = readingProposalOf(PERMIT, permit(), INITIAL_DRAFT, null);
    expect(readingApplicationOf(fromPermit, new Set(['permitDate'] as const), INITIAL_DRAFT)).toEqual({
      patch: { permitDate: '2020-06-09' },
      declared: [{ target: { input: 'permitDate' }, value: '2020-06-09', source: { document: PERMIT, page: 1 } }],
    });
  });

  it('καμία αποδοχή ⇒ καμία αλλαγή (ούτε το είδος)', () => {
    expect(readingApplicationOf(proposal, new Set(), INITIAL_DRAFT)).toEqual({ patch: {}, declared: [] });
  });
});

describe('mergeDeclaredReadings', () => {
  const source = { document: E9, page: 2 } as const;
  const floor: ObjectiveValueDeclaredReading = { target: { input: 'levelFloor', level: 0 }, value: 1, source };
  const area: ObjectiveValueDeclaredReading = { target: { input: 'area' }, value: 8.61, source };
  const permitDate: ObjectiveValueDeclaredReading = { target: { input: 'permitDate' }, value: '2020-06-09', source: { document: PERMIT, page: 1 } };

  it('ίδια είσοδος ⇒ κερδίζει η νεότερη', () => {
    const newer: ObjectiveValueDeclaredReading = { target: { input: 'levelFloor', level: 0 }, value: 2, source };
    expect(mergeDeclaredReadings([floor], [newer])).toEqual([newer]);
  });

  it('αλλαγή είδους ⇒ οι δηλώσεις θέσης του παλιού είδους φεύγουν', () => {
    expect(mergeDeclaredReadings([floor], [area])).toEqual([area]);
    expect(mergeDeclaredReadings([area], [floor])).toEqual([floor]);
  });

  it('η ημερομηνία άδειας είναι κοινή: ούτε διώχνει θέση, ούτε διώχνεται από αλλαγή είδους', () => {
    expect(mergeDeclaredReadings([floor], [permitDate])).toEqual([floor, permitDate]);
    expect(mergeDeclaredReadings([permitDate, floor], [area])).toEqual([permitDate, area]);
  });

  it('τίποτα νέο ⇒ τίποτα δεν αλλάζει', () => {
    expect(mergeDeclaredReadings([floor], [])).toEqual([floor]);
  });
});
