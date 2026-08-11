'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
  ShowcaseMediaGrid,
} from '@/components/showcase-core';
import type { StorageShowcasePayload } from '@/types/storage-showcase';
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
  getPdfUrl: (p) => p.pdfUrl ?? undefined,
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
      <ShowcaseMediaGrid media={p.photos} title={t('storageShowcase.photos.title')} />
      <ShowcaseMediaGrid media={p.floorplans} title={t('storageShowcase.floorplans.title')} />
    </>
  ),
};

export function StorageShowcaseClient({ token }: StorageShowcaseClientProps) {
  return <ShowcaseClient<StorageShowcasePayload> token={token} config={storageShowcaseClientConfig} />;
}

