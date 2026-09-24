'use client';

/**
 * @fileoverview **Το ιστορικό εκδόσεων μιας σελίδας** — ζωντανή · πρόχειρα · δημοσίευση · επαναφορά ·
 *   νέα εστίαση (ADR-881 §4.2).
 * @module components/admin/landing-heroes/HeroRevisionHistory
 *
 * 🔑 **Τίποτα δεν σβήνεται** (Shopify «Older versions» / Webflow Versions): επαναφορά = δημοσίευση
 *    παλιότερης έκδοσης· «Επιστροφή στην ενσωματωμένη» = δείκτης `null`. Γι' αυτό **κανένας** διάλογος
 *    επιβεβαίωσης — κάθε πράξη αναιρείται με ένα κλικ (NN/g: μην ρωτάς για αναστρέψιμα).
 * 🔑 **Νέα εστίαση** = νέα έκδοση πάνω στα **ίδια** παράγωγα (κανένα re-encode)· η παλιά μένει ως είναι.
 */

import React, { useState } from 'react';
import { Crosshair, RotateCcw, Rocket } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import type { LandingHeroRevision } from '@/lib/landing/landing-hero-document';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

import { HeroFocalPicker } from './HeroFocalPicker';
import { HeroFramePreview } from './HeroFramePreview';
import { HERO_FOCAL_ORIGIN_KEYS, LANDING_HEROES_NS } from './landing-heroes-keys';

interface HeroRevisionHistoryProps {
  readonly revisions: readonly LandingHeroRevision[];
  readonly liveRevisionId: string | null;
  readonly busy: boolean;
  readonly onPublish: (revisionId: string | null) => void;
  readonly onRefocus: (baseRevisionId: string, point: PhotoFocalPoint) => Promise<unknown>;
}

export function HeroRevisionHistory({ revisions, liveRevisionId, busy, onPublish, onRefocus }: HeroRevisionHistoryProps) {
  const { t } = useTranslation(LANDING_HEROES_NS);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{t('history.title')}</h3>
        {liveRevisionId !== null && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onPublish(null)}>
            <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
            {t('history.revertBuiltin')}
          </Button>
        )}
      </header>
      {revisions.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t('history.empty')}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {revisions.map((revision) => (
            <RevisionItem
              key={revision.id}
              revision={revision}
              live={revision.id === liveRevisionId}
              busy={busy}
              onPublish={() => onPublish(revision.id)}
              onRefocus={(point) => onRefocus(revision.id, point)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

interface RevisionItemProps {
  readonly revision: LandingHeroRevision;
  readonly live: boolean;
  readonly busy: boolean;
  readonly onPublish: () => void;
  readonly onRefocus: (point: PhotoFocalPoint) => Promise<unknown>;
}

function RevisionItem({ revision, live, busy, onPublish, onRefocus }: RevisionItemProps) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const [refocusing, setRefocusing] = useState(false);
  const thumb = revision.day.sources?.[0]?.url ?? revision.day.src;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <article className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" className="aspect-[2/1] w-40 rounded object-cover" />
        <section className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Badge variant={live ? 'default' : 'secondary'}>
              {t(live ? 'history.live' : 'history.draft')}
            </Badge>
            <time dateTime={revision.createdAt}>{formatDateTime(revision.createdAt)}</time>
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {t(HERO_FOCAL_ORIGIN_KEYS[revision.focalOrigin])}
            {revision.dusk === null && ` · ${t('history.noDusk')}`}
          </p>
        </section>
        <RevisionActions live={live} busy={busy} refocusing={refocusing} onPublish={onPublish} onToggleRefocus={() => setRefocusing((v) => !v)} />
      </article>
      {refocusing && (
        <RefocusPanel revision={revision} busy={busy} onSave={async (point) => { await onRefocus(point); setRefocusing(false); }} />
      )}
    </li>
  );
}

function RevisionActions({
  live,
  busy,
  refocusing,
  onPublish,
  onToggleRefocus,
}: {
  readonly live: boolean;
  readonly busy: boolean;
  readonly refocusing: boolean;
  readonly onPublish: () => void;
  readonly onToggleRefocus: () => void;
}) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  return (
    <menu className="m-0 flex flex-wrap gap-2 p-0">
      {!live && (
        <li className="list-none">
          <Button type="button" size="sm" disabled={busy} onClick={onPublish}>
            <Rocket aria-hidden="true" className="mr-2 h-4 w-4" />
            {t('history.publish')}
          </Button>
        </li>
      )}
      <li className="list-none">
        <Button type="button" variant="outline" size="sm" aria-expanded={refocusing} disabled={busy} onClick={onToggleRefocus}>
          <Crosshair aria-hidden="true" className="mr-2 h-4 w-4" />
          {t('history.refocus')}
        </Button>
      </li>
    </menu>
  );
}

/** Νέα εστίαση πάνω στις ίδιες εικόνες — με προεπισκόπηση, πριν γίνει νέα έκδοση. */
function RefocusPanel({
  revision,
  busy,
  onSave,
}: {
  readonly revision: LandingHeroRevision;
  readonly busy: boolean;
  readonly onSave: (point: PhotoFocalPoint) => Promise<void>;
}) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const [point, setPoint] = useState<PhotoFocalPoint>(revision.focalPoint);

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3">
      <HeroFocalPicker src={revision.day.src} point={point} onChange={setPoint} />
      <HeroFramePreview daySrc={revision.day.src} duskSrc={revision.dusk?.src ?? null} focalPoint={point} />
      <footer>
        <Button type="button" size="sm" disabled={busy} onClick={() => void onSave(point)}>
          {t('history.saveRefocus')}
        </Button>
      </footer>
    </section>
  );
}
