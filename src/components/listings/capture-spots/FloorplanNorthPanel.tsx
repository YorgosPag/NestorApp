'use client';

/**
 * @fileoverview 🧭 **ΤΟ ΠΑΝΕΛ «ΒΟΡΡΑΣ ΚΑΤΟΨΗΣ»** — μία δήλωση ανά κάτοψη, στο πρόχειρο του χώρου εργασίας (ADR-897 Φ5.2).
 * @related FloorplanNorthArrow.tsx (το βέλος πάνω στην κάτοψη) · use-north-estimate.ts · lib/listings/floorplan-north
 * @module components/listings/capture-spots/FloorplanNorthPanel
 *
 * 🏆 **Τρεις δρόμοι προς τον ίδιο βορρά**: (α) σύρσιμο του βέλους πάνω στην κάτοψη (CubiCasa) · (β) ρυθμιστής σε μοίρες
 *   (Revit «Angle from Project to True North») · (γ) **εύρεση από τις πυξίδες** των φωτογραφιών που ήδη τοποθετήθηκαν —
 *   με μέτρο συμφωνίας, και **μόνο** ως πρόταση με «Χρήση».
 * ⌨️ Ο ρυθμιστής είναι η εναλλακτική χωρίς σύρσιμο (WCAG 2.5.7).
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { degToRad, normalizeAngleDeg, radToDeg } from '@/lib/geometry/angle';

import { DegreeSlider } from './DegreeSlider';
import type { NorthEstimateState } from './use-north-estimate';

const K = 'property-market:photoCaptureSpots.north';

const wholeDegrees = (rad: number) => Math.round(normalizeAngleDeg(radToDeg(rad))) % 360;

export interface FloorplanNorthPanelProps {
  readonly northRad: number | null;
  readonly onNorth: (northRad: number | null) => void;
  readonly estimate: NorthEstimateState;
  readonly onEstimate: () => void;
}

function EstimateOutcome({ estimate, onNorth }: Pick<FloorplanNorthPanelProps, 'estimate' | 'onNorth'>) {
  const { t } = useTranslation(['property-market']);
  if (estimate.status === 'loading') return <p className="m-0 text-xs text-muted-foreground">{t(`${K}.estimating`)}</p>;
  if (estimate.status !== 'done') return null;
  const result = estimate.estimate;
  if (result === null) {
    return <p className="m-0 text-xs text-muted-foreground">{t(`${K}.estimateTooFew`, { count: estimate.samples })}</p>;
  }
  const spread = Math.round(radToDeg(result.spreadRad));
  if (result.kind === 'disagree') {
    return <p className="m-0 text-xs text-muted-foreground">{t(`${K}.estimateDisagree`, { total: result.total, spread })}</p>;
  }
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-2">
      <p className="m-0 text-xs">
        {t(`${K}.estimateResult`, { used: result.used, degrees: wholeDegrees(result.northRad), spread })}
      </p>
      <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => onNorth(result.northRad)}>
        {t(`${K}.use`)}
      </Button>
    </section>
  );
}

export function FloorplanNorthPanel({ northRad, onNorth, estimate, onEstimate }: FloorplanNorthPanelProps) {
  const { t } = useTranslation(['property-market']);
  return (
    <section aria-labelledby="floorplan-north-title" className="flex flex-col gap-2 border-b border-border pb-4">
      <h4 id="floorplan-north-title" className="m-0 text-sm font-semibold">{t(`${K}.title`)}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t(`${K}.hint`)}</p>
      {northRad === null ? (
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onNorth(0)}>
          {t(`${K}.set`)}
        </Button>
      ) : (
        <>
          <DegreeSlider id="floorplan-north-angle" label={t(`${K}.angle`)} min={0} max={359} value={wholeDegrees(northRad)}
            onValue={(degrees) => onNorth(degToRad(degrees))} />
          <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => onNorth(null)}>
            {t(`${K}.remove`)}
          </Button>
        </>
      )}
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={estimate.status === 'loading'}
        onClick={onEstimate}>
        {t(`${K}.estimate`)}
      </Button>
      <section aria-live="polite">
        <EstimateOutcome estimate={estimate} onNorth={onNorth} />
      </section>
    </section>
  );
}
