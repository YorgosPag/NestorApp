/**
 * ⚓ Η ταινία του κλειδωμένου πλαισίου (ADR-329 §3.9) — λέει **πότε**, **γιατί έμεινε**, **πότε φεύγει**
 * και **τι θα κάνει η επαναφορά**, και κάθε γραμμή έρχεται από την πηγή της:
 *
 *   • «γιατί δεν διαγράφηκε»  ← ο φρουρός διαγραφής (ζωντανά)· 403 ⇒ η γραμμή **λείπει**, δεν μαντεύεται
 *   • «πότε εκκαθαρίζεται»    ← `TRASH_RETENTION_MS`, η ΙΔΙΑ σταθερά με το purge job
 *   • «τι κάνει η επαναφορά»  ← `REINSTATE_PROMISES` (δεμένο με τον διακομιστή στο `reinstate-promises.test`)
 *
 * Ψεύτικα είναι μόνο τα σύνορα: δίκτυο, ονόματα χρηστών, μετάφραση.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { TRASH_RETENTION_MS } from '@/lib/firestore/trashed-status';
import { formatDate } from '@/lib/intl-formatting';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const apiGet = jest.fn<Promise<unknown>, [string]>();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (url: string) => apiGet(url) },
}));

let knownNames = new Map<string, string>();
jest.mock('@/hooks/useUserDisplayNames', () => ({
  useUserDisplayNames: () => knownNames,
}));

import { RetiredRecordBanner } from '../RetiredRecordBanner';

const AT = new Date('2026-09-01T10:00:00.000Z');
const GUARD_URL = '/api/deletion-guard/property/prop_1';

const blockedBy = (dependencies: Array<{ label: string; count: number }>) => ({
  allowed: false,
  totalDependents: dependencies.reduce((sum, dependency) => sum + dependency.count, 0),
  message: '',
  dependencies: dependencies.map((dependency) => ({ ...dependency, collection: 'x', documentIds: [] })),
});

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue(blockedBy([]));
  knownNames = new Map();
});

describe('ζωντανή εγγραφή', () => {
  it('δεν αποδίδει τίποτα και δεν ρωτά τον φρουρό', () => {
    const { container } = render(<RetiredRecordBanner entityType="property" record={{ id: 'prop_1', status: 'for-sale' }} />);

    expect(container).toBeEmptyDOMElement();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('αρχείο', () => {
  const archived = { id: 'prop_1', status: 'archived', archivedAt: AT, archivedBy: 'uid_1' };

  it('🔴 λέει πότε και από ποιον — το όνομα μόνο όταν λύθηκε', () => {
    knownNames = new Map([['uid_1', 'Γιώργος']]);
    render(<RetiredRecordBanner entityType="property" record={archived} />);

    expect(screen.getByText(/retiredBanner\.archivedOnBy/)).toHaveTextContent('Γιώργος');
    expect(screen.getByText(/retiredBanner\.archivedOnBy/)).toHaveTextContent(formatDate(AT));
  });

  it('άλυτο όνομα (π.χ. `system:…`) ⇒ μόνο η ημερομηνία, ποτέ ωμό αναγνωριστικό', () => {
    render(<RetiredRecordBanner entityType="property" record={archived} />);

    expect(screen.getByText(/retiredBanner\.archivedOn /)).toBeInTheDocument();
    expect(screen.queryByText(/uid_1/)).toBeNull();
  });

  it('🔴 «γιατί δεν διαγράφηκε» έρχεται ΖΩΝΤΑΝΑ από τον φρουρό — μόνο ό,τι όντως το αναφέρει', async () => {
    apiGet.mockResolvedValue(blockedBy([{ label: 'Συμβόλαια', count: 2 }, { label: 'Πληρωμές', count: 0 }]));
    render(<RetiredRecordBanner entityType="property" record={archived} />);

    await waitFor(() => expect(screen.getByText(/retiredBanner\.keptBecause/)).toHaveTextContent('Συμβόλαια (2)'));
    expect(apiGet).toHaveBeenCalledWith(GUARD_URL);
    expect(screen.getByText(/retiredBanner\.keptBecause/)).not.toHaveTextContent('Πληρωμές');
  });

  it('🔴 403 από τον φρουρό ⇒ η γραμμή ΛΕΙΠΕΙ· η ταινία δεν μαντεύει λόγο', async () => {
    apiGet.mockRejectedValue(new Error('403'));
    render(<RetiredRecordBanner entityType="property" record={archived} />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByText(/retiredBanner\.keptBecause/)).toBeNull();
  });

  it('🔴 υπόσχεται επιστροφή ΕΚΤΟΣ ΑΓΟΡΑΣ, και καμία ημερομηνία εκκαθάρισης', () => {
    render(<RetiredRecordBanner entityType="property" record={archived} />);

    expect(screen.getByText('listingStaysOffMarketNotice')).toBeInTheDocument();
    expect(screen.queryByText(/retiredBanner\.purgeOn/)).toBeNull();
  });
});

describe('κάδος', () => {
  const trashed = { id: 'prop_1', status: 'deleted', deletedAt: { _seconds: AT.getTime() / 1000 }, deletedBy: 'uid_1' };

  it('🔴 η εκκαθάριση είναι `deletedAt` + η προθεσμία του purge job — και η σφραγίδα διαβάζεται μέσα από JSON', () => {
    render(<RetiredRecordBanner entityType="property" record={trashed} />);

    const purgeDay = formatDate(new Date(AT.getTime() + TRASH_RETENTION_MS));
    expect(screen.getByText(/retiredBanner\.purgeOn/)).toHaveTextContent(purgeDay);
  });

  it('🔴 υπόσχεται επιστροφή ΟΠΩΣ ΗΤΑΝ, και ΔΕΝ ρωτά τον φρουρό (ο κάδος δεν κρατήθηκε από αναφορές)', () => {
    render(<RetiredRecordBanner entityType="property" record={trashed} />);

    expect(screen.getByText('retiredBanner.returnsAsItWas')).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('χωρίς σφραγίδα ⇒ λέει μόνο πού βρίσκεται, χωρίς ημερομηνία εκκαθάρισης που δεν ξέρει', () => {
    render(<RetiredRecordBanner entityType="property" record={{ id: 'prop_1', status: 'deleted' }} />);

    expect(screen.getByText('retiredBanner.trashedUndated')).toBeInTheDocument();
    expect(screen.queryByText(/retiredBanner\.purgeOn/)).toBeNull();
  });
});
