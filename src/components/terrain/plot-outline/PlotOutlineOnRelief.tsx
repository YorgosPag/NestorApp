'use client';

/**
 * @fileoverview **Το περίγραμμα πάνω στο ανάγλυφο, όπως το βλέπει ο ιδιοκτήτης** — κάτοψη και 3Δ, πριν και ανεξάρτητα από
 *   το αν θα φανεί δημόσια (ADR-920 §14.11 Ζ5 · Π9 «στην προεπισκόπηση του ιδιοκτήτη φαίνεται πάντα»).
 * @related hooks/listings/useOwnerRelief (`GET …/terrain?view=relief`) · ./PlotOutlineStatusCard (το κουτάκι Π9, ακριβώς
 *   από πάνω) · components/listing-detail/terrain/terrain-surfaces (η ΙΔΙΑ σκηνή «Κάτοψη | 3Δ» με τη δημόσια αγγελία)
 * @module components/terrain/plot-outline/PlotOutlineOnRelief
 *
 * 🔑 **Δίπλα στην απόφαση**: ο χάρτης ζει κάτω από το κουτάκι «να φαίνεται στη δημόσια αγγελία» — ο ιδιοκτήτης βλέπει ΤΙ
 *    εγκρίνει πριν το εγκρίνει. Η δημόσια αγγελία μένει ο καθρέφτης του κοινού: εκεί φαίνεται μόνο ό,τι δημοσιεύτηκε.
 * 🔑 **Λέει ποιος το βλέπει**: με ατσεκάριστο Π9 γράφει ρητά «μόνο εσύ» — αλλιώς ο ιδιοκτήτης θα νόμιζε ότι το περίγραμμα
 *    είναι ήδη δημόσιο (το λάθος που αποφεύγει η απόφαση «όχι και στη σελίδα της αγγελίας»).
 * 🔑 **Μία σκηνή**: ο ίδιος χάρτης και το ίδιο 3Δ με τη δημόσια αγγελία — η μόνη διαφορά είναι το στιγμιότυπο που δέχεται.
 */

import React, { useCallback, useId, useRef, useState } from 'react';

import { LazyTerrainSnapshotStage, TerrainStagePending } from '@/components/listing-detail/terrain/terrain-surfaces';
import { Button } from '@/components/ui/button';
import { useOwnerRelief, ownerReliefApplies } from '@/hooks/listings/useOwnerRelief';
import { useSizeObserver } from '@/hooks/media/useElementSize';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PlotOutlineStatus } from '@/lib/terrain/plot-outline/plot-outline-status';
import { terrainMapWidthClassOf } from '@/lib/terrain/publication/terrain-map-model';
import { TERRAIN_REFUSAL_MESSAGE_LIMITS } from '@/lib/terrain/publication/terrain-publication-contract';
import { cn } from '@/lib/utils';
import type { OwnerTerrainTarget } from '@/services/listings/plot-outline.client';

const NS = 'terrain-survey:plotOutline.onRelief';

export interface PlotOutlineOnReliefProps {
  readonly target: OwnerTerrainTarget;
  /** Η κατάσταση όπως τη διάβασε η πόρτα· `null` = δεν διαβάστηκε (ακόμη). */
  readonly status: PlotOutlineStatus | null;
}

export function PlotOutlineOnRelief({ target, status }: PlotOutlineOnReliefProps) {
  const { t } = useTranslation(['terrain-survey', 'listing-detail']);
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);
  const [widthClass, setWidthClass] = useState<number | null>(null);
  const onSize = useCallback((width: number) => setWidthClass(terrainMapWidthClassOf(width)), []);
  useSizeObserver(ref, onSize, 'content-box');
  const relief = useOwnerRelief(target, status);

  if (!ownerReliefApplies(status) || status === null || status.outline === null) return null;
  const audience = status.outline.showInListing ? 'public' : 'private';
  return (
    <section ref={ref} aria-labelledby={headingId} aria-busy={relief.updating} data-plot-outline-on-relief={audience}
      className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${NS}.heading`)}</h4>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.audience.${audience}`)}</p>
      {/* Η ζωντανή περιοχή μένει ΠΑΝΤΑ στο DOM — αλλιώς δεν ανακοινώνει την αλλαγή. */}
      <p role="status" className="m-0 text-sm text-muted-foreground">
        {relief.updating && relief.snapshot !== null ? t(`${NS}.updating`) : ''}
      </p>
      {relief.snapshot !== null && (
        <section className={cn('transition-opacity motion-reduce:transition-none', relief.updating && 'opacity-60')}>
          <LazyTerrainSnapshotStage snapshot={relief.snapshot} widthClass={widthClass} />
        </section>
      )}
      {relief.snapshot === null && relief.updating && <TerrainStagePending />}
      {relief.refusal !== null && (
        <section className="flex flex-col items-start gap-2">
          <p role="alert" className="m-0 text-sm text-foreground">
            {t(`terrain-survey:publish.refusals.${relief.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={relief.retry}>{t(`${NS}.retry`)}</Button>
        </section>
      )}
    </section>
  );
}
