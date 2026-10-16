/**
 * ADR-901 §5.5 — παραγωγή κατάστασης καταλόγου. Κάθε test ρωτά ΜΙΑ κατάσταση ή ΕΝΑΝ
 * κανόνα, με γραμμές του πραγματικού καταλόγου (όχι ψεύτικες) όπου μετράει η αντιστοίχιση.
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { ChecklistItemOverride, EvidenceFile } from '@/types/conveyance-case';
import { deriveChecklist, type DeriveChecklistInput } from '../derive-checklist';
import type { FactValues } from '../derive-facts';
import { sellerRowKey, testFacts, testRows } from '../__fixtures__/case-rows-fixture';

function item(id: string): ChecklistItem {
  const found = getChecklistItem(id);
  if (!found) throw new Error(`missing catalog item ${id}`);
  return found;
}

function file(overrides: Partial<EvidenceFile> = {}): EvidenceFile {
  return {
    fileId: 'file_1', displayName: 'permit.pdf', entityType: 'project', entityId: 'proj_1',
    purpose: 'permit', source: { kind: 'owned' }, level: 'project', fingerprint: 'file_1:0:2026-09-01', createdAt: '2026-09-01T10:00:00Z', documentFacts: null,
    ...overrides,
  };
}

/** Γραμμές καταλόγου + επίπεδα γεγονότα ⇒ η είσοδος της παραγωγής, μέσα από τον ίδιο επιλυτή (`testRows`/`testFacts`). */
type TestInput = Omit<Partial<DeriveChecklistInput>, 'rows' | 'facts'> & {
  readonly items?: readonly ChecklistItem[];
  readonly facts?: FactValues;
};

function input({ items = [item('building_permit')], facts = {}, ...rest }: TestInput = {}): DeriveChecklistInput {
  return {
    rows: testRows(items), facts: testFacts(facts), overrides: {}, evidence: [], sealed: [],
    today: '2026-10-02', targetSigningDate: null, viewer: 'host', ...rest,
  };
}

function statusOf(overrides: TestInput): string {
  return deriveChecklist(input(overrides)).rows[0].status;
}

const accepted = (extra: Partial<NonNullable<ChecklistItemOverride['review']>> = {}): Record<string, ChecklistItemOverride> => ({
  building_permit: {
    review: {
      verdict: 'accepted', fileId: 'file_1', fileFingerprint: 'file_1:0:2026-09-01', issuedOn: null, printedValidUntil: null,
      reason: null, reviewedBy: 'u1', reviewedAt: '2026-09-02T00:00:00Z', ...extra,
    },
  },
});

describe('deriveChecklist — καταστάσεις', () => {
  it('missing: καμία απόδειξη, κανένας έλεγχος', () => {
    expect(statusOf({})).toBe('missing');
  });

  it('uploaded: αρχείο έργου με purpose permit ⇒ η γραμμή γεμίζει ΜΟΝΗ της (Σ-1)', () => {
    expect(statusOf({ evidence: [file()] })).toBe('uploaded');
  });

  it('το ίδιο purpose σε ΑΛΛΟ επίπεδο δεν μετράει (Ε-Β: permit μοιράζεται property/project)', () => {
    const wrongLevel = file({ level: 'building', entityType: 'building' });
    expect(statusOf({ evidence: [wrongLevel] })).toBe('missing');
  });

  it('accepted: έλεγχος δεμένος στο νεότερο αρχείο', () => {
    expect(statusOf({ evidence: [file()], overrides: accepted() })).toBe('accepted');
  });

  it('stale: νέα έκδοση του ίδιου αρχείου μετά την αποδοχή', () => {
    expect(statusOf({ evidence: [file({ fingerprint: 'file_1:1:2026-09-20' })], overrides: accepted() })).toBe('stale');
  });

  it('stale: νεότερο αρχείο ανέβηκε μετά την αποδοχή', () => {
    const newer = file({ fileId: 'file_2', fingerprint: 'file_2:0:x', createdAt: '2026-09-30T00:00:00Z' });
    expect(statusOf({ evidence: [file(), newer], overrides: accepted() })).toBe('stale');
  });

  it('rejected: επιστροφή με λόγο', () => {
    expect(statusOf({ evidence: [file()], overrides: accepted({ verdict: 'rejected', reason: 'χωρίς σφραγίδα' }) })).toBe('rejected');
  });

  it('rejected → uploaded όταν ξαναανέβει (revise & resubmit)', () => {
    const resubmitted = file({ fileId: 'file_2', fingerprint: 'file_2:0:x', createdAt: '2026-09-30T00:00:00Z' });
    expect(statusOf({ evidence: [file(), resubmitted], overrides: accepted({ verdict: 'rejected', reason: 'x' }) })).toBe('uploaded');
  });

  it('notary_side: το εκδίδει ο συμβολαιογράφος', () => {
    expect(statusOf({ items: [item('final_contract')] })).toBe('notary_side');
  });

  it('notary_side: notaryFallback χωρίς αρχείο — όχι missing', () => {
    expect(statusOf({ items: [item('encumbrance_certificate')] })).toBe('notary_side');
  });

  it('needs_answer: γραμμή υπό όρους με άγνωστο γεγονός', () => {
    const row = deriveChecklist(input({ items: [item('seller_power_of_attorney')] })).rows[0];
    expect(row.status).toBe('needs_answer');
    expect(row.pendingFact).toBe('seller_by_proxy');
  });

  it('not_applicable (fact): το γεγονός απαντήθηκε αντίθετα', () => {
    const row = deriveChecklist(input({ items: [item('seller_power_of_attorney')], facts: { seller_by_proxy: false } })).rows[0];
    expect([row.status, row.notApplicableBy]).toEqual(['not_applicable', 'fact']);
  });

  it('not_applicable (manual): ρητή σήμανση υπερισχύει αρχείων', () => {
    const overrides = { building_permit: { notApplicable: { reason: 'r', markedBy: 'u', markedAt: 't' } } };
    const row = deriveChecklist(input({ evidence: [file()], overrides })).rows[0];
    expect([row.status, row.notApplicableBy]).toEqual(['not_applicable', 'manual']);
  });

  it('offline: επιβεβαίωση παραλαβής χωρίς αρχείο ⇒ accepted', () => {
    const overrides = {
      building_identity: { review: { verdict: 'accepted' as const, fileId: null, fileFingerprint: null, issuedOn: null, printedValidUntil: null, reason: null, reviewedBy: 'u', reviewedAt: 't' } },
    };
    expect(statusOf({ items: [item('building_identity')], overrides })).toBe('accepted');
  });
});

describe('deriveChecklist — ισχύς (Σ-5)', () => {
  const energy = (issuedOn: string, extra: TestInput = {}) => {
    const evidence = [file({ level: 'property', entityType: 'property', purpose: 'certificate' })];
    const overrides = {
      energy_certificate: { review: { verdict: 'accepted' as const, fileId: 'file_1', fileFingerprint: 'file_1:0:2026-09-01', issuedOn, printedValidUntil: null, reason: null, reviewedBy: 'u', reviewedAt: 't' } },
    };
    return deriveChecklist(input({ items: [item('energy_certificate')], evidence, overrides, ...extra })).rows[0];
  };

  it('expired: η λήξη πέρασε', () => {
    expect(energy('2016-01-01').status).toBe('expired');
  });

  it('expiring: λήγει μέσα σε 7 ημέρες', () => {
    expect(energy('2016-10-06').status).toBe('expiring');
  });

  it('expiring: ισχύει σήμερα αλλά ΟΧΙ την ημέρα υπογραφής', () => {
    const row = energy('2016-11-01', { targetSigningDate: '2026-12-15' });
    expect([row.status, row.validOnSigning]).toEqual(['expiring', false]);
  });

  it('accepted: ισχύει και την ημέρα υπογραφής', () => {
    const row = energy('2025-01-01', { targetSigningDate: '2026-12-15' });
    expect([row.status, row.validOnSigning]).toEqual(['accepted', true]);
  });

  // ADR-915 Φ2 — άγκυρες συμπεριφοράς γραμμένες ΠΡΙΝ το `validityOf` αναθέσει στο `documentStanding`.
  it('η τελευταία μέρα είναι ΜΕΣΑ: λήγει σήμερα ⇒ `expiring`, όχι `expired`', () => {
    const row = energy('2016-10-02');
    expect([row.status, row.expiresOn]).toEqual(['expiring', '2026-10-02']);
  });

  it('όριο παραθύρου: λήγει σε ακριβώς 7 ημέρες ⇒ `expiring` · σε 8 ⇒ `accepted`', () => {
    expect(energy('2016-10-09').status).toBe('expiring');
    expect(energy('2016-10-10').status).toBe('accepted');
  });

  it('υπογραφή την ημέρα λήξης ⇒ ισχύει (`validOnSigning: true`)', () => {
    const row = energy('2017-01-01', { targetSigningDate: '2027-01-01' });
    expect([row.status, row.validOnSigning]).toEqual(['accepted', true]);
  });

  it('χωρίς ή με αδιάβαστη ημέρα υπογραφής ⇒ `validOnSigning: null`, ποτέ `true`', () => {
    expect(energy('2025-01-01').validOnSigning).toBeNull();
    expect(energy('2025-01-01', { targetSigningDate: 'not-a-date' }).validOnSigning).toBeNull();
  });

  it('ληγμένο ΚΑΙ πριν την υπογραφή ⇒ `expired` με `validOnSigning: false`', () => {
    const row = energy('2016-01-01', { targetSigningDate: '2026-12-15' });
    expect([row.status, row.validOnSigning]).toEqual(['expired', false]);
  });

  it('βεβαίωση άρθρου 83 εγκεκριμένη: λήγει 2 μήνες μετά την υπογραφή της ⇒ ΔΕΝ φτάνει ως την υπογραφή (ADR-915 §13)', () => {
    const overrides = {
      building_identity: { review: { verdict: 'accepted' as const, fileId: null, fileFingerprint: null, issuedOn: '2026-09-01', printedValidUntil: null, reason: null, reviewedBy: 'u', reviewedAt: 't' } },
    };
    const row = deriveChecklist(input({ items: [item('building_identity')], overrides, targetSigningDate: '2026-12-15' })).rows[0];
    expect([row.status, row.expiresOn, row.validOnSigning]).toEqual(['expiring', '2026-11-01', false]);
  });
});

describe('deriveChecklist — ισχύς από τα γεγονότα του αρχείου (ADR-915 Φ3β · Α3/Α4)', () => {
  const READ: NonNullable<EvidenceFile['documentFacts']> = {
    kind: 'energy-certificate', issuedOn: '2025-01-01', printedValidUntil: null, source: { kind: 'document-text', reader: 'pea-text' },
  };
  const energyWith = (documentFacts: EvidenceFile['documentFacts'], issuedOn: string | null) => {
    const evidence = [file({ level: 'property', entityType: 'property', purpose: 'certificate', documentFacts })];
    const overrides = {
      energy_certificate: { review: { verdict: 'accepted' as const, fileId: 'file_1', fileFingerprint: 'file_1:0:2026-09-01', issuedOn, printedValidUntil: null, reason: null, reviewedBy: 'u', reviewedAt: 't' } },
    };
    return deriveChecklist(input({ items: [item('energy_certificate')], evidence, overrides })).rows[0];
  };

  it('χωρίς γεγονότα ⇒ ακριβώς όπως πριν (εφεδρεία `review.issuedOn`)', () => {
    expect(energyWith(null, '2025-01-01').expiresOn).toBe('2035-01-01');
  });

  it('το αρχείο κερδίζει την ημερομηνία του ελεγκτή (Α3)', () => {
    const row = energyWith(READ, '2016-01-01');
    expect([row.status, row.expiresOn]).toEqual(['accepted', '2035-01-01']);
  });

  it('η εγκεκριμένη χωρίς ημερομηνία παίρνει λήξη από το αρχείο (όχι πια «άγνωστη»)', () => {
    expect(energyWith(READ, null).expiresOn).toBe('2035-01-01');
  });

  it('τυπωμένη λήξη νωρίτερα από τον κανόνα ⇒ ισχύει η τυπωμένη (Α4)', () => {
    const row = energyWith({ ...READ, printedValidUntil: '2026-10-05' }, '2025-01-01');
    expect([row.status, row.expiresOn]).toEqual(['expiring', '2026-10-05']);
  });

  it('⛔ γεγονότα άλλου είδους αγνοούνται — μένει η ημερομηνία του ελεγκτή', () => {
    expect(energyWith({ ...READ, kind: 'building-identity' }, '2016-01-01').status).toBe('expired');
  });
});

describe('ADR-915 §14 — τυπωμένη λήξη · «τουλάχιστον έως» · «εκδώστε από»', () => {
  const taxReview = (printedValidUntil: string | null) => ({
    [sellerRowKey('seller_tax_clearance')]: {
      review: {
        verdict: 'accepted' as const, fileId: null, fileFingerprint: null, issuedOn: '2026-09-20', printedValidUntil,
        reason: null, reviewedBy: 'u', reviewedAt: 't',
      },
    },
  });
  const taxRow = (overrides: TestInput) =>
    deriveChecklist(input({ items: [item('seller_tax_clearance')], ...overrides })).rows[0];

  it('χωρίς τυπωμένη ⇒ το κατώτατο (1 μήνας), σημαδεμένο «τουλάχιστον»', () => {
    const row = taxRow({ overrides: taxReview(null) });
    expect([row.status, row.expiresOn, row.expiryIsFloor]).toEqual(['accepted', '2026-10-20', true]);
  });

  it('με τυπωμένη μέσα στα όρια ⇒ αυτή, ΧΩΡΙΣ «τουλάχιστον»', () => {
    const row = taxRow({ overrides: taxReview('2026-11-20') });
    expect([row.expiresOn, row.expiryIsFloor]).toEqual(['2026-11-20', false]);
  });

  it('«εκδώστε από»: η νωρίτερη έκδοση που καλύπτει την υπογραφή · χωρίς υπογραφή ή εγγύηση ⇒ null', () => {
    expect(taxRow({ targetSigningDate: '2026-12-15' }).issueFrom).toBe('2026-11-15');
    expect(taxRow({}).issueFrom).toBeNull();
    expect(deriveChecklist(input({ targetSigningDate: '2026-12-15' })).rows[0].issueFrom).toBeNull();
  });
});

describe('deriveChecklist — ορατότητα & σύνοψη', () => {
  it('Α4: ο buyer_lawyer δεν βλέπει προσωπικά έγγραφα πωλητή', () => {
    const rows = deriveChecklist(input({ items: [item('seller_tax_clearance'), item('building_permit')], viewer: 'buyer_lawyer' })).rows;
    expect(rows.map((row) => row.itemId)).toEqual(['building_permit']);
  });

  it('η σύνοψη μετρά ολοκληρωμένα / ελέγχους / ερωτήσεις μία φορά', () => {
    const { summary } = deriveChecklist(input({
      items: [item('building_permit'), item('final_contract'), item('seller_power_of_attorney'), item('buyer_mortgage_approval')],
      evidence: [file()],
    }));
    expect(summary).toEqual({
      applicable: 2, complete: 1, awaitingReview: 1, missing: 0, rejected: 0, expiring: 0, expired: 0,
      openQuestions: [{ factId: 'seller_by_proxy', partyKey: 'cont_seller' }, { factId: 'buyer_has_mortgage', partyKey: null }],
    });
  });
});

describe('Α35 — σφραγισμένη παράδοση (Π2)', () => {
  const sealed = { itemId: 'buyer_identity', deliveredAt: '2026-10-03T09:00:00Z', authorRole: 'buyer_lawyer' } as const;
  const buyerRow = (overrides: TestInput = {}) =>
    deriveChecklist(input({ items: [item('buyer_identity')], sealed: [sealed], ...overrides })).rows[0];

  it('χωρίς ορατό αρχείο ⇒ `delivered_sealed`, με την παράδοση στη γραμμή · μετρά στα ολοκληρωμένα', () => {
    const row = buyerRow();
    expect(row.status).toBe('delivered_sealed');
    expect(row.sealed).toEqual(sealed);
    expect(deriveChecklist(input({ items: [item('buyer_identity')], sealed: [sealed] })).summary.complete).toBe(1);
  });

  it('ορατό αρχείο (επαφή αγοραστή στον χώρο του εργολάβου) ⇒ υπερισχύει: `uploaded`', () => {
    const purpose = findEntryPoint('contact', 'id-card')?.purpose ?? 'missing-entry-point';
    const contactFile = file({ entityType: 'contact', entityId: 'cnt_1', purpose, level: 'buyer_contact' });
    expect(buyerRow({ evidence: [contactFile] }).status).toBe('uploaded');
  });

  it('παλιός έλεγχος που δεν δένει πια με αρχείο ⇒ η παράδοση μετρά (όχι «λείπει»)', () => {
    const overrides = { buyer_identity: { review: { ...accepted().building_permit.review!, verdict: 'rejected' as const, reason: 'x' } } };
    expect(buyerRow({ overrides }).status).toBe('delivered_sealed');
  });

  it('σφράγιση άλλης γραμμής δεν αγγίζει αυτή', () => {
    expect(buyerRow({ sealed: [{ ...sealed, itemId: 'buyer_payslips' }] }).status).toBe('missing');
  });
});
