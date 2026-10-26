'use client';

/**
 * @fileoverview 🏔️ **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΕΔΑΦΟΥΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — ο χάρτης της αγγελίας πάνω στα σημεία που μόλις φόρτωσε,
 * υπολογισμένος στον Web Worker (ADR-920 Β4.8 5γ).
 * @related hooks/listings/useTerrainSurveyImport (`preview` + `setPreviewWidth`) · hooks/listings/useSurveyPreview (η
 *   κατάσταση) · ./TerrainContourMap (η ΙΔΙΑ όψη με τη δημόσια αγγελία — εδώ το μοντέλο κουβαλά και σημάνσεις)
 * @module components/listing-detail/terrain/TerrainPreview
 *
 * 🔑 **Μετρά το πλάτος του** (`useSizeObserver`, content-box) και το δίνει στο hook: οι ετικέτες βγαίνουν σε pixels οθόνης,
 *   ποτέ κάτω από το όριο αναγνωσιμότητας (§13.8 απόφαση 4).
 * 🔑 **Ποτέ κενό, ποτέ πάγωμα**: όσο έρχεται νεότερος χάρτης, ο προηγούμενος μένει (αχνός) με `aria-busy` και μήνυμα
 *   κατάστασης — ο αναγνώστης οθόνης ακούει «ενημερώνεται», όχι σιωπή.
 */

import { useRef } from 'react';

import { useSizeObserver } from '@/hooks/media/useElementSize';
import type { TerrainSurveyImportApi } from '@/hooks/listings/useTerrainSurveyImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { TerrainContourMap } from './TerrainContourMap';

const NS = 'listing-detail:terrain.map.preview';

export interface TerrainPreviewProps {
  readonly preview: TerrainSurveyImportApi['preview'];
  /** Σταθερό (`useCallback`) — το `setPreviewWidth` του hook. */
  readonly onWidth: TerrainSurveyImportApi['setPreviewWidth'];
}

export function TerrainPreview({ preview, onWidth }: TerrainPreviewProps) {
  const { t } = useTranslation('listing-detail');
  const ref = useRef<HTMLElement>(null);
  useSizeObserver(ref, onWidth, 'content-box');
  // Η ζωντανή περιοχή μένει ΠΑΝΤΑ στο DOM (κενή όταν ο χάρτης είναι ο τρέχων) — αλλιώς δεν ανακοινώνει την αλλαγή.
  const status = preview.failed ? t(`${NS}.failed`) : preview.updating ? t(`${NS}.updating`) : '';
  return (
    <section ref={ref} aria-label={t(`${NS}.label`)} aria-busy={preview.updating} data-terrain-preview=""
      className={cn(
        'flex flex-col gap-2 [&>figure]:transition-opacity motion-reduce:[&>figure]:transition-none',
        preview.updating && '[&>figure]:opacity-60',
      )}>
      <p role="status" className="m-0 text-sm text-muted-foreground">{status}</p>
      {preview.model !== null && <TerrainContourMap model={preview.model} />}
    </section>
  );
}
