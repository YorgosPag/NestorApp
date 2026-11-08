'use client';

/**
 * @fileoverview **`/suppliers/<ψευδώνυμο>/catalogs` — το ράφι των εντύπων της βιτρίνας** (ADR-923 §5.15.3): ανά ράφι το ισχύον
 *   έντυπο του ανωνύμου, οι άλλες εκδόσεις κάτω από αυτό, και ο σταθερός σύνδεσμος του ραφιού.
 * @module components/public-catalog/PublicCatalogShelfView
 */

import React, { useMemo } from 'react';

import { CatalogEditionShelf } from '@/components/catalog/editions/CatalogEditionShelf';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { publicCatalogShelfRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import { BackToSupplier, publicEditionOpener } from './public-catalog-edition-links';
import { usePublicCatalogText } from './public-catalog-text';

// 🔴 ADR-744 §18 — το `public-catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/suppliers__alias__catalogs.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export interface PublicCatalogShelfViewProps {
  readonly segment: string;
  readonly legalName: string;
  readonly editions: readonly CatalogEditionView[];
}

export function PublicCatalogShelfView({ segment, legalName, editions }: PublicCatalogShelfViewProps): React.JSX.Element {
  const { t } = usePublicCatalogText();
  const opener = useMemo(() => publicEditionOpener(segment), [segment]);
  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6">
      <header className="flex flex-col gap-1">
        <BackToSupplier segment={segment} legalName={legalName} />
        <h1 className="m-0 text-2xl font-semibold">{t('editions.title')}</h1>
        <p className="m-0 text-sm text-muted-foreground">{legalName}</p>
      </header>
      <CatalogEditionShelf editions={editions} opener={opener} shelfHrefOf={(shelfKey) => publicCatalogShelfRoute(segment, shelfKey)} />
    </ShellSurface>
  );
}
