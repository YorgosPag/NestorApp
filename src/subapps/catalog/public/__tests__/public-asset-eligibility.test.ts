/**
 * Ποιο μέσο βγαίνει στο κοινό (ADR-923 §5.13 Σ3): κλειστή κρίση, τέσσερις ανεξάρτητες ερωτήσεις.
 */

import { CATALOG_RENDITION_RECIPE_VERSION, type CatalogRenditions } from '../../renditions/catalog-renditions';
import { isPublicAsset } from '../public-asset-eligibility';
import type { CatalogAssetDefinition } from '../../types/asset';
import type { MediaLicense } from '@/types/media-rights';

const NOW = Date.parse('2026-11-02T10:00:00.000Z');

const READY = { status: 'ready', recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: '1' } as unknown as CatalogRenditions;
const OLD_RECIPE = { ...READY, recipe: CATALOG_RENDITION_RECIPE_VERSION - 1 } as CatalogRenditions;
const FAILED = { status: 'failed', recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: '1', failure: 'undecodable', failedAt: '' } as CatalogRenditions;

const assetWith = (license: MediaLicense, kind: CatalogAssetDefinition['kind'] = 'image') =>
  ({ kind, rights: { license } }) as Pick<CatalogAssetDefinition, 'kind' | 'rights'>;

const PERPETUAL: MediaLicense = { purpose: 'catalog-publication', term: { kind: 'perpetual' } };

describe('isPublicAsset', () => {
  it('εικόνα, άδεια καταλόγου σε ισχύ, έτοιμη απόδοση ⇒ ναι', () => {
    expect(isPublicAsset(assetWith(PERPETUAL), READY, NOW)).toBe(true);
  });

  it.each(['catalog-publication', 'reseller-reuse', 'unrestricted'] as const)('σκοπός καταλόγου %s ⇒ ναι', (purpose) => {
    expect(isPublicAsset(assetWith({ ...PERPETUAL, purpose }), READY, NOW)).toBe(true);
  });

  it.each(['listing-marketing', 'owner-reuse'] as const)('σκοπός έξω από τον κατάλογο %s ⇒ όχι', (purpose) => {
    expect(isPublicAsset(assetWith({ ...PERPETUAL, purpose }), READY, NOW)).toBe(false);
  });

  it('ληγμένη άδεια πέφτει χωρίς κανέναν γραφέα', () => {
    const until = '2026-11-02T09:59:59.000Z';
    expect(isPublicAsset(assetWith({ purpose: 'unrestricted', term: { kind: 'date', until } }), READY, NOW)).toBe(false);
    expect(isPublicAsset(assetWith({ purpose: 'unrestricted', term: { kind: 'date', until } }), READY, Date.parse(until) - 1)).toBe(true);
  });

  it('άδεια «όσο ισχύει η εντολή» δεν ανοίγει ποτέ σε κατάλογο', () => {
    expect(isPublicAsset(assetWith({ purpose: 'unrestricted', term: { kind: 'mandate', mandateId: 'm' } }), READY, NOW)).toBe(false);
  });

  it('μη εικόνα ⇒ όχι (CAD/IFC, Ε5)', () => {
    expect(isPublicAsset(assetWith(PERPETUAL, 'document'), READY, NOW)).toBe(false);
  });

  it.each([
    ['χωρίς απόδοση', undefined],
    ['παλιά συνταγή', OLD_RECIPE],
    ['αποτυχημένη', FAILED],
  ])('%s ⇒ όχι', (_name, renditions) => {
    expect(isPublicAsset(assetWith(PERPETUAL), renditions, NOW)).toBe(false);
  });
});
