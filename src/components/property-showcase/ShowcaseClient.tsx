'use client';

import React, { useEffect, useState } from 'react';
import { Download, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { ShowcaseHeader } from './ShowcaseHeader';
import { ShowcaseSpecs } from './ShowcaseSpecs';
import { ShowcasePhotoGrid } from './ShowcasePhotoGrid';
import { ShowcaseFloorplans } from './ShowcaseFloorplans';
import { ShowcaseVideoEmbed } from './ShowcaseVideoEmbed';
import type { ShowcasePayload } from './types';

interface ShowcaseClientProps {
  token: string;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ShowcasePayload }
  | { kind: 'expired' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

export function ShowcaseClient({ token }: ShowcaseClientProps) {
  const { t } = useTranslation('showcase');
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/showcase/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 410) {
          setState({ kind: 'expired' });
          return;
        }
        if (res.status === 404) {
          setState({ kind: 'notfound' });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          setState({ kind: 'error', message: body?.error || 'Error loading showcase' });
          return;
        }
        const data = (await res.json()) as ShowcasePayload;
        setState({ kind: 'ready', data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (state.kind === 'expired') {
    return (
      <MessageScreen
        icon={<Clock className="h-10 w-10 text-amber-500" aria-hidden="true" />}
        title={t('states.expiredTitle')}
        description={t('states.expiredDescription')}
      />
    );
  }
  if (state.kind === 'notfound') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t('states.notFoundTitle')}
        description={t('states.notFoundDescription')}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t('states.errorTitle')}
        description={state.message}
      />
    );
  }

  const { data } = state;
  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
        <ShowcaseHeader company={data.company} />
        <section className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">{data.property.name}</h2>
          {data.property.code && (
            <p className="text-sm text-gray-500 mt-1">{t('property.code')}: {data.property.code}</p>
          )}
          {data.property.description && (
            <p className="text-gray-700 mt-3 whitespace-pre-line">{data.property.description}</p>
          )}
        </section>
        <ShowcasePhotoGrid photos={data.photos} />
        <ShowcaseSpecs property={data.property} />
        <ShowcaseFloorplans floorplans={data.floorplans} />
        <ShowcaseVideoEmbed videoUrl={data.videoUrl} />
        {data.pdfUrl && (
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white px-5 py-3 rounded-lg font-semibold shadow-md"
          >
            <Download className="h-4 w-4" />
            {t('actions.downloadPdf')}
          </a>
        )}
        <ShowcaseFooter company={data.company} />
      </div>
    </main>
  );
}

function MessageScreen({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center border border-gray-100">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function ShowcaseFooter({ company }: { company: { name: string; phone?: string; email?: string; website?: string } }) {
  const contact = [company.phone, company.email, company.website].filter(Boolean).join(' · ');
  if (!contact) return null;
  return (
    <footer className="text-center text-sm text-gray-500 py-4">
      {company.name} · {contact}
    </footer>
  );
}
