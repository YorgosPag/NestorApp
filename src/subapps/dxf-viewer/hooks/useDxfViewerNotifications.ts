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

    return () => unsubs.forEach((u) => u());
  }, [t]);
}
