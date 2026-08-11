'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
  ShowcaseMediaGrid,
} from '@/components/showcase-core';
import type { ProjectShowcasePayload } from '@/types/project-showcase';
import { ProjectShowcaseSpecs } from './ProjectShowcaseSpecs';

interface ProjectShowcaseClientProps {
  token: string;
}

const projectShowcaseClientConfig: ShowcaseClientConfig<ProjectShowcasePayload> = {
  fetchEndpoint: (token, locale) =>
    `/api/project-showcase/${encodeURIComponent(token)}?locale=${locale}`,
  i18nNamespace: 'showcase',
  stateKeys: {
    expiredTitle: 'projectShowcase.states.expiredTitle',
    expiredDescription: 'projectShowcase.states.expiredDescription',
    notFoundTitle: 'projectShowcase.states.notFoundTitle',
    notFoundDescription: 'projectShowcase.states.notFoundDescription',
    errorTitle: 'projectShowcase.states.errorTitle',
    errorDescription: 'projectShowcase.states.errorDescription',
    downloadPdfLabel: 'projectShowcase.actions.downloadPdf',
  },
  getCompany: (p) => p.company,
  getPdfUrl: (p) => p.pdfUrl ?? undefined,
  headerProps: (p, t) => ({
    titleOverride: p.project.name,
    subtitleOverride: `${p.company.name} · ${t('projectShowcase.header.subtitle')}`,
  }),
  renderContent: (p, t) => (
    <>
      {p.project.description && (
        <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-3">
            {t('projectShowcase.description.sectionTitle')}
          </h2>
          <p className="text-[hsl(var(--showcase-fg))]/90 whitespace-pre-line">
            {p.project.description}
          </p>
        </section>
      )}
      <ProjectShowcaseSpecs project={p.project} />
      <ShowcaseMediaGrid media={p.photos} title={t('projectShowcase.photos.title')} />
      <ShowcaseMediaGrid media={p.floorplans} title={t('projectShowcase.floorplans.title')} />
    </>
  ),
};

export function ProjectShowcaseClient({ token }: ProjectShowcaseClientProps) {
  return <ShowcaseClient<ProjectShowcasePayload> token={token} config={projectShowcaseClientConfig} />;
}

