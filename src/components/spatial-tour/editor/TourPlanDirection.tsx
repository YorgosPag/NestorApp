'use client';

/**
 * @fileoverview **Η ΚΑΤΕΥΘΥΝΣΗ ΤΗΣ ΛΗΨΗΣ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — ο κώνος του θεατή στρίβει σωστά μόνο αν η λήψη ξέρει προς τα πού
 * κοιτάζει το κέντρο της (ADR-884 Φ2στ-β · §4.13 · 3DVista «radar»).
 * @related `TourPlanPane.tsx` (ο κάτοχος) · `lib/spatial-tour/tour-plan-frame.ts` (`suggestHeading`) · εντολή `orient`
 *   (`tour-plan-edit.ts` — στρέφει **και** τα βελάκια του σημείου)
 * @module components/spatial-tour/editor/TourPlanDirection
 *
 * 🏆 **Πρόταση από τα βελάκια** — η 3DVista θέλει χειροκίνητη πυξίδα. Εδώ, όταν το σημείο και ένας γείτονάς του έχουν θέση,
 *   το βελάκι που έβαλε ο άνθρωπος μέσα στη φωτογραφία **λέει** την κατεύθυνση· με ≥ 2 βελάκια η διαφωνία τους φαίνεται.
 * ⌨️ Ο ρυθμιστής (Radix) είναι προσβάσιμος με πληκτρολόγιο· η αποθήκευση γίνεται **μία** φορά, στο άφημα (`onValueCommit`).
 */

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { degToRad, normalizeAngleDeg, radToDeg } from '@/lib/geometry/angle';
import { suggestHeading } from '@/lib/spatial-tour/tour-plan-frame';
import type { TourNode } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

/** Πάνω από αυτή τη διαφωνία (μοίρες) η οθόνη προειδοποιεί ότι κάποιο βελάκι ή κάποια θέση είναι λάθος. */
const SPREAD_WARNING_DEG = 10;

export interface TourPlanDirectionProps {
  readonly node: TourNode;
  readonly nodes: readonly TourNode[];
  readonly headingRad: number;
  /** Κατά το σύρσιμο — η οθόνη δείχνει τον κώνο πριν αποθηκευτεί. */
  readonly onPreview: (headingRad: number | null) => void;
  readonly onCommit: (headingRad: number) => void;
}

const roundDeg = (rad: number) => Math.round(normalizeAngleDeg(radToDeg(rad))) % 360;

export function TourPlanDirection({ node, nodes, headingRad, onPreview, onCommit }: TourPlanDirectionProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [degrees, setDegrees] = useState(roundDeg(headingRad));
  useEffect(() => { setDegrees(roundDeg(headingRad)); onPreview(null); }, [headingRad, onPreview]);
  const suggestion = suggestHeading(node, headingRad, nodes);
  const spread = suggestion === null ? 0 : Math.round(radToDeg(suggestion.spreadRad));
  return (
    <section className="flex flex-col gap-2" aria-labelledby="tour-plan-direction">
      <h4 id="tour-plan-direction" className="m-0 text-sm font-medium">{t(TOUR_EDITOR_KEYS.planDirection)}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t(TOUR_EDITOR_KEYS.planDirectionHint)}</p>
      <section className="flex items-center gap-3">
        <Slider min={0} max={359} step={1} value={[degrees]} className="flex-1" thumbAriaLabel={t(TOUR_EDITOR_KEYS.planDirection)}
          onValueChange={([value]) => { setDegrees(value); onPreview(degToRad(value)); }}
          onValueCommit={([value]) => onCommit(degToRad(value))} />
        <output className="w-12 text-right text-sm tabular-nums">{t(TOUR_EDITOR_KEYS.planDirectionValue, { degrees })}</output>
      </section>
      {suggestion !== null && (
        <section className="flex flex-col gap-1">
          <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onCommit(suggestion.headingRad)}>
            {t(TOUR_EDITOR_KEYS.planSuggest)}
          </Button>
          <p className="m-0 text-xs text-muted-foreground">{t(TOUR_EDITOR_KEYS.planSuggestHint, { count: suggestion.samples })}</p>
          {spread > SPREAD_WARNING_DEG && (
            <p role="status" className="m-0 text-xs text-destructive">{t(TOUR_EDITOR_KEYS.planSuggestSpread, { degrees: spread })}</p>
          )}
        </section>
      )}
    </section>
  );
}
