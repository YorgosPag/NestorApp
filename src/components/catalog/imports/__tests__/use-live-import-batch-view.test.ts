/**
 * ADR-923 §5.5.2 · ADR-905 — η πύλη αποδοχής της ζωντανής όψης παρτίδας: **μονοτονική**. Μια αργή απάντηση (παλαιότερη
 * αναθεώρηση σήματος) δεν γυρίζει ποτέ πίσω την οθόνη ούτε τη βάση του CAS· ίση αναθεώρηση γίνεται δεκτή (η πιο πρόσφατη άφιξη).
 */
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { acceptNewer } from '../use-live-import-batch-view';

jest.mock('@/services/catalog/catalog-import-api.client', () => ({}));
jest.mock('@/services/catalog/catalog-view-signal.client-ref', () => ({}));
jest.mock('@/services/realtime/hooks/use-server-view-signal', () => ({}));
jest.mock('@/hooks/useCompanyId', () => ({}));
jest.mock('@/hooks/catalog/useCatalogServerView', () => ({}));

const at = (revision: number): ImportBatchDetailView =>
  ({ freshness: { revision, freshUntil: '2026-11-11T18:00:00.000Z' }, batch: {}, proposals: [] }) as unknown as ImportBatchDetailView;

describe('acceptNewer', () => {
  it('πρώτη όψη ⇒ δεκτή', () => {
    expect(acceptNewer(null, at(0))).toBe(true);
  });

  it('νεότερη ή ίση αναθεώρηση ⇒ δεκτή', () => {
    expect(acceptNewer(at(4), at(5))).toBe(true);
    expect(acceptNewer(at(5), at(5))).toBe(true);
  });

  it('🔴 παλαιότερη αναθεώρηση (αργή απάντηση) ⇒ απορρίπτεται', () => {
    expect(acceptNewer(at(7), at(6))).toBe(false);
  });
});
