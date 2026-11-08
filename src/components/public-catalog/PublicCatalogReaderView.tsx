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
    <main
      /*
        🖼️ ΑΝΑΓΝΩΣΤΗΣ ΣΕ ΠΛΗΡΕΣ ΠΑΡΑΘΥΡΟ (ADR-923 §5.15.3 · ADR-797 Φάσεις Β+Γ) — πρότυπο Issuu · Google Drive · Acrobat.
        Ήταν `ShellSurface measure="wide"`: ταβάνι **γραμμής κειμένου** σε χαρακτήρες πάνω σε επιφάνεια-καμβά ⇒
        ο αναγνώστης έπιανε 576px σε παράθυρο 1920 (30%), με ύψος από `min-h-[36rem]` αντί για την οθόνη.
        `bleed` = μηδέν διάδρομος· `data-shell-viewport` = το κάδρο κλειδώνει στο παράθυρο και ο αναγνώστης
        παίρνει «ό,τι περισσεύει» κάτω από την κεφαλίδα (κύλιση ΜΕΣΑ στον αναγνώστη, όχι στο έγγραφο).
        ⚠️ ΑΜΕΣΟ ΠΑΙΔΙ του διαδρόμου (κανόνας Υ5 του CHECK 3.63) — η σελίδα αποδίδει μόνο αυτό το στοιχείο.
        Η δήλωση ζει με λόγο (και εξαίρεση WCAG 1.4.10) στο `.shell-surface.json`.
      */
      data-shell-surface="bleed"
      data-shell-viewport
      className="flex min-h-0 flex-1 flex-col gap-y-2 bg-background"
    >
      <nav aria-label={t('editions.title')} className="flex flex-wrap gap-4 px-4 pt-3 text-sm">
        <BackToSupplier segment={segment} legalName={legalName} />
        <p className="m-0"><Link href={publicCatalogsRoute(segment)}>{t('editions.allEditions')}</Link></p>
      </nav>
      <CatalogEditionReader edition={edition} issue={issue} current={current} opener={opener} pageInUrl className="min-h-0 flex-1 px-4 pb-3" />
    </main>
  );
}
