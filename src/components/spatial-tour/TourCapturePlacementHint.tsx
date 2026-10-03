'use client';

/**
 * @fileoverview **Η ΠΡΟΤΑΣΗ ΘΕΣΗΣ ΤΟΥ ΦΩΤΟΓΡΑΦΟΥ** — «Πρόταση φωτογράφου: Όροφος 1 · Κουζίνα / Καθιστικό» (ADR-904 Κ8 · Α8).
 * @related `lib/spatial-tour/tour-capture-placement-hint.ts` (`placementHintLevel` — υπάρχει · νέος · εκτός) · `TourCaptureInbox.tsx`
 *   · `editor/TourPlacementForm.tsx` · `viewer/useLevelLabel.ts` · `viewer/useStopNames.ts` (`roomDisplayText`)
 * @module components/spatial-tour/TourCapturePlacementHint
 *
 * 🏆 **Πέρα από τους μεγάλους**: Matterport/Zillow δείχνουν τον όροφο της λήψης σαν να είναι απόφαση. Εδώ φέρει **σήμα
 *   προέλευσης** — είναι λόγος του ανθρώπου που στάθηκε εκεί, όχι απόφαση του υπευθύνου — και λέει **ρητά** αν ο όροφος
 *   είναι νέος ή δεν υπάρχει πια, αντί να τον αντιστοιχίσει σιωπηλά σε άλλον.
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  placementHintLevel,
  placementHintPoint,
  type CaptureLevelChoice,
  type PlacementHintPoint,
} from '@/lib/spatial-tour/tour-capture-placement-hint';
import { plainRoomDisplay } from '@/lib/spatial-tour/tour-room';
import type { TourCapturePlacementHint as PlacementHint, TourSubject } from '@/types/spatial-tour';

import { PANEL_KEYS } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { TourHintPlanPreview } from './TourHintPlanPreview';
import { useCapturePlanImage } from './useCapturePlanImage';
import { useLevelLabel } from './viewer/useLevelLabel';
import { roomDisplayText } from './viewer/useStopNames';

/** Όροφος και χώρος — σημείο στίξης, όχι λέξη προς μετάφραση. */
const PART_JOINER = ' · ';

/**
 * Το σημείο σε λέξεις (Κ9) — «άγνωστος όροφος» το λέει ήδη το μέρος του ορόφου, όχι δεύτερη φορά. Ρητά `PANEL_KEYS.x`: ο αναλυτής
 * του i18n slice επιλύει `OBJ.prop`, όχι υπολογιζόμενο κλειδί (ADR-744).
 */
function pointText(t: (key: string) => string, point: PlacementHintPoint | null): string | null {
  if (point === null || point.kind === 'level-unknown') return null;
  if (point.kind === 'on-plan') return t(PANEL_KEYS.hintPointOnPlan);
  return point.kind === 'plan-changed' ? t(PANEL_KEYS.hintPointPlanChanged) : t(PANEL_KEYS.hintPointOutside);
}

/** **Η πρόταση ως κείμενο** — `null` ⇒ τίποτα να ειπωθεί. Ο ΕΝΑΣ τρόπος για εισερχόμενα **και** φόρμα τοποθέτησης. */
export function usePlacementHintText(levels: readonly CaptureLevelChoice[]): (hint: PlacementHint) => string | null {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const levelLabel = useLevelLabel();
  return (hint) => {
    const parts: string[] = [];
    if (hint.level !== undefined) {
      const at = placementHintLevel(hint.level, levels);
      parts.push(at.kind === 'known' ? levelLabel(at.level)
        : at.kind === 'new' ? t(PANEL_KEYS.hintNewFloor, { ordinal: at.ordinal }) : t(PANEL_KEYS.hintGoneFloor));
    }
    if (hint.room !== undefined) parts.push(roomDisplayText(t, plainRoomDisplay(hint.room)));
    const point = pointText(t, placementHintPoint(hint, levels));
    if (point !== null) parts.push(point);
    return parts.length === 0 ? null : parts.join(PART_JOINER);
  };
}

type OnPlan = Extract<PlacementHintPoint, { readonly kind: 'on-plan' }>;

/** Η κάτοψη των εισερχομένων — τα bytes από την ίδια πόρτα με την εφαρμογή κινητού (`getCapturePlan`). */
function InboxHintPlan({ subject, at }: { readonly subject: TourSubject; readonly at: OnPlan }) {
  const imageUrl = useCapturePlanImage(subject, at.plan.image.contentHash);
  return <TourHintPlanPreview at={at} imageUrl={imageUrl} />;
}

/**
 * Η πρόταση με το σήμα προέλευσης. Με `subject` (εισερχόμενα) δείχνει **και** το σημείο πάνω στην κάτοψη· η φόρμα τοποθέτησης
 * δείχνει τη δική της (μαζί με την επιλογή «στη θέση της πρότασης»), άρα δεν περνά `subject`.
 */
export function TourCapturePlacementHint({ hint, levels, subject }: {
  readonly hint: PlacementHint;
  readonly levels: readonly CaptureLevelChoice[];
  readonly subject?: TourSubject;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const place = usePlacementHintText(levels)(hint);
  if (place === null) return null;
  const point = placementHintPoint(hint, levels);
  return (
    <section className="flex w-full flex-col gap-2 text-xs text-muted-foreground" aria-label={t(PANEL_KEYS.hintFrom)}>
      <p className="m-0 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(PANEL_KEYS.hintFrom)}</Badge>
        <span>{place}</span>
      </p>
      {subject !== undefined && point?.kind === 'on-plan' && <span className="block max-w-xs"><InboxHintPlan subject={subject} at={point} /></span>}
    </section>
  );
}
