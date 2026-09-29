'use client';

/**
 * @fileoverview **ΤΟ ΒΗΜΑ «ΧΩΡΟΙ» ΣΤΗ ΣΤΗΛΗ ΤΟΥ ΣΗΜΕΙΟΥ** — πληρότητα του ορόφου + είσοδος στον χώρο εργασίας (ADR-884 Φ2στ-γ
 * Γ3γ-2β · §12 Δ8.3 · Δ9.1).
 * @related `../TourPlanPane.tsx` (ο κάτοχος — μετά το βήμα «Θέση») · `TourSpacesWorkspace.tsx` (πίσω από `next/dynamic`) ·
 *   `lib/spatial-tour/viewer/tour-space-view.ts` (`spaceCoverage`)
 * @module components/spatial-tour/editor/spaces/TourSpacesLauncher
 *
 * 🔑 **Πληρότητα = προειδοποίηση, όχι φραγή** (Δ8.3): «Χώροι: 3 από 4 σημεία» + **ποια** λείπουν· η περιήγηση δημοσιεύεται κανονικά.
 * 🔑 **Ο χώρος εργασίας κατεβαίνει μόνο όταν ανοίξει** (`next/dynamic`, `ssr: false`, CHECK 3.34): Worker ανίχνευσης, λαβές, πένα
 *   και οι λέξεις τους δεν μπαίνουν στο πακέτο του πάνελ.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Expand } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceCoverage } from '@/lib/spatial-tour/viewer/tour-space-view';
import { placedStops } from '@/lib/spatial-tour/viewer/tour-viewer-plan';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import type { TourSpacesWorkspaceProps } from './TourSpacesWorkspace';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';

const TourSpacesWorkspace = dynamic(() => import('./TourSpacesWorkspace').then((m) => m.TourSpacesWorkspace), { ssr: false });

export type TourSpacesLauncherProps = Omit<TourSpacesWorkspaceProps, 'open' | 'onOpenChange'> & {
  /** Χωρίς κλίμακα δεν υπάρχουν μέτρα ⇒ ούτε χώροι (ο γραφέας: `plan-uncalibrated`). */
  readonly calibrated: boolean;
};

export function TourSpacesLauncher(props: TourSpacesLauncherProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  const level = props.graph.levels.find((l) => l.id === props.levelId);
  if (level === undefined) return null;
  const placed = placedStops(props.graph, level).map((s) => ({ nodeId: s.entry.node.id, point: s.point }));
  const coverage = spaceCoverage(level.spaces, placed);
  const hintId = `tour-spaces-hint-${level.id}`;
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3" aria-labelledby={`tour-spaces-${level.id}`}>
      <h4 id={`tour-spaces-${level.id}`} className="m-0 text-sm font-semibold">
        {coverage.total > 0 ? t(TOUR_SPACE_EDITOR_KEYS.coverage, { covered: coverage.covered, total: coverage.total })
          : t(TOUR_SPACE_EDITOR_KEYS.title)}
      </h4>
      {coverage.missing.length > 0 ? (
        <p id={hintId} className="m-0 text-sm text-muted-foreground">
          {t(TOUR_SPACE_EDITOR_KEYS.coverageMissing, { names: coverage.missing.map(props.nameOf).join(', ') })}{' '}
          {t(TOUR_SPACE_EDITOR_KEYS.coverageHint)}
        </p>
      ) : (
        coverage.total > 0 && <p id={hintId} className="m-0 text-sm text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.coverageComplete)}</p>
      )}
      {!props.calibrated && <p className="m-0 text-sm text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.needsScale)}</p>}
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={!props.calibrated}
        aria-describedby={coverage.total > 0 ? hintId : undefined} onClick={() => setOpen(true)}>
        <Expand aria-hidden className="h-4 w-4" />{t(TOUR_SPACE_EDITOR_KEYS.open)}
      </Button>
      {open && <TourSpacesWorkspace {...props} open={open} onOpenChange={setOpen} />}
    </section>
  );
}
