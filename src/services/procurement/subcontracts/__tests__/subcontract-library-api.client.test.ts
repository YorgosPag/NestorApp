import { existsSync } from 'fs';
import { join } from 'path';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(async () => ({})), put: jest.fn(async () => ({})) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  approveClauseTranslation,
  approveClauseVersion,
  markClauseVersionReviewed,
  proposeClauseTranslation,
  rejectClauseVersion,
  seedSubcontractLibrary,
  setClauseArchived,
  setTradeTemplateArchived,
  withdrawClauseVersion,
} from '../subcontract-library-api.client';

const post = apiClient.post as jest.Mock;
const put = apiClient.put as jest.Mock;
const ref = { clauseId: 'sccl_1', version: 3 };

/** Η διαδρομή του πελάτη λύνεται σε αρχείο `route.ts` του Next (ο φάκελος με `[id]` · `[version]` · `[language]`). */
function routeFileOf(url: string): string {
  const pattern = url
    .replace('/api/subcontracts/', '')
    .replace(/^clauses\/[^/]+/, 'clauses/[id]')
    .replace(/versions\/\d+/, 'versions/[version]')
    .replace(/translations\/[^/]+\/approve$/, 'translations/[language]/approve')
    .replace(/^trade-templates\/[^/]+/, 'trade-templates/[id]');
  return join(process.cwd(), 'src/app/api/subcontracts', pattern, 'route.ts');
}

describe('subcontract-library-api.client — διαδρομές και σώματα', () => {
  beforeEach(() => jest.clearAllMocks());

  it('κάθε πράξη στέλνει στη σωστή διαδρομή, και η διαδρομή υπάρχει', async () => {
    await seedSubcontractLibrary();
    await approveClauseVersion(ref, { expectedRevision: 2, effectiveFrom: null, reason: null });
    await rejectClauseVersion(ref, { expectedRevision: 2, reason: 'Ασαφές' });
    await withdrawClauseVersion(ref, { expectedRevision: 2, reason: null });
    await markClauseVersionReviewed(ref, { expectedRevision: 2 });
    await proposeClauseTranslation(ref, { expectedRevision: 2, language: 'en', body: { heading: 'H', blocks: [] }, origin: 'human' });
    await approveClauseTranslation(ref, 'en', { expectedRevision: 2 });
    await setClauseArchived('sccl_1', { expectedRevision: 4, archived: true });
    await setTradeTemplateArchived('sctt_1', { expectedRevision: 1, archived: false });

    const urls = [...post.mock.calls, ...put.mock.calls].map(([url]) => url as string);
    expect(urls).toEqual([
      '/api/subcontracts/library/seed',
      '/api/subcontracts/clauses/sccl_1/versions/3/approve',
      '/api/subcontracts/clauses/sccl_1/versions/3/reject',
      '/api/subcontracts/clauses/sccl_1/versions/3/withdraw',
      '/api/subcontracts/clauses/sccl_1/versions/3/review',
      '/api/subcontracts/clauses/sccl_1/versions/3/translations',
      '/api/subcontracts/clauses/sccl_1/versions/3/translations/en/approve',
      '/api/subcontracts/clauses/sccl_1/archive',
      '/api/subcontracts/trade-templates/sctt_1/archive',
    ]);
    for (const url of urls) expect(existsSync(routeFileOf(url))).toBe(true);
  });

  it('το σώμα φτάνει αυτούσιο (η διαδρομή κρίνει, ο πελάτης δεν μεταμορφώνει)', async () => {
    const input = { expectedRevision: 7, effectiveFrom: '2026-12-01', reason: 'Σύμφωνα με τον νομικό' };
    await approveClauseVersion(ref, input);
    expect(post).toHaveBeenCalledWith('/api/subcontracts/clauses/sccl_1/versions/3/approve', input);
  });
});
