'use client';

/**
 * @fileoverview **`/suppliers/<ψευδώνυμο>/catalogs/<έκδοση>` — ο αναγνώστης ενός δημόσιου εντύπου** (ADR-923 §5.15.3).
 * @module components/public-catalog/PublicCatalogReaderView
 *
 * 🔑 Ο εκδότης της άδειας φτιάχνεται **εδώ**, στον πελάτη (μια συνάρτηση δεν περνά το σύνορο server→client), πάντα προς την
 *    **ανώνυμη** πόρτα: στη βιτρίνα ο θεατής είναι πάντα `anonymous`, ακόμη κι αν είναι συνδεδεμένος — ό,τι βλέπει ως αγοραστής
 *    ζει στην εφαρμογή, πίσω από τη σχέση του.
 * 🔑 `#page=N` στη διεύθυνση: εδώ ο αναγνώστης **είναι** η σελίδα (βαθύς σύνδεσμος, ανανέωση, QR).
 */

import React, { useMemo } from 'react';
import { Link } from '@/lib/workspace/navigation';

import { CatalogEditionReader } from '@/components/catalog/editions/CatalogEditionReader';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { catalogEditionLicenseIssuer } from '@/services/catalog/catalog-editions-api.client';
import { publicCatalogEditionFileApi, publicCatalogsRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import { BackToSupplier, publicEditionOpener } from './public-catalog-edition-links';
import { usePublicCatalogText } from './public-catalog-text';

// 🔴 ADR-744 §18 — το `public-catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/suppliers__alias__catalogs__edition.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export interface PublicCatalogReaderViewProps {
  readonly segment: string;
  readonly legalName: string;
  readonly edition: CatalogEditionView;
  /** Το ισχύον έντυπο του ίδιου ραφιού για τον ανώνυμο, όταν το ζητούμενο δεν είναι αυτό. */
  readonly current: CatalogEditionView | null;
}

export function PublicCatalogReaderView({ segment, legalName, edition, current }: PublicCatalogReaderViewProps): React.JSX.Element {
  const { t } = usePublicCatalogText();
  const opener = useMemo(() => publicEditionOpener(segment), [segment]);
  const issue = useMemo(() => catalogEditionLicenseIssuer(publicCatalogEditionFileApi(segment, edition.id), 'public'), [segment, edition.id]);
  return (
    <ShellSurface as="main" measure="wide" className="min-h-0 flex-1 gap-y-3">
      <nav aria-label={t('editions.title')} className="flex flex-wrap gap-4 text-sm">
        <BackToSupplier segment={segment} legalName={legalName} />
        <p className="m-0"><Link href={publicCatalogsRoute(segment)}>{t('editions.allEditions')}</Link></p>
      </nav>
      <CatalogEditionReader edition={edition} issue={issue} current={current} opener={opener} pageInUrl className="min-h-[36rem] flex-1" />
    </ShellSurface>
  );
}
