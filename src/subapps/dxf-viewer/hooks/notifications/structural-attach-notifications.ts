/**
 * structural-attach-notifications — ADR-401.
 *
 * Toast registrars for the wall/column/stair attach-to-structural family +
 * adjacency merge. Extracted from `useDxfViewerNotifications` (Google file-size
 * SSoT, N.7.1). Pure: every registrar takes the bound `t` and returns the
 * EventBus unsubscribe handles for the caller's effect cleanup.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';

/** Wall/column/stair attach-detach + host-missing + adjacency merge toasts. */
export function registerStructuralAttachNotifications(t: TFunction): Array<() => void> {
  return [
    // ADR-401 Phase C — a deleted structural host left ≥1 attached wall without
    // its top support. The wall already falls back to baseline geometry; warn
    // the user (Revit "Top Constraint no longer valid"), non-blocking.
    EventBus.on('bim:wall-attach-host-missing', () => {
      toast.warning(t('attachToStructural.hostMissing'));
    }),

    // ADR-401 Phase D — walls auto-attached their top to a just-created beam/slab
    // placed over them. Non-blocking confirmation (Revit auto-attach feedback).
    EventBus.on('bim:walls-auto-attached', () => {
      toast.info(t('attachToStructural.autoAttached'));
    }),

    // ADR-401 Phase E.1 — manual attach/detach from the contextual wall ribbon.
    EventBus.on('bim:walls-attached-manual', () => {
      toast.info(t('attachToStructural.attachedManual'));
    }),
    EventBus.on('bim:walls-detached', () => {
      toast.info(t('attachToStructural.detached'));
    }),

    // ADR-401 Phase F.3 — column attach (ADR-450 §3: column-specific copy — the
    // generic message says «Οι τοίχοι» which is wrong for grid-born columns).
    EventBus.on('bim:columns-auto-attached', () => {
      toast.info(t('attachToStructural.autoAttachedColumns'));
    }),
    EventBus.on('bim:columns-auto-attached-base', () => {
      toast.info(t('attachToStructural.autoAttachedColumns'));
    }),
    EventBus.on('bim:columns-attached-manual', () => {
      toast.info(t('attachToStructural.attachedManual'));
    }),
    EventBus.on('bim:columns-detached', () => {
      toast.info(t('attachToStructural.detached'));
    }),

    // ADR-459 Φ4f — manual κολόνα↔πέδιλο connectivity από το foundation ribbon.
    EventBus.on('bim:column-footing-attached-manual', ({ columnIds }) => {
      toast.info(t('structuralOrganism.footingAttached', { count: columnIds.length }));
    }),
    EventBus.on('bim:column-footing-detached', ({ columnIds }) => {
      toast.info(t('structuralOrganism.footingDetached', { count: columnIds.length }));
    }),

    // ADR-363 Post-Creation Adjacency Merge — N γειτονικές κολόνες συγχωνεύτηκαν σε
    // ΕΝΑ composite τοιχίο (single-undo). Non-blocking success feedback.
    EventBus.on('bim:columns-merged', () => {
      toast.success(t('columnAdjacency.merged'));
    }),

    // ADR-459 Φ4d — «Αυτόματος Οπλισμός»: N μέλη οπλίστηκαν (auto-apply command).
    // count=0 → κανένα χρειαζόταν (όλα ήδη οπλισμένα). Non-blocking feedback.
    EventBus.on('bim:structural-auto-reinforced', ({ count }) => {
      toast.info(t('structuralOrganism.autoReinforced', { count }));
    }),

    // ADR-503 Slice 2 — η χειροκίνητη διατομή κολώνας ήταν υποδιαστασιολογημένη: το lock
    // μπλοκαρίστηκε, το σύστημα κράτησε την ελάχιστη επαρκή. Stable `id` ⇒ ένα toast κατά το
    // συνεχές section-grip drag (μηδέν storm), όχι ένα ανά frame.
    EventBus.on('bim:column-section-rejected', ({ w, d, minW, minD }) => {
      toast.warning(t('structuralOrganism.columnSectionRejected', { w, d, minW, minD }), {
        id: 'column-section-rejected',
      });
    }),

    // ADR-464 Slice 4 — «Υπολογισμός Φορτίων»: N πέδιλα έλαβαν tributary φορτίο.
    // count=0 → καμία πηγή (χωρίς κολώνες σε πέδιλα / ορόφους) → οδηγία διάγνωσης.
    EventBus.on('bim:structural-loads-computed', ({ count }) => {
      if (count > 0) toast.success(t('structuralOrganism.loadsComputed', { count }));
      else toast.info(t('structuralOrganism.loadsComputedEmpty'));
    }),

    // ADR-401 Phase G.3 — stair attach (ADR-450 §3 Boy-Scout: stair-specific copy,
    // same latent «Οι τοίχοι» mismatch as columns).
    EventBus.on('bim:stairs-auto-attached', () => {
      toast.info(t('attachToStructural.autoAttachedStairs'));
    }),
    EventBus.on('bim:stairs-auto-attached-base', () => {
      toast.info(t('attachToStructural.autoAttachedStairs'));
    }),
    EventBus.on('bim:stairs-attached-manual', () => {
      toast.info(t('attachToStructural.attachedManual'));
    }),
    EventBus.on('bim:stairs-detached', () => {
      toast.info(t('attachToStructural.detached'));
    }),
  ];
}
