'use client';

import React from 'react';
import {
  ShowcaseClient,
  type ShowcaseClientConfig,
} from '@/components/showcase-core';
import type { ProjectShowcaseMedia, ProjectShowcasePayload } from '@/types/project-showcase';
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
  getPdfUrl: (p) => p.pdfUrl,
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
      <MediaGrid media={p.photos} title={t('projectShowcase.photos.title')} />
      <MediaGrid media={p.floorplans} title={t('projectShowcase.floorplans.title')} />
    </>
  ),
};

export function ProjectShowcaseClient({ token }: ProjectShowcaseClientProps) {
  return <ShowcaseClient<ProjectShowcasePayload> token={token} config={projectShowcaseClientConfig} />;
}

interface MediaGridProps {
  media: ProjectShowcaseMedia[];
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
