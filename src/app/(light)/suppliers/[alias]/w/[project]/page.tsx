/**
 * `/suppliers/<ψευδώνυμο>/w/<slug>-<id>` — **η δημόσια σελίδα ενός έργου του portfolio** (ADR-923 Ν11 στ · §22 Υ8).
 *
 * 🔑 Το πρότυπο της σελίδας μοντέλου: ISR 5′, το ίδιο παράθυρο με τον αναγνώστη· πύλη της βιτρίνας πρώτα· κανονική μορφή με 308.
 * 🔑 Κανένας νέος αναγνώστης: το έργο ζει ήδη στο δημόσιο προφίλ (`readPublicSupplierProfile`), πίσω από την ίδια πύλη.
 * 🔒 Έργο που έφυγε από το προφίλ, ξένο, ανύπαρκτο ή πίσω από αποσυρμένη βιτρίνα δίνουν το ίδιο 404.
 * ⛔ Το `permanentRedirect` πετά: μένει εκτός κάθε `try`.
 *
 * @module app/(light)/suppliers/[alias]/w/[project]/page
 */

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { PublicProjectView } from '@/components/public-catalog/PublicProjectView';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText } from '@/i18n/localized-text';
import { projectStructuredData } from '@/lib/catalog/public-structured-data';
import { publicUrl } from '@/lib/http/public-origin';
import { readPublicSupplierProfile } from '@/services/public-catalog/public-catalog.reader';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import { publicIdOfSegment, publicProjectRoute, publicSegmentOf, publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import { publicProjectOf, publicProjectTitle, type PublicPortfolioProject } from '@/subapps/catalog/public/public-supplier-profile';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';

export const revalidate = 300;

interface ProjectPageProps {
  readonly params: Promise<{ readonly alias: string; readonly project: string }>;
}

interface ResolvedProject {
  readonly supplier: SupplierShowcaseRecord;
  readonly project: PublicPortfolioProject;
  readonly route: string;
  readonly canonicalSegment: string;
}

async function resolveProject(alias: string, segment: string): Promise<ResolvedProject> {
  const supplier = await requirePublicSupplier(alias, (canonical) => publicProjectRoute(canonical, segment));
  const projectId = publicIdOfSegment(segment);
  if (projectId === null) notFound();
  const profile = await orSupplierCatalogUnavailable(() => readPublicSupplierProfile(supplier.companyId));
  const project = publicProjectOf(profile, projectId);
  if (project === null) notFound();
  const canonicalSegment = publicSegmentOf(publicProjectTitle(project), projectId);
  return { supplier, project, canonicalSegment, route: publicProjectRoute(alias, canonicalSegment) };
}

/** Ίδια με τη σελίδα προμηθευτή: η περιγραφή ολόκληρη, γιατί τη συντομεύει η ίδια η μηχανή. */
export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { alias, project } = await params;
  const resolved = await resolveProject(alias, project);
  const title = `${publicProjectTitle(resolved.project)} · ${resolved.supplier.legalName}`;
  const text = resolveLocalizedText(resolved.project.description, DEFAULT_LANGUAGE);
  const description = text === '' ? undefined : text;
  return {
    title,
    description,
    alternates: { canonical: publicUrl(resolved.route) },
    openGraph: { title, description, images: [resolved.project.images[0].url] },
  };
}

export default async function SupplierProjectPage({ params }: ProjectPageProps) {
  const { alias, project: segment } = await params;
  const { supplier, project, route, canonicalSegment } = await resolveProject(alias, segment);
  if (decodeURIComponent(segment) !== canonicalSegment) permanentRedirect(route);
  const url = publicUrl(route);
  const supplierUrl = publicUrl(publicSupplierRoute(alias));
  return (
    <>
      {url === null || supplierUrl === null ? null : (
        <JsonLdScript data={projectStructuredData(project, url, { legalName: supplier.legalName, url: supplierUrl })} />
      )}
      <PublicProjectView segment={alias} legalName={supplier.legalName} project={project} />
    </>
  );
}
