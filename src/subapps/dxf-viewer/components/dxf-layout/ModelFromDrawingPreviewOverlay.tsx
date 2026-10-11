'use client';

/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useModelFromDrawingState } from '../../systems/model-from-drawing/model-from-drawing-store';
import { ASSISTANT_STATUS_TONE } from '../../systems/model-from-drawing/assistant-status-tone';
import {
  PREVIEW_ZONE_PAINT_ORDER,
  PREVIEW_ZONE_STYLE,
} from '../../systems/region-preview/preview-zone-style';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../rendering/types/Types';
import type { AssistantPreviewZone } from '../../bim/model-from-drawing/assistant-preview';
import { PreviewZoneShape } from './preview-zone/PreviewZoneShape';
import { worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  readonly viewport: Viewport;
}

/** Πάχος (CSS px) της ανεξήγητης γραμμής — παχύτερη από κάθε ζώνη: είναι ό,τι ΔΕΝ θα χτιστεί. */
const UNEXPLAINED_STROKE_PX = 3;

/** Σειρά ζωγραφικής: ανά τόνο (ό,τι θέλει προσοχή από πάνω), και η εστιασμένη ζώνη τελευταία. */
function inPaintOrder(zones: readonly AssistantPreviewZone[], focusedKey: string | null): AssistantPreviewZone[] {
  const rank = (zone: AssistantPreviewZone): number =>
    zone.key === focusedKey
      ? PREVIEW_ZONE_PAINT_ORDER.length
      : PREVIEW_ZONE_PAINT_ORDER.indexOf(ASSISTANT_STATUS_TONE[zone.status]);
  return [...zones].sort((a, b) => rank(a) - rank(b));
}

/**
 * ADR-911 Φ3β — η προεπισκόπηση του βοηθού «Μοντέλο από το σχέδιο»: ΚΑΘΕ ανιχνευμένο ορθογώνιο
 * με την κατάστασή του, πριν γραφτεί οτιδήποτε. Ο άνθρωπος εγκρίνει ό,τι ΒΛΕΠΕΙ· γι' αυτό τα
 * «έτοιμα» φωτίζονται με το σώμα που θα ζωγραφιστεί (άγκυρα Α-10), όχι με το ωμό ορθογώνιο.
 *
 * Τέσσερις καταστάσεις, τέσσερα μοτίβα γραμμής (`preview-zone-style.ts`) — ποτέ μόνο χρώμα.
 * Συν οι ανεξήγητες γραμμές: τοίχος του σχεδίου που δεν ανήκει σε κανένα ορθογώνιο.
 *
 * ADR-040: standalone leaf. ΕΝΑ υψίσυχνο hook (transform) + το ΧΑΜΗΛΟΣΥΧΝΟ store της συνεδρίας
 * (γράφεται μόνο σε κλικ). Κλειστός βοηθός ⇒ `null` πριν από κάθε προβολή. Read-only,
 * pointer-events-none. Mirror του `TopoAutoBreaklinePreviewOverlay`.
 */
export function ModelFromDrawingPreviewOverlay({ viewport }: Props): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { phase, preview, focusedKey } = useModelFromDrawingState();
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει προεπισκόπηση).
  const transform = useTransformValue();

  if (phase === 'closed' || !preview) return null;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="model-from-drawing-preview"
    >
      {inPaintOrder(preview.zones, focusedKey).map((zone) => (
        <PreviewZoneShape
          key={zone.key}
          testId={`mfd-zone-${zone.status}`}
          pieces={zone.pieces}
          tone={ASSISTANT_STATUS_TONE[zone.status]}
          title={zone.reason ? t(zone.reason) : undefined}
          focused={zone.key === focusedKey}
          transform={transform}
          viewport={viewport}
        />
      ))}
      {preview.unexplained.map((segment, i) => (
        <path
          key={`unexplained-${i}`}
          data-testid="mfd-unexplained"
          d={worldRingToSvgPath([segment.start, segment.end], transform, viewport, false)}
          fill="none"
          stroke={PREVIEW_ZONE_STYLE.reject.stroke}
          strokeWidth={UNEXPLAINED_STROKE_PX}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
