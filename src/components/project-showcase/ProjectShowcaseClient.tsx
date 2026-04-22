'use client';

import React, { useEffect, useState } from 'react';
import { Download, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { ProjectShowcaseHeader } from './ProjectShowcaseHeader';
import { ProjectShowcaseSpecs } from './ProjectShowcaseSpecs';
import type { ProjectShowcasePayload, ProjectShowcaseMedia } from '@/types/project-showcase';

interface ProjectShowcaseClientProps {
  token: string;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ProjectShowcasePayload }
  | { kind: 'expired' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

export function ProjectShowcaseClient({ token }: ProjectShowcaseClientProps) {
  const { t, i18n } = useTranslation('showcase');
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  const locale = i18n.language?.startsWith('el') ? 'el' : 'en';

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/project-showcase/${encodeURIComponent(token)}?locale=${locale}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 410) { setState({ kind: 'expired' }); return; }
        if (res.status === 404) { setState({ kind: 'notfound' }); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          setState({ kind: 'error', message: body?.error || 'Error loading showcase' });
          return;
        }
        const data = (await res.json()) as ProjectShowcasePayload;
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
        title={t('projectShowcase.states.expiredTitle')}
        description={t('projectShowcase.states.expiredDescription')}
      />
    );
  }
  if (state.kind === 'notfound') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t('projectShowcase.states.notFoundTitle')}
        description={t('projectShowcase.states.notFoundDescription')}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t('projectShowcase.states.errorTitle')}
        description={t('projectShowcase.states.errorDescription')}
      />
    );
  }

  const { data } = state;

  return (
    <main className="min-h-screen bg-[hsl(var(--showcase-bg))] text-[hsl(var(--showcase-fg))] pb-12">
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
        <ProjectShowcaseHeader company={data.company} projectName={data.project.name} />

        {data.project.description && (
          <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
            <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-3">
              {t('projectShowcase.description.sectionTitle')}
            </h2>
            <p className="text-[hsl(var(--showcase-fg))]/90 whitespace-pre-line">
              {data.project.description}
            </p>
          </section>
        )}

        <ProjectShowcaseSpecs project={data.project} />
        <MediaGrid media={data.photos} title={t('projectShowcase.photos.title')} />
        <MediaGrid media={data.floorplans} title={t('projectShowcase.floorplans.title')} />

        {data.pdfUrl && (
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[hsl(var(--showcase-surface))] hover:bg-[hsl(var(--showcase-border))] text-[hsl(var(--showcase-fg))] border border-[hsl(var(--showcase-border))] px-5 py-3 rounded-lg font-semibold shadow-md"
          >
            <Download className="h-4 w-4" />
            {t('projectShowcase.actions.downloadPdf')}
          </a>
        )}

        <ShowcaseFooter company={data.company} />
      </div>
    </main>
  );
}

function MediaGrid({ media, title }: { media: ProjectShowcaseMedia[]; title: string }) {
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

function MessageScreen({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--showcase-bg))] px-4">
      <div className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-8 max-w-md text-center border border-[hsl(var(--showcase-border))]">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-[hsl(var(--showcase-fg))] mb-2">{title}</h1>
        <p className="text-[hsl(var(--showcase-muted-fg))]">{description}</p>
      </div>
    </div>
  );
}

function ShowcaseFooter({
  company,
}: { company: { name: string; phone?: string; email?: string; website?: string } }) {
  const { t } = useTranslation('showcase');
  const contact = [company.phone, company.email, company.website].filter(Boolean).join(' · ');
  const year = new Date().getFullYear();
  return (
    <footer className="mt-6 pt-5 border-t border-[hsl(var(--showcase-border))] text-center space-y-3">
      {contact && (
        <p className="text-sm text-[hsl(var(--showcase-muted-fg))]">
          {company.name} · {contact}
        </p>
      )}
      <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--showcase-muted-fg))]">
        <img
          src="/images/nestor-app-logo.png"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded bg-white/90 object-contain p-0.5"
          aria-hidden="true"
        />
        <span className="font-semibold">{t('brand.poweredBy')}</span>
      </div>
      <p className="text-[10px] text-[hsl(var(--showcase-muted-fg))]/70">
        &copy; {year} {t('brand.appName')}
      </p>
    </footer>
  );
}
