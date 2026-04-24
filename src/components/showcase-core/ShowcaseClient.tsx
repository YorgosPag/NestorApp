'use client';

/**
 * =============================================================================
 * SHOWCASE CORE — Public Showcase Client (ADR-321 Phase 1.5a)
 * =============================================================================
 *
 * Config-driven client component lifted from the project + building showcase
 * clients (95 %-identical state machine) and structurally aligned with the
 * property showcase client (which has the same 5-state shape plus a larger
 * render hook). Owns:
 *
 *   1. The 5-state `ViewState` machine: `loading` | `ready` | `expired` |
 *      `notfound` | `error`.
 *   2. Fetch orchestration with cancellation (unmount-safe).
 *   3. Spinner / MessageScreen rendering for non-ready states using the
 *      shared `showcase-*` CSS variables.
 *   4. The common chrome (header + content slot + PDF CTA + footer) for the
 *      ready state.
 *
 * Callers provide:
 *   - `fetchEndpoint(token, locale)` — surface-specific URL (e.g.
 *     `/api/building-showcase/{token}?locale={locale}`).
 *   - `i18nNamespace` + `stateKeys` — where the 7 state-label strings live
 *     inside the caller's translation namespace.
 *   - `getCompany`, `getPdfUrl`, `headerProps`, `renderContent` — accessor
 *     hooks that project the surface-specific payload onto the shared
 *     chrome.
 *
 * @module components/showcase-core/ShowcaseClient
 */

import React, { useEffect, useState } from 'react';
import { Download, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { ShowcaseHeader } from '@/components/property-showcase/ShowcaseHeader';
import { MessageScreen, ShowcaseFooter } from '@/components/property-showcase/ShowcaseShared';
import type { ShowcaseCompanyBrand } from '@/components/property-showcase/types';

/**
 * Loose translation callback — matches the return shape of the project's
 * custom `useTranslation` hook without forcing consumers to import the
 * full i18next `TFunction` generics (which react-i18next widens).
 */
export type ShowcaseClientT = (key: string, options?: Record<string, unknown>) => string;

// =============================================================================
// Public contracts
// =============================================================================

export type ShowcaseClientLocale = 'el' | 'en';

export interface ShowcaseClientStateKeys {
  expiredTitle: string;
  expiredDescription: string;
  notFoundTitle: string;
  notFoundDescription: string;
  errorTitle: string;
  errorDescription: string;
  /** Translation key for the "Download PDF" CTA label. */
  downloadPdfLabel: string;
}

export interface ShowcaseHeaderOverrides {
  titleOverride?: string;
  subtitleOverride?: string;
}

export interface ShowcaseClientConfig<TPayload> {
  /** Build the GET endpoint URL for the public payload. */
  fetchEndpoint: (token: string, locale: ShowcaseClientLocale) => string;
  /** i18n namespace used by the component (e.g. `'showcase'`). */
  i18nNamespace: string;
  /** Fully-qualified translation keys for the 7 state / CTA strings. */
  stateKeys: ShowcaseClientStateKeys;
  /** Project the payload to the shared company-branding shape. */
  getCompany: (payload: TPayload) => ShowcaseCompanyBrand;
  /** Extract the public PDF URL when the share carries one. */
  getPdfUrl: (payload: TPayload) => string | undefined;
  /**
   * Optional header overrides (entity name + subtitle). Returning an empty
   * object lets the default company branding drive the header (property
   * baseline); project/building pass title + subtitle overrides.
   */
  headerProps?: (
    payload: TPayload,
    t: ShowcaseClientT,
    locale: ShowcaseClientLocale,
  ) => ShowcaseHeaderOverrides;
  /** Render the main content between header and PDF CTA + footer. */
  renderContent: (
    payload: TPayload,
    t: ShowcaseClientT,
    locale: ShowcaseClientLocale,
  ) => React.ReactNode;
}

export interface ShowcaseClientProps<TPayload> {
  token: string;
  config: ShowcaseClientConfig<TPayload>;
}

type ViewState<TPayload> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: TPayload }
  | { kind: 'expired' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

// =============================================================================
// Component
// =============================================================================

export function ShowcaseClient<TPayload>({
  token,
  config,
}: ShowcaseClientProps<TPayload>) {
  const { t, i18n } = useTranslation(config.i18nNamespace);
  const [state, setState] = useState<ViewState<TPayload>>({ kind: 'loading' });

  const locale: ShowcaseClientLocale = i18n.language?.startsWith('el') ? 'el' : 'en';

  useEffect(() => {
    let cancelled = false;
    fetch(config.fetchEndpoint(token, locale))
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 410) { setState({ kind: 'expired' }); return; }
        if (res.status === 404) { setState({ kind: 'notfound' }); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          setState({
            kind: 'error',
            message: (body?.error as string) || 'Error loading showcase',
          });
          return;
        }
        const data = (await res.json()) as TPayload;
        setState({ kind: 'ready', data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token, locale, config]);

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
        title={t(config.stateKeys.expiredTitle)}
        description={t(config.stateKeys.expiredDescription)}
      />
    );
  }
  if (state.kind === 'notfound') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t(config.stateKeys.notFoundTitle)}
        description={t(config.stateKeys.notFoundDescription)}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <MessageScreen
        icon={<AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />}
        title={t(config.stateKeys.errorTitle)}
        description={t(config.stateKeys.errorDescription)}
      />
    );
  }

  const { data } = state;
  const company = config.getCompany(data);
  const pdfUrl = config.getPdfUrl(data);
  const headerOverrides = config.headerProps?.(data, t, locale) ?? {};

  return (
    <main className="min-h-screen bg-[hsl(var(--showcase-bg))] text-[hsl(var(--showcase-fg))] pb-12">
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
        <ShowcaseHeader
          company={company}
          titleOverride={headerOverrides.titleOverride}
          subtitleOverride={headerOverrides.subtitleOverride}
        />
        {config.renderContent(data, t, locale)}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[hsl(var(--showcase-surface))] hover:bg-[hsl(var(--showcase-border))] text-[hsl(var(--showcase-fg))] border border-[hsl(var(--showcase-border))] px-5 py-3 rounded-lg font-semibold shadow-md"
          >
            <Download className="h-4 w-4" />
            {t(config.stateKeys.downloadPdfLabel)}
          </a>
        )}
        <ShowcaseFooter company={company} />
      </div>
    </main>
  );
}
