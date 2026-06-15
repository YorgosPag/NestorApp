/**
 * useModalPresence — React subscription to the modal-presence SSoT.
 *
 * Replaces the per-component `MutationObserver` + `querySelectorAll` modal
 * detection that fired on every mouse move (see {@link ModalPresenceStore}).
 *
 * @module systems/modal/useModalPresence
 */

import { useSyncExternalStore } from 'react';
import { subscribeModalPresence, getIsModalOpen } from './ModalPresenceStore';

/** True while any modal/dialog overlay is open. Re-renders only on open/close. */
export function useModalPresence(): boolean {
  return useSyncExternalStore(subscribeModalPresence, getIsModalOpen, () => false);
}
