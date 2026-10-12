'use client';

/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useModelFromDrawingState } from '../../systems/model-from-drawing/model-from-drawing-store';
import {
  ASSISTANT_STATUS_TONE,
  openingZoneTone,
} from '../../systems/model-from-drawing/assistant-status-tone';
import {
  OPENING_CHOICE_LABEL_KEY,
  OPENING_REASON_LABEL_KEY,
} from '../../systems/model-from-drawing/opening-label-keys';
import {
  PREVIEW_ZONE_PAINT_ORDER,
  PREVIEW_ZONE_STYLE,
  type PreviewZoneTone,
} from '../../systems/region-preview/preview-zone-style';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { AssistantPreview, UnexplainedSegment } from '../../bim/model-from-drawing/assistant-preview';
import type { OpeningPreview, OpeningPreviewZone } from '../../bim/model-from-drawing/opening-preview';
import { PreviewZoneShape } from './preview-zone/PreviewZoneShape';
import { worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  readonly viewport: Viewport;
}

/** Ό,τι χρειάζεται κάθε στρώση για να ζωγραφίσει: ΕΝΑ transform, διαβασμένο από το φύλλο. */
interface Projection {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

type Translate = (key: string) => string;

/** Πάχος (CSS px) της ανεξήγητης γραμμής — παχύτερη από κάθε ζώνη: είναι ό,τι ΔΕΝ θα χτιστεί. */
const UNEXPLAINED_STROKE_PX = 3;

/** Η ετικέτα μιας ζώνης ανοίγματος: πόρτα και παράθυρο έχουν τον ίδιο τόνο, όχι το ίδιο όνομα. */
function openingZoneLabelKey(status: OpeningPreviewZone['status']): string | null {
  return status === 'door' || status === 'window' ? OPENING_CHOICE_LABEL_KEY[status] : null;
}

/** Σειρά ζωγραφικής: ανά τόνο (ό,τι θέλει προσοχή από πάνω), και η εστιασμένη ζώνη τελευταία. */
function inPaintOrder<Z extends { readonly key: string }>(
  zones: readonly Z[],
  toneOf: (zone: Z) => PreviewZoneTone,
  focusedKey: string | null,
): Z[] {
  const rank = (zone: Z): number =>
    zone.key === focusedKey ? PREVIEW_ZONE_PAINT_ORDER.length : PREVIEW_ZONE_PAINT_ORDER.indexOf(toneOf(zone));
  return [...zones].sort((a, b) => rank(a) - rank(b));
}

/** Γραμμές του σχεδίου φωτισμένες αυτούσιες (ανεξήγητες · ένοικοι κενού · σύμβολα χωρίς λωρίδα). */
function SegmentStrokes(props: Projection & {
  readonly segments: readonly UnexplainedSegment[];
  readonly tone: PreviewZoneTone;
  readonly testId: string;
}): React.ReactElement {
  return (
    <>
      {props.segments.map((segment, i) => (
        <path
          key={`${props.testId}-${i}`}
          data-testid={props.testId}
          d={worldRingToSvgPath([segment.start, segment.end], props.transform, props.viewport, false)}
          fill="none"
          stroke={PREVIEW_ZONE_STYLE[props.tone].stroke}
          strokeWidth={UNEXPLAINED_STROKE_PX}
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

function WallLayer(props: Projection & {
  readonly preview: AssistantPreview;
  readonly focusedKey: string | null;
  readonly t: Translate;
}): React.ReactElement {
  const { preview, focusedKey, t, transform, viewport } = props;
  return (
    <>
      {inPaintOrder(preview.zones, (zone) => ASSISTANT_STATUS_TONE[zone.status], focusedKey).map((zone) => (
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
      <SegmentStrokes segments={preview.unexplained} tone="reject" testId="mfd-unexplained" transform={transform} viewport={viewport} />
    </>
  );
}

/**
 * Φ4-3β — τα ανοίγματα πάνω στο σχέδιο. Ζωγραφίζονται ΠΑΝΩ από τους τοίχους: κάθονται μέσα τους.
 * Ό,τι «θα γραφτεί» είναι το περίγραμμα του ίδιου του σχεδίου εγγραφής (Α-10 για ανοίγματα).
 */
function OpeningLayer(props: Projection & {
  readonly preview: OpeningPreview;
  readonly focusedKey: string | null;
  readonly t: Translate;
}): React.ReactElement {
  const { preview, focusedKey, t, transform, viewport } = props;
  const toneOf = (zone: OpeningPreviewZone): PreviewZoneTone => openingZoneTone(zone, preview.refusal !== undefined);
  return (
    <>
      {inPaintOrder(preview.zones, toneOf, focusedKey).map((zone) => {
        const labelKey = openingZoneLabelKey(zone.status);
        return (
          <PreviewZoneShape
            key={zone.key}
            testId={`mfd-opening-${zone.status}`}
            pieces={zone.pieces}
            tone={toneOf(zone)}
            label={labelKey ? t(labelKey) : undefined}
            title={zone.reason ? t(OPENING_REASON_LABEL_KEY[zone.reason]) : undefined}
            focused={zone.key === focusedKey}
            transform={transform}
            viewport={viewport}
          />
        );
      })}
      <SegmentStrokes segments={preview.occupants} tone="decide" testId="mfd-opening-occupant" transform={transform} viewport={viewport} />
      <SegmentStrokes segments={preview.loose} tone="decide" testId="mfd-opening-loose" transform={transform} viewport={viewport} />
      <SegmentStrokes segments={preview.unexplained} tone="reject" testId="mfd-opening-unexplained" transform={transform} viewport={viewport} />
    </>
  );
}

/**
 * ADR-911 Φ3β / Φ4-3β — η προεπισκόπηση του βοηθού «Μοντέλο από το σχέδιο»: ΚΑΘΕ ανιχνευμένο
 * ορθογώνιο και ΚΑΘΕ άνοιγμα με την κατάστασή του, πριν γραφτεί οτιδήποτε. Ο άνθρωπος εγκρίνει
 * ό,τι ΒΛΕΠΕΙ· γι' αυτό τα «έτοιμα» φωτίζονται με το σώμα που θα ζωγραφιστεί (άγκυρα Α-10), όχι
 * με το ωμό ορθογώνιο, και τα ανοίγματα με το περίγραμμα που θα γραφτεί.
 *
 * Τέσσερις τόνοι, τέσσερα μοτίβα γραμμής (`preview-zone-style.ts`) — ποτέ μόνο χρώμα.
 *
 * ADR-040: standalone leaf. ΕΝΑ υψίσυχνο hook (transform) + το ΧΑΜΗΛΟΣΥΧΝΟ store της συνεδρίας
 * (γράφεται μόνο σε κλικ / πλήκτρο απόφασης). Οι δύο στρώσεις είναι παιδιά ΧΩΡΙΣ δική τους
 * συνδρομή: το transform περνά ως prop. Κλειστός βοηθός ⇒ `null` πριν από κάθε προβολή.
 * Read-only, pointer-events-none. Mirror του `TopoAutoBreaklinePreviewOverlay`.
 */
export function ModelFromDrawingPreviewOverlay({ viewport }: Props): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { phase, preview, openingPreview, focusedKey } = useModelFromDrawingState();
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει προεπισκόπηση).
  const transform = useTransformValue();

  if (phase === 'closed' || (!preview && !openingPreview)) return null;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="model-from-drawing-preview"
    >
      {preview ? <WallLayer preview={preview} focusedKey={focusedKey} t={t} transform={transform} viewport={viewport} /> : null}
      {openingPreview
        ? <OpeningLayer preview={openingPreview} focusedKey={focusedKey} t={t} transform={transform} viewport={viewport} />
        : null}
    </svg>
  );
}
