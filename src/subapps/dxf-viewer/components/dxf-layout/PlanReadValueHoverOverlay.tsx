'use client';

/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-929 Δ21 (δ) — **πού είναι στην εικόνα** η γραμμή της λίστας «Τι διάβασα» που δείχνει ο άνθρωπος: πλαίσιο γύρω από το
 * κείμενο, ώστε η διόρθωση να γίνεται κοιτάζοντας το χαρτί, όχι από μνήμης.
 *
 * ADR-040: gate-at-mount. Ο εξωτερικός ακούει μόνο ΧΑΜΗΛΟΣΥΧΝΑ stores (αναγνώριση · υπόβαθρο του ορόφου) και επιστρέφει
 * `null` όταν δεν δείχνεται κείμενο· ο εσωτερικός κάνει το **ένα** υψίσυχνο hook (`useTransformValue`). Το πλαίσιο σκηνής
 * υπολογίζεται μία φορά ανά (κείμενο, τοποθέτηση)· ανά transform γίνεται μόνο η προβολή. Read-only, pointer-events-none.
 * Σημάδι: το υπάρχον `PLAN_CONFIDENCE_MARKS` (CHECK 3.41), διπλό πάχος όπως η επισήμανση της κάρτας κλίμακας.
 */

import React from 'react';
import { usePlanRecognitionState } from '../../systems/plan-recognition/plan-recognition-store';
import { planConfidenceMark } from '../../systems/plan-recognition/plan-confidence';
import { sceneTextRing } from '../../systems/plan-recognition/plan-overlay-geometry';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Point2D, Viewport } from '../../rendering/types/Types';
import { worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  readonly viewport: Viewport;
}

/** Πόσο παχύτερο από το συνηθισμένο σημάδι (ίδιο με την επισήμανση της κάρτας κλίμακας). */
const HOVER_WIDTH_FACTOR = 2;

function HoverRing({ textId, ring, viewport }: {
  readonly textId: string;
  readonly ring: readonly Point2D[];
  readonly viewport: Viewport;
}): React.ReactElement {
  // ADR-040 Phase XXII.B — leaf-level transform: το ΜΟΝΑΔΙΚΟ υψίσυχνο hook.
  const transform = useTransformValue();
  const mark = planConfidenceMark('high');
  return (
    <svg className="absolute inset-0 size-full pointer-events-none z-10" xmlns="http://www.w3.org/2000/svg" data-testid="plan-read-value-hover-overlay">
      <path d={worldRingToSvgPath(ring, transform, viewport)} fill="none" stroke={mark.stroke}
        strokeWidth={mark.strokeWidth * HOVER_WIDTH_FACTOR} data-text-id={textId} />
    </svg>
  );
}

export function PlanReadValueHoverOverlay({ viewport }: Props): React.ReactElement | null {
  const { run, reading, readHoverTextId } = usePlanRecognitionState();
  const floorId = run?.floorId ?? null;
  const background = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background ?? null : null));

  const ring = React.useMemo(() => {
    if (!background || readHoverTextId === null || reading?.status !== 'read') return null;
    // Το πλαίσιο δεν αλλάζει με τη διόρθωση: η ανάγνωση της μηχανής το έχει ήδη.
    const text = reading.reading.texts.find((t) => t.id === readHoverTextId);
    return text ? sceneTextRing(text.rect, background) : null;
  }, [background, reading, readHoverTextId]);

  if (!ring || readHoverTextId === null) return null;
  return <HoverRing textId={readHoverTextId} ring={ring} viewport={viewport} />;
}
