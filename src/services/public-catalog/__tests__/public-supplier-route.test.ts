/**
 * Από τη διεύθυνση στον προμηθευτή (ADR-923 §5.13 Σ4): 404 για ό,τι δεν είναι δημόσιο, 5xx για ό,τι δεν ρωτήθηκε.
 */

import { BackendUnavailableError } from '@/lib/errors/backend-unavailable';
import type { AliasResolution } from '@/lib/workspace/alias-registry';
import { requirePublicSupplier } from '../public-supplier-route';

const resolveAlias = jest.fn<Promise<AliasResolution>, [string]>();
const readPublicSupplier = jest.fn();

jest.mock('@/lib/workspace/alias-registry', () => ({ resolveAlias: (segment: string) => resolveAlias(segment) }));
jest.mock('../public-catalog.reader', () => ({ readPublicSupplier: (companyId: string) => readPublicSupplier(companyId) }));
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  permanentRedirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const FOUND: AliasResolution = { outcome: 'found', companyId: 'comp_a', form: 'identity', current: true, canonicalAlias: null };
const ALIAS_FOUND: AliasResolution = { ...FOUND, form: 'alias' };
const SHOWCASE = { companyId: 'comp_a', legalName: 'ΑΛΦΑ ΑΕ', alias: null };
const WITH_ALIAS = { ...SHOWCASE, alias: 'aries' };

beforeEach(() => {
  resolveAlias.mockReset();
  readPublicSupplier.mockReset();
});

describe('requirePublicSupplier', () => {
  it('δημοσιευμένος ⇒ η βιτρίνα', async () => {
    resolveAlias.mockResolvedValue(FOUND);
    readPublicSupplier.mockResolvedValue(SHOWCASE);
    await expect(requirePublicSupplier('comp_a')).resolves.toBe(SHOWCASE);
  });

  describe('🔑 μία κανονική διεύθυνση', () => {
    beforeEach(() => readPublicSupplier.mockResolvedValue(WITH_ALIAS));

    it('η ταυτότητα στέλνει 308 στο ψευδώνυμο, κρατώντας τη σελίδα', async () => {
      resolveAlias.mockImplementation(async (segment) => (segment === 'aries' ? ALIAS_FOUND : FOUND));
      await expect(requirePublicSupplier('comp_a')).rejects.toThrow('REDIRECT:/suppliers/aries');
      await expect(requirePublicSupplier('comp_a', (canonical) => `/x/${canonical}/p/1`)).rejects.toThrow('REDIRECT:/x/aries/p/1');
    });

    it('🔒 ψευδώνυμο που λύνεται σε άλλον χώρο ⇒ καμία ανακατεύθυνση', async () => {
      resolveAlias.mockImplementation(async (segment) => (segment === 'aries' ? { ...ALIAS_FOUND, companyId: 'comp_b' } : FOUND));
      await expect(requirePublicSupplier('comp_a')).resolves.toBe(WITH_ALIAS);
    });

    it('βλάβη της αυθεντίας ⇒ η σελίδα αποδίδεται στη ζητούμενη διεύθυνση', async () => {
      resolveAlias.mockImplementation(async (segment) => {
        if (segment === 'aries') throw new Error('5xx');
        return FOUND;
      });
      await expect(requirePublicSupplier('comp_a')).resolves.toBe(WITH_ALIAS);
    });

    it('το ίδιο το ψευδώνυμο δεν ξαναστέλνει: κανένας βρόχος', async () => {
      resolveAlias.mockResolvedValue(ALIAS_FOUND);
      await expect(requirePublicSupplier('aries')).resolves.toBe(WITH_ALIAS);
    });

    it('🔒 ψευδώνυμο που δείχνει στον εαυτό του δεν γίνεται ατέρμονο 308', async () => {
      resolveAlias.mockResolvedValue({ ...ALIAS_FOUND, current: false, canonicalAlias: 'aries' });
      await expect(requirePublicSupplier('aries')).resolves.toBe(WITH_ALIAS);
    });

    it('🔒 ανακλημένος δεν αποκαλύπτει ψευδώνυμο: 404 πριν από κάθε ανακατεύθυνση', async () => {
      resolveAlias.mockResolvedValue(FOUND);
      readPublicSupplier.mockResolvedValue(null);
      await expect(requirePublicSupplier('comp_a')).rejects.toThrow('NOT_FOUND');
    });
  });

  it('ανύπαρκτος και αδημοσίευτος ⇒ το ίδιο 404', async () => {
    resolveAlias.mockResolvedValue({ outcome: 'not-found' });
    await expect(requirePublicSupplier('x')).rejects.toThrow('NOT_FOUND');
    resolveAlias.mockResolvedValue(FOUND);
    readPublicSupplier.mockResolvedValue(null);
    await expect(requirePublicSupplier('comp_a')).rejects.toThrow('NOT_FOUND');
  });

  it('🔑 άγνωστο ψευδώνυμο ή βλάβη ανάγνωσης ⇒ 5xx, ποτέ 404', async () => {
    resolveAlias.mockResolvedValue({ outcome: 'unknown' });
    await expect(requirePublicSupplier('x')).rejects.toBeInstanceOf(BackendUnavailableError);
    resolveAlias.mockResolvedValue(FOUND);
    readPublicSupplier.mockRejectedValue(new Error('5xx'));
    await expect(requirePublicSupplier('comp_a')).rejects.toMatchObject({ dependency: 'supplier-catalog' });
  });
});
