'use client';

/**
 * @fileoverview **Ρυθμιστής γωνίας σε μοίρες** — κατεύθυνση, πεδίο, βορράς (ADR-897 Φ3 · Φ5.2).
 * @related CaptureSpotInspector.tsx · FloorplanNorthPanel.tsx · components/spatial-tour/editor/TourPlanDirection (ίδιο ιδίωμα)
 * @module components/listings/capture-spots/DegreeSlider
 *
 * ⌨️ Η εναλλακτική χωρίς σύρσιμο (WCAG 2.5.7) για κάθε λαβή της κάτοψης: Radix Slider, προσβάσιμος με πληκτρολόγιο,
 *   με την τιμή σε μοίρες δίπλα. Εξήχθη όταν ήρθε ο **δεύτερος** καταναλωτής (ο βορράς) — όχι δίδυμο (N.0.2).
 */

import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface DegreeSliderProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onValue: (degrees: number) => void;
}

export function DegreeSlider({ id, label, value, min, max, onValue }: DegreeSliderProps) {
  const { t } = useTranslation(['property-market']);
  return (
    <section className="flex flex-col gap-1" aria-labelledby={id}>
      <h5 id={id} className="m-0 text-sm font-medium">{label}</h5>
      <section className="flex items-center gap-3">
        <Slider min={min} max={max} step={1} value={[value]} className="flex-1" thumbAriaLabel={label}
          onValueChange={([next]) => onValue(next)} />
        <output className="w-12 text-right text-sm tabular-nums">
          {t('property-market:photoCaptureSpots.degrees', { degrees: value })}
        </output>
      </section>
    </section>
  );
}
