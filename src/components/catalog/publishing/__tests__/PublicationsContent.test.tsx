/**
 * ADR-923 §5.6.1 — **η σελίδα ολόκληρη**: η επιλογή ζει στη διεύθυνση, το σπλιτ δείχνει τη συνταγή της διεύθυνσης, και κάθε
 * συνταγή βλέπει μόνο τις δικές της εκδόσεις. Τα κομμάτια έχουν δικό τους render test· εδώ κρίνεται η καλωδίωσή τους.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { usePublicationsView } from '@/hooks/catalog/usePublicationsView';
import { EMPTY_PUBLICATION_RETENTION, type PublicationRecipeWire, type PublicationRunWire, type PublicationsViewWire } from '@/subapps/catalog/types/publication';
import { PublicationsContent } from '../PublicationsContent';
import { emptyRecipe } from '../publication-draft';

jest.setTimeout(60_000);

const replace = jest.fn();
let mockQuery = '';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockQuery) }));
jest.mock('@/lib/workspace/navigation', () => ({
  usePathname: () => '/o/acme/catalog/publications',
  useRouter: () => ({ replace }),
}));
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock('@/hooks/catalog/useCatalogCollection', () => ({ useCatalogCollection: () => ({ state: 'ready', items: [] }) }));
jest.mock('@/hooks/catalog/useCatalogAssetFiles', () => ({ useCatalogAssetFiles: () => ({ ready: true, byId: new Map(), byAsset: new Map() }) }));
jest.mock('@/hooks/catalog/usePublicationsView', () => ({ usePublicationsView: jest.fn() }));
jest.mock('@/core/layouts', () => ({
  ListDetailsSplit: ({ list, details }: { readonly list: React.ReactNode; readonly details: React.ReactNode }) => <main>{list}{details}</main>,
}));
jest.mock('@/core/containers', () => ({
  EntityListColumn: ({ children }: { readonly children: React.ReactNode }) => <section>{children}</section>,
  DetailsContainer: ({ selectedItem, children }: { readonly selectedItem: unknown; readonly children: React.ReactNode }) => <article>{selectedItem ? children : null}</article>,
}));

const stamps = { companyId: 'comp_test', isDeleted: false, createdAt: '2026-10-30T00:00:00.000Z', createdBy: 'u', updatedAt: '2026-10-30T00:00:00.000Z', updatedBy: 'u', deletedAt: null, deletedBy: null };
const recipeOf = (code: string, id: string): PublicationRecipeWire => ({ ...emptyRecipe('el'), code, labels: { el: `Συνταγή ${code}` }, title: { el: 'Τ' }, id, revision: 1, ...stamps });
const runOf = (id: string, recipeId: string, failure: 'engineTimeout' | 'engineFailed'): PublicationRunWire => ({
  id, recipeId, recipeRevision: 1, inputHash: id, audienceKey: 'none', priced: false, priceVersion: null, retention: EMPTY_PUBLICATION_RETENTION, dispositionDueAt: null, status: 'failed', progress: { phase: 'done', pagesDone: 0, pagesTotal: 0 },
  artifacts: [], report: null, failure, attempts: 1, requestedAt: '2026-10-30T10:00:00.000Z', requestedBy: 'u', finishedAt: null, companyId: 'comp_test',
  createdAt: '2026-10-30T10:00:00.000Z', updatedAt: '2026-10-30T10:00:00.000Z',
});

const view: PublicationsViewWire = {
  recipes: [recipeOf('alpha', 'r1'), recipeOf('beta', 'r2')],
  runs: [runOf('run1', 'r1', 'engineTimeout'), runOf('run2', 'r2', 'engineFailed')],
};

function showPage(query: string, current: unknown = { state: 'ready', view }) {
  mockQuery = query;
  jest.mocked(usePublicationsView).mockReturnValue({ current, revalidate: jest.fn() } as unknown as ReturnType<typeof usePublicationsView>);
  render(<PublicationsContent />);
}

beforeEach(() => replace.mockClear());

describe('PublicationsContent', () => {
  it('χωρίς επιλογή στη διεύθυνση: η λίστα, και καμία έκδοση', () => {
    showPage('');
    expect(screen.getByText('Συνταγή alpha')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('🔑 η διεύθυνση ανοίγει τη συνταγή, και αυτή βλέπει μόνο τις δικές της εκδόσεις', () => {
    showPage('recipe=beta');
    expect(screen.getByRole('alert')).toHaveTextContent('publishing.failure.engineFailed');
    expect(screen.queryByText('publishing.failure.engineTimeout')).not.toBeInTheDocument();
  });

  it('🔑 η επιλογή γράφεται στη διεύθυνση', () => {
    showPage('');
    fireEvent.click(screen.getByText('Συνταγή alpha'));
    expect(replace).toHaveBeenCalledWith('/o/acme/catalog/publications?recipe=alpha');
  });

  it('κωδικός που δεν υπάρχει: καμία λεπτομέρεια, όχι ξένη συνταγή', () => {
    showPage('recipe=ghost');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('🔴 χωρίς δικαίωμα προβολής: το δικό μας μήνυμα, όχι λίστα', () => {
    showPage('', { state: 'failed', failure: { kind: 'forbidden' } });
    expect(screen.getByRole('status')).toHaveTextContent('pricing.noView');
    expect(screen.queryByText('Συνταγή alpha')).not.toBeInTheDocument();
  });
});
