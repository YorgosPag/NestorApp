/**
 * @file useUserSettingsRepoSync — Cross-device Firestore sync for SettingsState
 * @module settings-provider/storage/useUserSettingsRepoSync
 *
 * 🏢 ADR-XXX UserSettings SSoT — Firestore-backed industry pattern
 *
 * Sits alongside `useStorageLoad` / `useStorageSave` (which keep persisting to
 * IndexedDB / localStorage as fast local cache). This hook adds the server-side
 * leg: it binds the singleton `userSettingsRepository` once auth resolves and
 * keeps the provider's `SettingsState` in sync with the
 * `dxfViewer.dxfSettings` slice of the user's Firestore preferences doc.
 *
 * Behavior:
 *  - On bind: subscribe to the slice. If the remote doc has a value, dispatch
 *    LOAD_SUCCESS so the provider state mirrors Firestore (the local IndexedDB
 *    snapshot is overridden). If the remote doc is empty (first session),
 *    push the current local `SettingsState` upstream so the doc materializes
 *    with the user's existing preferences.
 *  - On state change: write to repository (the repository handles debounce +
 *    schema validation + audit). Skipped during hydration to avoid feedback.
 *
 * @author Γιώργος Παγώνης + Claude Opus 4.7
 * @since 2026-05-08
 */

import { useEffect, useRef } from 'react';
import { userSettingsRepository } from '@/services/user-settings';
import type { SettingsState } from '../../settings/core/types';

interface UseUserSettingsRepoSyncParams {
  userId: string | null;
  companyId: string | null;
  enabled: boolean;
  isLoaded: boolean;
  settings: SettingsState;
  onRemoteHydrate: (settings: SettingsState) => void;
}

export function useUserSettingsRepoSync(params: UseUserSettingsRepoSyncParams): void {
  const { userId, companyId, enabled, isLoaded, settings, onRemoteHydrate } = params;
  const isHydratingRef = useRef(false);
  const onHydrateRef = useRef(onRemoteHydrate);
  onHydrateRef.current = onRemoteHydrate;

  // ── Bind repository on auth ready + subscribe to slice ─────────────────
  useEffect(() => {
    if (!enabled || !userId || !companyId) return;

    userSettingsRepository.bind(userId, companyId);

    let firstSnapshot = true;
    const unsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.dxfSettings',
      (remote) => {
        if (remote) {
          // Remote (or own debounced write echo) → hydrate local without
          // re-firing the upstream save.
          isHydratingRef.current = true;
          onHydrateRef.current(remote as unknown as SettingsState);
          // Reset the flag in a microtask so the same render pass that
          // applied the hydration doesn't trigger an outbound write.
          queueMicrotask(() => {
            isHydratingRef.current = false;
          });
        } else if (firstSnapshot && isLoaded) {
          // First session for this (user, tenant) — push the current local
          // settings up so the Firestore doc materializes with the user's
          // existing preferences (carried over from IndexedDB).
          userSettingsRepository.updateSlice(
            'dxfViewer.dxfSettings',
            settings as unknown as never,
          );
        }
        firstSnapshot = false;
      },
    );

    return () => {
      unsubscribe();
    };
    // We intentionally do NOT depend on `settings` here — the slice subscriber
    // re-runs on remote change, not on every local edit. The local→remote
    // mirror is handled by the second useEffect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, companyId, isLoaded]);

  // ── Mirror local state changes upstream (debounced by the repository) ──
  useEffect(() => {
    if (!enabled || !userId || !companyId || !isLoaded) return;
    if (isHydratingRef.current) return;
    userSettingsRepository.updateSlice(
      'dxfViewer.dxfSettings',
      settings as unknown as never,
    );
  }, [enabled, userId, companyId, isLoaded, settings]);
}
