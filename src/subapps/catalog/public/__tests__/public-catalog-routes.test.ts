/**
 * Οι δημόσιες διευθύνσεις και ό,τι βγαίνει από το έγγραφο προς την οθόνη (ADR-923 §5.13 Σ4).
 */

import { modelStructuredData, projectStructuredData, supplierStructuredData } from '@/lib/catalog/public-structured-data';
import { publicAfterOf, publicCategoryRoute, publicIdOfSegment, publicModelRoute, publicProjectRoute, publicSegmentOf, publicSupplierRoute } from '../public-catalog-routes';
import { publicProjectOf, publicProjectTitle, type PublicPortfolioProject } from '../public-supplier-profile';
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
    expect(publicProjectRoute('aries', 'x_1')).toBe('/suppliers/aries/w/x_1');
  });
});

describe('Ν11 στ: σελίδα έργου portfolio', () => {
  const PROJECT_ID = 'cprjt_0f3a2b1c-1234-4abc-8def-001122334455';
  const project = (over: Partial<PublicPortfolioProject> = {}): PublicPortfolioProject => ({
    projectId: PROJECT_ID,
    title: { el: 'Ανακαίνιση Γραφείων Θέρμης', en: 'Thermi Office Renovation' },
    description: { el: 'Πλήρης ηλεκτρομηχανολογική εγκατάσταση.' },
    year: 2024,
    images: [IMAGE, { ...IMAGE, assetId: 'a2', url: 'https://cdn/b.webp' }],
    ...over,
  });
  const profile = { schemaVersion: 2 as const, companyId: 'comp_a', description: {}, projects: [project()], acceptsQuoteRequests: false };

  it('🔑 η διεύθυνση από τον ελληνικό τίτλο, και το id βγαίνει ατόφιο από αυτήν', () => {
    const segment = publicSegmentOf(publicProjectTitle(project()), PROJECT_ID);
    expect(segment).toBe(`anakainisi-grafeion-thermis-${PROJECT_ID}`);
    expect(publicIdOfSegment(segment)).toBe(PROJECT_ID);
  });

  it('έργο που δεν είναι στο προφίλ, ή προφίλ που λείπει ⇒ `null` (το ίδιο 404)', () => {
    expect(publicProjectOf(profile, PROJECT_ID)).toEqual(project());
    expect(publicProjectOf(profile, 'cprjt_other')).toBeNull();
    expect(publicProjectOf(null, PROJECT_ID)).toBeNull();
  });

  it('`CreativeWork` με `creator` το `@id` του οργανισμού · έτος ISO · μόνο ό,τι δείχνει η σελίδα', () => {
    const node = projectStructuredData(project(), 'https://x/w/1', { legalName: 'ΑΛΦΑ ΑΕ', url: 'https://x' });
    expect(node).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: 'Ανακαίνιση Γραφείων Θέρμης',
      description: 'Πλήρης ηλεκτρομηχανολογική εγκατάσταση.',
      url: 'https://x/w/1',
      image: ['https://cdn/a.webp', 'https://cdn/b.webp'],
      dateCreated: '2024',
      creator: { '@type': 'Organization', '@id': 'https://x#organization', name: 'ΑΛΦΑ ΑΕ' },
    });
  });

  it('χωρίς περιγραφή ή έτος ⇒ κανένα κενό πεδίο', () => {
    const node = projectStructuredData(project({ description: {}, year: null }), 'https://x/w/1', { legalName: 'ΑΛΦΑ ΑΕ', url: 'https://x' });
    expect(node).toMatchObject({ description: undefined, dateCreated: undefined });
  });

  it('ο πάροχος του `Service` και ο δημιουργός του έργου είναι ο ΙΔΙΟΣ κόμβος', () => {
    const service = modelStructuredData(model({ listingKind: 'service' }), 'https://x/p', SUPPLIER);
    const work = projectStructuredData(project(), 'https://x/w/1', SUPPLIER);
    expect((work as { creator: unknown }).creator).toEqual((service as { provider: unknown }).provider);
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
    expect(Object.keys(publicModelCardOf(model())).sort()).toEqual(['code', 'familyLabels', 'image', 'listingKind', 'modelId', 'title', 'variantCount', 'variantIds']);
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

  it('Σ6: `offers` μόνο από την ανώνυμη τελική τιμή, με ΦΠΑ και ποσότητα αναφοράς · «Κατόπιν προσφοράς» ⇒ κανένα', () => {
    const product = model({ media: [IMAGE] });
    const [variant] = product.variants;
    const priced = { kind: 'priced', audience: 'anonymous', currency: 'EUR', unitCode: 'm', priceQuantity: 100, net: null, gross: 10416, vatRate: 24, unitNet: null, unitGross: 104 } as const;
    const data = modelStructuredData(product, 'https://x/p', SUPPLIER, { [variant.variantId]: priced });
    expect(data).toMatchObject({ offers: [{ '@type': 'Offer', price: '104.16', priceCurrency: 'EUR', priceSpecification: { valueAddedTaxIncluded: true, referenceQuantity: { value: 100, unitCode: 'MTR' } } }] });
    expect(JSON.stringify(data)).not.toContain('84');
    // Μ-6: κανένα επινοημένο πεδίο — ο κατάλογος δεν έχει διαθεσιμότητα ούτε λήξη τιμής (δηλωμένα κενά).
    expect(JSON.stringify(data)).not.toMatch(/availability|priceValidUntil/);
    const buyer = { ...priced, audience: 'buyer', net: 8400, unitNet: 84 } as const;
    expect(keysOf(modelStructuredData(product, 'https://x/p', SUPPLIER, { [variant.variantId]: buyer }))).not.toContain('offers');
    expect(keysOf(modelStructuredData(product, 'https://x/p', SUPPLIER, { [variant.variantId]: { kind: 'onRequest' } }))).not.toContain('offers');
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

  it('όλη η χώρα ⇒ `Country` · ακτίνα και πολύγωνο χωρίς αποδεδειγμένη περιοχή ⇒ σιωπή, χωρίς κέντρο ή γεωμετρία', () => {
    const areaOf = (area: PublicProviderFacts['area']) => supplierStructuredData({ ...SUPPLIER, facts: { ...FACTS, area } });
    expect(areaOf({ kind: 'nationwide' })).toMatchObject({ areaServed: { '@type': 'Country', name: 'GR' } });
    for (const area of [{ kind: 'radius', radiusKm: 30, names: [] }, { kind: 'outline', km2: 120, names: [] }] as const) {
      expect(keysOf(areaOf(area))).not.toEqual(expect.arrayContaining(['geoRadius']));
      expect(areaOf(area)).toMatchObject({ areaServed: undefined });
    }
  });

  it('Ν11 ε: ακτίνα και πολύγωνο ⇒ οι περιοχές που εξυπηρετούν ως `AdministrativeArea` · ποτέ `GeoCircle`/`GeoShape`', () => {
    const areaOf = (area: PublicProviderFacts['area']) => supplierStructuredData({ ...SUPPLIER, facts: { ...FACTS, area } });
    const names = ['Δήμος Θέρμης', 'Δήμος Πυλαίας-Χορτιάτη'];
    for (const area of [{ kind: 'radius', radiusKm: 30, names }, { kind: 'outline', km2: 120, names }] as const) {
      const node = areaOf(area);
      expect(node).toMatchObject({ areaServed: names.map((name) => ({ '@type': 'AdministrativeArea', name })) });
      expect(JSON.stringify(node)).not.toMatch(/GeoCircle|GeoShape|geoRadius|geoMidpoint/);
    }
  });
});

describe('publicProviderFactsOf', () => {
  const NAMES: Readonly<Record<string, string>> = { 'municipality:1': 'ΔΗΜΟΣ ΘΕΡΜΗΣ' };
  const AREAS = { nameOf: (id: string) => NAMES[id], servedNames: [] };
  const showcase = (over: Partial<Pick<PublicShowcase, 'mark' | 'website' | 'coverage'>> = {}) => ({ mark: null, website: null, coverage: null, ...over });

  it('δεν δήλωσε ⇒ τίποτα', () => {
    expect(publicProviderFactsOf(showcase(), AREAS)).toEqual(NO_PROVIDER_FACTS);
  });

  it('🔒 το πορτρέτο δεν φτάνει στη σελίδα που βλέπουν οι μηχανές · το λογότυπο φτάνει', () => {
    expect(publicProviderFactsOf(showcase({ mark: { kind: 'portrait', image: LOGO } }), AREAS).logo).toBeNull();
    expect(publicProviderFactsOf(showcase({ mark: { kind: 'logo', image: LOGO } }), AREAS).logo).toEqual(LOGO);
  });

  it('ονόματα από την ιεραρχία · άγνωστη ταυτότητα πέφτει · καμία γνωστή ⇒ `null`, όχι κενή λίστα', () => {
    expect(publicProviderFactsOf(showcase({ coverage: { adminIds: ['municipality:1', 'municipality:9'] } }), AREAS).area).toEqual({ kind: 'areas', names: ['ΔΗΜΟΣ ΘΕΡΜΗΣ'] });
    expect(publicProviderFactsOf(showcase({ coverage: { adminIds: ['municipality:9'] } }), AREAS).area).toBeNull();
  });

  it('🔒 από την ακτίνα μένει μόνο ο αριθμός: το κέντρο δεν φεύγει', () => {
    const coverage = { circle: { center: { lat: 40.5, lng: 22.9 }, radiusKm: 30 as const } };
    const facts = publicProviderFactsOf(showcase({ coverage }), AREAS);
    expect(facts.area).toEqual({ kind: 'radius', radiusKm: 30, names: [] });
    expect(JSON.stringify(facts)).not.toContain('40.5');
  });

  it('Ν11 ε: ακτίνα και περίγραμμα φέρνουν τις περιοχές που εξυπηρετούν · η λίστα ταυτοτήτων δεν τις αγγίζει', () => {
    const sources = { nameOf: AREAS.nameOf, servedNames: ['Δήμος Θέρμης'] };
    const circle = { circle: { center: { lat: 40.5, lng: 22.9 }, radiusKm: 30 as const } };
    const outline = { outline: [{ lat: 40.5, lng: 22.9 }, { lat: 40.6, lng: 22.9 }, { lat: 40.6, lng: 23.0 }] };
    expect(publicProviderFactsOf(showcase({ coverage: circle }), sources).area).toEqual({ kind: 'radius', radiusKm: 30, names: ['Δήμος Θέρμης'] });
    expect(publicProviderFactsOf(showcase({ coverage: outline }), sources).area).toMatchObject({ kind: 'outline', names: ['Δήμος Θέρμης'] });
    expect(publicProviderFactsOf(showcase({ coverage: { adminIds: ['municipality:1'] } }), sources).area).toEqual({ kind: 'areas', names: ['ΔΗΜΟΣ ΘΕΡΜΗΣ'] });
  });

  it('όλη η χώρα · η ιστοσελίδα περνά αυτούσια', () => {
    expect(publicProviderFactsOf(showcase({ coverage: { nationwide: true }, website: 'https://a.gr' }), AREAS)).toEqual({ logo: null, website: 'https://a.gr', area: { kind: 'nationwide' } });
  });
});
