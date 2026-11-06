'use client';

/**
 * **Η σελίδα ενός έργου του portfolio** (ADR-923 Ν11 στ · §22 Υ8). Δεν διαβάζει τίποτα: όλα έρχονται στο HTML του διακομιστή.
 *
 * 🔑 Κείμενο απλό, με `whitespace-pre-line`: κανένα HTML από τον χρήστη σε σελίδα ανοιχτή στις μηχανές (όπως η κάρτα).
 * 🔑 Η πρώτη εικόνα είναι το εξώφυλλο, σε πλήρες πλάτος. Οι υπόλοιπες ακολουθούν σε πλέγμα, χωρίς περικοπή.
 *
 * @module components/public-catalog/PublicProjectView
 */

import React from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { Link } from '@/lib/workspace/navigation';
import { publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { PublicPortfolioProject } from '@/subapps/catalog/public/public-supplier-profile';

import { usePublicCatalogText } from './public-catalog-text';
import { ProjectImage, SUPPLIER_PORTFOLIO_ANCHOR } from './SupplierPortfolio';

// ADR-744 §18: το route slice φτάνει στον φυλλομετρητή μόνο από client component, όχι από το `page.tsx`.
import routeSlice from '@/i18n/generated/routes/suppliers__alias__w__project.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

interface PublicProjectViewProps {
  readonly segment: string;
  readonly legalName: string;
  readonly project: PublicPortfolioProject;
}

export function PublicProjectView({ segment, legalName, project }: PublicProjectViewProps): React.JSX.Element {
  const { t, text } = usePublicCatalogText();
  const title = text(project.title);
  const description = text(project.description);
  const [cover, ...rest] = project.images;
  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6">
      <nav><Link href={`${publicSupplierRoute(segment)}#${SUPPLIER_PORTFOLIO_ANCHOR}`}>{t('project.backToPortfolio')}</Link></nav>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">{title}</h1>
        <p className="m-0 text-sm text-muted-foreground">
          <Link href={publicSupplierRoute(segment)}>{t('project.by', { name: legalName })}</Link>
        </p>
        {project.year !== null && <p className="m-0 text-sm text-muted-foreground">{t('project.year', { year: String(project.year) })}</p>}
      </header>
      <ProjectImage image={cover} title={title} className="max-h-[70vh] w-full rounded-md object-contain" />
      {description !== '' && <p className="m-0 max-w-prose whitespace-pre-line">{description}</p>}
      {rest.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold">{t('project.photos')}</h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-0">
            {rest.map((image) => <li key={image.assetId}><ProjectImage image={image} title={title} className="w-full rounded-sm object-contain" /></li>)}
          </ul>
        </section>
      )}
    </ShellSurface>
  );
}
