'use client';

/**
 * @fileoverview **Μία θέση αρχείου** — μέρα ή σούρουπο: επιλογή, μικρογραφία, διαστάσεις, ζητήματα (ADR-881 §4.6).
 * @module components/admin/landing-heroes/HeroVariantSlot
 *
 * 🔑 Τα ζητήματα λέγονται **με το όνομά τους** και **με τη βαθμίδα τους** (μπλοκ/προειδοποίηση) — ο
 *    άνθρωπος ξέρει τι να αλλάξει στην εντολή του AI, όχι απλώς «μη έγκυρο αρχείο».
 */

import React, { useId, useRef } from 'react';
import { AlertTriangle, ImagePlus, OctagonX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { severityOf, type HeroUploadIssueCode } from '@/lib/landing/hero-upload-check';
import { LANDING_HERO_UPLOAD_SPEC, type LandingHeroVariant } from '@/lib/landing/landing-hero-vocabulary';

import { HERO_ISSUE_KEYS, HERO_VARIANT_KEYS, LANDING_HEROES_NS } from './landing-heroes-keys';
import type { HeroDraftVariant } from './useHeroDraft';

interface HeroVariantSlotProps {
  readonly variant: LandingHeroVariant;
  readonly value: HeroDraftVariant | null;
  readonly onChange: (file: File | null) => void;
  readonly disabled: boolean;
}

export function HeroVariantSlot({ variant, value, onChange, disabled }: HeroVariantSlotProps) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">{t(HERO_VARIANT_KEYS[variant])}</legend>
      {variant === 'dusk' && <p className="m-0 text-xs text-muted-foreground">{t('composer.duskOptional')}</p>}

      {value !== null && (
        <figure className="m-0 flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="" className="aspect-[2/1] w-full rounded-md object-cover" />
          {value.size !== null && (
            <figcaption className="text-xs text-muted-foreground">
              {t('composer.dimensions', { width: value.size.width, height: value.size.height })}
            </figcaption>
          )}
        </figure>
      )}

      <IssueList issues={value?.issues ?? []} />

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={LANDING_HERO_UPLOAD_SPEC.acceptedTypes.join(',')}
        className="sr-only"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <menu className="m-0 flex flex-wrap gap-2 p-0">
        <li className="list-none">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlus aria-hidden="true" className="mr-2 h-4 w-4" />
            {t(value === null ? 'composer.choose' : 'composer.replace')}
          </Button>
        </li>
        {value !== null && (
          <li className="list-none">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              {t('composer.remove')}
            </Button>
          </li>
        )}
      </menu>
    </fieldset>
  );
}

/** Τα ζητήματα, με εικονίδιο βαθμίδας — το χρώμα δεν είναι το μόνο κανάλι (CHECK 3.41). */
export function IssueList({ issues }: { readonly issues: readonly HeroUploadIssueCode[] }) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  if (issues.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      {issues.map((code) => {
        const blocking = severityOf(code) === 'block';
        const Icon = blocking ? OctagonX : AlertTriangle;
        return (
          <li key={code} className={`flex items-start gap-1.5 ${blocking ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t(HERO_ISSUE_KEYS[code])}</span>
          </li>
        );
      })}
    </ul>
  );
}
