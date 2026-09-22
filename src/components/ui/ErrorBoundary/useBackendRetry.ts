'use client';

/**
 * **Αυτόματη επανάληψη με αντίστροφη μέτρηση** — το ιδίωμα του Gmail («Νέα δοκιμή σε 5″
 * · Δοκιμή τώρα») για σελίδα που ο server δεν μπόρεσε να αποδώσει επειδή δεν απάντησε
 * το backend (`BackendUnavailableError`, `lib/errors/backend-unavailable.ts`).
 *
 * 🔑 **Χωρίς σύνδεση ΔΕΝ μετράμε**: μια επαναφόρτωση offline είναι βέβαιη αποτυχία που
 * καίει προσπάθεια. Περιμένουμε το `online` και ξαναδοκιμάζουμε **αμέσως**.
 *
 * @module components/ui/ErrorBoundary/useBackendRetry
 */

import { useCallback, useEffect, useState } from 'react';

import { readAttempt, recordAttempt, secondsUntilRetry, type AttemptStore } from './backend-retry-schedule';

export type BackendRetryState =
  | { readonly phase: 'waiting'; readonly secondsLeft: number }
  | { readonly phase: 'retrying' }
  | { readonly phase: 'offline' }
  | { readonly phase: 'exhausted' };

function sessionStore(): AttemptStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function initialState(): BackendRetryState {
  // Τα error boundaries αποδίδονται στον πελάτη· ο φρουρός είναι για κάθε ενδεχόμενο SSR.
  if (typeof window === 'undefined') return { phase: 'retrying' };
  if (!navigator.onLine) return { phase: 'offline' };
  const seconds = secondsUntilRetry(readAttempt(sessionStore(), window.location.pathname, Date.now()));
  return seconds === null ? { phase: 'exhausted' } : { phase: 'waiting', secondsLeft: seconds };
}

/** Ξαναφορτώνει τη σελίδα, αφού καταγράψει την προσπάθεια. `manual` ⇒ δεν μετρά στο όριο. */
function reloadNow(manual: boolean): void {
  const path = window.location.pathname;
  const store = sessionStore();
  const attempt = readAttempt(store, path, Date.now());
  recordAttempt(store, path, manual ? attempt : attempt + 1, Date.now());
  window.location.reload();
}

export function useBackendRetry(): { readonly state: BackendRetryState; readonly retryNow: () => void } {
  const [state, setState] = useState<BackendRetryState>(initialState);

  const retryNow = useCallback(() => {
    setState({ phase: 'retrying' });
    reloadNow(true);
  }, []);

  useEffect(() => {
    const onOnline = (): void => {
      setState({ phase: 'retrying' });
      reloadNow(false);
    };
    const onOffline = (): void => setState({ phase: 'offline' });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (state.phase !== 'waiting') return undefined;
    if (state.secondsLeft <= 0) {
      setState({ phase: 'retrying' });
      reloadNow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setState({ phase: 'waiting', secondsLeft: state.secondsLeft - 1 }), 1000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return { state, retryNow };
}
