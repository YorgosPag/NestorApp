/**
 * `/suppliers/<ψευδώνυμο>/p/<slug>-<id>` — **η δημόσια σελίδα μοντέλου** (ADR-923 §5.13 Σ4).
 *
 * 🔑 ISR 5′, το ίδιο παράθυρο με τον αναγνώστη. Τα tags της `unstable_cache` ακολουθούν τη σελίδα, άρα η ανάκληση την ακυρώνει.
 * 🔒 Κρυφό, αποσυρμένο, ξένο και ανύπαρκτο δίνουν το ίδιο 404. Το JSON-LD δεν έχει `offers`.
 * ⛔ Το `permanentRedirect` πετά: μένει εκτός κάθε `try`.
 *
 * @module app/(light)/suppliers/[alias]/p/[model]/page
 */

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { PublicModelView } from '@/components/public-catalog/PublicModelView';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { modelStructuredData } from '@/lib/catalog/public-structured-data';
import { publicUrl } from '@/lib/http/public-origin';
import { readPublicModel, readPublicProviderFacts, readPublicSupplierProfile } from '@/services/public-catalog/public-catalog.reader';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { publicIdOfSegment, publicModelRoute, publicSegmentOf, publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import { publicModelTitle } from '@/subapps/catalog/public/public-model-card';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';

export const revalidate = 300;

interface ModelPageProps {
  readonly params: Promise<{ readonly alias: string; readonly model: string }>;
}

interface ResolvedModel {
  readonly supplier: SupplierShowcaseRecord;
  readonly model: PublicCatalogModel;
  readonly route: string;
  readonly canonicalSegment: string;
}

async function resolveModel(alias: string, segment: string): Promise<ResolvedModel> {
  const supplier = await requirePublicSupplier(alias, (canonical) => publicModelRoute(canonical, segment));
  const modelId = publicIdOfSegment(segment);
  if (modelId === null) notFound();
  const model = await orSupplierCatalogUnavailable(() => readPublicModel(supplier.companyId, modelId));
  if (model === null) notFound();
  const canonicalSegment = publicSegmentOf(publicModelTitle(model), modelId);
  return { supplier, model, canonicalSegment, route: publicModelRoute(alias, canonicalSegment) };
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { alias, model } = await params;
  const resolved = await resolveModel(alias, model);
  return { title: `${publicModelTitle(resolved.model)} · ${resolved.supplier.legalName}`, alternates: { canonical: publicUrl(resolved.route) } };
}

export default async function SupplierModelPage({ params }: ModelPageProps) {
  const { alias, model: segment } = await params;
  const { supplier, model, route, canonicalSegment } = await resolveModel(alias, segment);
  if (decodeURIComponent(segment) !== canonicalSegment) permanentRedirect(route);
  const url = publicUrl(route);
  const supplierUrl = publicUrl(publicSupplierRoute(alias));
  const [facts, profile] = await orSupplierCatalogUnavailable(() =>
    Promise.all([readPublicProviderFacts(supplier.companyId), readPublicSupplierProfile(supplier.companyId)]),
  );
  return (
    <>
      {url === null || supplierUrl === null ? null : (
        <JsonLdScript data={modelStructuredData(model, url, { legalName: supplier.legalName, url: supplierUrl, facts })} />
      )}
      {/* §5.13 Ε6β: το κουμπί μόνο με opt-in του προμηθευτή. Η σελίδα μένει ISR, η ταυτότητα κρίνεται στη νησίδα. */}
      <PublicModelView segment={alias} model={model} acceptsQuoteRequests={profile?.acceptsQuoteRequests === true} />
    </>
  );
}
