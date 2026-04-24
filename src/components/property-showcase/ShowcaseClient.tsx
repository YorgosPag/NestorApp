'use client';

import React from 'react';
import {
  ShowcaseClient as CoreShowcaseClient,
  type ShowcaseClientConfig,
  type ShowcaseClientT,
  type ShowcaseClientLocale,
} from '@/components/showcase-core';
import { ShowcaseSpecs } from './ShowcaseSpecs';
import { ShowcasePhotoGrid } from './ShowcasePhotoGrid';
import { ShowcaseFloorplans } from './ShowcaseFloorplans';
import { ShowcaseLinkedSpacesFloorplans } from './ShowcaseLinkedSpacesFloorplans';
import { ShowcaseVideoEmbed } from './ShowcaseVideoEmbed';
import {
  ShowcaseProjectCard,
  ShowcaseCommercialCard,
  ShowcaseSystemsCard,
  ShowcaseFinishesCard,
  ShowcaseFeaturesCard,
  ShowcaseEnergyExtrasCard,
  ShowcaseLinkedSpacesCardView,
  ShowcaseViewsCard,
  ShowcaseOrientationCard,
} from './ShowcaseDetailSections';
import type { ShowcasePayload } from './types';

interface ShowcaseClientProps {
  token: string;
}

function renderShowcaseContent(
  data: ShowcasePayload,
  t: ShowcaseClientT,
  locale: ShowcaseClientLocale,
): React.ReactNode {
  const p = data.property;
  return (
    <>
      {p.project && <ShowcaseProjectCard project={p.project} t={t} />}
      {p.commercial && <ShowcaseCommercialCard commercial={p.commercial} t={t} locale={locale} />}
      <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
        <h2 className="text-2xl font-bold text-[hsl(var(--showcase-fg))]">{p.name}</h2>
        {p.code && (
          <p className="text-sm text-[hsl(var(--showcase-muted-fg))] mt-1">{t('property.code')}: {p.code}</p>
        )}
        {p.description && (
          <p className="text-[hsl(var(--showcase-fg))]/90 mt-3 whitespace-pre-line">{p.description}</p>
        )}
      </section>
      <ShowcasePhotoGrid photos={data.photos} />
      <ShowcaseVideoEmbed videoUrl={data.videoUrl} />
      <ShowcaseSpecs property={p} />
      <ShowcaseOrientationCard orientations={p.orientations} orientationLabels={p.orientationLabels} t={t} />
      {p.energy && <ShowcaseEnergyExtrasCard energy={p.energy} t={t} />}
      {p.views && p.views.length > 0 && <ShowcaseViewsCard views={p.views} t={t} />}
      <ShowcaseFloorplans floorplans={data.floorplans} propertyFloorFloorplans={data.propertyFloorFloorplans} />
      {p.systems && <ShowcaseSystemsCard systems={p.systems} t={t} />}
      {p.finishes && <ShowcaseFinishesCard finishes={p.finishes} t={t} />}
      {p.features && <ShowcaseFeaturesCard features={p.features} t={t} />}
      {p.linkedSpaces && p.linkedSpaces.length > 0 && (
        <ShowcaseLinkedSpacesCardView linkedSpaces={p.linkedSpaces} t={t} />
      )}
      {data.linkedSpaceFloorplans && (
        <ShowcaseLinkedSpacesFloorplans linkedSpaceFloorplans={data.linkedSpaceFloorplans} />
      )}
    </>
  );
}

const showcaseConfig: ShowcaseClientConfig<ShowcasePayload> = {
  fetchEndpoint: (token, locale) =>
    `/api/showcase/${encodeURIComponent(token)}?locale=${locale}`,
  i18nNamespace: 'showcase',
  stateKeys: {
    expiredTitle:       'states.expiredTitle',
    expiredDescription: 'states.expiredDescription',
    notFoundTitle:      'states.notFoundTitle',
    notFoundDescription:'states.notFoundDescription',
    errorTitle:         'states.errorTitle',
    errorDescription:   'states.errorDescription',
    downloadPdfLabel:   'actions.downloadPdf',
  },
  getCompany:     (data) => data.company,
  getPdfUrl:      (data) => data.pdfUrl,
  renderContent:  renderShowcaseContent,
};

export function ShowcaseClient({ token }: ShowcaseClientProps) {
  return <CoreShowcaseClient token={token} config={showcaseConfig} />;
}
