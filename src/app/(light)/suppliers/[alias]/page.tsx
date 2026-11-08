/**
 * `/suppliers/<ψευδώνυμο>` — **η δημόσια σελίδα προμηθευτή** (ADR-923 §5.13 Σ4).
 *
 * 🔑 Η σελιδοποίηση (`?after=`) κάνει τη διαδρομή δυναμική. Η μνήμη ζει στον αναγνώστη (`unstable_cache` με tags), άρα η ανάκληση
 *    ισχύει και εδώ, όπως στις σελίδες με ISR.
 * 🔑 Χώρος χωρίς ψευδώνυμο ζει στο `/suppliers/comp_<uuid>`. Με ψευδώνυμο, αυτή η διεύθυνση στέλνει 308 στην κανονική.
 *
 * @module app/(light)/suppliers/[alias]/page
 */

import type { Metadata } from 'next';

import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { SupplierCatalogView } from '@/components/public-catalog/SupplierCatalogView';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText } from '@/i18n/localized-text';
import { publicUrl } from '@/lib/http/public-origin';
import { supplierStructuredData, type SupplierServiceNode } from '@/lib/catalog/public-structured-data';
import { readPublicCategoryIndex, readPublicModelPage, readPublicProviderFacts, readPublicSupplierBrands, readPublicSupplierProfile } from '@/services/public-catalog/public-catalog.reader';
import { readShowcaseCardPrices } from '@/services/public-catalog/public-catalog-prices';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import { readPublicCatalogEditions } from '@/server/catalog/editions/catalog-edition-reads.server';
import { publicAfterOf, publicCatalogsRoute, publicModelRoute, publicSegmentOf, publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { PublicModelCard } from '@/subapps/catalog/public/public-model-card';

interface SupplierPageProps {
  readonly params: Promise<{ readonly alias: string }>;
  readonly searchParams: Promise<{ readonly after?: string | string[] }>;
}

export async function generateMetadata({ params }: SupplierPageProps): Promise<Metadata> {
  const { alias } = await params;
  const supplier = await requirePublicSupplier(alias);
  const profile = await orSupplierCatalogUnavailable(() => readPublicSupplierProfile(supplier.companyId));
  const description = profile === null ? '' : resolveLocalizedText(profile.description, DEFAULT_LANGUAGE);
  return { title: supplier.legalName, description: description === '' ? undefined : description, alternates: { canonical: publicUrl(publicSupplierRoute(alias)) } };
}

/** Οι υπηρεσίες αυτής της σελίδας: ο κατάλογος του JSON-LD λέει μόνο ό,τι βλέπει ο επισκέπτης. */
function serviceNodesOf(cards: readonly PublicModelCard[], alias: string): readonly SupplierServiceNode[] {
  return cards.flatMap((card) => {
    const url = card.listingKind === 'service' ? publicUrl(publicModelRoute(alias, publicSegmentOf(card.title, card.modelId))) : null;
    return url === null ? [] : [{ name: card.title, familyLabels: card.familyLabels, url }];
  });
}

export default async function SupplierPage({ params, searchParams }: SupplierPageProps) {
  const { alias } = await params;
  const after = publicAfterOf((await searchParams).after);
  const supplier = await requirePublicSupplier(alias);
  const { companyId, legalName } = supplier;
  const [page, categories, facts, profile, brands, editions] = await orSupplierCatalogUnavailable(() =>
    Promise.all([readPublicModelPage(companyId, { categoryId: null, after }), readPublicCategoryIndex(companyId), readPublicProviderFacts(companyId), readPublicSupplierProfile(companyId), readPublicSupplierBrands(companyId), readPublicCatalogEditions(companyId)]),
  );
  // §5.13 Σ6: ανώνυμη τιμή «από» για τις κάρτες αυτής της σελίδας. Κλειστός διακόπτης ⇒ `null`, χωρίς ανάγνωση· βλάβη ⇒ `null`, ποτέ 5xx (Μ2).
  const cardPrices = await readShowcaseCardPrices(companyId, page.cards);
  const route = publicSupplierRoute(alias);
  const url = publicUrl(route);
  return (
    <>
      {url === null ? null : <JsonLdScript data={supplierStructuredData({ legalName, url, facts, description: profile?.description, brands }, serviceNodesOf(page.cards, alias))} />}
      <SupplierCatalogView
        segment={alias}
        legalName={legalName}
        provider={facts}
        profile={profile}
        brands={brands}
        catalogsHref={editions.length > 0 ? publicCatalogsRoute(alias) : null}
        cards={page.cards}
        cardPrices={cardPrices}
        categories={categories}
        activeCategoryId={null}
        nextHref={page.nextAfter === null ? null : `${route}?after=${encodeURIComponent(page.nextAfter)}`}
      />
    </>
  );
}
