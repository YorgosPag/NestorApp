/**
 * mep-circuit-notifications — ADR-408.
 *
 * Toast registrars for MEP circuit + pipe-network create/manage/derive feedback.
 * Extracted from `useDxfViewerNotifications` (Google file-size SSoT, N.7.1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-circuits-networks.md
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';

/** ADR-408 Φ5/Φ6 — electrical circuit create + member-management feedback. */
function registerCircuitToasts(t: TFunction): Array<() => void> {
  return [
    EventBus.on('bim:mep-circuit-created', ({ memberCount }) => {
      toast.success(t('mepCircuit.created', { count: memberCount }));
    }),
    EventBus.on('bim:mep-circuit-create-failed', ({ reason }) => {
      toast.warning(t(`mepCircuit.failed.${reason}`));
    }),
    EventBus.on('bim:mep-circuit-members-added', ({ memberCount }) => {
      toast.success(t('mepCircuit.membersAdded', { count: memberCount }));
    }),
    EventBus.on('bim:mep-circuit-members-removed', ({ memberCount }) => {
      toast.success(t('mepCircuit.membersRemoved', { count: memberCount }));
    }),
    EventBus.on('bim:mep-circuit-edit-failed', ({ reason }) => {
      toast.warning(t(`mepCircuit.${reason}`));
    }),
  ];
}

/** ADR-408 Φ10/Φ13 — pipe-network derive + from-manifold create/manage feedback. */
function registerPipeNetworkToasts(t: TFunction): Array<() => void> {
  return [
    EventBus.on('bim:mep-networks-derived', ({ networkCount }) => {
      toast.success(t('mepCircuit.networksDerived', { count: networkCount }));
    }),
    EventBus.on('bim:mep-network-created', ({ memberCount }) => {
      toast.success(t('mepPipeNetwork.created', { count: memberCount }));
    }),
    EventBus.on('bim:mep-network-create-failed', ({ reason }) => {
      toast.warning(t(`mepPipeNetwork.failed.${reason}`));
    }),
    EventBus.on('bim:mep-network-members-added', ({ memberCount }) => {
      toast.success(t('mepPipeNetwork.membersAdded', { count: memberCount }));
    }),
    EventBus.on('bim:mep-network-members-removed', ({ memberCount }) => {
      toast.success(t('mepPipeNetwork.membersRemoved', { count: memberCount }));
    }),
    EventBus.on('bim:mep-network-edit-failed', ({ reason }) => {
      toast.warning(t(`mepPipeNetwork.${reason}`));
    }),
  ];
}

/** All ADR-408 circuit + pipe-network toasts. */
export function registerMepCircuitNotifications(t: TFunction): Array<() => void> {
  return [
    ...registerCircuitToasts(t),
    ...registerPipeNetworkToasts(t),
  ];
}
