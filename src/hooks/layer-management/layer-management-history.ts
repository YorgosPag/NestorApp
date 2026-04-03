import { generateHistoryId } from '@/services/enterprise-id.service';
import type { LayerHistoryEntry, LayerState } from '@/types/layers';

export type LayerHistoryInput = Omit<LayerHistoryEntry, 'id' | 'timestamp'>;

export function appendHistoryEntry(state: LayerState, entry: LayerHistoryInput): LayerState {
  const historyEntry: LayerHistoryEntry = {
    ...entry,
    id: generateHistoryId(),
    timestamp: new Date().toISOString()
  };

  const nextHistory = state.history.slice(0, state.historyIndex + 1);
  nextHistory.push(historyEntry);

  if (nextHistory.length > state.maxHistorySize) {
    nextHistory.shift();
  }

  return {
    ...state,
    history: nextHistory,
    historyIndex: nextHistory.length - 1
  };
}

export function clearHistoryState(state: LayerState): LayerState {
  return {
    ...state,
    history: [],
    historyIndex: -1
  };
}
