/**
 * @jest-environment jsdom
 */

/**
 * ADR-330 §5.1 S3.1 — οι κάρτες της Επισκόπησης προμηθειών είναι drill-down ΣΥΝΔΕΣΜΟΙ:
 *   (α) κάρτα με τιμή > 0 ⇒ πραγματικό `<a href>` προς την καρτέλα, με φίλτρο στο URL·
 *   (β) το φίλτρο είναι ΤΟ ΙΔΙΟ σύνολο που μετρά ο aggregator (όχι δεύτερη χειρόγραφη λίστα)·
 *   (γ) κάρτα με τιμή 0 ⇒ ΚΑΝΕΝΑΣ σύνδεσμος (drill σε άδεια λίστα = αδιέξοδο).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { KpiOpenRfqs } from '../KpiOpenRfqs';
import { KpiPendingApprovalPos } from '../KpiPendingApprovalPos';
import { KpiTotalCommittedSpend } from '../KpiTotalCommittedSpend';
import { KpiBoqCoverage } from '../KpiBoqCoverage';
import { getProjectProcurementUrl, PROCUREMENT_STATUS_PARAM } from '@/lib/navigation/procurement-urls';
import { getProjectTabUrl } from '@/lib/navigation/project-urls';
import { PO_AWAITING_APPROVAL_STATUSES, PO_COMMITTED_STATUSES } from '@/types/procurement';
import { RFQ_OPEN_STATUSES } from '@/subapps/procurement/types/rfq';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const PROJECT_ID = 'proj_test';

function stats(overrides: Partial<ProjectProcurementStats> = {}): ProjectProcurementStats {
  return {
    openRfqCount: 0,
    pendingApprovalPoCount: 0,
    totalCommittedSpend: 0,
    budgetVsCommitted: [],
    boqCoverage: { coveredCount: 0, totalCount: 0, percentage: 0 },
    ...overrides,
  };
}

function statusesOf(href: string | null): string[] {
  const query = href?.split('?')[1] ?? '';
  return (new URLSearchParams(query).get(PROCUREMENT_STATUS_PARAM) ?? '').split(',').filter(Boolean);
}

describe('getProjectProcurementUrl — φίλτρο κατάστασης', () => {
  it('χωρίς φίλτρο ή με κενό φίλτρο ⇒ καμία παράμετρος ερωτήματος', () => {
    expect(getProjectProcurementUrl(PROJECT_ID, 'po')).toBe(`/projects/${PROJECT_ID}/procurement/po`);
    expect(getProjectProcurementUrl(PROJECT_ID, 'po', { status: [] })).toBe(`/projects/${PROJECT_ID}/procurement/po`);
  });

  it('με φίλτρο ⇒ `?status=` διαχωρισμένο με κόμμα', () => {
    expect(getProjectProcurementUrl(PROJECT_ID, 'po', { status: ['ordered', 'closed'] }))
      .toBe(`/projects/${PROJECT_ID}/procurement/po?status=ordered%2Cclosed`);
  });
});

describe('Κάρτες Επισκόπησης — drill-down', () => {
  it.each([
    ['Ανοιχτά Αιτήματα', <KpiOpenRfqs key="r" projectId={PROJECT_ID} stats={stats({ openRfqCount: 2 })} />, 'rfq', RFQ_OPEN_STATUSES],
    ['Προς Έγκριση', <KpiPendingApprovalPos key="p" projectId={PROJECT_ID} stats={stats({ pendingApprovalPoCount: 1 })} />, 'po', PO_AWAITING_APPROVAL_STATUSES],
    ['Δεσμευμένη Δαπάνη', <KpiTotalCommittedSpend key="c" projectId={PROJECT_ID} stats={stats({ totalCommittedSpend: 1500 })} />, 'po', PO_COMMITTED_STATUSES],
  ] as const)('%s > 0 ⇒ σύνδεσμος με το ΙΔΙΟ σύνολο του aggregator', (_name, card, section, expected) => {
    render(card);
    const href = screen.getByRole('link').getAttribute('href');
    expect(href?.startsWith(`/projects/${PROJECT_ID}/procurement/${section}?`)).toBe(true);
    expect(new Set(statusesOf(href))).toEqual(new Set(expected));
  });

  it('Κάλυψη Επιμετρήσεων με επιμετρήσεις ⇒ σύνδεσμος στην καρτέλα Επιμετρήσεων', () => {
    render(<KpiBoqCoverage projectId={PROJECT_ID} stats={stats({ boqCoverage: { coveredCount: 0, totalCount: 49, percentage: 0 } })} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(getProjectTabUrl(PROJECT_ID, 'measurements'));
  });

  it.each([
    ['Ανοιχτά Αιτήματα', <KpiOpenRfqs key="r" projectId={PROJECT_ID} stats={stats()} />],
    ['Προς Έγκριση', <KpiPendingApprovalPos key="p" projectId={PROJECT_ID} stats={stats()} />],
    ['Δεσμευμένη Δαπάνη', <KpiTotalCommittedSpend key="c" projectId={PROJECT_ID} stats={stats()} />],
    ['Κάλυψη χωρίς επιμετρήσεις', <KpiBoqCoverage key="b" projectId={PROJECT_ID} stats={stats()} />],
  ] as const)('%s = 0 ⇒ ΚΑΝΕΝΑΣ σύνδεσμος', (_name, card) => {
    render(card);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
