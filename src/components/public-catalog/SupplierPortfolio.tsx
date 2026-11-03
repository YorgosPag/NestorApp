'use client';

/**
 * **Περιγραφή και portfolio στη σελίδα προμηθευτή** (ADR-923 §22 Υ8). Δεν διαβάζει τίποτα: όλα έρχονται στο HTML του διακομιστή.
 *
 * 🔑 Κείμενο απλό, με `whitespace-pre-line`: κανένα HTML από τον χρήστη σε σελίδα ανοιχτή στις μηχανές.
 * ⚠️ Η πρώτη εικόνα είναι το εξώφυλλο, οι υπόλοιπες μικρογραφίες. Οι εικόνες είναι σκέτο `<img>`, όπως όλη η δημόσια βιτρίνα.
 *
 * @module components/public-catalog/SupplierPortfolio
 */

import React from 'react';

import type { PublicCatalogMedia } from '@/subapps/catalog/public/public-catalog-schema';
import type { PublicPortfolioProject, PublicSupplierProfile } from '@/subapps/catalog/public/public-supplier-profile';

import { usePublicCatalogText } from './public-catalog-text';

function ProjectImage({ image, title, className }: { readonly image: PublicCatalogMedia; readonly title: string; readonly className: string }): React.JSX.Element {
  const { text } = usePublicCatalogText();
  return <img src={image.url} alt={text(image.labels) || title} loading="lazy" className={className} />;
}

function ProjectCard({ project }: { readonly project: PublicPortfolioProject }): React.JSX.Element {
  const { text } = usePublicCatalogText();
  const title = text(project.title);
  const description = text(project.description);
  const [cover, ...rest] = project.images;
  return (
    <li className="rounded-md border">
      <article className="flex flex-col gap-2 p-3">
        <ProjectImage image={cover} title={title} className="aspect-[4/3] w-full rounded-sm object-cover" />
        {rest.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0">
            {rest.map((image) => <li key={image.assetId}><ProjectImage image={image} title={title} className="aspect-square w-full rounded-sm object-cover" /></li>)}
          </ul>
        )}
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        {project.year !== null && <p className="m-0 text-sm text-muted-foreground">{project.year}</p>}
        {description !== '' && <p className="m-0 whitespace-pre-line text-sm">{description}</p>}
      </article>
    </li>
  );
}

export function SupplierAbout({ profile }: { readonly profile: PublicSupplierProfile }): React.JSX.Element | null {
  const { t, text } = usePublicCatalogText();
  const description = text(profile.description);
  if (description === '') return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-lg font-semibold">{t('supplier.about')}</h2>
      <p className="m-0 whitespace-pre-line text-sm">{description}</p>
    </section>
  );
}

export function SupplierPortfolio({ profile }: { readonly profile: PublicSupplierProfile }): React.JSX.Element | null {
  const { t } = usePublicCatalogText();
  if (profile.projects.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold">{t('supplier.portfolio')}</h2>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-0">
        {profile.projects.map((project) => <ProjectCard key={project.projectId} project={project} />)}
      </ul>
    </section>
  );
}
