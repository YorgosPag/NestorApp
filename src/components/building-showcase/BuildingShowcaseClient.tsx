'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
} from '@/components/showcase-core';
import type { BuildingShowcaseMedia, BuildingShowcasePayload } from '@/types/building-showcase';
import { BuildingShowcaseSpecs } from './BuildingShowcaseSpecs';

interface BuildingShowcaseClientProps {
  token: string;
}

const buildingShowcaseClientConfig: ShowcaseClientConfig<BuildingShowcasePayload> = {
  fetchEndpoint: (token, locale) =>
    `/api/building-showcase/${encodeURIComponent(token)}?locale=${locale}`,
  i18nNamespace: 'showcase',
  stateKeys: {
    expiredTitle: 'buildingShowcase.states.expiredTitle',
    expiredDescription: 'buildingShowcase.states.expiredDescription',
    notFoundTitle: 'buildingShowcase.states.notFoundTitle',
    notFoundDescription: 'buildingShowcase.states.notFoundDescription',
    errorTitle: 'buildingShowcase.states.errorTitle',
    errorDescription: 'buildingShowcase.states.errorDescription',
    downloadPdfLabel: 'buildingShowcase.actions.downloadPdf',
  },
  getCompany: (p) => p.company,
  getPdfUrl: (p) => p.pdfUrl,
  headerProps: (p, t) => ({
    titleOverride: p.building.name,
    subtitleOverride: `${p.company.name} · ${t('buildingShowcase.header.subtitle')}`,
  }),
  renderContent: (p, t) => (
    <>
      {p.building.description && (
        <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-3">
            {t('buildingShowcase.description.sectionTitle')}
          </h2>
          <p className="text-[hsl(var(--showcase-fg))]/90 whitespace-pre-line">
            {p.building.description}
          </p>
        </section>
      )}
      <BuildingShowcaseSpecs building={p.building} />
      <MediaGrid media={p.photos} title={t('buildingShowcase.photos.title')} />
      <MediaGrid media={p.floorplans} title={t('buildingShowcase.floorplans.title')} />
    </>
  ),
};

export function BuildingShowcaseClient({ token }: BuildingShowcaseClientProps) {
  return <ShowcaseClient<BuildingShowcasePayload> token={token} config={buildingShowcaseClientConfig} />;
}

interface MediaGridProps {
  media: BuildingShowcaseMedia[];
  title: string;
}

function MediaGrid({ media, title }: MediaGridProps) {
  if (media.length === 0) return null;
  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {media.map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-lg bg-[hsl(var(--showcase-bg))]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.displayName || title}
              loading="lazy"
              className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
            />
            {item.displayName && (
              <figcaption className="text-xs text-[hsl(var(--showcase-muted-fg))] px-2 py-1 truncate">
                {item.displayName}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

