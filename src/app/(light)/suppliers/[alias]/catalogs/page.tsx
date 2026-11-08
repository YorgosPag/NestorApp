/**
 * `/suppliers/<ψευδώνυμο>/catalogs` — **το ράφι των εντύπων της βιτρίνας** (ADR-923 §5.15.3).
 *
 * 🔑 Το πρότυπο των αδελφών σελίδων: ISR 5′, πύλη της βιτρίνας πρώτα (`requirePublicSupplier`), κανονική μορφή με 308.
 * 🔑 Κανένας νέος αναγνώστης: `readPublicCatalogEditions` (μνήμη με tags εταιρείας **και** εκδόσεων — η δημοσίευση, η απόσυρση και
 *    η ανάκληση της βιτρίνας το χτυπούν αμέσως). Το «ισχύον» κάθε ραφιού έρχεται σημαδεμένο από τον ίδιο κριτή.
 * 🔒 Κανένα ορατό έντυπο ⇒ 404, ίδιο με ανύπαρκτο προμηθευτή ή αποσυρμένη βιτρίνα.
 * 🔑 Η σελίδα **ευρετηριάζεται** (Ε2: οι σελίδες ανοίγουν)· τα PDF όχι (Θ3) — εκείνα δεν περνούν ποτέ από εδώ.
 *
 * @module app/(light)/suppliers/[alias]/catalogs/page
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicCatalogShelfView } from '@/components/public-catalog/PublicCatalogShelfView';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText } from '@/i18n/localized-text';
import { publicUrl } from '@/lib/http/public-origin';
import { readPublicCatalogEditions } from '@/server/catalog/editions/catalog-edition-reads.server';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import { publicCatalogsRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';

export const revalidate = 300;

interface CatalogsPageProps {
  readonly params: Promise<{ readonly alias: string }>;
}

interface ResolvedShelf {
  readonly supplier: SupplierShowcaseRecord;
  readonly editions: readonly CatalogEditionView[];
}

async function resolveShelf(alias: string): Promise<ResolvedShelf> {
  const supplier = await requirePublicSupplier(alias, publicCatalogsRoute);
  const editions = await orSupplierCatalogUnavailable(() => readPublicCatalogEditions(supplier.companyId));
  if (editions.length === 0) notFound();
  return { supplier, editions };
}

/** Τίτλος από τα δεδομένα (όπως οι αδελφές σελίδες): το νεότερο ισχύον έντυπο και η επωνυμία. */
export async function generateMetadata({ params }: CatalogsPageProps): Promise<Metadata> {
  const { alias } = await params;
  const { supplier, editions } = await resolveShelf(alias);
  const lead = editions.find((edition) => edition.current) ?? editions[0];
  const title = lead === undefined ? supplier.legalName : `${resolveLocalizedText(lead.title, DEFAULT_LANGUAGE)} · ${supplier.legalName}`;
  return { title, alternates: { canonical: publicUrl(publicCatalogsRoute(alias)) } };
}

export default async function CatalogsPage({ params }: CatalogsPageProps) {
  const { alias } = await params;
  const { supplier, editions } = await resolveShelf(alias);
  return <PublicCatalogShelfView segment={alias} legalName={supplier.legalName} editions={editions} />;
}
