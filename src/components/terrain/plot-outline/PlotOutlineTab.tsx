'use client';

/**
 * @fileoverview **Η καρτέλα «Τοπογραφικό σχέδιο»** — το περίγραμμα που ισχύει, και ένα νέο σχέδιο να το ορίσει (ADR-920 §14.11 Ζ4).
 * @related ./PlotOutlineStatusCard (κατάσταση · Π9 · αφαίρεση · επαναφορά) · ./PlotDrawingImport (σχέδιο → υποψήφια → επιβεβαίωση) ·
 *   hooks/listings/usePlotOutlineStatus · hooks/listings/usePlotDrawingImport ·
 *   components/terrain/survey-import/TerrainSurveyImportPanel (ο φιλοξενών — η ΙΔΙΑ ενότητα, δεύτερη καρτέλα)
 * @module components/terrain/plot-outline/PlotOutlineTab
 *
 * 🔑 **Δύο πηγές, και ο άνθρωπος το καταλαβαίνει** (εντολή Giorgio 2026-11-23): οι ισοϋψείς δίνουν το ανάγλυφο μιας περιοχής·
 *    το σχέδιο δίνει **μόνο** το περίγραμμα. Το λέει η εισαγωγή της καρτέλας, πριν από οτιδήποτε άλλο.
 * 🔑 Μετά από επιβεβαίωση η κατάσταση **ξαναδιαβάζεται από την πόρτα** — η κάρτα δείχνει ό,τι ισχύει, όχι ό,τι στάλθηκε.
 */

import React from 'react';

import { usePlotDrawingImport } from '@/hooks/listings/usePlotDrawingImport';
import { usePlotOutlineStatus } from '@/hooks/listings/usePlotOutlineStatus';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { OwnerTerrainTarget } from '@/services/listings/plot-outline.client';

import { PlotDrawingImport } from './PlotDrawingImport';
import { PlotOutlineStatusCard } from './PlotOutlineStatusCard';

export interface PlotOutlineTabProps {
  readonly target: OwnerTerrainTarget;
  /** Το εμβαδόν που δηλώνει η αγγελία οικοπέδου, m² — τεκμήριο κατάταξης (Π4). `null` = δεν δηλώνεται. */
  readonly listingAreaM2: number | null;
}

export function PlotOutlineTab({ target, listingAreaM2 }: PlotOutlineTabProps) {
  const { t } = useTranslation(['terrain-survey']);
  const status = usePlotOutlineStatus(target);
  // `refresh` είναι σταθερή (useCallback ανά αγγελία) ⇒ καμία νέα συνάρτηση ανά απόδοση στο hook της αποστολής.
  const drawing = usePlotDrawingImport(target, listingAreaM2, status.refresh);
  return (
    <section className="flex flex-col gap-4" data-plot-outline-tab="">
      <p className="m-0 text-sm text-muted-foreground">{t('terrain-survey:plotOutline.intro')}</p>
      <PlotOutlineStatusCard api={status} />
      <PlotDrawingImport api={drawing} />
    </section>
  );
}
