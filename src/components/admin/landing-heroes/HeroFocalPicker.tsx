'use client';

/**
 * @fileoverview **Κλικ πάνω στο θέμα** — το σημείο εστίασης του ήρωα (ADR-881 §4.4).
 * @related shared/landing-hero/hero-focal-attributes · hero-focal-picker.module.css
 * @module components/admin/landing-heroes/HeroFocalPicker
 *
 * 🏆 Πρότυπο Sanity hotspot / WordPress `FocalPointPicker`: ολόκληρη η εικόνα (`object-contain`) και ένας
 *    δείκτης· κλικ ⇒ νέο σημείο. **Και από πληκτρολόγιο**: τα βελάκια μετακινούν κατά ένα βήμα (5%) —
 *    ένα εργαλείο που δουλεύει μόνο με ποντίκι αποκλείει ανθρώπους (WCAG 2.1.1).
 * 🔑 Ο δείκτης κάθεται στο **κβαντισμένο** σημείο — ακριβώς εκεί που θα το αποδώσει ο ήρωας.
 */

import React, { useCallback } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import {
  HERO_FOCAL_STEP,
  heroFocalAttributes,
  renderedFocalPoint,
} from '@/components/shared/landing-hero/hero-focal-attributes';

import { LANDING_HEROES_NS } from './landing-heroes-keys';
import styles from './hero-focal-picker.module.css';

interface HeroFocalPickerProps {
  readonly src: string;
  readonly point: PhotoFocalPoint;
  readonly onChange: (point: PhotoFocalPoint) => void;
}

const STEP = HERO_FOCAL_STEP / 100;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

const KEY_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-STEP, 0],
  ArrowRight: [STEP, 0],
  ArrowUp: [0, -STEP],
  ArrowDown: [0, STEP],
};

export function HeroFocalPicker({ src, point, onChange }: HeroFocalPickerProps) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const shown = renderedFocalPoint(point);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      onChange({ x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) });
    },
    [onChange],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const delta = KEY_DELTAS[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      onChange({ x: clamp(shown.x + delta[0]), y: clamp(shown.y + delta[1]) });
    },
    [onChange, shown.x, shown.y],
  );

  const position = t('focal.position', { x: Math.round(shown.x * 100), y: Math.round(shown.y * 100) });

  return (
    <figure className="m-0 flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-label={`${t('focal.label')} — ${position}`}
        className="relative block w-full cursor-crosshair overflow-hidden rounded-md border border-border bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {/* 🔑 Φυσική αναλογία (`h-auto`), ΟΧΙ κουτί 2:1 με `object-contain`: αλλιώς μια 3:2 θα άφηνε
            κενά στα πλάγια και το κλικ θα μετριόταν στο κουτί αντί για την εικόνα. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="block h-auto w-full" />
        <span aria-hidden="true" className={`${styles.marker} h-6 w-6 rounded-full border-2 border-white bg-primary/60 shadow-lg ring-2 ring-black/40`} {...heroFocalAttributes(point)} />
      </button>
      <figcaption className="text-xs text-muted-foreground">
        {t('focal.hint')} · {position}
      </figcaption>
    </figure>
  );
}
