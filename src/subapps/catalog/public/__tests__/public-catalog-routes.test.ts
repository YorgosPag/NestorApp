/**
 * Οι δημόσιες διευθύνσεις και ό,τι βγαίνει από το έγγραφο προς την οθόνη (ADR-923 §5.13 Σ4).
 */

import { modelStructuredData, supplierStructuredData } from '@/lib/catalog/public-structured-data';
import { publicAfterOf, publicCategoryRoute, publicIdOfSegment, publicModelRoute, publicSegmentOf, publicSupplierRoute } from '../public-catalog-routes';
import { PUBLIC_CATALOG_SCHEMA_VERSION, type PublicCatalogModel, type PublicCatalogVariant } from '../public-catalog-schema';
import { publicModelCardOf, publicModelImage, publicModelTitle } from '../public-model-card';
import { NO_PROVIDER_FACTS, publicProviderFactsOf, type PublicProviderFacts } from '../public-provider-facts';
import { publicValueIn, publicValueText } from '../public-value-text';
import { CATALOG_LISTING_KINDS } from '../../vocabulary/listing-kinds';
import type { PublicShowcase } from '@/types/agency-profile';

const LOGO = { url: 'https://s/logo.webp', width: 200, height: 100, altKey: 'k', sources: [{ url: 'https://s/logo.webp', width: 200 }] };
const FACTS: PublicProviderFacts = { logo: null, website: null, area: { kind: 'areas', names: ['ΔΗΜΟΣ ΘΕΡΜΗΣ'] } };
const SUPPLIER = { legalName: 'ΑΛΦΑ ΑΕ', url: 'https://x', facts: FACTS };
const SERVICE = { name: 'Τοποθέτηση', familyLabels: { el: 'Εργασίες' }, url: 'https://x/p/1' };

const ID = 'cpmod_0f3a2b1c-1234-4abc-8def-001122334455';
const VARIANT: PublicCatalogVariant = { variantId: 'v1', code: 'A', label: 'Fan coil 12kW', attributes: [], media: [] };
const IMAGE = { assetId: 'a1', url: 'https://cdn/a.webp', labels: { el: 'Φωτό' } };

const model = (over: Partial<PublicCatalogModel> = {}): PublicCatalogModel => ({
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION,
  companyId: 'comp_a',
  modelId: ID,
  kind: 'productModel',
  code: 'MFP-TM',
  familyId: 'fam',
  familyLabels: { el: 'Κλιματιστικά' },
  listingKind: 'product',
  categoryIds: [],
  categoryLabels: {},
  locales: ['el'],
  attributes: [],
  media: [],
  variants: [VARIANT],
  ...over,
});

function keysOf(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
}

describe('τμήματα διεύθυνσης', () => {
  it('το ελληνικό όνομα γίνεται λατινικό slug', () => {
    expect(publicSegmentOf('Κλιματιστικό Τοίχου 12kW', ID)).toBe(`klimatistiko-toichou-12kw-${ID}`);
  });

  it('όνομα χωρίς slug ⇒ σκέτο id', () => {
    expect(publicSegmentOf('···', ID)).toBe(ID);
  });

  it('🔑 το id βγαίνει ατόφιο, παρά τις παύλες του', () => {
    expect(publicIdOfSegment(publicSegmentOf('Κλιματιστικό Τοίχου', ID))).toBe(ID);
    expect(publicIdOfSegment(ID)).toBe(ID);
  });

  it('τμήμα χωρίς id ή με ξένους χαρακτήρες ⇒ null', () => {
    expect(publicIdOfSegment('klimatistiko')).toBeNull();
    expect(publicIdOfSegment('slug-cpmod_x/y')).toBeNull();
  });

  it('🔒 ο δρομέας δεν δέχεται ελεύθερο κείμενο ή πίνακα', () => {
    expect(publicAfterOf('cpmod_1')).toBe('cpmod_1');
    expect(publicAfterOf('../x')).toBeNull();
    expect(publicAfterOf(['cpmod_1', 'cpmod_2'])).toBeNull();
    expect(publicAfterOf(undefined)).toBeNull();
  });

  it('οι διαδρομές κρατούν το ίδιο πρόθεμα', () => {
    expect(publicSupplierRoute('aries')).toBe('/suppliers/aries');
    expect(publicCategoryRoute('aries', 'x_1')).toBe('/suppliers/aries/c/x_1');
    expect(publicModelRoute('aries', 'x_1')).toBe('/suppliers/aries/p/x_1');
  });
});

describe('κάρτα μοντέλου', () => {
  it('ένα SKU ⇒ η ετικέτα του · πολλά ή καμία ⇒ ο κωδικός', () => {
    expect(publicModelTitle(model())).toBe('Fan coil 12kW');
    expect(publicModelTitle(model({ variants: [VARIANT, { ...VARIANT, variantId: 'v2' }] }))).toBe('MFP-TM');
    expect(publicModelTitle(model({ variants: [{ ...VARIANT, label: null }] }))).toBe('MFP-TM');
  });

  it('εικόνα: του μοντέλου, αλλιώς του πρώτου SKU, αλλιώς καμία', () => {
    expect(publicModelImage(model({ media: [IMAGE] }))).toEqual(IMAGE);
    expect(publicModelImage(model({ variants: [{ ...VARIANT, media: [IMAGE] }] }))).toEqual(IMAGE);
    expect(publicModelImage(model())).toBeNull();
  });

  it('🔒 η κάρτα δεν κουβαλά τιμές ιδιοτήτων', () => {
    expect(Object.keys(publicModelCardOf(model())).sort()).toEqual(['code', 'familyLabels', 'image', 'listingKind', 'modelId', 'title', 'variantCount']);
  });
});

describe('τιμή ιδιότητας', () => {
  it('μέτρηση, επιλογή και πολλαπλή επιλογή', () => {
    expect(publicValueText({ type: 'measurement', value: '12', unitCode: 'kW' }, 'el')).toBe('12 kW');
    expect(publicValueText({ type: 'option', option: { optionCode: 'w', labels: { el: 'Λευκό', en: 'White' } } }, 'en')).toBe('White');
    expect(publicValueText({ type: 'options', options: [{ optionCode: 'a', labels: { el: 'Α' } }, { optionCode: 'b', labels: { el: 'Β' } }] }, 'el')).toBe('Α, Β');
  });

  it('γλώσσα που λείπει ⇒ όποια υπάρχει', () => {
    const value = { type: 'text', text: 'Λευκό' } as const;
    expect(publicValueIn({ el: value }, 'en')).toEqual(value);
    expect(publicValueIn({}, 'el')).toBeNull();
  });
});

describe('🔒 δομημένα δεδομένα', () => {
  it('κανένα `offers` ή ποσό, σε βαθιά σάρωση', () => {
    for (const listingKind of CATALOG_LISTING_KINDS) {
      const keys = keysOf(modelStructuredData(model({ media: [IMAGE], listingKind }), 'https://x/p', SUPPLIER));
      expect(keys).not.toContain('offers');
      expect(keys.filter((key) => /price|amount/i.test(key))).toEqual([]);
    }
    expect(keysOf(supplierStructuredData(SUPPLIER, [SERVICE]))).not.toContain('offers');
  });

  it('τα πεδία του προϊόντος και το κενό `image`', () => {
    expect(modelStructuredData(model({ media: [IMAGE] }), 'https://x/p', SUPPLIER)).toMatchObject({ '@type': 'Product', name: 'Fan coil 12kW', sku: 'MFP-TM', category: 'Κλιματιστικά', image: [IMAGE.url] });
    expect(modelStructuredData(model(), 'https://x/p', SUPPLIER)).toMatchObject({ image: undefined });
  });

  it('υπηρεσία ⇒ `Service` με πάροχο και περιοχή · προϊόν με τοποθέτηση μένει `Product`', () => {
    const service = modelStructuredData(model({ listingKind: 'service', media: [IMAGE] }), 'https://x/p', SUPPLIER);
    expect(service).toMatchObject({
      '@type': 'Service',
      serviceType: 'Κλιματιστικά',
      url: 'https://x/p',
      image: [IMAGE.url],
      provider: { '@type': 'Organization', '@id': 'https://x#organization', name: 'ΑΛΦΑ ΑΕ' },
      areaServed: [{ '@type': 'AdministrativeArea', name: 'ΔΗΜΟΣ ΘΕΡΜΗΣ' }],
    });
    expect(keysOf(service)).not.toContain('sku');
    expect(modelStructuredData(model({ listingKind: 'productWithInstallation' }), 'https://x/p', SUPPLIER)).toMatchObject({ '@type': 'Product' });
  });

  it('ο οργανισμός: η δική του ιστοσελίδα, το λογότυπο, η περιοχή και ο κατάλογος υπηρεσιών χωρίς `Offer`', () => {
    const node = supplierStructuredData({ ...SUPPLIER, facts: { ...FACTS, website: 'https://aries.gr', logo: LOGO } }, [SERVICE]);
    expect(node).toMatchObject({ '@type': 'Organization', '@id': 'https://x#organization', name: 'ΑΛΦΑ ΑΕ', url: 'https://aries.gr', logo: LOGO.url });
    expect(node).toMatchObject({ hasOfferCatalog: { '@type': 'OfferCatalog', itemListElement: [{ '@type': 'Service', name: 'Τοποθέτηση', url: 'https://x/p/1' }] } });
    expect(JSON.stringify(node)).not.toContain('"Offer"');
  });

  it('χωρίς στοιχεία: η σελίδα είναι το `url`, και κανένας κενός κόμβος', () => {
    expect(supplierStructuredData({ ...SUPPLIER, facts: NO_PROVIDER_FACTS })).toMatchObject({ url: 'https://x', logo: undefined, areaServed: undefined, hasOfferCatalog: undefined });
  });

  it('🔒 `brand` στον οργανισμό μόνο από κατοχή σε ισχύ · το προϊόν δεν παίρνει ποτέ', () => {
    expect(supplierStructuredData({ ...SUPPLIER, brands: [{ brandName: 'Toshiba', relation: 'manufacturer' }] })).toMatchObject({ brand: [{ '@type': 'Brand', name: 'Toshiba' }] });
    expect(supplierStructuredData({ ...SUPPLIER, brands: [] })).toMatchObject({ brand: undefined });
    expect(keysOf(modelStructuredData(model(), 'https://x/p', { ...SUPPLIER, brands: [{ brandName: 'Toshiba', relation: 'manufacturer' }] }))).not.toContain('brand');
  });

  it('η περιγραφή μόνο όταν υπάρχει', () => {
    expect(supplierStructuredData({ ...SUPPLIER, description: { el: 'Κείμενο' } })).toMatchObject({ description: 'Κείμενο' });
    expect(supplierStructuredData({ ...SUPPLIER, description: {} })).toMatchObject({ description: undefined });
  });

  it('όλη η χώρα ⇒ `Country` · ακτίνα και πολύγωνο ⇒ σιωπή, χωρίς κέντρο ή γεωμετρία', () => {
    const areaOf = (area: PublicProviderFacts['area']) => supplierStructuredData({ ...SUPPLIER, facts: { ...FACTS, area } });
    expect(areaOf({ kind: 'nationwide' })).toMatchObject({ areaServed: { '@type': 'Country', name: 'GR' } });
    for (const area of [{ kind: 'radius', radiusKm: 30 }, { kind: 'outline', km2: 120 }] as const) {
      expect(keysOf(areaOf(area))).not.toEqual(expect.arrayContaining(['geoRadius']));
      expect(areaOf(area)).toMatchObject({ areaServed: undefined });
    }
  });
});

describe('publicProviderFactsOf', () => {
  const NAMES: Readonly<Record<string, string>> = { 'municipality:1': 'ΔΗΜΟΣ ΘΕΡΜΗΣ' };
  const nameOf = (id: string) => NAMES[id];
  const showcase = (over: Partial<Pick<PublicShowcase, 'mark' | 'website' | 'coverage'>> = {}) => ({ mark: null, website: null, coverage: null, ...over });

  it('δεν δήλωσε ⇒ τίποτα', () => {
    expect(publicProviderFactsOf(showcase(), nameOf)).toEqual(NO_PROVIDER_FACTS);
  });

  it('🔒 το πορτρέτο δεν φτάνει στη σελίδα που βλέπουν οι μηχανές · το λογότυπο φτάνει', () => {
    expect(publicProviderFactsOf(showcase({ mark: { kind: 'portrait', image: LOGO } }), nameOf).logo).toBeNull();
    expect(publicProviderFactsOf(showcase({ mark: { kind: 'logo', image: LOGO } }), nameOf).logo).toEqual(LOGO);
  });

  it('ονόματα από την ιεραρχία · άγνωστη ταυτότητα πέφτει · καμία γνωστή ⇒ `null`, όχι κενή λίστα', () => {
    expect(publicProviderFactsOf(showcase({ coverage: { adminIds: ['municipality:1', 'municipality:9'] } }), nameOf).area).toEqual({ kind: 'areas', names: ['ΔΗΜΟΣ ΘΕΡΜΗΣ'] });
    expect(publicProviderFactsOf(showcase({ coverage: { adminIds: ['municipality:9'] } }), nameOf).area).toBeNull();
  });

  it('🔒 από την ακτίνα μένει μόνο ο αριθμός: το κέντρο δεν φεύγει', () => {
    const coverage = { circle: { center: { lat: 40.5, lng: 22.9 }, radiusKm: 30 as const } };
    const facts = publicProviderFactsOf(showcase({ coverage }), nameOf);
    expect(facts.area).toEqual({ kind: 'radius', radiusKm: 30 });
    expect(JSON.stringify(facts)).not.toContain('40.5');
  });

  it('όλη η χώρα · η ιστοσελίδα περνά αυτούσια', () => {
    expect(publicProviderFactsOf(showcase({ coverage: { nationwide: true }, website: 'https://a.gr' }), nameOf)).toEqual({ logo: null, website: 'https://a.gr', area: { kind: 'nationwide' } });
  });
});
