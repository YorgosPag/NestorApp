/**
 * regression-alert-bus — ADR-366 §C.7.Q5
 *
 * Module-level pubsub bridging the non-React PerformanceCollector
 * to the React PerformanceRegressionNotifier (which has i18n + toast access).
 *
 * Pattern mirrors aria-live-bus.
 */

import type { RegressionAlertPayload } from './regression-detector';

type Listener = (payload: RegressionAlertPayload) => void;

const listeners = new Set<Listener>();

export const regressionAlertBus = {
  emit(payload: RegressionAlertPayload): void {
    listeners.forEach((l) => l(payload));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  _resetForTests(): void {
    listeners.clear();
  },
};
