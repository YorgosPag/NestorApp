'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
} from '@/components/showcase-core';
import type { ParkingShowcaseMedia, ParkingShowcasePayload } from '@/types/parking-showcase';
import { ParkingShowcaseSpecs } from './ParkingShowcaseSpecs';

interface ParkingShowcaseClientProps {
  token: string;
}

const parkingShowcaseClientConfig: ShowcaseClientConfig<ParkingShowcasePayload> = {
  fetchEndpoint: (token, locale) =>
    `/api/parking-showcase/${encodeURIComponent(token)}?locale=${locale}`,
  i18nNamespace: 'showcase',
  stateKeys: {
    expiredTitle:        'parkingShowcase.states.expiredTitle',
    expiredDescription:  'parkingShowcase.states.expiredDescription',
    notFoundTitle:       'parkingShowcase.states.notFoundTitle',
    notFoundDescription: 'parkingShowcase.states.notFoundDescription',
    errorTitle:          'parkingShowcase.states.errorTitle',
    errorDescription:    'parkingShowcase.states.errorDescription',
    downloadPdfLabel:    'parkingShowcase.actions.downloadPdf',
  },
  getCompany: (p) => p.company,
  getPdfUrl: (p) => p.pdfUrl ?? null,
  headerProps: (p, t) => ({
    titleOverride: p.parking.number,
    subtitleOverride: `${p.company.name} · ${t('parkingShowcase.header.subtitle')}`,
  }),
  renderContent: (p, t) => (
    <>
      {p.parking.description && (
        <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-3">
            {t('pdf.descriptionSection')}
          </h2>
          <p className="text-[hsl(var(--showcase-fg))]/90 whitespace-pre-line">
            {p.parking.description}
          </p>
        </section>
      )}
      <ParkingShowcaseSpecs parking={p.parking} />
      <MediaGrid media={p.photos} title={t('parkingShowcase.photos.title')} />
      <MediaGrid media={p.floorplans} title={t('parkingShowcase.floorplans.title')} />
    </>
  ),
};

export function ParkingShowcaseClient({ token }: ParkingShowcaseClientProps) {
  return <ShowcaseClient<ParkingShowcasePayload> token={token} config={parkingShowcaseClientConfig} />;
}

interface MediaGridProps {
  media: ParkingShowcaseMedia[];
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
