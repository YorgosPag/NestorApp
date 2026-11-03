/**
 * **Η δημόσια βιτρίνα όπως τη διαβάζει η μηχανή αναζήτησης** (ADR-923 §5.13 Σ4 · §22 Υ8).
 *
 * 🔒 Κανένα `offers`: το δημόσιο έγγραφο δεν έχει ποσό (Ε4), και τιμή `0` ή επινοημένη θα ήταν ψευδής δήλωση προς τη Google.
 *    Χωρίς `offers` η σελίδα δεν παίρνει product snippet. Αυτό είναι επιλογή του Σ4· οι τιμές έρχονται στο Σ6.
 * 🔒 Τίποτα που δεν βλέπει ο ανώνυμος: όλα βγαίνουν από το δημόσιο έγγραφο και τα δημόσια στοιχεία του παρόχου.
 * ⚠️ Κανένα `manufacturer` ή `brand` στο προϊόν: ο προμηθευτής μπορεί να είναι διανομέας, και το έγγραφο δεν έχει πεδίο μάρκας. Ο
 *    οργανισμός παίρνει `brand` μόνο από κατοχή που εγκρίθηκε και ισχύει (§16).
 *
 * 🔑 **`areaServed` μόνο από ονομασμένες περιοχές.** Η ακτίνα και το χαραγμένο πολύγωνο μένουν έξω: το Google Business Profile
 *    δέχεται μόνο ονομασμένες περιοχές, και η ακτίνα θα έδινε το σημείο του κέντρου, που μπορεί να είναι κατοικία.
 * 🔑 **`OfferCatalog` χωρίς `Offer`.** Το schema.org δέχεται `Thing` στο `itemListElement`, άρα η υπηρεσία μπαίνει ως `Service`
 *    και κανένας κόμβος δεν υπόσχεται προσφορά. Η Google δεν έχει rich result για `Service`: η αξία είναι η ανάγνωση, όχι η εμφάνιση.
 *
 * @module lib/catalog/public-structured-data
 */

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { publicModelTitle } from '@/subapps/catalog/public/public-model-card';
import type { PublicProviderFacts, PublicServiceArea } from '@/subapps/catalog/public/public-provider-facts';
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

function areaServedOf(area: PublicServiceArea | null): JsonLdValue | undefined {
  if (area?.kind === 'nationwide') return { '@type': 'Country', name: 'GR' };
  if (area?.kind === 'areas') return area.names.map((name) => ({ '@type': 'AdministrativeArea', name }));
  return undefined;
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

function productNode(model: PublicCatalogModel, url: string): JsonLdValue {
  return {
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
    provider: { '@type': 'Organization', '@id': organisationIdOf(supplier.url), name: supplier.legalName },
  };
}

/** Το προϊόν με τοποθέτηση μένει `Product`: η υπηρεσία του είναι δικό της SKU (§22 Υ5). */
export function modelStructuredData(model: PublicCatalogModel, url: string, supplier: SupplierNodeInput): JsonLdValue {
  return model.listingKind === 'service' ? serviceDocument(model, url, supplier) : productNode(model, url);
}
