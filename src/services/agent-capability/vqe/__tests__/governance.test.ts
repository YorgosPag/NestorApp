/**
 * governance — Ο ΚΑΝΟΝΑΣ ΤΗΣ ΧΑΜΗΛΟΤΕΡΗΣ ΚΑΤΑΣΤΑΣΗΣ
 *
 * ADR-734 §6.3 κανόνας 1: 99 certified + 1 draft ΔΕΝ είναι certified.
 * Αν αυτό σπάσει, ένας πράκτορας μπορεί να παρουσιάσει ως εγκεκριμένο σύνολο
 * που δεν είναι — δηλαδή ολόκληρος ο λόγος ύπαρξης του φακέλου.
 */

import { BOQ_STATUS_LIFECYCLE_ORDER } from '@/types/boq';
import type { BOQItem, BOQItemStatus } from '@/types/boq';
import type { EnvelopeIssue, EnvelopeWarningCode } from '@/types/vqe';
import { buildGovernanceRecord } from '../governance';
import { makeItem } from './vqe-test-fixtures';

function itemsWithStatuses(statuses: readonly BOQItemStatus[]): BOQItem[] {
  return statuses.map((status, index) => makeItem({ id: `boq-${index}`, status }));
}

function codesOf(warnings: readonly { source: string }[]): readonly EnvelopeWarningCode[] {
  return warnings
    .filter((warning): warning is EnvelopeIssue => warning.source === 'envelope')
    .map((warning) => warning.code);
}

describe('effectiveStatus — η χαμηλότερη κατάσταση του συνόλου', () => {
  it('99 certified + 1 draft ΔΕΝ είναι certified', () => {
    const statuses: BOQItemStatus[] = [...Array<BOQItemStatus>(99).fill('certified'), 'draft'];
    const { result, warnings } = buildGovernanceRecord(itemsWithStatuses(statuses), null);

    expect(result.effectiveStatus).toBe('draft');
    expect(result.isSignable).toBe(false);
    expect(codesOf(warnings)).toContain('mixed_governance_status');
  });

  it('ομοιογενές σύνολο κρατά την κατάστασή του χωρίς προειδοποίηση', () => {
    const { result, warnings } = buildGovernanceRecord(
      itemsWithStatuses(['approved', 'approved']),
      null,
    );
    expect(result.effectiveStatus).toBe('approved');
    expect(codesOf(warnings)).not.toContain('mixed_governance_status');
  });

  it('certified + locked παραμένει υπογράψιμο (και τα δύο είναι δεσμευτικά)', () => {
    const { result } = buildGovernanceRecord(itemsWithStatuses(['certified', 'locked']), null);
    expect(result.effectiveStatus).toBe('certified');
    expect(result.isSignable).toBe(true);
  });

  it('η σειρά των items δεν επηρεάζει το αποτέλεσμα', () => {
    const forward = buildGovernanceRecord(itemsWithStatuses(['draft', 'locked']), null).result;
    const backward = buildGovernanceRecord(itemsWithStatuses(['locked', 'draft']), null).result;
    expect(forward.effectiveStatus).toBe(backward.effectiveStatus);
    expect(forward.isSignable).toBe(backward.isSignable);
  });
});

describe('fail-closed', () => {
  it('κενό σύνολο δεν είναι υπογράψιμο και πέφτει στη χαμηλότερη κατάσταση', () => {
    const { result } = buildGovernanceRecord([], null);
    expect(result.effectiveStatus).toBe('draft');
    expect(result.isSignable).toBe(false);
  });

  it('άγνωστη κατάσταση υποβαθμίζει το σύνολο και αναφέρεται με την ωμή τιμή', () => {
    const corrupted = makeItem({ id: 'boq-x', status: 'νέο-άγνωστο' as unknown as BOQItemStatus });
    const { result, warnings } = buildGovernanceRecord(
      [makeItem({ id: 'boq-1', status: 'certified' }), corrupted],
      null,
    );

    expect(result.effectiveStatus).toBe('draft');
    expect(result.isSignable).toBe(false);
    expect(codesOf(warnings)).toContain('unknown_governance_status');

    const issue = warnings.find(
      (warning): warning is EnvelopeIssue =>
        warning.source === 'envelope' && warning.code === 'unknown_governance_status',
    );
    expect(issue?.itemIds).toEqual(['boq-x']);
    expect(issue?.rawValue).toBe('νέο-άγνωστο');
  });

  it('σύνολο μόνο με άγνωστες καταστάσεις δεν θεωρείται «ανάμεικτο»', () => {
    const unknownOnly = [makeItem({ id: 'a', status: 'x' as unknown as BOQItemStatus })];
    const { warnings } = buildGovernanceRecord(unknownOnly, null);
    expect(codesOf(warnings)).toContain('unknown_governance_status');
    expect(codesOf(warnings)).not.toContain('mixed_governance_status');
  });
});

describe('statusBreakdown', () => {
  it('περιέχει ΚΑΘΕ κατάσταση του κύκλου ζωής, ακόμη και με μηδέν', () => {
    const { result } = buildGovernanceRecord(itemsWithStatuses(['draft']), null);
    expect(Object.keys(result.statusBreakdown).sort()).toEqual(
      [...BOQ_STATUS_LIFECYCLE_ORDER].sort(),
    );
    expect(result.statusBreakdown.draft).toBe(1);
    expect(result.statusBreakdown.locked).toBe(0);
  });

  it('μετρά σωστά ανάμεικτο σύνολο', () => {
    const { result } = buildGovernanceRecord(
      itemsWithStatuses(['draft', 'draft', 'certified']),
      null,
    );
    expect(result.statusBreakdown.draft).toBe(2);
    expect(result.statusBreakdown.certified).toBe(1);
    expect(result.statusBreakdown.submitted).toBe(0);
  });

  it('άγνωστη κατάσταση ΔΕΝ προσμετράται σε καμία γνωστή στήλη', () => {
    const { result } = buildGovernanceRecord(
      [makeItem({ id: 'a', status: 'ghost' as unknown as BOQItemStatus })],
      null,
    );
    const total = BOQ_STATUS_LIFECYCLE_ORDER.reduce(
      (sum, status) => sum + result.statusBreakdown[status],
      0,
    );
    expect(total).toBe(0);
  });
});

describe('baselineDrift', () => {
  it('μεταφέρεται αυτούσιο στο record', () => {
    const summary = {
      trackedItemCount: 1,
      driftedItemCount: 1,
      totalItemCount: 1,
      maxAbsPercent: 10,
      netQuantityDelta: 10,
      worstItemId: 'boq-1',
      latestSyncedAt: null,
    };
    const { result } = buildGovernanceRecord(itemsWithStatuses(['draft']), summary);
    expect(result.baselineDrift).toBe(summary);
  });
});
