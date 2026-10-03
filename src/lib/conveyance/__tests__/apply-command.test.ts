/**
 * ADR-901 §5.1 — εφαρμογή εντολών στην υπόθεση: κάθε απόρριψη του κλειστού συνόλου + ότι ο
 * έλεγχος δένεται στο αποτύπωμα που ΒΡΗΚΕ ο πυρήνας (ποτέ σε αυτό που λέει ο client).
 */

import type { ConveyanceCase, EvidenceFile } from '@/types/conveyance-case';
import { applyConveyanceCommand, type CommandContext } from '../apply-command';
import { effectiveCaseState, isCaseEditable } from '../case-state';
import { conveyanceCommandRequestSchema } from '../conveyance-commands';

function baseCase(overrides: Partial<ConveyanceCase> = {}): ConveyanceCase {
  return {
    id: 'cvc_1', companyId: 'comp_a',
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: 'bld_1', projectId: 'proj_1', appurtenances: [] },
    profile: 'new_build_company',
    parties: { seller: { contactId: 'cont_s', kind: 'legal_entity' }, buyers: [{ contactId: 'cont_b' }] },
    facts: {}, overrides: {}, storedState: 'open', targetSigningDate: null, catalogVersion: '0.1.0',
    version: 3, createdBy: 'u1', createdAt: 't0', updatedAt: 't0', cancellation: null,
    ...overrides,
  };
}

const permitFile: EvidenceFile = {
  fileId: 'file_permit', displayName: 'permit.pdf', entityType: 'project', entityId: 'proj_1', purpose: 'permit',
  source: { kind: 'owned' }, level: 'project', fingerprint: 'file_permit:2:2026-09-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00Z',
};

const ctx: CommandContext = { actorUid: 'u2', now: '2026-10-02T10:00:00Z', today: '2026-10-02', evidence: [permitFile] };

describe('applyConveyanceCommand', () => {
  it('review: ο έλεγχος δένεται στο αποτύπωμα που βρήκε ο server', () => {
    const result = applyConveyanceCommand(baseCase(), {
      type: 'review', itemId: 'building_permit', verdict: 'accepted', fileId: 'file_permit', issuedOn: null, reason: null,
    }, ctx);
    if (!result.ok) throw new Error(result.rejection);
    expect(result.next.overrides.building_permit?.review?.fileFingerprint).toBe(permitFile.fingerprint);
    expect(result.changes).toEqual([{ field: 'checklist.building_permit.review', oldValue: null, newValue: 'accepted' }]);
  });

  it('review: αρχείο που ΔΕΝ είναι τεκμήριο της γραμμής ⇒ file_not_evidence', () => {
    const result = applyConveyanceCommand(baseCase(), {
      type: 'review', itemId: 'title_deed', verdict: 'accepted', fileId: 'file_permit', issuedOn: null, reason: null,
    }, ctx);
    expect(result).toEqual({ ok: false, rejection: 'file_not_evidence' });
  });

  it('review: επιστροφή χωρίς λόγο ⇒ reason_required', () => {
    const result = applyConveyanceCommand(baseCase(), {
      type: 'review', itemId: 'building_permit', verdict: 'rejected', fileId: 'file_permit', issuedOn: null, reason: null,
    }, ctx);
    expect(result).toEqual({ ok: false, rejection: 'reason_required' });
  });

  it('review: ημερομηνία έκδοσης στο μέλλον ⇒ future_issue_date · ανύπαρκτη ⇒ invalid_date', () => {
    const base = { type: 'review' as const, itemId: 'building_permit', verdict: 'accepted' as const, fileId: 'file_permit', reason: null };
    expect(applyConveyanceCommand(baseCase(), { ...base, issuedOn: '2026-10-03' }, ctx)).toEqual({ ok: false, rejection: 'future_issue_date' });
    expect(applyConveyanceCommand(baseCase(), { ...base, issuedOn: '2026-02-30' }, ctx)).toEqual({ ok: false, rejection: 'invalid_date' });
  });

  it('άγνωστη γραμμή ⇒ unknown_item', () => {
    expect(applyConveyanceCommand(baseCase(), { type: 'mark_not_applicable', itemId: 'nope', reason: 'x' }, ctx))
      .toEqual({ ok: false, rejection: 'unknown_item' });
  });

  it('answer_fact: null αποσύρει την απάντηση (επιστροφή στο παραγόμενο)', () => {
    const answered = baseCase({ facts: { seller_by_proxy: { value: true, answeredBy: 'u', answeredAt: 't' } } });
    const result = applyConveyanceCommand(answered, { type: 'answer_fact', factId: 'seller_by_proxy', value: null }, ctx);
    if (!result.ok) throw new Error(result.rejection);
    expect(result.next.facts.seller_by_proxy).toBeUndefined();
  });

  it('cancel: η υπόθεση κλείνει με λόγο · μετά ΚΑΜΙΑ εντολή (not_editable)', () => {
    const cancelled = applyConveyanceCommand(baseCase(), { type: 'cancel', reason: 'υπαναχώρηση' }, ctx);
    if (!cancelled.ok) throw new Error(cancelled.rejection);
    expect(cancelled.next.storedState).toBe('cancelled');
    expect(applyConveyanceCommand(cancelled.next, { type: 'clear_override', itemId: 'title_deed' }, ctx))
      .toEqual({ ok: false, rejection: 'not_editable' });
  });

  it('clear_override χωρίς απόκλιση ⇒ ιδεμποτές (καμία αλλαγή ίχνους)', () => {
    const result = applyConveyanceCommand(baseCase(), { type: 'clear_override', itemId: 'title_deed' }, ctx);
    expect(result.ok && result.changes).toEqual([]);
  });
});

describe('case-state (Ε-Ε · Ε-6)', () => {
  it('signed παράγεται από το legalPhase και παγώνει την υπόθεση', () => {
    expect(effectiveCaseState('open', 'final_pending')).toBe('open');
    expect(effectiveCaseState('open', 'final_signed')).toBe('signed');
    expect(effectiveCaseState('open', 'payoff_completed')).toBe('signed');
    expect(isCaseEditable(effectiveCaseState('open', 'final_signed'))).toBe(false);
  });

  it('ρητή κατάσταση υπερισχύει του legalPhase', () => {
    expect(effectiveCaseState('cancelled', 'final_signed')).toBe('cancelled');
  });
});

describe('conveyanceCommandRequestSchema', () => {
  it('απορρίπτει άγνωστο γεγονός και άγνωστο τύπο εντολής', () => {
    expect(conveyanceCommandRequestSchema.safeParse({ expectedVersion: 0, command: { type: 'answer_fact', factId: 'x', value: true } }).success).toBe(false);
    expect(conveyanceCommandRequestSchema.safeParse({ expectedVersion: 0, command: { type: 'delete_case' } }).success).toBe(false);
  });
});
