/**
 * ADR-915 §45.18 Φ6 — **η κάρτα του επαγγελματία λέει την προθεσμία και αν καθυστερεί** (η ΙΔΙΑ βαθμίδα με το μητρώο
 * του γραφείου)· χωρίς προθεσμία ⇒ τίποτα (ποτέ «χωρίς προθεσμία» σε ανάθεση που δεν δεσμεύτηκε ακόμη).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import type { MyIssuanceCard } from '@/types/my-engagements';

import { MyIssuanceCardView } from '../MyIssuanceCardView';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ children, href }: { readonly children: React.ReactNode; readonly href: string }) => <a href={href}>{children}</a>,
}));
jest.mock('@/lib/intl-formatting', () => ({ formatDate: (day: string) => `«${day}»` }));

const CARD: MyIssuanceCard = {
  kind: 'document_issuance', engagementId: 'ceng_1', engagementState: 'active', verdict: 'engaged',
  offeredAt: '2026-11-01T09:00:00.000Z', expiresAt: '2026-12-01T09:00:00.000Z', hostName: 'Γραφείο Άλφα',
  propertyName: 'Διαμέρισμα Α1', documentKind: 'energy-certificate', stage: 'accepted', ballInCourt: 'professional',
  actingFor: null, delivery: null,
};

describe('ADR-915 §45.18 Φ6 — MyIssuanceCardView', () => {
  it('καθυστερεί ⇒ «Παράδοση έως …» + η βαθμίδα του μητρώου με τις ημέρες', () => {
    render(<MyIssuanceCardView card={{ ...CARD, delivery: { dueOn: '2026-11-13', lateness: { tier: 'overdue', days: 3 } } }} home="personal" />);
    expect(screen.getByText(`conveyance:engagement.issuance.dueOnLine ${JSON.stringify({ date: '«2026-11-13»' })}`)).toBeTruthy();
    expect(screen.getByText(/document-registry:issuance\.delivery\.tier\.overdue/)).toBeTruthy();
  });

  it('χωρίς προθεσμία ⇒ καμία γραμμή παράδοσης', () => {
    render(<MyIssuanceCardView card={CARD} home="personal" />);
    expect(screen.queryByText(/dueOnLine/)).toBeNull();
    expect(screen.queryByText(/delivery\.tier/)).toBeNull();
  });
});
