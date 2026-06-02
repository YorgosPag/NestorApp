/**
 * useDxfViewerNotifications — surfaces decoupled DXF-viewer engine events as
 * transient toasts, so commands/tools stay UI-agnostic (they emit on the
 * EventBus, this hook renders the user-facing toast). Mounted once by the
 * viewer shell.
 *
 * @see systems/events/EventBus.ts — the decoupled pub/sub contract
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EventBus } from '../systems/events/EventBus';

export function useDxfViewerNotifications(): void {
  const { t } = useTranslation('dxf-viewer-shell');

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // ADR-401 Phase C — a deleted structural host left ≥1 attached wall without
    // its top support. The wall already falls back to baseline geometry; warn
    // the user (Revit "Top Constraint no longer valid"), non-blocking.
    unsubs.push(
      EventBus.on('bim:wall-attach-host-missing', () => {
        toast.warning(t('attachToStructural.hostMissing'));
      }),
    );

    // ADR-401 Phase D — walls auto-attached their top to a just-created beam/slab
    // placed over them. Non-blocking confirmation (Revit auto-attach feedback).
    unsubs.push(
      EventBus.on('bim:walls-auto-attached', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );

    // ADR-363 «Τοίχος από περίγραμμα» — summary feedback after a box-select build.
    unsubs.push(
      EventBus.on('bim:walls-from-perimeter', ({ built, ignored }) => {
        if (built === 0) {
          toast.warning(t('perimeterWall.noneBuilt'));
        } else if (ignored > 0) {
          toast.info(t('perimeterWall.builtWithIgnored', { built, ignored }));
        } else {
          toast.success(t('perimeterWall.built', { built }));
        }
      }),
    );

    // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — summary feedback (ΕΝΑ τοιχίο/περίμετρο).
    unsubs.push(
      EventBus.on('bim:columns-from-perimeter', ({ built, ignored }) => {
        if (built === 0) {
          toast.warning(t('perimeterColumn.noneBuilt'));
        } else if (ignored > 0) {
          toast.info(t('perimeterColumn.builtWithIgnored', { built, ignored }));
        } else {
          toast.success(t('perimeterColumn.built', { built }));
        }
      }),
    );

    // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — breakdown feedback (κολώνες/τοιχία).
    unsubs.push(
      EventBus.on('bim:columns-discrete-from-perimeter', ({ columns, walls }) => {
        if (columns === 0 && walls === 0) {
          toast.warning(t('perimeterColumnDiscrete.noneBuilt'));
        } else if (walls > 0) {
          // Plural-correct σύνθετο μήνυμα (i18next _one/_other ανά αριθμό).
          const columnsText = t('perimeterColumnDiscrete.nColumns', { count: columns });
          const wallsText = t('perimeterColumnDiscrete.nWalls', { count: walls });
          toast.info(t('perimeterColumnDiscrete.builtMixed', { columns: columnsText, walls: wallsText }));
        } else {
          toast.success(t('perimeterColumnDiscrete.built', { count: columns }));
        }
      }),
    );

    // ADR-401 Phase E.1 — manual attach/detach from the contextual wall ribbon.
    unsubs.push(
      EventBus.on('bim:walls-attached-manual', () => {
        toast.info(t('attachToStructural.attachedManual'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:walls-detached', () => {
        toast.info(t('attachToStructural.detached'));
      }),
    );

    // ADR-401 Phase F.3 — column attach mirrors (reuse the generic messages).
    unsubs.push(
      EventBus.on('bim:columns-auto-attached', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:columns-auto-attached-base', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:columns-attached-manual', () => {
        toast.info(t('attachToStructural.attachedManual'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:columns-detached', () => {
        toast.info(t('attachToStructural.detached'));
      }),
    );

    // ADR-408 Φ5 — circuit creation feedback (create-from-selection ribbon).
    unsubs.push(
      EventBus.on('bim:mep-circuit-created', ({ memberCount }) => {
        toast.success(t('mepCircuit.created', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-circuit-create-failed', ({ reason }) => {
        toast.warning(t(`mepCircuit.failed.${reason}`));
      }),
    );

    // ADR-408 Φ6 — circuit member-management feedback (properties panel).
    unsubs.push(
      EventBus.on('bim:mep-circuit-members-added', ({ memberCount }) => {
        toast.success(t('mepCircuit.membersAdded', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-circuit-members-removed', ({ memberCount }) => {
        toast.success(t('mepCircuit.membersRemoved', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-circuit-edit-failed', ({ reason }) => {
        toast.warning(t(`mepCircuit.${reason}`));
      }),
    );

    // ADR-401 Phase G.3 — stair attach mirrors (reuse the generic messages).
    unsubs.push(
      EventBus.on('bim:stairs-auto-attached', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:stairs-auto-attached-base', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:stairs-attached-manual', () => {
        toast.info(t('attachToStructural.attachedManual'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:stairs-detached', () => {
        toast.info(t('attachToStructural.detached'));
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, [t]);
}
