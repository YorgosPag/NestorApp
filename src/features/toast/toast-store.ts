"use client";

import type { Toast } from "@/types/toast";
import { TOAST_LIMIT, TOAST_REMOVE_DELAY } from "@/constants/toast";

// --- State & Types ---

type ActionType = 'ADD_TOAST' | 'UPDATE_TOAST' | 'DISMISS_TOAST' | 'REMOVE_TOAST' | 'REMOVE_ALL_TOASTS';

type Action =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'UPDATE_TOAST'; toast: Partial<Toast> }
  | { type: 'DISMISS_TOAST'; toastId?: Toast['id'] }
  | { type: 'REMOVE_TOAST'; toastId?: Toast['id'] }
  | { type: 'REMOVE_ALL_TOASTS' };

interface State {
  toasts: Toast[];
}

// --- Singleton Store ---

export const listeners: Array<(state: State) => void> = [];
export let memoryState: State = { toasts: [] };

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimeoutFor(id: string) {
  const t = toastTimeouts.get(id);
  if (t) {
    clearTimeout(t);
    toastTimeouts.delete(id);
  }
}

function addToRemoveQueue(id: string) {
  if (toastTimeouts.has(id)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(id);
    dispatch({ type: 'REMOVE_TOAST', toastId: id });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(id, timeout);
}

function trimToLimit(toasts: Toast[]): Toast[] {
  if (toasts.length <= TOAST_LIMIT) return toasts;
  const trimmed = toasts.slice(0, TOAST_LIMIT);
  const dropped = toasts.slice(TOAST_LIMIT);
  dropped.forEach(t => clearTimeoutFor(t.id)); // avoid orphan timeouts
  return trimmed;
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST': {
      const next = [action.toast, ...state.toasts];
      return { ...state, toasts: trimToLimit(next) };
    }
    case 'UPDATE_TOAST': {
      if (!action.toast.id) return state; // guard
      return {
        ...state,
        toasts: state.toasts.map(t => t.id === action.toast.id ? { ...t, ...action.toast } : t),
      };
    }
    case 'DISMISS_TOAST': {
      if (action.toastId) {
        addToRemoveQueue(action.toastId);
      } else {
        state.toasts.forEach(t => addToRemoveQueue(t.id));
      }
      return {
        ...state,
        toasts: state.toasts.map(t =>
          action.toastId === undefined || t.id === action.toastId ? { ...t, open: false } : t
        ),
      };
    }
    case 'REMOVE_TOAST': {
      if (action.toastId) clearTimeoutFor(action.toastId);
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.toastId) };
    }
    case 'REMOVE_ALL_TOASTS': {
      // clear existing timeouts, then schedule removals uniformly
      state.toasts.forEach(t => clearTimeoutFor(t.id));
      state.toasts.forEach(t => addToRemoveQueue(t.id));
      return {
        ...state,
        toasts: state.toasts.map(t => ({ ...t, open: false })),
      };
    }
    default:
      return state;
  }
};

export function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

// Optional reset function for testing or full cleanup on unmounts
export function resetStore() {
    toastTimeouts.forEach(clearTimeout);
    toastTimeouts.clear();
    listeners.length = 0;
    memoryState = { toasts: [] };
}
