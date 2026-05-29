'use client';

/**
 * ADR-396 Phase P6 — Thermal Envelope (ETICS) dialog host.
 *
 * Lifecycle owner του authoring command «Εφαρμογή Θερμοπρόσοψης»:
 *   1. Listen σε `bim:thermal-envelope-requested` (ribbon → action intercept →
 *      EventBus) → init draft από το spec του τρέχοντος ορόφου (ή default) +
 *      open dialog.
 *   2. «Εφαρμογή» → `setEnvelopeSpec(currentLevelId, draft)` (D3 ανά όροφο).
 *   3. «σε όλους» → `setEnvelopeSpec` σε ΟΛΟΥΣ τους ορόφους (D3).
 *   4. `markAllCanvasDirty()` → 2D overlay repaint· το 3D resync wiring
 *      (`use-bim3d-vg-resync`) ακούει το spec store για parity.
 *
 * Mounted as React.Suspense leaf σε `DxfViewerContent.tsx` — mirror του
 * `OpeningTagStyleHost` (ADR-376 C.2). ADR-040: leaf-only, καμία orchestrator
 * subscription. Δέχεται `levels`/`currentLevelId` ως props (ο γονιός κρατά ήδη
 * το levelManager) → καμία διπλή store subscription.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P6)
 */

import * as React from 'react';

import { markAllCanvasDirty } from '../../../rendering/core/frame-scheduler-api';
import { EventBus } from '../../../systems/events/EventBus';
import {
  buildDefaultSpec,
  getEnvelopeSpec,
  setEnvelopeSpec,
} from '../../../bim/stores/envelope-spec-store';
import type { ThermalEnvelopeSpec } from '../../../bim/types/thermal-envelope-types';
import { saveThermalEnvelopeSpec } from '../../../services/thermal-envelope.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { ThermalEnvelopeDialog } from './ThermalEnvelopeDialog';

const logger = createModuleLogger('ThermalEnvelopeHost');

export interface ThermalEnvelopeHostProps {
  /** Τρέχων BIM όροφος — κλειδί του per-level spec (D3). */
  readonly currentLevelId: string | null | undefined;
  /** Όλοι οι όροφοι — για «Εφαρμογή σε όλους» (D3). */
  readonly levels: ReadonlyArray<{ readonly id: string }>;
}

export function ThermalEnvelopeHost(
  props: ThermalEnvelopeHostProps,
): React.ReactElement | null {
  const { currentLevelId, levels } = props;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ThermalEnvelopeSpec>(buildDefaultSpec);

  // EventBus listener — ribbon button → init draft από το spec του ορόφου + open.
  React.useEffect(() => {
    return EventBus.on('bim:thermal-envelope-requested', () => {
      setDraft(getEnvelopeSpec(currentLevelId) ?? buildDefaultSpec());
      setOpen(true);
    });
  }, [currentLevelId]);

  const applyToLevels = React.useCallback(
    (levelIds: readonly string[]) => {
      for (const id of levelIds) {
        // Optimistic in-memory update (instant 2D/3D repaint)…
        setEnvelopeSpec(id, draft);
        // …+ persist στο level doc (ADR-396 P7) ώστε να επιβιώνει reload.
        // Fire-and-forget: το store έχει ήδη ενημερωθεί· ο sync-hook quiet
        // window αγνοεί το Firestore echo που ακολουθεί.
        void saveThermalEnvelopeSpec(id, draft).catch((err: unknown) => {
          logger.error('persist failed', { levelId: id, err });
        });
      }
      markAllCanvasDirty();
      setOpen(false);
    },
    [draft],
  );

  const handleApply = React.useCallback(() => {
    if (currentLevelId) applyToLevels([currentLevelId]);
  }, [currentLevelId, applyToLevels]);

  const handleApplyAll = React.useCallback(() => {
    applyToLevels(levels.map((l) => l.id));
  }, [levels, applyToLevels]);

  return (
    <ThermalEnvelopeDialog
      open={open}
      onOpenChange={setOpen}
      value={draft}
      onChange={setDraft}
      onApply={handleApply}
      onApplyAll={handleApplyAll}
    />
  );
}
