/**
 * **Η δημόσια βιτρίνα όπως τη διαβάζει η μηχανή αναζήτησης** (ADR-923 §5.13 Σ4 · §22 Υ8).
 *
 * 🔒 `offers` **μόνο** από την ανώνυμη τιμή του διακομιστή (Σ6, Ε3: «JSON-LD μόνο ό,τι βλέπει ο ανώνυμος»), ποτέ από το δημόσιο
 *    έγγραφο, που δεν έχει ποσό (Ε4). Χωρίς ανώνυμη τιμή (κλειστός διακόπτης, «Κατόπιν προσφοράς») κανένα `offers`: τιμή `0` ή
 *    επινοημένη θα ήταν ψευδής δήλωση προς τη Google. Η τιμή είναι η **τελική**, με `valueAddedTaxIncluded`.
 * 🔒 Τίποτα που δεν βλέπει ο ανώνυμος: όλα βγαίνουν από το δημόσιο έγγραφο και τα δημόσια στοιχεία του παρόχου.
 * ⚠️ Κανένα `manufacturer` ή `brand` στο προϊόν: ο προμηθευτής μπορεί να είναι διανομέας, και το έγγραφο δεν έχει πεδίο μάρκας. Ο
 *    οργανισμός παίρνει `brand` μόνο από κατοχή που εγκρίθηκε και ισχύει (§16).
 *
 * 🔑 **`areaServed` μόνο από ονομασμένες περιοχές.** Ποτέ `GeoCircle` ή `GeoShape`: το Google Business Profile δέχεται μόνο
 *    ονομασμένες περιοχές, και η ακτίνα θα έδινε το σημείο του κέντρου, που μπορεί να είναι κατοικία. Η ακτίνα και το
 *    περίγραμμα δηλώνονται με τις περιοχές που **εξυπηρετούν** (Ν11 ε, `coverage-served-areas`), τις ίδιες που δείχνει η σελίδα.
 * 🔑 **`OfferCatalog` χωρίς `Offer`.** Το schema.org δέχεται `Thing` στο `itemListElement`, άρα η υπηρεσία μπαίνει ως `Service`
 *    και κανένας κόμβος δεν υπόσχεται προσφορά. Η Google δεν έχει rich result για `Service`: η αξία είναι η ανάγνωση, όχι η εμφάνιση.
 *
 * @module lib/catalog/public-structured-data
 */

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import { majorFromMinor } from '@/lib/money/money';
import { uneceCodeOf } from '@/lib/uom/uom-registry';
import { toFixedDecimal } from '@/subapps/catalog/measurement/conversion';
import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { showcasePriceIn, type ShowcaseModelPrices } from '@/subapps/catalog/public/showcase-price';
import { publicModelTitle } from '@/subapps/catalog/public/public-model-card';
import type { PublicProviderFacts, PublicServiceArea } from '@/subapps/catalog/public/public-provider-facts';
import { publicProjectTitle, type PublicPortfolioProject } from '@/subapps/catalog/public/public-supplier-profile';
import type { PublicSupplierBrand } from '@/subapps/catalog/types/supplier-brand-claim';

const SCHEMA_ORG = 'https://schema.org';

/** Ο πάροχος όπως τον αναφέρουν οι κόμβοι. `url` = η σελίδα του στη βιτρίνα: από εκεί βγαίνει το `@id`. */
export interface SupplierNodeInput {
  readonly legalName: string;
  readonly url: string;
  readonly facts: PublicProviderFacts;
  readonly description?: LocalizedText;
  /** Μάρκες σε ισχύ (§16): μόνο από ελεγμένη κατοχή, ποτέ από το έγγραφο προϊόντος. */
  readonly brands?: readonly PublicSupplierBrand[];
}

/** Μία υπηρεσία του καταλόγου, στη λίστα της σελίδας προμηθευτή. */
export interface SupplierServiceNode {
  readonly name: string;
  readonly familyLabels: LocalizedText;
  readonly url: string;
}

const organisationIdOf = (supplierUrl: string): string => `${supplierUrl}#organization`;

/** Ο οργανισμός ως αναφορά από άλλη σελίδα: το `@id` του κόμβου της σελίδας προμηθευτή και το όνομα. */
function organisationRefOf(supplier: Pick<SupplierNodeInput, 'legalName' | 'url'>): JsonLdValue {
  return { '@type': 'Organization', '@id': organisationIdOf(supplier.url), name: supplier.legalName };
}

function areaServedOf(area: PublicServiceArea | null): JsonLdValue | undefined {
  if (area === null) return undefined;
  if (area.kind === 'nationwide') return { '@type': 'Country', name: 'GR' };
  return area.names.length === 0 ? undefined : area.names.map((name) => ({ '@type': 'AdministrativeArea', name }));
}

function serviceNode(service: SupplierServiceNode, area: PublicServiceArea | null): Readonly<Record<string, JsonLdValue | undefined>> {
  return {
    '@type': 'Service',
    name: service.name,
    serviceType: resolveLocalizedText(service.familyLabels, DEFAULT_LANGUAGE),
    url: service.url,
    areaServed: areaServedOf(area),
  };
}

export function supplierStructuredData(supplier: SupplierNodeInput, services: readonly SupplierServiceNode[] = []): JsonLdValue {
  const { legalName, url, facts } = supplier;
  const description = supplier.description === undefined ? '' : resolveLocalizedText(supplier.description, DEFAULT_LANGUAGE);
  return {
    '@context': SCHEMA_ORG,
    '@type': 'Organization',
    '@id': organisationIdOf(url),
    name: legalName,
    url: facts.website ?? url,
    description: description === '' ? undefined : description,
    logo: facts.logo?.url,
    brand: supplier.brands === undefined || supplier.brands.length === 0 ? undefined : supplier.brands.map(({ brandName }) => ({ '@type': 'Brand', name: brandName })),
    areaServed: areaServedOf(facts.area),
    hasOfferCatalog: services.length === 0
      ? undefined
      : { '@type': 'OfferCatalog', name: legalName, itemListElement: services.map((service) => serviceNode(service, facts.area)) },
  };
}

function imagesOf(model: PublicCatalogModel): readonly string[] | undefined {
  const images = [...model.media, ...model.variants.flatMap((variant) => variant.media)].map((media) => media.url);
  return images.length === 0 ? undefined : [...new Set(images)];
}

/**
 * Μία προσφορά ανά SKU με ανώνυμη τελική τιμή. Η ποσότητα αναφοράς λέει «ανά 100 m» όταν η τιμή αφορά περισσότερες μονάδες.
 *
 * ⚠️ **Δηλωμένα κενά (ανασκόπηση Μ-6), όχι παραλείψεις** — κανένα πεδίο δεν επινοείται:
 * - `availability`: ο κατάλογος **δεν έχει** δεδομένα διαθεσιμότητας (απόθεμα, χρόνο παράδοσης, κατάργηση) ούτε στο SKU ούτε στο
 *   δημόσιο έγγραφο. Ένα «InStock» εδώ θα ήταν ψευδής δήλωση προς τη Google (πολιτική Merchant: ασυμφωνία σελίδας/δεδομένων).
 *   Μπαίνει όταν υπάρξει πεδίο διαθεσιμότητας στο δημόσιο έγγραφο.
 * - `priceValidUntil`: η τιμή βγαίνει από **δημοσιευμένη έκδοση** λίστας, που δεν έχει αποθηκευμένο τέλος (το ορίζει η επόμενη
 *   δημοσίευση, πρότυπο SAP). Καμία πραγματική ημερομηνία λήξης δεν υπάρχει για να δηλωθεί.
 */
function offersOf(model: PublicCatalogModel, url: string, prices: ShowcaseModelPrices | null): readonly JsonLdValue[] | undefined {
  const offers = model.variants.flatMap((variant): JsonLdValue[] => {
    const price = showcasePriceIn(prices, variant.variantId);
    // Μόνο τιμή καταναλωτή (Ε3): JSON-LD = ό,τι βλέπει ο ανώνυμος, ποτέ τιμή αγοραστή.
    if (price.kind !== 'priced' || price.audience !== 'anonymous') return [];
    const amount = toFixedDecimal(majorFromMinor(price.gross), 2);
    const unitCode = uneceCodeOf(price.unitCode) ?? undefined;
    return [{
      '@type': 'Offer',
      sku: variant.code ?? undefined,
      url,
      price: amount,
      priceCurrency: price.currency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: amount,
        priceCurrency: price.currency,
        valueAddedTaxIncluded: true,
        referenceQuantity: { '@type': 'QuantitativeValue', value: price.priceQuantity, unitCode },
      },
    }];
  });
  return offers.length === 0 ? undefined : offers;
}

function productNode(model: PublicCatalogModel, url: string, prices: ShowcaseModelPrices | null): JsonLdValue {
  const offers = offersOf(model, url, prices);
  return {
    // Χωρίς ανώνυμη τιμή το κλειδί λείπει εντελώς: ούτε `offers: undefined` στη σάρωση.
    ...(offers === undefined ? {} : { offers }),
    '@context': SCHEMA_ORG,
    '@type': 'Product',
    name: publicModelTitle(model),
    sku: model.code,
    category: resolveLocalizedText(model.familyLabels, DEFAULT_LANGUAGE),
    url,
    image: imagesOf(model),
  };
}

function serviceDocument(model: PublicCatalogModel, url: string, supplier: SupplierNodeInput): JsonLdValue {
  const node = serviceNode({ name: publicModelTitle(model), familyLabels: model.familyLabels, url }, supplier.facts.area);
  return {
    '@context': SCHEMA_ORG,
    ...node,
    image: imagesOf(model),
    provider: organisationRefOf(supplier),
  };
}

/**
 * **Ένα έργο του portfolio** (Ν11 στ): `CreativeWork` με `creator` τον οργανισμό, ώστε η μηχανή να δέσει το έργο με τη σελίδα
 * του προμηθευτή. Μόνο ό,τι δείχνει η σελίδα: τίτλος, περιγραφή, έτος, εικόνες. Το έτος είναι ημερομηνία ISO 8601 ακρίβειας έτους.
 */
export function projectStructuredData(project: PublicPortfolioProject, url: string, supplier: Pick<SupplierNodeInput, 'legalName' | 'url'>): JsonLdValue {
  const description = resolveLocalizedText(project.description, DEFAULT_LANGUAGE);
  return {
    '@context': SCHEMA_ORG,
    '@type': 'CreativeWork',
    name: publicProjectTitle(project),
    description: description === '' ? undefined : description,
    url,
    image: [...new Set(project.images.map((image) => image.url))],
    dateCreated: project.year === null ? undefined : String(project.year),
    creator: organisationRefOf(supplier),
  };
}

/** Το προϊόν με τοποθέτηση μένει `Product`: η υπηρεσία του είναι δικό της SKU (§22 Υ5). */
export function modelStructuredData(model: PublicCatalogModel, url: string, supplier: SupplierNodeInput, prices: ShowcaseModelPrices | null = null): JsonLdValue {
  return model.listingKind === 'service' ? serviceDocument(model, url, supplier) : productNode(model, url, prices);
}
