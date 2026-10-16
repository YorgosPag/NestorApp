/**
 * ADR-901 §5.1 — εφαρμογή εντολών στην υπόθεση: κάθε απόρριψη του κλειστού συνόλου + ότι ο
 * έλεγχος δένεται στο αποτύπωμα που ΒΡΗΚΕ ο πυρήνας (ποτέ σε αυτό που λέει ο client).
 */

import type { ConveyanceCase, EvidenceFile } from '@/types/conveyance-case';
import { applyConveyanceCommand, type CommandContext } from '../apply-command';
import { effectiveCaseState, isCaseEditable } from '../case-state';
import { conveyanceCommandRequestSchema } from '../conveyance-commands';
import { sellerParty } from '../case-parties';

function baseCase(overrides: Partial<ConveyanceCase> = {}): ConveyanceCase {
  return {
    id: 'cvc_1', companyId: 'comp_a',
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: 'bld_1', projectId: 'proj_1', appurtenances: [] },
    profile: 'new_build_company',
    parties: { sellers: [sellerParty('cont_s', 'legal_entity')], buyers: [{ contactId: 'cont_b' }] },
    facts: {}, partyFacts: {}, overrides: {}, storedState: 'open', targetSigningDate: null, catalogVersion: '0.1.0',
    version: 3, createdBy: 'u1', createdAt: 't0', updatedAt: 't0', cancellation: null,
    ...overrides,
  };
}

const permitFile: EvidenceFile = {
  fileId: 'file_permit', displayName: 'permit.pdf', entityType: 'project', entityId: 'proj_1', purpose: 'permit',
  source: { kind: 'owned' }, level: 'project', fingerprint: 'file_permit:2:2026-09-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00Z', documentFacts: null,
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

  describe('ADR-915 Φ3β — η ημερομηνία δεν αντιλέγει στο ίδιο το έγγραφο', () => {
    const peaFile = (source: NonNullable<EvidenceFile['documentFacts']>['source']): EvidenceFile => ({
      ...permitFile, fileId: 'file_pea', entityType: 'property', entityId: 'prop_1', level: 'property', purpose: 'certificate',
      fingerprint: 'file_pea:0:x', documentFacts: { kind: 'energy-certificate', issuedOn: '2025-01-01', printedValidUntil: null, source },
    });
    const review = (issuedOn: string | null, verdict: 'accepted' | 'rejected' = 'accepted') => ({
      type: 'review' as const, itemId: 'energy_certificate', verdict, fileId: 'file_pea', issuedOn, reason: verdict === 'rejected' ? 'λάθος' : null,
    });
    const read = { ...ctx, evidence: [peaFile({ kind: 'document-text', reader: 'pea-text' })] };

    it('⛔ αποδοχή με άλλη ημερομηνία από την ανάγνωση ⇒ issued_on_contradicts_document', () => {
      expect(applyConveyanceCommand(baseCase(), review('2024-01-01'), read)).toEqual({ ok: false, rejection: 'issued_on_contradicts_document' });
    });

    it('ίδια ημερομηνία ή καμία ⇒ δεκτή · επιστροφή του εγγράφου ⇒ πάντα δεκτή (η διαφωνία γίνεται έτσι)', () => {
      expect(applyConveyanceCommand(baseCase(), review('2025-01-01'), read).ok).toBe(true);
      expect(applyConveyanceCommand(baseCase(), review(null), read).ok).toBe(true);
      expect(applyConveyanceCommand(baseCase(), review('2024-01-01', 'rejected'), read).ok).toBe(true);
    });

    it('δήλωση ανθρώπου (`attested`) δεν κλειδώνει — διορθώνεται', () => {
      const attested = { ...ctx, evidence: [peaFile({ kind: 'attested', via: 'conveyance-review' })] };
      expect(applyConveyanceCommand(baseCase(), review('2024-01-01'), attested).ok).toBe(true);
    });
  });

  describe('ADR-915 §14 — η τυπωμένη λήξη της δήλωσης', () => {
    const taxFile: EvidenceFile = {
      ...permitFile, fileId: 'file_tax', entityType: 'contact', entityId: 'cont_s', level: 'seller_contact', purpose: 'tax-clearance',
      fingerprint: 'file_tax:0:x',
    };
    const taxCtx = { ...ctx, evidence: [taxFile] };
    const accept = (issuedOn: string | null, validUntil?: string | null) => ({
      type: 'review' as const, itemId: 'seller_tax_clearance@cont_s', verdict: 'accepted' as const, fileId: 'file_tax', issuedOn, validUntil, reason: null,
    });

    it('αποθηκεύεται στον έλεγχο της γραμμής, δίπλα στην έκδοση', () => {
      const result = applyConveyanceCommand(baseCase(), accept('2026-09-20', '2026-11-20'), taxCtx);
      if (!result.ok) throw new Error(result.rejection);
      expect(result.next.overrides['seller_tax_clearance@cont_s']?.review).toMatchObject({ issuedOn: '2026-09-20', printedValidUntil: '2026-11-20' });
    });

    it('παλιός client χωρίς `validUntil` ⇒ `null`, ποτέ σφάλμα', () => {
      const result = applyConveyanceCommand(baseCase(), accept('2026-09-20'), taxCtx);
      if (!result.ok) throw new Error(result.rejection);
      expect(result.next.overrides['seller_tax_clearance@cont_s']?.review?.printedValidUntil).toBeNull();
    });

    it('⛔ λήξη ΠΡΙΝ από την έκδοση ⇒ validity_before_issue · ανύπαρκτη ⇒ invalid_date', () => {
      expect(applyConveyanceCommand(baseCase(), accept('2026-09-20', '2026-09-19'), taxCtx)).toEqual({ ok: false, rejection: 'validity_before_issue' });
      expect(applyConveyanceCommand(baseCase(), accept('2026-09-20', '2026-11-31'), taxCtx)).toEqual({ ok: false, rejection: 'invalid_date' });
    });
  });

  it('άγνωστη γραμμή ⇒ unknown_item', () => {
    expect(applyConveyanceCommand(baseCase(), { type: 'mark_not_applicable', itemId: 'nope', reason: 'x' }, ctx))
      .toEqual({ ok: false, rejection: 'unknown_item' });
  });

  it('answer_fact: null αποσύρει την απάντηση (επιστροφή στο παραγόμενο)', () => {
    const answered = baseCase({ facts: { buyer_has_mortgage: { value: true, answeredBy: 'u', answeredAt: 't' } } });
    const result = applyConveyanceCommand(answered, { type: 'answer_fact', factId: 'buyer_has_mortgage', value: null }, ctx);
    if (!result.ok) throw new Error(result.rejection);
    expect(result.next.facts.buyer_has_mortgage).toBeUndefined();
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
