'use client';

import React, { useEffect, useState } from 'react';
import { Download, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { ShowcaseHeader } from '@/components/property-showcase/ShowcaseHeader';
import { MessageScreen, ShowcaseFooter } from '@/components/property-showcase/ShowcaseShared';
import { BuildingShowcaseSpecs } from './BuildingShowcaseSpecs';
import type { BuildingShowcasePayload, BuildingShowcaseMedia } from '@/types/building-showcase';

interface BuildingShowcaseClientProps {
  token: string;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: BuildingShowcasePayload }
  | { kind: 'expired' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

export function BuildingShowcaseClient({ token }: BuildingShowcaseClientProps) {
  const { t, i18n } = useTranslation('showcase');
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  const locale = i18n.language?.startsWith('el') ? 'el' : 'en';

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/building-showcase/${encodeURIComponent(token)}?locale=${locale}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 410) { setState({ kind: 'expired' }); return; }
        if (res.status === 404) { setState({ kind: 'notfound' }); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          setState({ kind: 'error', message: body?.error || 'Error loading showcase' });
          return;
        }
        const data = (await res.json()) as BuildingShowcasePayload;
        setState({ kind: 'ready', data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' });
      });
    return () => { cancelled = true; };
  }, [token, locale]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--showcase-bg))]">
        <Spinner />
      </div>
    );
  }

  if (state.kind === 'expired') {
    return (
      <MessageScreen
        icon={<Clock className="h-10 w-10 text-amber-500" aria-hidden="true" />}
        title={t('buildingShowcase.states.expiredTitle')}
        description={t('buildingShowcase.states.expiredDescription')}
      />
    );
  }
  if (state.kind === 'notfound') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t('buildingShowcase.states.notFoundTitle')}
        description={t('buildingShowcase.states.notFoundDescription')}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t('buildingShowcase.states.errorTitle')}
        description={t('buildingShowcase.states.errorDescription')}
      />
    );
  }

  const { data } = state;

  return (
    <main className="min-h-screen bg-[hsl(var(--showcase-bg))] text-[hsl(var(--showcase-fg))] pb-12">
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
        <ShowcaseHeader
          company={data.company}
          titleOverride={data.building.name}
          subtitleOverride={`${data.company.name} · ${t('buildingShowcase.header.subtitle')}`}
        />

        {data.building.description && (
          <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
            <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-3">
              {t('buildingShowcase.description.sectionTitle')}
            </h2>
            <p className="text-[hsl(var(--showcase-fg))]/90 whitespace-pre-line">
              {data.building.description}
            </p>
          </section>
        )}

        <BuildingShowcaseSpecs building={data.building} />
        <MediaGrid media={data.photos} title={t('buildingShowcase.photos.title')} />
        <MediaGrid media={data.floorplans} title={t('buildingShowcase.floorplans.title')} />

        {data.pdfUrl && (
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[hsl(var(--showcase-surface))] hover:bg-[hsl(var(--showcase-border))] text-[hsl(var(--showcase-fg))] border border-[hsl(var(--showcase-border))] px-5 py-3 rounded-lg font-semibold shadow-md"
          >
            <Download className="h-4 w-4" />
            {t('buildingShowcase.actions.downloadPdf')}
          </a>
        )}

        <ShowcaseFooter company={data.company} />
      </div>
    </main>
  );
}

function MediaGrid({ media, title }: { media: BuildingShowcaseMedia[]; title: string }) {
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
