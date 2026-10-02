/**
 * ADR-901 §5.5 — παραγωγή κατάστασης καταλόγου. Κάθε test ρωτά ΜΙΑ κατάσταση ή ΕΝΑΝ
 * κανόνα, με γραμμές του πραγματικού καταλόγου (όχι ψεύτικες) όπου μετράει η αντιστοίχιση.
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import type { ChecklistItemOverride, EvidenceFile } from '@/types/conveyance-case';
import { deriveChecklist, type DeriveChecklistInput } from '../derive-checklist';

function item(id: string): ChecklistItem {
  const found = getChecklistItem(id);
  if (!found) throw new Error(`missing catalog item ${id}`);
  return found;
}

function file(overrides: Partial<EvidenceFile> = {}): EvidenceFile {
  return {
    fileId: 'file_1', displayName: 'permit.pdf', entityType: 'project', entityId: 'proj_1',
    purpose: 'permit', level: 'project', fingerprint: 'file_1:0:2026-09-01', createdAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

function input(overrides: Partial<DeriveChecklistInput> = {}): DeriveChecklistInput {
  return {
    items: [item('building_permit')], facts: {}, overrides: {}, evidence: [],
    today: '2026-10-02', targetSigningDate: null, viewer: 'host', ...overrides,
  };
}

function statusOf(overrides: Partial<DeriveChecklistInput>): string {
  return deriveChecklist(input(overrides)).rows[0].status;
}

const accepted = (extra: Partial<NonNullable<ChecklistItemOverride['review']>> = {}): Record<string, ChecklistItemOverride> => ({
  building_permit: {
    review: {
      verdict: 'accepted', fileId: 'file_1', fileFingerprint: 'file_1:0:2026-09-01', issuedOn: null,
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
      building_identity: { review: { verdict: 'accepted' as const, fileId: null, fileFingerprint: null, issuedOn: null, reason: null, reviewedBy: 'u', reviewedAt: 't' } },
    };
    expect(statusOf({ items: [item('building_identity')], overrides })).toBe('accepted');
  });
});

describe('deriveChecklist — ισχύς (Σ-5)', () => {
  const energy = (issuedOn: string, extra: Partial<DeriveChecklistInput> = {}) => {
    const evidence = [file({ level: 'property', entityType: 'property', purpose: 'certificate' })];
    const overrides = {
      energy_certificate: { review: { verdict: 'accepted' as const, fileId: 'file_1', fileFingerprint: 'file_1:0:2026-09-01', issuedOn, reason: null, reviewedBy: 'u', reviewedAt: 't' } },
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
      openQuestions: ['seller_by_proxy', 'buyer_has_mortgage'],
    });
  });
});
