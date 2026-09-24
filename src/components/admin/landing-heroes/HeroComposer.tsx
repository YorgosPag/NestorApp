'use client';

/**
 * @fileoverview **Νέα έκδοση** — μέρα + σούρουπο, εστίαση, προεπισκόπηση σε όλα τα κάδρα, αποθήκευση ως
 *   πρόχειρο (ADR-881 §5.1).
 * @module components/admin/landing-heroes/HeroComposer
 *
 * 🔑 **Αποθήκευση ≠ δημοσίευση** (Shopify/Webflow): η νέα έκδοση μπαίνει στο ιστορικό ως πρόχειρο και
 *    ζωντανεύει **μόνο** με ρητό «Δημοσίευση». Ένα λάθος ανέβασμα δεν φτάνει ποτέ στον επισκέπτη.
 * ⚠️ **Εστίαση = ο κανόνας της σύνθεσης μέχρι να κάνει ο άνθρωπος κλικ** (θέμα δεξιά, κάθετο κέντρο —
 *    ADR-881 §8.6)· η προεπισκόπηση δείχνει **ακριβώς** αυτό που θα αποθηκευτεί.
 */

import React from 'react';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LandingHeroPage } from '@/lib/landing/landing-hero-vocabulary';
import { LANDING_HERO_DEFAULT_FOCAL_POINT } from '@/lib/landing/landing-hero-vocabulary';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

import { HeroFocalPicker } from './HeroFocalPicker';
import { HeroFramePreview } from './HeroFramePreview';
import { HeroVariantSlot, IssueList } from './HeroVariantSlot';
import { LANDING_HEROES_NS } from './landing-heroes-keys';
import type { HeroDraftInput } from './useLandingHeroesAdmin';
import { useHeroDraft } from './useHeroDraft';

interface HeroComposerProps {
  readonly page: LandingHeroPage;
  readonly saving: boolean;
  readonly onSave: (input: HeroDraftInput) => Promise<unknown>;
}

export function HeroComposer({ page, saving, onSave }: HeroComposerProps) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const draft = useHeroDraft();
  const { day, dusk } = draft.variants;
  const save = async () => {
    if (day === null || !draft.canSave) return;
    const revision = await onSave({ page, day: day.file, dusk: dusk?.file ?? null, focalPoint: draft.focalPoint });
    if (revision !== null) draft.reset();
  };
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h3 className="m-0 text-base font-semibold">{t('composer.title')}</h3>
        <p className="m-0 text-sm text-muted-foreground">{t('composer.description')}</p>
      </header>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HeroVariantSlot variant="day" value={day} onChange={(file) => void draft.setFile('day', file)} disabled={saving} />
        <HeroVariantSlot variant="dusk" value={dusk} onChange={(file) => void draft.setFile('dusk', file)} disabled={saving} />
      </section>
      <IssueList issues={draft.pairIssues} />
      {day !== null && (
        <>
          <HeroFocalSection src={day.url} point={draft.focalPoint} onChange={draft.setFocalPoint} />
          <HeroFramePreview daySrc={day.url} duskSrc={dusk?.url ?? null} focalPoint={draft.focalPoint ?? LANDING_HERO_DEFAULT_FOCAL_POINT} />
        </>
      )}
      <footer className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={!draft.canSave || saving}>
          <Save aria-hidden="true" className="mr-2 h-4 w-4" />
          {t(saving ? 'composer.saving' : 'composer.save')}
        </Button>
        {day !== null && !draft.canSave && (
          <p className="m-0 text-xs text-destructive">{t('composer.blocked')}</p>
        )}
      </footer>
    </section>
  );
}

/** Εστίαση: «αυτόματη» μέχρι το πρώτο κλικ· επαναφορά στο αυτόματο με ένα κουμπί. */
function HeroFocalSection({
  src,
  point,
  onChange,
}: {
  readonly src: string;
  readonly point: PhotoFocalPoint | null;
  readonly onChange: (point: PhotoFocalPoint | null) => void;
}) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{t('focal.title')}</h3>
        {point === null ? (
          <span className="text-xs text-muted-foreground">{t('focal.auto')}</span>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t('focal.reset')}
          </Button>
        )}
      </header>
      <HeroFocalPicker src={src} point={point ?? LANDING_HERO_DEFAULT_FOCAL_POINT} onChange={onChange} />
    </section>
  );
}
