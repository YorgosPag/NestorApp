'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
  ShowcaseMediaGrid,
} from '@/components/showcase-core';
import type { ParkingShowcasePayload } from '@/types/parking-showcase';
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
  getPdfUrl: (p) => p.pdfUrl ?? undefined,
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
      <ShowcaseMediaGrid media={p.photos} title={t('parkingShowcase.photos.title')} />
      <ShowcaseMediaGrid media={p.floorplans} title={t('parkingShowcase.floorplans.title')} />
    </>
  ),
};

export function ParkingShowcaseClient({ token }: ParkingShowcaseClientProps) {
  return <ShowcaseClient<ParkingShowcasePayload> token={token} config={parkingShowcaseClientConfig} />;
}

