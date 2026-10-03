'use client';

/**
 * @fileoverview **Η ΕΤΙΚΕΤΑ ΕΝΟΣ ΟΡΟΦΟΥ** — η δηλωμένη, αλλιώς «Όροφος {n}». Ένας κανόνας για στήλη, επεξεργαστή, λίστα χωρίς
 * WebGL και την πρόταση θέσης στα εισερχόμενα (ADR-904 Κ8).
 * @related `TourViewerNavigation.tsx` · `editor/TourPlacementForm.tsx` · `TourCapturePlacementHint.tsx`
 * @module components/spatial-tour/viewer/useLevelLabel
 *
 * 🔑 **Χωριστό module επίτηδες** (ADR-744): ζούσε μέσα στο `TourViewerNavigation`, οπότε όποιος ήθελε **μία** λέξη έφερνε στο
 * i18n slice της σελίδας του **όλες** τις λέξεις της πλοήγησης του θεατή (μετρημένο: +32% στο `/tour-captures`).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ViewerLevelEntry } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';

export function useLevelLabel(): (level: Pick<ViewerLevelEntry, 'label' | 'ordinal'>) => string {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (level) => level.label ?? t(TOUR_VIEWER_KEYS.floorNumbered, { ordinal: level.ordinal });
}
