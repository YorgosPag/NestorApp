'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
  ShowcaseMediaGrid,
} from '@/components/showcase-core';
import type { BuildingShowcasePayload } from '@/types/building-showcase';
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
  getPdfUrl: (p) => p.pdfUrl ?? undefined,
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
      <ShowcaseMediaGrid media={p.photos} title={t('buildingShowcase.photos.title')} />
      <ShowcaseMediaGrid media={p.floorplans} title={t('buildingShowcase.floorplans.title')} />
    </>
  ),
};

export function BuildingShowcaseClient({ token }: BuildingShowcaseClientProps) {
  return <ShowcaseClient<BuildingShowcasePayload> token={token} config={buildingShowcaseClientConfig} />;
}
