/**
 * useDxfViewerNotifications — surfaces decoupled DXF-viewer engine events as
 * transient toasts, so commands/tools stay UI-agnostic (they emit on the
 * EventBus, this hook renders the user-facing toast). Mounted once by the
 * viewer shell.
 *
 * The per-domain toast registrars live under `hooks/notifications/*` (Google
 * file-size SSoT, N.7.1) — this hook only composes them inside one effect and
 * owns the EventBus-unsubscribe cleanup.
 *
 * @see systems/events/EventBus.ts — the decoupled pub/sub contract
 * @see hooks/notifications/ — the per-domain registrars
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { registerStructuralAttachNotifications } from './notifications/structural-attach-notifications';
import { registerGridBuildNotifications } from './notifications/grid-build-notifications';
import { registerPerimeterBuildNotifications } from './notifications/perimeter-build-notifications';
import { registerMepCircuitNotifications } from './notifications/mep-circuit-notifications';
import { registerMepAutoDesignNotifications } from './notifications/mep-autodesign-notifications';
import { registerPrintFidelityNotifications } from './notifications/print-fidelity-notifications';

export function useDxfViewerNotifications(): void {
  const { t } = useTranslation('dxf-viewer-shell');

  useEffect(() => {
    const unsubs: Array<() => void> = [
      ...registerStructuralAttachNotifications(t),
      ...registerGridBuildNotifications(t),
      ...registerPerimeterBuildNotifications(t),
      ...registerMepCircuitNotifications(t),
      ...registerMepAutoDesignNotifications(t),
      ...registerPrintFidelityNotifications(t),
    ];

    return () => unsubs.forEach((u) => u());
  }, [t]);
}
