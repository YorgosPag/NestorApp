'use client';

/**
 * @fileoverview 🏔️ **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΕΔΑΦΟΥΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — η όψη «Κάτοψη | 3Δ» της αγγελίας πάνω στα σημεία που μόλις
 * φόρτωσε, υπολογισμένη στον Web Worker (ADR-920 Β4.8 5γ · Β6.7).
 * @related hooks/listings/useTerrainSurveyImport (`preview` + `setPreviewWidth`) · hooks/listings/useSurveyPreview (η
 *   κατάσταση) · ./TerrainViewStage (η ΙΔΙΑ όψη με τη δημόσια αγγελία — εδώ η κάτοψη κουβαλά και σημάνσεις)
 * @module components/listing-detail/terrain/TerrainPreview
 *
 * 🔑 **Ό,τι θα δει ο αγοραστής, ΟΛΟ** (Β6.7): η ΙΔΙΑ σκηνή `TerrainViewStage` με την καρτέλα «Ανάγλυφο» της αγγελίας —
 *   κάτοψη (Υψόμετρα | Κλίσεις) και 3Δ με τον κύβο — πριν δημοσιευτεί οτιδήποτε. Το three κατεβαίνει μόνο αν ζητηθεί.
 * 🔑 **Μετρά το πλάτος του** (`useSizeObserver`, content-box) και το δίνει στο hook: οι ετικέτες βγαίνουν σε pixels οθόνης,
 *   ποτέ κάτω από το όριο αναγνωσιμότητας (§13.8 απόφαση 4).
 * 🔑 **Ποτέ κενό, ποτέ πάγωμα**: όσο έρχεται νεότερη απάντηση, η προηγούμενη σκηνή μένει (αχνή) με `aria-busy` και μήνυμα
 *   κατάστασης — ο αναγνώστης οθόνης ακούει «ενημερώνεται», όχι σιωπή. Η σκηνή ΔΕΝ αποπροσαρτάται: καρτέλα, «Κλίσεις»,
 *   υπερβολή και κάμερα του 3Δ μένουν όπως τα άφησε ο ιδιοκτήτης.
 */

import { useRef } from 'react';

import { useSizeObserver } from '@/hooks/media/useElementSize';
import type { TerrainSurveyImportApi } from '@/hooks/listings/useTerrainSurveyImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { TerrainViewStage } from './TerrainViewStage';

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
  // Η ζωντανή περιοχή μένει ΠΑΝΤΑ στο DOM (κενή όταν η σκηνή είναι η τρέχουσα) — αλλιώς δεν ανακοινώνει την αλλαγή.
  const status = preview.failed ? t(`${NS}.failed`) : preview.updating ? t(`${NS}.updating`) : '';
  return (
    <section ref={ref} aria-label={t(`${NS}.label`)} aria-busy={preview.updating} data-terrain-preview=""
      className={cn(
        'flex flex-col gap-2 [&>[data-terrain-view-stage]]:transition-opacity motion-reduce:[&>[data-terrain-view-stage]]:transition-none',
        preview.updating && '[&>[data-terrain-view-stage]]:opacity-60',
      )}>
      <p role="status" className="m-0 text-sm text-muted-foreground">{status}</p>
      {preview.model !== null && preview.snapshot !== null && (
        <TerrainViewStage model={preview.model} snapshot={preview.snapshot} worldCentreMm={preview.worldCentreMm} />
      )}
    </section>
  );
}
