'use client';

/**
 * @fileoverview **Ο χώρος εργασίας μιας σελίδας** — τι είναι ζωντανό · νέα έκδοση · ιστορικό · οδηγός AI
 *   (ADR-881 §5).
 * @module components/admin/landing-heroes/HeroPageWorkspace
 */

import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { LANDING_HERO_IMAGES } from '@/components/shared/landing-hero/landing-hero-images';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import type { LandingHeroPage } from '@/lib/landing/landing-hero-vocabulary';

import { HeroComposer } from './HeroComposer';
import { HeroPromptGuide } from './HeroPromptGuide';
import { HeroRevisionHistory } from './HeroRevisionHistory';
import { LANDING_HEROES_NS } from './landing-heroes-keys';
import type { LandingHeroesAdmin, ReadyAdminState } from './useLandingHeroesAdmin';

interface HeroPageWorkspaceProps {
  readonly page: LandingHeroPage;
  readonly state: ReadyAdminState;
  readonly admin: LandingHeroesAdmin;
}

export function HeroPageWorkspace({ page, state, admin }: HeroPageWorkspaceProps) {
  const pointer = state.pointers[page];
  const revisions = state.revisions.filter((revision) => revision.page === page);

  return (
    <section className="flex flex-col gap-6">
      <LiveSummary page={page} liveRevisionId={pointer.publishedRevisionId} publishedAt={pointer.publishedAt} state={state} />
      <HeroPromptGuide page={page} />
      <Card>
        <CardContent className="pt-6">
          <HeroComposer page={page} saving={admin.busy === 'saving'} onSave={admin.saveDraft} />
        </CardContent>
      </Card>
      <HeroRevisionHistory
        revisions={revisions}
        liveRevisionId={pointer.publishedRevisionId}
        busy={admin.busy !== null}
        onPublish={(revisionId) => void admin.publish(page, revisionId)}
        onRefocus={admin.refocus}
      />
    </section>
  );
}

/** «Τι βλέπει τώρα ο επισκέπτης;» — η δημοσιευμένη έκδοση ή η ενσωματωμένη, πάντα με εικόνα. */
function LiveSummary({
  page,
  liveRevisionId,
  publishedAt,
  state,
}: {
  readonly page: LandingHeroPage;
  readonly liveRevisionId: string | null;
  readonly publishedAt: string | null;
  readonly state: ReadyAdminState;
}) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const live = state.revisions.find((revision) => revision.id === liveRevisionId) ?? null;
  const src = live?.day.sources?.[0]?.url ?? live?.day.src ?? LANDING_HERO_IMAGES[page].day.src;

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="aspect-[2/1] w-48 rounded object-cover" />
      <header className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-semibold">{t('live.title')}</h2>
        <p className="m-0 text-sm text-muted-foreground">
          {liveRevisionId === null
            ? t('live.builtin')
            : t('live.revision', { date: publishedAt === null ? '' : formatDateTime(publishedAt) })}
        </p>
      </header>
    </section>
  );
}
