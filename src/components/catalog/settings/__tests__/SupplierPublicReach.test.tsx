/**
 * @jest-environment jsdom
 */

/**
 * «Δημόσια ορατά: X από Y — γιατί» (ADR-923 §5.13 Σ9): η οθόνη δείχνει ό,τι απάντησε ο διακομιστής, και σε βλάβη ποτέ «0 από Y».
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { PublicCatalogReach } from '@/subapps/catalog/public/public-reach';

import { SupplierPublicReach } from '../SupplierPublicReach';

const get = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (url: string) => get(url) } }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}));
jest.mock('../../shared/catalog-ui-hooks', () => ({
  useCatalogText: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key) }),
}));

const READY: PublicCatalogReach = { published: 2, total: 2, lastPassAtMs: Date.UTC(2026, 10, 7, 9, 55), reasons: [] };

const shown = async (reach: PublicCatalogReach) => {
  get.mockResolvedValue({ reach });
  render(<SupplierPublicReach />);
  return screen.findByText(/supplierVerification\.reach\.summary/);
};

beforeEach(() => get.mockReset());

describe('SupplierPublicReach', () => {
  it('διαβάζει από το ένα endpoint', async () => {
    await shown(READY);
    expect(get).toHaveBeenCalledWith('/api/catalog/supplier-showcase');
  });

  it('όλα δημόσια ⇒ X από Y, καμία αιτία, και η ώρα του πλήρους ελέγχου', async () => {
    const summary = await shown(READY);
    expect(summary.textContent).toBe('supplierVerification.reach.summary {"published":2,"total":2}');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(/supplierVerification\.reach\.lastPass/)).toBeTruthy();
  });

  it('χωρίς πλήρη έλεγχο ⇒ καμία γραμμή ώρας', async () => {
    await shown({ ...READY, lastPassAtMs: null });
    expect(screen.queryByText(/supplierVerification\.reach\.lastPass/)).toBeNull();
  });

  it('🔑 ο κανόνας καταλόγου κρύβει ⇒ αιτία με σύνδεσμο εκεί όπου διορθώνεται', async () => {
    await shown({ ...READY, published: 0, reasons: [{ kind: 'catalogRuleHides' }] });
    expect(screen.getByText(/supplierVerification\.reach\.reason\.catalogRuleHides/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'supplierVerification.reach.fix.visibility' });
    expect(link.getAttribute('href')).toContain('discounts');
    expect(link.getAttribute('href')).toContain('visibility');
  });

  it('αιτία με πλήθος ⇒ περνά το πλήθος στο κείμενο', async () => {
    await shown({ ...READY, published: 1, total: 3, reasons: [{ kind: 'noVisibleVariant', count: 2 }] });
    expect(screen.getByText('supplierVerification.reach.reason.noVisibleVariant {"count":2}')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'supplierVerification.reach.fix.products' })).toBeTruthy();
  });

  it.each(['conditionClosed', 'conditionUnknown', 'syncing'] as const)('%s δεν διορθώνεται με κλικ ⇒ κανένας σύνδεσμος', async (kind) => {
    await shown({ ...READY, published: 0, reasons: [{ kind }] });
    expect(screen.getByText(new RegExp(`supplierVerification\\.reach\\.reason\\.${kind}`))).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('🔒 βλάβη ⇒ ρητό μήνυμα, ποτέ «0 από Y»', async () => {
    get.mockRejectedValue(new Error('503'));
    render(<SupplierPublicReach />);
    expect(await screen.findByText('supplierVerification.reach.failed')).toBeTruthy();
    expect(screen.queryByText(/supplierVerification\.reach\.summary/)).toBeNull();
  });

  it('πριν απαντήσει ⇒ «μετράμε»', () => {
    get.mockReturnValue(new Promise(() => undefined));
    render(<SupplierPublicReach />);
    expect(screen.getByText('supplierVerification.reach.loading')).toBeTruthy();
  });
});
