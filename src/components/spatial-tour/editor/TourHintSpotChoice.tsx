'use client';

/**
 * @fileoverview **«ΣΤΗ ΘΕΣΗ ΠΟΥ ΠΡΟΤΕΙΝΕ Ο ΦΩΤΟΓΡΑΦΟΣ»** — η επιλογή της φόρμας τοποθέτησης για το σημείο της πρότασης (ADR-904 Κ9).
 * @related `TourPlacementForm.tsx` (ο καταναλωτής) · `TourHintPlanPreview.tsx` (η κάτοψη με την καρφίτσα) ·
 *   `lib/spatial-tour/tour-capture-placement-hint.ts` (`placementHintPoint` · `captureLevelsOfViewer`)
 * @module components/spatial-tour/editor/TourHintSpotChoice
 *
 * 🔑 **Αποδοχή με ένα κλικ, ποτέ αυτόματα**: η επιλογή είναι **προεπιλεγμένη** όταν το σημείο πέφτει στην **ίδια** βαθμονομημένη
 *   κάτοψη που είδε ο φωτογράφος — η τοποθέτηση γίνεται μόνο όταν ο υπεύθυνος πατήσει «Τοποθέτηση». Αλλαγμένη κάτοψη ⇒ η επιλογή
 *   **δεν** προσφέρεται (το λέει το κείμενο της πρότασης), ποτέ μεταφορά.
 */

import { useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { levelKeyId } from '@/lib/spatial-tour/spatial-tour-graph';
import {
  captureLevelsOfViewer,
  placementHintPoint,
  type CaptureLevelChoice,
  type PlacementHintPoint,
} from '@/lib/spatial-tour/tour-capture-placement-hint';
import type { TourViewerLevel } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourCapturePlacementHint } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TourHintPlanPreview } from '../TourHintPlanPreview';
import type { TourPanoramaSource } from '../viewer/tour-panorama-source';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

export type HintSpot = Extract<PlacementHintPoint, { readonly kind: 'on-plan' }>;

/** Πλάτος της μικρής κάτοψης στη φόρμα (css px) — η πηγή διαλέγει το παράγωγο. */
const SPOT_PREVIEW_CSS_WIDTH = 320;

/** Οι όροφοι ως επιλογές λήψης + το σημείο της πρότασης, **μόνο** αν πέφτει στην κάτοψη του ορόφου του. */
export function useHintSpot(levels: readonly TourViewerLevel[], hint: TourCapturePlacementHint | undefined) {
  return useMemo(() => {
    const captureLevels: CaptureLevelChoice[] = captureLevelsOfViewer(levels);
    const at = hint === undefined ? null : placementHintPoint(hint, captureLevels);
    return { captureLevels, spot: at?.kind === 'on-plan' ? at : null };
  }, [levels, hint]);
}

interface TourHintSpotChoiceProps {
  readonly spot: HintSpot;
  readonly levels: readonly TourViewerLevel[];
  readonly source: TourPanoramaSource;
  readonly checked: boolean;
  readonly busy: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function TourHintSpotChoice({ spot, levels, source, checked, busy, onCheckedChange }: TourHintSpotChoiceProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const plan = levels.find((level) => levelKeyId(level.key) === levelKeyId(spot.level.key))?.plan ?? null;
  const imageUrl = plan === null ? null : source.planImageUrl(plan, SPOT_PREVIEW_CSS_WIDTH);
  return (
    <fieldset className="m-0 space-y-2 border-0 p-0">
      <Label className="flex items-center gap-2 text-sm font-normal">
        <Checkbox checked={checked} disabled={busy} onCheckedChange={(on) => onCheckedChange(on === true)} />
        {t(TOUR_EDITOR_KEYS.placeAtHint)}
      </Label>
      {checked && <TourHintPlanPreview at={spot} imageUrl={imageUrl} />}
    </fieldset>
  );
}
