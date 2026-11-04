/**
 * `/suppliers/<ψευδώνυμο>/c/<slug>-<id>` — **η δημόσια σελίδα κατηγορίας** (ADR-923 §5.13 Σ4).
 *
 * Το id είναι η ταυτότητα, το slug διακόσμηση: άλλο slug ⇒ 308 στην κανονική. Κατηγορία χωρίς ορατό μοντέλο ⇒ 404.
 * ⛔ Το `permanentRedirect` πετά: μένει εκτός κάθε `try`.
 *
 * @module app/(light)/suppliers/[alias]/c/[category]/page
 */

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { SupplierCategoryView } from '@/components/public-catalog/SupplierCategoryView';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { publicUrl } from '@/lib/http/public-origin';
import { readPublicCategoryIndex, readPublicModelPage } from '@/services/public-catalog/public-catalog.reader';
import { readShowcaseCardPrices } from '@/services/public-catalog/public-catalog-prices';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import { publicAfterOf, publicCategoryRoute, publicIdOfSegment, publicSegmentOf } from '@/subapps/catalog/public/public-catalog-routes';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';

interface CategoryPageProps {
  readonly params: Promise<{ readonly alias: string; readonly category: string }>;
  readonly searchParams: Promise<{ readonly after?: string | string[] }>;
}

interface ResolvedCategory {
  readonly supplier: SupplierShowcaseRecord;
  readonly categories: Readonly<Record<string, LocalizedText>>;
  readonly categoryId: string;
  readonly canonicalSegment: string;
  readonly name: string;
}

async function resolveCategory(alias: string, segment: string): Promise<ResolvedCategory> {
  const supplier = await requirePublicSupplier(alias, (canonical) => publicCategoryRoute(canonical, segment));
  const categories = await orSupplierCatalogUnavailable(() => readPublicCategoryIndex(supplier.companyId));
  const categoryId = publicIdOfSegment(segment);
  const labels = categoryId === null ? undefined : categories[categoryId];
  if (categoryId === null || labels === undefined) notFound();
  const name = resolveLocalizedText(labels, DEFAULT_LANGUAGE);
  return { supplier, categories, categoryId, name, canonicalSegment: publicSegmentOf(name, categoryId) };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { alias, category } = await params;
  const { supplier, name, canonicalSegment } = await resolveCategory(alias, category);
  return { title: `${name} · ${supplier.legalName}`, alternates: { canonical: publicUrl(publicCategoryRoute(alias, canonicalSegment)) } };
}

export default async function SupplierCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { alias, category } = await params;
  const after = publicAfterOf((await searchParams).after);
  const { supplier, categories, categoryId, canonicalSegment } = await resolveCategory(alias, category);
  const route = publicCategoryRoute(alias, canonicalSegment);
  if (decodeURIComponent(category) !== canonicalSegment) permanentRedirect(route);
  const page = await orSupplierCatalogUnavailable(() => readPublicModelPage(supplier.companyId, { categoryId, after }));
  // §5.13 Σ6: ανώνυμη τιμή «από»· κλειστός διακόπτης ή βλάβη ⇒ `null`, ποτέ 5xx (Μ2).
  const cardPrices = await readShowcaseCardPrices(supplier.companyId, page.cards);
  return (
    <SupplierCategoryView
      segment={alias}
      legalName={supplier.legalName}
      cards={page.cards}
      cardPrices={cardPrices}
      categories={categories}
      activeCategoryId={categoryId}
      nextHref={page.nextAfter === null ? null : `${route}?after=${encodeURIComponent(page.nextAfter)}`}
    />
  );
}
