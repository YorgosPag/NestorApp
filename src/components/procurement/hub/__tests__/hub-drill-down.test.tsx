/**
 * @jest-environment jsdom
 */

/**
 * ADR-330 §5.1 S3.4 — οι κάρτες του hub προμηθειών:
 *   (α) η κάρτα-ενότητα είναι ΠΡΑΓΜΑΤΙΚΟΣ σύνδεσμος (`<a href>`), όχι `div role="button"`·
 *   (β) με αριθμό > 0 η διεύθυνση κουβαλά ΤΟ ΙΔΙΟ σύνολο καταστάσεων που μέτρησε η κάρτα·
 *   (γ) με 0 οδηγεί στην ενότητα ΧΩΡΙΣ φίλτρο (φίλτρο σε άδεια λίστα = αδιέξοδο)·
 *   (δ) οι κουβάδες συμβάσεων: η κάρτα του hub και η λίστα μετρούν με ΕΝΑΝ ορισμό (κατάσταση × λήξη)·
 *   (ε) η κάρτα-διακόπτης πάνω από λίστα: πατημένη ⇔ μόνη τιμή, δεύτερο κλικ αφαιρεί, 0 ⇒ καμία πράξη.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Timestamp } from 'firebase/firestore';

import { getProcurementHubUrl, PROCUREMENT_STATUS_PARAM } from '@/lib/navigation/procurement-urls';
import { QUOTE_PENDING_STATUSES, type Quote } from '@/subapps/procurement/types/quote';
import {
  AGREEMENT_BUCKET_PREDICATES,
  countAgreementBuckets,
  matchesAgreementBuckets,
} from '@/subapps/procurement/utils/framework-agreement-buckets';
import { applyStatusDrill, statusFilterCard } from '@/components/projects/procurement/clients/status-filter-card';
import { QuotesCard } from '../cards/QuotesCard';
import { MaterialCatalogCard } from '../cards/MaterialCatalogCard';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

let mockQuotes: Array<Pick<Quote, 'id' | 'status'>> = [];
jest.mock('@/subapps/procurement/hooks/useQuotes', () => ({
  useQuotes: () => ({ quotes: mockQuotes, loading: false }),
}));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 4);
const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Timestamp;

function statusOf(href: string | null): string | null {
  return new URL(href ?? '', 'http://x').searchParams.get(PROCUREMENT_STATUS_PARAM);
}

describe('getProcurementHubUrl', () => {
  it('καθαρή διεύθυνση χωρίς φίλτρο — ούτε κενό `?status=`', () => {
    expect(getProcurementHubUrl('quotes')).toBe('/procurement/quotes');
    expect(getProcurementHubUrl('quotes', { status: [] })).toBe('/procurement/quotes');
  });

  it('κουβαλά το σύνολο καταστάσεων στο ΕΝΑ κλειδί που διαβάζει η λίστα', () => {
    expect(statusOf(getProcurementHubUrl('purchase-orders', { status: ['delivered', 'closed'] })))
      .toBe('delivered,closed');
  });
});

describe('QuotesCard (κάρτα-ενότητα)', () => {
  it('(α)+(β) σύνδεσμος φιλτραρισμένος στο ΙΔΙΟ σύνολο που μετρά', () => {
    mockQuotes = [
      { id: 'q1', status: 'submitted' }, { id: 'q2', status: 'under_review' }, { id: 'q3', status: 'accepted' },
    ];
    render(<QuotesCard />);
    const link = screen.getByRole('link');
    expect(statusOf(link.getAttribute('href'))?.split(',')).toEqual([...QUOTE_PENDING_STATUSES]);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('(γ) με 0 σε αναμονή ⇒ η ενότητα χωρίς φίλτρο', () => {
    mockQuotes = [{ id: 'q3', status: 'accepted' }];
    render(<QuotesCard />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/procurement/quotes');
  });

  it('η κάρτα χωρίς μετρητή είναι επίσης σύνδεσμος', () => {
    render(<MaterialCatalogCard />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/procurement/materials');
  });
});

describe('(δ) κουβάδες συμβάσεων', () => {
  const live = { status: 'active' as const, validUntil: ts(NOW + 60 * DAY) };
  const soon = { status: 'active' as const, validUntil: ts(NOW + 10 * DAY) };
  const lapsed = { status: 'active' as const, validUntil: ts(NOW - DAY) };
  const draft = { status: 'draft' as const, validUntil: ts(NOW + 60 * DAY) };

  it('«active» με λήξη στο παρελθόν ΔΕΝ είναι ενεργή — είναι ληγμένη', () => {
    expect(AGREEMENT_BUCKET_PREDICATES.active(lapsed, NOW)).toBe(false);
    expect(AGREEMENT_BUCKET_PREDICATES.expired(lapsed, NOW)).toBe(true);
  });

  it('ο αριθμός της κάρτας = οι γραμμές της φιλτραρισμένης λίστας, για κάθε κουβά', () => {
    const all = [live, soon, lapsed, draft];
    const counts = countAgreementBuckets(all, NOW);
    for (const bucket of Object.keys(counts) as Array<keyof typeof counts>) {
      expect(all.filter((a) => matchesAgreementBuckets(a, [bucket], NOW))).toHaveLength(counts[bucket]);
    }
    expect(counts).toEqual({ active: 2, expiring: 1, expired: 1, draft: 1 });
  });

  it('κενό φίλτρο ⇒ όλες', () => {
    expect(matchesAgreementBuckets(draft, [], NOW)).toBe(true);
  });
});

describe('(ε) statusFilterCard / applyStatusDrill', () => {
  const drill = (statuses: string[]) => ({ statuses, set: jest.fn() });

  it('μη πατημένη ⇒ κλικ φιλτράρει σε αυτή την τιμή', () => {
    const d = drill([]);
    const card = statusFilterCard(d, 'draft', 3);
    expect(card.pressed).toBe(false);
    card.onActivate?.();
    expect(d.set).toHaveBeenCalledWith(['draft']);
  });

  it('πατημένη ⇒ κλικ αφαιρεί το φίλτρο, ακόμη και με 0', () => {
    const d = drill(['draft']);
    const card = statusFilterCard(d, 'draft', 0);
    expect(card.pressed).toBe(true);
    card.onActivate?.();
    expect(d.set).toHaveBeenCalledWith([]);
  });

  it('0 και μη πατημένη ⇒ καμία πράξη', () => {
    expect(statusFilterCard(drill([]), 'draft', 0)).toEqual({});
  });

  it('φίλτρο πολλών τιμών (από το hub) ⇒ καμία κάρτα δεν φαίνεται πατημένη', () => {
    expect(statusFilterCard(drill(['submitted', 'under_review']), 'submitted', 2).pressed).toBe(false);
  });

  it('applyStatusDrill: κενό ⇒ ίδιος πίνακας· αλλιώς μόνο οι ζητούμενες', () => {
    const items = [{ s: 'a' }, { s: 'b' }];
    expect(applyStatusDrill(items, [], (i) => i.s)).toBe(items);
    expect(applyStatusDrill(items, ['b'], (i) => i.s)).toEqual([{ s: 'b' }]);
  });
});
