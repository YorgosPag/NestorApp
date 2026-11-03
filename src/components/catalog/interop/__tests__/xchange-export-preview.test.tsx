/**
 * ADR-923 §5.14.1 · απόφαση Ε3 — **ο προέλεγχος στην οθόνη**: κανένα προϊόν ⇒ η αιτία και ο σύνδεσμος της διόρθωσης, με το
 * κουμπί κλειστό· παλιά απάντηση για άλλο κοινό δεν φαίνεται ποτέ· αποτυχία του προελέγχου δεν μπλοκάρει την εξαγωγή.
 */
import React from 'react';
import { render, renderHook, screen, waitFor } from '@testing-library/react';

import { fetchXChangeExportPreview } from '@/services/catalog/catalog-interop-api.client';
import type { XChangeExportPreview } from '@/subapps/catalog/types/xchange-export';
import { useXChangeExportPreview, type XChangePreviewState } from '../use-xchange-export-preview';
import { XChangeExportPreviewNote, xchangePreviewAllowsExport } from '../XChangeExportPreviewNote';

const notifyError = jest.fn();

jest.mock('@/services/catalog/catalog-interop-api.client', () => ({ fetchXChangeExportPreview: jest.fn() }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { readonly href: string; readonly children: React.ReactNode; readonly className?: string }) => <a href={href} className={className}>{children}</a>,
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: notifyError, warning: jest.fn() }),
}));
jest.mock('../../shared/CatalogIssues', () => ({
  useIssueMessage: () => (issue: { readonly code: string; readonly params?: Readonly<Record<string, unknown>> }) => `${issue.code}:${String(issue.params?.cause ?? '')}`,
}));

const previewOf = (over: Partial<XChangeExportPreview>): XChangeExportPreview => ({
  audience: { kind: 'public' }, priceSource: null, at: '2026-11-03T10:00:00.000Z', exported: 3, hidden: 0, unfitIdentifier: 0, onRequest: {},
  emptyCause: null, blockers: [], ...over,
});

const fetchPreview = jest.mocked(fetchXChangeExportPreview);

beforeEach(() => {
  fetchPreview.mockReset();
  notifyError.mockClear();
});

describe('XChangeExportPreviewNote', () => {
  it('🔑 κανένα ορατό ⇒ η αιτία, σύνδεσμος στην ορατότητα, και η εξαγωγή κλειστή', () => {
    const state: XChangePreviewState = { kind: 'ready', preview: previewOf({ exported: 0, hidden: 8, emptyCause: 'noVisibilityRules' }) };
    render(<XChangeExportPreviewNote state={state} />);
    expect(screen.getByText('xchangeNothingToExport:noVisibilityRules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'xchangeExport.preview.fix.visibility' })).toHaveAttribute('href', '/catalog/discounts?tab=visibility');
    expect(xchangePreviewAllowsExport(state)).toBe(false);
  });

  it('ορατά χωρίς κατάλληλο κωδικό ⇒ σύνδεσμος στα προϊόντα', () => {
    render(<XChangeExportPreviewNote state={{ kind: 'ready', preview: previewOf({ exported: 0, unfitIdentifier: 2, emptyCause: 'noUsableIdentifier' }) }} />);
    expect(screen.getByRole('link', { name: 'xchangeExport.preview.fix.products' })).toHaveAttribute('href', '/catalog/products');
  });

  it('εμπόδιο (χωρίς επωνυμία) ⇒ φαίνεται πριν το κλικ και κλείνει την εξαγωγή, μαζί με τη μέτρηση', () => {
    const state: XChangePreviewState = { kind: 'ready', preview: previewOf({ blockers: [{ code: 'xchangeSupplierNameMissing', path: 'supplier' }] }) };
    render(<XChangeExportPreviewNote state={state} />);
    expect(screen.getByRole('alert')).toHaveTextContent('xchangeSupplierNameMissing');
    expect(screen.getByText('xchangeExport.preview.ready')).toBeInTheDocument();
    expect(xchangePreviewAllowsExport(state)).toBe(false);
  });

  it('η εξαγωγή ανοίγει μόνο με θετική κρίση — ή όταν ο προέλεγχος απέτυχε (κρίνει ξανά ο διακομιστής)', () => {
    expect(xchangePreviewAllowsExport({ kind: 'ready', preview: previewOf({}) })).toBe(true);
    expect(xchangePreviewAllowsExport({ kind: 'unavailable' })).toBe(true);
    expect(xchangePreviewAllowsExport({ kind: 'loading' })).toBe(false);
    expect(xchangePreviewAllowsExport({ kind: 'refused', issues: [{ code: 'xchangePriceListNotOffered', path: 'priceListId' }] })).toBe(false);
  });
});

describe('useXChangeExportPreview', () => {
  it('🔑 αργή απάντηση για παλιό κοινό δεν φαίνεται ποτέ', async () => {
    let resolveSlow: (value: XChangeExportPreview) => void = () => undefined;
    fetchPreview.mockImplementation((priceListId) => (priceListId === null
      ? new Promise((resolve) => { resolveSlow = resolve; })
      : Promise.resolve(previewOf({ exported: 5 }))));
    const { result, rerender } = renderHook(({ id }: { readonly id: string | null }) => useXChangeExportPreview(id), { initialProps: { id: null as string | null } });
    rerender({ id: 'cprl_b' });
    await waitFor(() => expect(result.current.state).toMatchObject({ kind: 'ready', preview: { exported: 5 } }));
    resolveSlow(previewOf({ exported: 99 }));
    await Promise.resolve();
    expect(result.current.state).toMatchObject({ kind: 'ready', preview: { exported: 5 } });
  });

  it('αποτυχία χωρίς ευρήματα ⇒ «μη διαθέσιμος», με τη μία ειδοποίηση του καταλόγου', async () => {
    fetchPreview.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useXChangeExportPreview(null));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'unavailable' }));
    expect(notifyError).toHaveBeenCalledTimes(1);
  });
});
