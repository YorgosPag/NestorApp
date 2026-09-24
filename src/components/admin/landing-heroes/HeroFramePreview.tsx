'use client';

/**
 * @fileoverview **Ο ήρωας σε κάθε συσκευή και στα δύο θέματα** — με την κρίση αναγνωσιμότητας κάθε κάδρου
 *   (ADR-881 §4.5 · §5.3).
 * @related hero-frames · useHeroLegibility · shared/landing-hero/LandingHero (οι σταθερές του κάδρου)
 * @module components/admin/landing-heroes/HeroFramePreview
 *
 * 🔑 **Μία πηγή για το κάδρο**: κλάση φωτογραφίας, στρώμα και εστίαση έρχονται από το `LandingHero` —
 *    η προσομοίωση **δεν** ξαναγράφει τίποτα από όσα αποδίδει ο ήρωας.
 * ⚠️ **Χωρίς σούρουπο, το σκοτεινό θέμα δείχνει τη μέρα με το στρώμα της μέρας** — ακριβώς ό,τι κάνει ο
 *    ήρωας με μονή εικόνα (το ελαφρύτερο στρώμα ισχύει μόνο για ζεύγος).
 */

import React, { useId, useMemo } from 'react';
import { CheckCircle2, CircleHelp, OctagonX, TriangleAlert } from 'lucide-react';

import {
  HERO_IMAGE_CLASS,
  HERO_SCRIM_CLASS,
  HERO_SCRIM_DUSK_FORCED_CLASS,
} from '@/components/shared/landing-hero/LandingHero';
import { heroFocalAttributes, renderedFocalPoint } from '@/components/shared/landing-hero/hero-focal-attributes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HeroLegibility, HeroScrimTheme } from '@/lib/landing/hero-legibility';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

import { HERO_FRAMES, type HeroFrame } from './hero-frames';
import { HERO_FRAME_KEYS, HERO_THEME_KEYS, HERO_VERDICT_KEYS, LANDING_HEROES_NS } from './landing-heroes-keys';
import { measureHeroLegibility, useLoadedImage } from './useHeroLegibility';
import styles from './hero-frame-preview.module.css';

interface HeroFramePreviewProps {
  readonly daySrc: string;
  readonly duskSrc: string | null;
  readonly focalPoint: PhotoFocalPoint;
}

interface TileSource {
  readonly theme: HeroScrimTheme;
  readonly src: string;
  readonly image: HTMLImageElement | null;
  /** Ποιο στρώμα αποδίδει ο ήρωας εδώ — του σούρουπου **μόνο** όταν υπάρχει ζεύγος. */
  readonly scrim: HeroScrimTheme;
}

export function HeroFramePreview({ daySrc, duskSrc, focalPoint }: HeroFramePreviewProps) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const dayImage = useLoadedImage(daySrc);
  const duskImage = useLoadedImage(duskSrc);
  const point = useMemo(() => renderedFocalPoint(focalPoint), [focalPoint]);
  const headingId = useId();

  const sources: readonly TileSource[] = [
    { theme: 'day', src: daySrc, image: dayImage, scrim: 'day' },
    duskSrc === null
      ? { theme: 'dusk', src: daySrc, image: dayImage, scrim: 'day' }
      : { theme: 'dusk', src: duskSrc, image: duskImage, scrim: 'dusk' },
  ];

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="m-0 text-sm font-semibold">{t('preview.title')}</h3>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
        {HERO_FRAMES.flatMap((frame) =>
          sources.map((source) => (
            <li key={`${frame.id}-${source.theme}`}>
              <FrameTile frame={frame} source={source} point={point} />
            </li>
          )),
        )}
      </ul>
    </section>
  );
}

function FrameTile({ frame, source, point }: { readonly frame: HeroFrame; readonly source: TileSource; readonly point: PhotoFocalPoint }) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const { image, scrim } = source;
  const legibility = useMemo(
    () => (image === null ? null : measureHeroLegibility(image, frame, point, scrim)),
    [image, frame, point, scrim],
  );
  const scrimClass = scrim === 'dusk' ? HERO_SCRIM_DUSK_FORCED_CLASS : HERO_SCRIM_CLASS;

  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div data-frame={frame.id} className={`${styles.tile} ${frame.aspectClass} w-full rounded-md bg-muted`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.src} alt="" className={`absolute inset-0 h-full w-full ${HERO_IMAGE_CLASS}`} {...heroFocalAttributes(point)} />
        <span aria-hidden="true" className={scrimClass} />
        <span aria-hidden="true" className={`${styles.panel} bg-card/90`} />
        <span aria-hidden="true" className={`${styles.text} text-white`}>
          <span className={styles.title}>{t('preview.sampleTitle')}</span>
          <span className={`${styles.subtitle} text-white/90`}>{t('preview.sampleSubtitle')}</span>
        </span>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {t(HERO_FRAME_KEYS[frame.id])} · {frame.viewport}px · {t(HERO_THEME_KEYS[source.theme])}
        </span>
        <LegibilityBadge legibility={legibility} />
      </figcaption>
    </figure>
  );
}

const VERDICT_ICON = { pass: CheckCircle2, 'large-only': TriangleAlert, fail: OctagonX } as const;
const VERDICT_TONE = { pass: 'text-foreground', 'large-only': 'text-muted-foreground', fail: 'text-destructive' } as const;

/** Εικονίδιο **και** κείμενο — το χρώμα δεν είναι το μόνο κανάλι (CHECK 3.41). */
function LegibilityBadge({ legibility }: { readonly legibility: HeroLegibility | null }) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  if (legibility === null) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
        {t('legibility.unknown')}
      </span>
    );
  }
  const Icon = VERDICT_ICON[legibility.verdict];
  return (
    <span className={`flex items-center gap-1 ${VERDICT_TONE[legibility.verdict]}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {t(HERO_VERDICT_KEYS[legibility.verdict], { ratio: legibility.worstRatio.toFixed(1) })}
    </span>
  );
}
