/**
 * ADR-930 — ο κανόνας της αλλαγής σταδίου, εκτελεσμένος σκέτος (ο server τον τρέχει μέσα σε συναλλαγή).
 */

import { OPPORTUNITY_STAGE_IDS, OPPORTUNITY_STAGES, stageSpec } from '@/config/crm/opportunity-stages';
import {
  CLOSING_FIELDS,
  LOST_STAGE,
  planStageTransition,
  WON_STAGE,
  type StageTransitionPlan,
} from '../opportunity-stage-transition';

const NOW = '2026-11-04T12:00:00.000Z';

function applied(plan: StageTransitionPlan) {
  if (plan.kind !== 'apply') throw new Error(`expected apply, got ${plan.kind}`);
  return plan;
}

describe('ρίζα σταδίων', () => {
  it('ένα στάδιο επιτυχίας και ένα απώλειας, στο τέλος της σειράς', () => {
    expect(WON_STAGE).toBe('closed_won');
    expect(LOST_STAGE).toBe('closed_lost');
    expect(OPPORTUNITY_STAGES.filter((s) => s.kind === 'won')).toHaveLength(1);
    expect(OPPORTUNITY_STAGES.filter((s) => s.kind === 'lost')).toHaveLength(1);
    expect(OPPORTUNITY_STAGE_IDS[0]).toBe('initial_contact');
  });
});

describe('ανοιχτό → ανοιχτό', () => {
  it('γράφει στάδιο, παράγωγο status, προεπιλεγμένη πιθανότητα και χρονοσφραγίδα', () => {
    const plan = applied(planStageTransition({ stage: 'initial_contact' }, { kind: 'open', target: 'proposal' }, NOW));
    expect(plan.set).toMatchObject({
      stage: 'proposal',
      status: 'active',
      probability: stageSpec('proposal').defaultProbability,
      stageChangedAt: NOW,
    });
    expect(plan.reopened).toBe(false);
    expect(plan.set).not.toHaveProperty('reopenCount');
  });

  it('ίδιο στάδιο ⇒ unchanged (ιδεμπότητα: καμία εγγραφή, καμία γραμμή ιστορικού)', () => {
    expect(planStageTransition({ stage: 'viewing' }, { kind: 'open', target: 'viewing' }, NOW)).toEqual({ kind: 'unchanged' });
  });

  it('ανοιχτό αίτημα με στόχο κλειστό στάδιο ⇒ invalid (το κλείσιμο θέλει στοιχεία)', () => {
    expect(planStageTransition({ stage: 'viewing' }, { kind: 'open', target: 'closed_won' }, NOW))
      .toEqual({ kind: 'invalid', reason: 'target_not_open' });
  });
});

describe('κλείσιμο ως επιτυχία', () => {
  it('γράφει τελικό ποσό + ημερομηνία, status won, πιθανότητα 100', () => {
    const plan = applied(planStageTransition({ stage: 'contract' }, { kind: 'won', finalValue: 182_000, closedOn: '2026-11-04' }, NOW));
    expect(plan.target).toBe('closed_won');
    expect(plan.set).toMatchObject({ status: 'won', probability: 100, estimatedValue: 182_000, closedAt: '2026-11-04', wonDate: '2026-11-04' });
    expect(plan.clear).toEqual(['lostReason', 'lostReasonNote']);
  });

  it.each([
    [{ finalValue: 0, closedOn: '2026-11-04' }, 'won_value_required'],
    [{ finalValue: Number.NaN, closedOn: '2026-11-04' }, 'won_value_required'],
    [{ finalValue: 10, closedOn: '04/11/2026' }, 'won_date_required'],
  ])('%o ⇒ %s', (input, reason) => {
    expect(planStageTransition({ stage: 'contract' }, { kind: 'won', ...input }, NOW)).toEqual({ kind: 'invalid', reason });
  });
});

describe('κλείσιμο ως απώλεια', () => {
  it('γράφει λόγο από τον κατάλογο και κομμένο σχόλιο', () => {
    const plan = applied(planStageTransition(
      { stage: 'negotiation' },
      { kind: 'lost', lostReason: 'price', lostReasonNote: '  ακριβό για την περιοχή  ' },
      NOW,
    ));
    expect(plan.set).toMatchObject({
      stage: 'closed_lost', status: 'lost', probability: 0, lostReason: 'price',
      lostReasonNote: 'ακριβό για την περιοχή', closedAt: '2026-11-04',
    });
    expect(plan.clear).toEqual(['wonDate']);
  });

  it('κενό σχόλιο ⇒ καθαρίζει το παλιό σχόλιο, δεν γράφει κενό', () => {
    const plan = applied(planStageTransition({ stage: 'negotiation' }, { kind: 'lost', lostReason: 'timing', lostReasonNote: '   ' }, NOW));
    expect(plan.set).not.toHaveProperty('lostReasonNote');
    expect(plan.clear).toContain('lostReasonNote');
  });

  it('λόγος εκτός καταλόγου ⇒ invalid (δεύτερη γραμμή άμυνας πίσω από το zod)', () => {
    const request = { kind: 'lost', lostReason: 'ακριβό' } as unknown as Parameters<typeof planStageTransition>[1];
    expect(planStageTransition({ stage: 'negotiation' }, request, NOW)).toEqual({ kind: 'invalid', reason: 'lost_reason_required' });
  });

  it('σχόλιο πάνω από το όριο ⇒ invalid', () => {
    expect(planStageTransition({ stage: 'negotiation' }, { kind: 'lost', lostReason: 'other', lostReasonNote: 'x'.repeat(501) }, NOW))
      .toEqual({ kind: 'invalid', reason: 'lost_note_too_long' });
  });
});

describe('επανάνοιγμα', () => {
  it('κλειστό → ανοιχτό: καθαρίζει ΟΛΑ τα στοιχεία κλεισίματος, reopenCount + 1, status active', () => {
    const plan = applied(planStageTransition({ stage: 'closed_lost', reopenCount: 2 }, { kind: 'open', target: 'negotiation' }, NOW));
    expect(plan.reopened).toBe(true);
    expect(plan.set).toMatchObject({ status: 'active', reopenCount: 3 });
    expect(plan.clear).toEqual([...CLOSING_FIELDS]);
  });

  it('πρώτο επανάνοιγμα χωρίς μετρητή ⇒ 1', () => {
    expect(applied(planStageTransition({ stage: 'closed_won' }, { kind: 'open', target: 'contract' }, NOW)).set.reopenCount).toBe(1);
  });

  it('επιτυχία ⇄ απώλεια ΔΕΝ είναι επανάνοιγμα, αλλά καθαρίζει τα στοιχεία του άλλου κλεισίματος', () => {
    const plan = applied(planStageTransition({ stage: 'closed_won' }, { kind: 'lost', lostReason: 'financing' }, NOW));
    expect(plan.reopened).toBe(false);
    expect(plan.clear).toEqual(['wonDate', 'lostReasonNote']);
  });
});
