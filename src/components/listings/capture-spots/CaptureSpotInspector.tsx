'use client';

/**
 * @fileoverview **Ο ΕΠΙΘΕΩΡΗΤΗΣ ΤΗΣ ΕΠΙΛΕΓΜΕΝΗΣ ΦΩΤΟΓΡΑΦΙΑΣ** — κατεύθυνση, πεδίο, πρόταση πυξίδας, αφαίρεση (ADR-897 Φ3 · Φ5.2).
 * @related CaptureSpotWorkspaceDialog.tsx · DegreeSlider.tsx · lib/listings/floorplan-north (`headingFromCompass`)
 * @module components/listings/capture-spots/CaptureSpotInspector
 *
 * ⌨️ **Η εναλλακτική χωρίς σύρσιμο** (WCAG 2.5.7) για ό,τι κάνουν οι λαβές της κάτοψης. Η αλλαγή πάει στο **πρόχειρο** —
 *   η αποθήκευση είναι μία, στο τέλος.
 * 🧭 **Η πυξίδα ΠΡΟΤΕΙΝΕΙ, δεν αποφασίζει** (Φ5.2): μέσα σε κτίριο ξεφεύγει. Η πρόταση φαίνεται με την τιμή της και
 *   εφαρμόζεται **μόνο** με «Χρήση» — ποτέ σιωπηλά, ούτε στη νέα τοποθέτηση.
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { degToRad, normalizeAngleDeg, normalizeAngleDiff, radToDeg } from '@/lib/geometry/angle';
import { MAX_PHOTO_FOV_RAD, MIN_PHOTO_FOV_RAD, type PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';

import { DegreeSlider } from './DegreeSlider';

const K = 'property-market:photoCaptureSpots';

/** Κάτω από μία μοίρα η πρόταση **είναι** ήδη η τιμή — κανένα κουμπί που δεν αλλάζει τίποτα. */
const SAME_HEADING_RAD = degToRad(1);

/** Τι λέει η πυξίδα για την επιλεγμένη φωτογραφία. */
export type CompassHint =
  | { readonly kind: 'none' }
  | { readonly kind: 'needsNorth' }
  | { readonly kind: 'suggest'; readonly headingRad: number };

interface CaptureSpotInspectorProps {
  readonly name: string;
  readonly spot: PhotoCaptureSpot | null;
  readonly compass: CompassHint;
  readonly onChange: (next: PhotoCaptureSpot | null) => void;
}

const wholeDegrees = (rad: number) => Math.round(normalizeAngleDeg(radToDeg(rad))) % 360;

interface CompassSuggestionProps {
  readonly spot: PhotoCaptureSpot;
  readonly compass: CompassHint;
  readonly onChange: (next: PhotoCaptureSpot) => void;
}

function CompassSuggestion({ spot, compass, onChange }: CompassSuggestionProps) {
  const { t } = useTranslation(['property-market']);
  if (compass.kind === 'needsNorth') {
    return <p className="m-0 text-xs text-muted-foreground">{t(`${K}.north.compassNeedsNorth`)}</p>;
  }
  if (compass.kind !== 'suggest' || Math.abs(normalizeAngleDiff(compass.headingRad - spot.headingRad)) < SAME_HEADING_RAD) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-2" aria-live="polite">
      <p className="m-0 text-xs">{t(`${K}.north.compassSuggestion`, { degrees: wholeDegrees(compass.headingRad) })}</p>
      <Button type="button" size="sm" variant="secondary" className="self-start"
        onClick={() => onChange({ ...spot, headingRad: compass.headingRad })}>
        {t(`${K}.north.use`)}
      </Button>
    </section>
  );
}

export function CaptureSpotInspector({ name, spot, compass, onChange }: CaptureSpotInspectorProps) {
  const { t } = useTranslation(['property-market']);
  if (spot === null) {
    return <p className="m-0 text-sm text-muted-foreground">{t(`${K}.placeHint`, { name })}</p>;
  }
  return (
    <section className="flex flex-col gap-3" aria-label={name}>
      <DegreeSlider id="capture-spot-direction" label={t(`${K}.direction`)} min={0} max={359}
        value={wholeDegrees(spot.headingRad)}
        onValue={(degrees) => onChange({ ...spot, headingRad: degToRad(degrees) })} />
      <CompassSuggestion spot={spot} compass={compass} onChange={onChange} />
      <DegreeSlider id="capture-spot-fov" label={t(`${K}.fieldOfView`)}
        min={Math.ceil(radToDeg(MIN_PHOTO_FOV_RAD))} max={Math.floor(radToDeg(MAX_PHOTO_FOV_RAD))}
        value={Math.round(radToDeg(spot.fovRad))} onValue={(degrees) => onChange({ ...spot, fovRad: degToRad(degrees) })} />
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange(null)}>
        {t(`${K}.remove`)}
      </Button>
    </section>
  );
}
