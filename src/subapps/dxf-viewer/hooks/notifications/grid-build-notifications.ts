/**
 * grid-build-notifications — ADR-441 «από κάναβο» + ADR-448 storey gating.
 *
 * Toast registrars for the one-shot grid-build batches (foundations / columns /
 * walls / tie-beams / beams / slabs) plus the storey-gating soft warning.
 * Extracted from `useDxfViewerNotifications` (Google file-size SSoT, N.7.1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-441-grid-first-foundation-erection.md
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';

/** Foundation grid + storey-gating soft warning. */
function registerFoundationGridToasts(t: TFunction): Array<() => void> {
  return [
    // ADR-441 Slice 2 «Εσχάρα πεδιλοδοκών από κάναβο» — summary μετά το one-shot
    // batch (πληθυντικότητα μέσω ICU στα locale strings).
    EventBus.on('bim:foundations-from-grid', ({ created, deleted, rehosted, reJustified }) => {
      if (created === 0 && deleted === 0 && rehosted === 0 && reJustified === 0) {
        // ADR-441 Slice 6 — idempotent re-run: η εσχάρα ήταν ήδη ενημερωμένη.
        toast.info(t('foundationGrid.upToDate'));
      } else if (rehosted > 0) {
        // ADR-441 Slice 6b — legacy ορφανές ξανα-κρεμάστηκαν (Revit migration).
        toast.success(t('foundationGrid.rehosted', { rehosted, created }));
      } else if (deleted > 0 || reJustified > 0) {
        // managed reconcile: αντικαταστάθηκαν obsolete (split) ή ευθυγραμμίστηκε η έδραση.
        toast.success(t('foundationGrid.reconciled', { created, deleted, reJustified }));
      } else {
        toast.success(t('foundationGrid.built', { built: created }));
      }
    }),
    EventBus.on('bim:foundations-from-grid-failed', ({ reason }) => {
      toast.warning(
        t(reason === 'insufficient-guides' ? 'foundationGrid.insufficientGuides' : 'foundationGrid.empty'),
      );
    }),

    // ADR-448 Phase 2 — soft warning: θεμελίωση/εδαφόπλακα δημιουργείται εκτός του
    // κατώτατου ορόφου. Non-blocking (Revit-style «επιτρέπεται, αλλά προσοχή»).
    EventBus.on('bim:foundation-on-upper-storey', () => {
      toast.warning(t('storeyGating.foundationUpperStorey'));
    }),
  ];
}

/** Column / wall grid batches. */
function registerColumnWallGridToasts(t: TFunction): Array<() => void> {
  return [
    // ADR-441 Slice GEN-COL «Κολώνες από κάναβο» — `skipped` = τομές με ήδη υπάρχουσα
    // grid κολώνα. ICU πληθυντικότητα.
    EventBus.on('bim:columns-from-grid', ({ created, skipped }) => {
      if (created === 0) toast.info(t('columnGrid.upToDate'));
      else if (skipped > 0) toast.success(t('columnGrid.builtWithSkipped', { created, skipped }));
      else toast.success(t('columnGrid.built', { created }));
    }),
    EventBus.on('bim:columns-from-grid-failed', () => {
      toast.warning(t('columnGrid.insufficientGuides'));
    }),

    // ADR-441 Slice GEN-WALL «Τοίχοι από κάναβο» — summary μετά το one-shot batch.
    EventBus.on('bim:walls-from-grid', ({ created, skipped }) => {
      if (created === 0) toast.info(t('wallGrid.upToDate'));
      else if (skipped > 0) toast.success(t('wallGrid.builtWithSkipped', { created, skipped }));
      else toast.success(t('wallGrid.built', { created }));
    }),
    EventBus.on('bim:walls-from-grid-failed', () => {
      toast.warning(t('wallGrid.insufficientGuides'));
    }),
  ];
}

/** Tie-beam / beam / slab grid batches. */
function registerBeamSlabGridToasts(t: TFunction): Array<() => void> {
  return [
    // ADR-441 Slice GEN-TIE «Συνδετήριες από κάναβο» — summary μετά το one-shot batch.
    EventBus.on('bim:tie-beams-from-grid', ({ created, skipped, jointed }) => {
      if (created === 0 && jointed === 0) toast.info(t('tieBeamGrid.upToDate'));
      else if (created === 0) toast.success(t('tieBeamGrid.jointed', { jointed }));
      else if (skipped > 0) toast.success(t('tieBeamGrid.builtWithSkipped', { created, skipped }));
      else toast.success(t('tieBeamGrid.built', { created }));
    }),
    EventBus.on('bim:tie-beams-from-grid-failed', () => {
      toast.warning(t('tieBeamGrid.insufficientGuides'));
    }),

    // ADR-441 Slice GEN-BEAM «Δοκάρια από κάναβο» — summary μετά το one-shot batch.
    EventBus.on('bim:beams-from-grid', ({ created, skipped }) => {
      if (created === 0) toast.info(t('beamGrid.upToDate'));
      else if (skipped > 0) toast.success(t('beamGrid.builtWithSkipped', { created, skipped }));
      else toast.success(t('beamGrid.built', { created }));
    }),
    EventBus.on('bim:beams-from-grid-failed', () => {
      toast.warning(t('beamGrid.insufficientGuides'));
    }),

    // ADR-441 Slice GEN-SLAB «Πλάκες από κάναβο» — εδαφόπλακα/δάπεδα/οροφές summary.
    EventBus.on('bim:slabs-from-grid', ({ created, skipped }) => {
      if (created === 0) toast.info(t('slabGrid.upToDate'));
      else if (skipped > 0) toast.success(t('slabGrid.builtWithSkipped', { created, skipped }));
      else toast.success(t('slabGrid.built', { created }));
    }),
    EventBus.on('bim:slabs-from-grid-failed', () => {
      toast.warning(t('slabGrid.noFootprint'));
    }),
  ];
}

/** All «από κάναβο» grid-build toasts + storey-gating warning. */
export function registerGridBuildNotifications(t: TFunction): Array<() => void> {
  return [
    ...registerFoundationGridToasts(t),
    ...registerColumnWallGridToasts(t),
    ...registerBeamSlabGridToasts(t),
  ];
}
