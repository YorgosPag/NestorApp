'use client';

/**
 * @fileoverview **ΑΦΑΙΡΕΣΗ ΠΑΝΟΡΑΜΑΤΟΣ ΑΠΟ ΣΗΜΕΙΟ** — με επιβεβαίωση που λέει **τι θα χαθεί** (ADR-884 Φ2δ · §4.10).
 * @related `lib/spatial-tour/tour-graph-inverse.ts` (η αφαίρεση **δεν** έχει πιστή αναίρεση — γι' αυτό ρωτάμε πριν) ·
 *   `lib/spatial-tour/tour-editor-model.ts` (`capturesOnNode`)
 * @module components/spatial-tour/editor/TourPointRemoval
 *
 * 🔑 Αφαιρείται το πανόραμα που **φαίνεται** στο σημείο (το πιο πρόσφατο έτοιμο). Αν είναι το τελευταίο, ο γραφέας σβήνει
 *   και το σημείο με τα βελάκια του — το μήνυμα το λέει ρητά, με τον αριθμό του σημείου.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourEditorModel } from '@/lib/spatial-tour/tour-editor-model';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

interface TourPointRemovalProps {
  readonly model: TourEditorModel;
  readonly nodeId: string;
  readonly busy: boolean;
  readonly onUnplace: (captureId: string) => Promise<boolean>;
}

export function TourPointRemoval({ model, nodeId, busy, onUnplace }: TourPointRemovalProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  const entry = model.graph.stops.get(nodeId);
  if (entry === undefined) return null;
  const last = (model.capturesOnNode.get(nodeId) ?? 1) <= 1;
  const confirm = async () => {
    if (await onUnplace(entry.stop.captureId)) setOpen(false);
  };
  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setOpen(true)}>{t(TOUR_EDITOR_KEYS.remove)}</Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} variant="destructive" loading={busy}
        title={t(TOUR_EDITOR_KEYS.removeTitle)}
        description={t(last ? TOUR_EDITOR_KEYS.removeLast : TOUR_EDITOR_KEYS.removeOne, { number: entry.number })}
        confirmText={t(TOUR_EDITOR_KEYS.remove)} onConfirm={confirm} />
    </>
  );
}
