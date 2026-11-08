/**
 * `/suppliers/<ψευδώνυμο>/catalogs/<slug>-<id>` — **ο αναγνώστης ενός δημόσιου εντύπου** (ADR-923 §5.15.3).
 *
 * 🔑 Το πρότυπο της σελίδας μοντέλου: ISR 5′, πύλη της βιτρίνας πρώτα, κανονική μορφή με 308. Το έντυπο κρίνεται από την **ίδια**
 *    αποθηκευμένη λίστα του ανωνύμου με το ράφι — η σελίδα δεν κάνει δεύτερη κρίση.
 * 🔒 Κρυφό, αποσυρμένο, ξένο, ανύπαρκτο ή πίσω από αποσυρμένη βιτρίνα ⇒ ίδιο 404. Τα bytes δεν περνούν από εδώ: τα φέρνει ο
 *    αναγνώστης κομμάτι-κομμάτι με άδεια από την ανώνυμη πόρτα (Η4).
 * 🔑 `noindex, follow` (Θ3): το περιεχόμενο **είναι** το PDF, που δεν ευρετηριάζεται· οι σύνδεσμοι προς βιτρίνα ακολουθούνται.
 * ⛔ Το `permanentRedirect` πετά: μένει εκτός κάθε `try`.
 *
 * @module app/(light)/suppliers/[alias]/catalogs/[edition]/page
 */

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { PublicCatalogReaderView } from '@/components/public-catalog/PublicCatalogReaderView';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText } from '@/i18n/localized-text';
import { readPublicCatalogEditions } from '@/server/catalog/editions/catalog-edition-reads.server';
import { orSupplierCatalogUnavailable, requirePublicSupplier } from '@/services/public-catalog/public-supplier-route';
import { publicCatalogEditionRoute, publicCatalogEditionSegmentOf, publicIdOfSegment } from '@/subapps/catalog/public/public-catalog-routes';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';

export const revalidate = 300;

interface EditionPageProps {
  readonly params: Promise<{ readonly alias: string; readonly edition: string }>;
}

interface ResolvedEdition {
  readonly supplier: SupplierShowcaseRecord;
  readonly edition: CatalogEditionView;
  /** Το ισχύον του ίδιου ραφιού για τον ανώνυμο (ίσως το ίδιο το ζητούμενο). */
  readonly current: CatalogEditionView | null;
}

async function resolveEdition(alias: string, segment: string): Promise<ResolvedEdition> {
  const supplier = await requirePublicSupplier(alias, (canonical) => publicCatalogEditionRoute(canonical, segment));
  const editionId = publicIdOfSegment(segment);
  if (editionId === null) notFound();
  const editions = await orSupplierCatalogUnavailable(() => readPublicCatalogEditions(supplier.companyId));
  const edition = editions.find((candidate) => candidate.id === editionId);
  if (edition === undefined) notFound();
  const canonicalSegment = publicCatalogEditionSegmentOf(edition);
  if (canonicalSegment !== segment) permanentRedirect(publicCatalogEditionRoute(alias, canonicalSegment));
  const current = editions.find((candidate) => candidate.shelfKey === edition.shelfKey && candidate.current) ?? null;
  return { supplier, edition, current };
}

export async function generateMetadata({ params }: EditionPageProps): Promise<Metadata> {
  const { alias, edition } = await params;
  const resolved = await resolveEdition(alias, edition);
  return {
    title: `${resolveLocalizedText(resolved.edition.title, DEFAULT_LANGUAGE)} · ${resolved.supplier.legalName}`,
    robots: { index: false, follow: true },
  };
}

export default async function CatalogEditionPage({ params }: EditionPageProps) {
  const { alias, edition } = await params;
  const resolved = await resolveEdition(alias, edition);
  return <PublicCatalogReaderView segment={alias} legalName={resolved.supplier.legalName} edition={resolved.edition} current={resolved.current} />;
}
