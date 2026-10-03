'use client';

/**
 * @fileoverview **ΤΟ ΣΗΜΕΙΟ ΤΟΥ ΦΩΤΟΓΡΑΦΟΥ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — μικρή κάτοψη με καρφίτσα και κύκλο αβεβαιότητας (ADR-904 Κ9 · Α8).
 * @related `lib/spatial-tour/tour-capture-placement-hint.ts` (`placementHintPoint` — μόνο `on-plan` φτάνει εδώ) ·
 *   `TourCaptureInbox.tsx` (εικόνα από το `getCapturePlan`) · `editor/TourPlacementForm.tsx` (εικόνα από την πηγή του επεξεργαστή)
 * @module components/spatial-tour/TourHintPlanPreview
 *
 * 🔑 **Παρουσίαση μόνο**: ποια εικόνα και από πού το αποφασίζει ο καλών — εδώ μόνο «ποιο pixel». Το SVG έχει `viewBox` στις
 *   διαστάσεις της **πρωτότυπης** εικόνας, άρα το pixel της πρότασης πέφτει ακριβώς εκεί που το πάτησε ο φωτογράφος, σε όποιο
 *   πλάτος κι αν σερβιριστεί το παράγωγο.
 * 🏆 **Πέρα από τους μεγάλους**: ο κύκλος αβεβαιότητας (ακρίβεια του δαχτύλου στο ζουμ της στιγμής) — ο υπεύθυνος αποδέχεται
 *   **ξέροντας** πόσο ακριβές είναι το σημείο.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import type { PlacementHintPoint } from '@/lib/spatial-tour/tour-capture-placement-hint';

import { PANEL_KEYS } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { PLAN_HINT_CLASS } from './viewer/tour-plan-overlay-palette';

type OnPlan = Extract<PlacementHintPoint, { readonly kind: 'on-plan' }>;

/** Η καρφίτσα ως κλάσμα της μεγαλύτερης διάστασης — ίδιο οπτικό μέγεθος σε κάθε κάτοψη. */
const PIN_FRACTION = 0.012;
const STROKE_FRACTION = 0.003;
/** Κάτω από αυτό η αβεβαιότητα κρύβεται πίσω από την καρφίτσα — δεν σχεδιάζεται. */
const MIN_RADIUS_IN_PINS = 1.5;

export function TourHintPlanPreview({ at, imageUrl }: { readonly at: OnPlan; readonly imageUrl: string | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { width, height } = at.plan.image;
  const unit = Math.max(width, height);
  const pin = unit * PIN_FRACTION;
  const stroke = unit * STROKE_FRACTION;
  const radius = at.radiusPx !== null && at.radiusPx > pin * MIN_RADIUS_IN_PINS ? at.radiusPx : null;
  const metres = at.radiusPx === null ? null : formatNumber(at.radiusPx * at.plan.metresPerPixel, { maximumFractionDigits: 1 });
  return (
    <figure className="m-0 space-y-1">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t(PANEL_KEYS.hintPlanAlt)}
        className="block h-auto w-full overflow-hidden rounded-md border border-border">
        {imageUrl !== null && <image href={imageUrl} x={0} y={0} width={width} height={height} />}
        {radius !== null && (
          <circle cx={at.pixel.x} cy={at.pixel.y} r={radius} className={PLAN_HINT_CLASS.radius} strokeWidth={stroke} strokeDasharray={`${stroke * 3} ${stroke * 2}`} />
        )}
        <circle cx={at.pixel.x} cy={at.pixel.y} r={pin} className={PLAN_HINT_CLASS.pin} strokeWidth={stroke} />
      </svg>
      {metres !== null && <figcaption className="text-xs text-muted-foreground">{t(PANEL_KEYS.hintPointAccuracy, { metres })}</figcaption>}
    </figure>
  );
}
