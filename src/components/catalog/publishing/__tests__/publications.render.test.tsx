/**
 * Η οθόνη του εκδότη **αποδίδεται** με πραγματικές εγγραφές: συνταγή στη λίστα, έκδοση που απέτυχε (με την κλειστή
 * αιτία της), έκδοση έτοιμη (με σύνδεσμο λήψης ανά προφίλ), και ο επεξεργαστής με κλειδωμένο κωδικό. Πιάνει ό,τι δεν πιάνουν
 * οι καθαρές συναρτήσεις: σφάλματα απόδοσης και λάθος καλωδίωση props.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { PublicationRecipeWire, PublicationRunWire } from '@/subapps/catalog/types/publication';
import { PublicationRecipeEditor } from '../PublicationRecipeEditor';
import { PublicationRecipeList } from '../PublicationRecipeList';
import { PublicationRunList } from '../PublicationRunList';
import { emptyRecipe } from '../publication-draft';

jest.setTimeout(60_000);

jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}|${JSON.stringify(params)}` : key),
    i18n: { language: 'el' },
  }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock('@/hooks/catalog/useCatalogCollection', () => ({ useCatalogCollection: () => ({ state: 'ready', items: [] }) }));

const meta = {
  companyId: 'comp_test',
  isDeleted: false,
  createdAt: '2026-10-30T00:00:00.000Z',
  createdBy: 'u',
  updatedAt: '2026-10-30T00:00:00.000Z',
  updatedBy: 'u',
  deletedAt: null,
  deletedBy: null,
};

const recipe: PublicationRecipeWire = {
  ...emptyRecipe('el'),
  code: 'tech_2026',
  labels: { el: 'Τεχνικός 2026' },
  title: { el: 'Τεχνικός κατάλογος' },
  id: 'pubrec_1',
  revision: 3,
  ...meta,
};

const baseRun: PublicationRunWire = {
  id: 'pubrun_1',
  recipeId: 'pubrec_1',
  recipeRevision: 3,
  inputHash: 'h',
  audienceKey: 'none',
  priced: false,
  status: 'ready',
  progress: { phase: 'done', pagesDone: 12, pagesTotal: 12 },
  artifacts: [
    { profile: 'print', storagePath: 'p', sizeBytes: 10, pageCount: 12, sha256: 'a', renderMs: 5 },
    { profile: 'screen', storagePath: 's', sizeBytes: 10, pageCount: 12, sha256: 'b', renderMs: 5 },
  ],
  report: { incompleteSkuCount: 2, unpricedSkuCount: 0, lowResolutionImageCount: 0, nonCmykImageCount: 1 },
  failure: null,
  attempts: 1,
  requestedAt: '2026-10-30T10:00:00.000Z',
  requestedBy: 'u',
  finishedAt: '2026-10-30T10:01:00.000Z',
  companyId: 'comp_test',
  createdAt: '2026-10-30T10:00:00.000Z',
  updatedAt: '2026-10-30T10:01:00.000Z',
};

const failedRun: PublicationRunWire = {
  ...baseRun,
  id: 'pubrun_2',
  status: 'failed',
  artifacts: [],
  report: null,
  failure: 'engineTimeout',
  requestedAt: '2026-10-30T09:00:00.000Z',
};

describe('Εκδότης καταλόγου — λίστα συνταγών', () => {
  it('δείχνει τη συνταγή με το όνομα και τον κωδικό της', () => {
    render(<PublicationRecipeList recipes={[recipe]} selectedCode={null} onSelect={jest.fn()} />);
    expect(screen.getByText('Τεχνικός 2026')).toBeInTheDocument();
    expect(screen.getByText('tech_2026')).toBeInTheDocument();
  });

  it('χωρίς συνταγές λέει ότι δεν υπάρχει ακόμη', () => {
    render(<PublicationRecipeList recipes={[]} selectedCode={null} onSelect={jest.fn()} />);
    expect(screen.getByText('publishing.empty')).toBeInTheDocument();
  });
});

describe('Εκδότης καταλόγου — εκδόσεις', () => {
  it('η έκδοση που απέτυχε λέει την κλειστή αιτία και δεν δίνει λήψη', () => {
    render(<PublicationRunList runs={[failedRun]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('publishing.failure.engineTimeout');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('η έτοιμη έκδοση δίνει σύνδεσμο λήψης ανά προφίλ και την αναφορά της', () => {
    render(<PublicationRunList runs={[baseRun]} />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      CATALOG_API.publicationDownload('pubrun_1', 'print'),
      CATALOG_API.publicationDownload('pubrun_1', 'screen'),
    ]);
    const report = screen.getByRole('region', { name: 'publishing.report.title' });
    expect(within(report).getAllByRole('listitem')).toHaveLength(2);
  });

  it('χωρίς εκδόσεις λέει ότι δεν έγινε ακόμη καμία', () => {
    render(<PublicationRunList runs={[]} />);
    expect(screen.getByText('publishing.noRuns')).toBeInTheDocument();
  });

  it('η έκδοση σε εξέλιξη δείχνει φάση και πρόοδο', () => {
    const running: PublicationRunWire = { ...baseRun, status: 'running', artifacts: [], report: null, progress: { phase: 'composing', pagesDone: 3, pagesTotal: 12 } };
    render(<PublicationRunList runs={[running]} />);
    expect(screen.getByText(/publishing\.phase\.composing/)).toBeInTheDocument();
    expect(screen.getByText(/publishing\.progress/)).toBeInTheDocument();
  });
});

describe('Εκδότης καταλόγου — επεξεργαστής', () => {
  const noop = jest.fn();
  const renderEditor = (record: PublicationRecipeWire | null) =>
    render(<PublicationRecipeEditor record={record} revalidate={() => Promise.resolve()} onCreated={noop} onDeleted={noop} reportDirty={noop} />);

  it('η υπάρχουσα συνταγή έχει κωδικό αμετάβλητο (μόνο ανάγνωση)', () => {
    renderEditor(recipe);
    expect(screen.getByDisplayValue('tech_2026')).toHaveAttribute('readonly');
  });

  it('η νέα συνταγή έχει επεξεργάσιμο κωδικό και δεν προσφέρει διαγραφή', () => {
    renderEditor(null);
    expect(screen.getByLabelText('common.code')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
  });
});
