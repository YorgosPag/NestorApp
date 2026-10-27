/**
 * @fileoverview Οι κάρτες της σελίδας RFQ (ADR-330 §5.1 S3.3).
 *
 * Κ1 «Γραμμές» μετρά την ΥΠΟΣΥΛΛΟΓΗ, όχι το legacy `rfq.lines` (το λάθος «0 ενώ υπάρχει 1») ·
 * Κ2 καμία κάρτα δεν αθροίζει ποσότητες διαφορετικών μονάδων ·
 * Κ3 κάρτα = φίλτρο ΜΟΝΟ πάνω από λίστα· μηδέν ⇒ όχι φίλτρο· πατημένη ⇒ κλικ αφαιρεί ·
 * Κ4 κάρτα που ονομάζει μία προσφορά ⇒ την ανοίγει ·
 * Κ5 κάρτα και λίστα προσκλήσεων διαβάζουν τα ΙΔΙΑ κατηγορήματα (μέτρηση == φιλτραρισμένη λίστα) ·
 * Κ6 το badge «χρειάζονται προσοχή» μετρά και `sent`/`opened` μετά την προθεσμία (όχι μόνο `pending`).
 */

import type { TFunction } from 'i18next';
import type { StatusDrill } from '@/components/projects/procurement/clients/useStatusDrillParam';
import type { Quote, QuoteStatus } from '../../types/quote';
import type { RFQ } from '../../types/rfq';
import type { RfqLine } from '../../types/rfq-line';
import type { VendorInvite } from '../../types/vendor-invite';
import { buildRfqDashboardStats, countInvitesNeedingAttention, type RfqDashboardInput } from '../rfq-dashboard-stats';
import { inviteMatchesFocus, type InviteFocus } from '../vendor-invite-status';

const NOW = Date.parse('2026-10-27T10:00:00.000Z');
const DAY = 86_400_000;
const t = ((key: string) => key) as unknown as TFunction;

function drill<S extends string>(statuses: readonly S[] = []): StatusDrill<S> & { set: jest.Mock } {
  return { statuses, set: jest.fn(), clear: jest.fn() };
}

const line = (source: RfqLine['source'], unit: string, quantity: number): RfqLine =>
  ({ id: `${source}-${unit}`, source, unit, quantity, trade: 'demolition' } as unknown as RfqLine);
const quote = (id: string, status: QuoteStatus, total: number): Quote =>
  ({ id, status, totals: { total }, extractedData: { vendorName: { value: `V-${id}` } } } as unknown as Quote);
const invite = (id: string, status: string, expiresInMs: number): VendorInvite =>
  ({ id, status, expiresAt: new Date(NOW + expiresInMs) } as unknown as VendorInvite);

function input(over: Partial<RfqDashboardInput>): RfqDashboardInput {
  return {
    rfq: { lines: [], deadlineDate: new Date(NOW + 10 * DAY) } as unknown as RFQ,
    lines: [], linesLoading: false, quotes: [], invites: [], comparison: null, activeTab: 'setup',
    nowMs: NOW, quoteFilter: drill<QuoteStatus>(), inviteFilter: drill<InviteFocus>(),
    onOpenQuote: jest.fn(), t, ...over,
  };
}

describe('RFQ dashboard stats', () => {
  it('Κ1 — «Γραμμές» μετρά την υποσυλλογή, όχι το άδειο legacy rfq.lines', () => {
    const [lines] = buildRfqDashboardStats(input({ lines: [line('boq', 'm3', 1)] }));
    expect(lines.value).toBe(1);
    expect(lines.description).toBe('rfqs.dashboard.setup.linesAllBoq');
    expect(lines.onActivate).toBeUndefined();
    const mixed = buildRfqDashboardStats(input({ lines: [line('boq', 'm3', 1), line('ad_hoc', 'kg', 1)] }))[0];
    expect(mixed.description).toBe('rfqs.dashboard.setup.linesBySource');
  });

  it('Κ2 — καμία κάρτα δεν αθροίζει ποσότητες (m3 + kg δεν έχουν άθροισμα)', () => {
    const stats = buildRfqDashboardStats(input({ lines: [line('boq', 'm3', 5), line('ad_hoc', 'kg', 7)] }));
    expect(stats.map((s) => s.value)).not.toContain(12);
    expect(stats.map((s) => s.title)).not.toContain('rfqs.dashboard.setup.totalVolume');
  });

  it('Κ3 — μηδέν ⇒ όχι φίλτρο· με τιμή ⇒ φίλτρο· πατημένη ⇒ κλικ αφαιρεί', () => {
    const quoteFilter = drill<QuoteStatus>();
    const stats = buildRfqDashboardStats(input({ activeTab: 'quotes', quoteFilter, quotes: [quote('a', 'under_review', 10)] }));
    const [total, underReview, accepted] = stats;
    expect(total.onActivate).toBeUndefined();
    expect(accepted.onActivate).toBeUndefined();
    underReview.onActivate?.();
    expect(quoteFilter.set).toHaveBeenCalledWith(['under_review']);

    const pressedFilter = drill<QuoteStatus>(['accepted']);
    const pressed = buildRfqDashboardStats(input({ activeTab: 'quotes', quoteFilter: pressedFilter }))[2];
    expect(pressed.pressed).toBe(true);
    pressed.onActivate?.();
    expect(pressedFilter.set).toHaveBeenCalledWith([]);
  });

  it('Κ4 — καλύτερη/χειρότερη τιμή ανοίγουν ΤΗΝ προσφορά', () => {
    const onOpenQuote = jest.fn();
    const quotes = [quote('cheap', 'submitted', 100), quote('dear', 'submitted', 300)];
    const [best, worst, diff] = buildRfqDashboardStats(input({ activeTab: 'comparison', quotes, onOpenQuote }));
    best.onActivate?.();
    worst.onActivate?.();
    expect(onOpenQuote.mock.calls).toEqual([['cheap'], ['dear']]);
    expect(best.description).toBe('V-cheap');
    expect(diff.onActivate).toBeUndefined();
  });

  it('Κ5 — η μέτρηση της κάρτας == ό,τι αφήνει το φίλτρο της λίστας', () => {
    const invites = [
      invite('live', 'sent', DAY), invite('expired', 'opened', -1),
      invite('done', 'submitted', -1), invite('no', 'declined', DAY),
    ];
    const stats = buildRfqDashboardStats(input({ invites }));
    const deadlineMs = NOW + 10 * DAY;
    for (const [card, focus] of [[stats[2], 'awaiting'], [stats[3], 'attention']] as const) {
      const listed = invites.filter((i) => inviteMatchesFocus(i, [focus], deadlineMs, NOW));
      expect(card.value).toBe(listed.length);
    }
    expect(stats[2].value).toBe(1);
    expect(stats[3].value).toBe(1);
  });

  it('Κ6 — μετά την προθεσμία, αναπάντητες sent/opened «χρειάζονται προσοχή»· απαντημένες όχι', () => {
    const invites = [invite('a', 'sent', DAY), invite('b', 'opened', DAY), invite('c', 'submitted', DAY)];
    expect(countInvitesNeedingAttention(invites, NOW - 1, NOW)).toBe(2);
    expect(countInvitesNeedingAttention(invites, NOW + DAY, NOW)).toBe(0);
  });

  it('προθεσμία: χωρίς ημερομηνία ⇒ «—»· περασμένη ⇒ «Έληξε» (κόκκινο)· κοντινή ⇒ πορτοκαλί', () => {
    const at = (ms: number | null) =>
      buildRfqDashboardStats(input({ rfq: { lines: [], deadlineDate: ms === null ? null : new Date(ms) } as unknown as RFQ }))[1];
    expect(at(null).value).toBe('—');
    expect(at(NOW - DAY)).toMatchObject({ value: 'rfqs.dashboard.setup.deadlinePassed', color: 'red' });
    expect(at(NOW + 2 * DAY).color).toBe('orange');
    expect(at(NOW + 10 * DAY).color).toBe('blue');
  });
});
