'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
} from '@/components/showcase-core';
import type { StorageShowcaseMedia, StorageShowcasePayload } from '@/types/storage-showcase';
import { StorageShowcaseSpecs } from './StorageShowcaseSpecs';

interface StorageShowcaseClientProps {
  token: string;
}

const storageShowcaseClientConfig: ShowcaseClientConfig<StorageShowcasePayload> = {
  fetchEndpoint: (token, locale) =>
    `/api/storage-showcase/${encodeURIComponent(token)}?locale=${locale}`,
  i18nNamespace: 'showcase',
  stateKeys: {
    expiredTitle:        'storageShowcase.states.expiredTitle',
    expiredDescription:  'storageShowcase.states.expiredDescription',
    notFoundTitle:       'storageShowcase.states.notFoundTitle',
    notFoundDescription: 'storageShowcase.states.notFoundDescription',
    errorTitle:          'storageShowcase.states.errorTitle',
    errorDescription:    'storageShowcase.states.errorDescription',
    downloadPdfLabel:    'storageShowcase.actions.downloadPdf',
  },
  getCompany: (p) => p.company,
  getPdfUrl: (p) => p.pdfUrl ?? null,
  headerProps: (p, t) => ({
    titleOverride: p.storage.name,
    subtitleOverride: `${p.company.name} · ${t('storageShowcase.header.subtitle')}`,
  }),
  renderContent: (p, t) => (
    <>
      {p.storage.description && (
        <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-3">
            {t('pdf.descriptionSection')}
          </h2>
          <p className="text-[hsl(var(--showcase-fg))]/90 whitespace-pre-line">
            {p.storage.description}
          </p>
        </section>
      )}
      <StorageShowcaseSpecs storage={p.storage} />
      <MediaGrid media={p.photos} title={t('storageShowcase.photos.title')} />
      <MediaGrid media={p.floorplans} title={t('storageShowcase.floorplans.title')} />
    </>
  ),
};

export function StorageShowcaseClient({ token }: StorageShowcaseClientProps) {
  return <ShowcaseClient<StorageShowcasePayload> token={token} config={storageShowcaseClientConfig} />;
}

interface MediaGridProps {
  media: StorageShowcaseMedia[];
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
