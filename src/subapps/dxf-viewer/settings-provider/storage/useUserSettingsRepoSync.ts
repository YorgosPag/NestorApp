/**
 * @file useUserSettingsRepoSync — Cross-device Firestore sync for SettingsState
 * @module settings-provider/storage/useUserSettingsRepoSync
 *
 * 🏢 ADR-341 UserSettings SSoT — Firestore-backed industry pattern
 *
 * Sits alongside `useStorageLoad` / `useStorageSave` (which keep persisting to
 * IndexedDB / localStorage as fast local cache). This hook adds the server-side
 * leg: it binds the singleton `userSettingsRepository` once auth resolves and
 * keeps the provider's `SettingsState` in sync with the
 * `dxfViewer.dxfSettings` slice of the user's Firestore preferences doc.
 *
 * Echo-loop prevention: tracks `lastWrittenHashRef` and skips listener
 * callbacks whose payload matches the last value we wrote. Without this guard,
 * the optimistic notification inside `updateSlice` would feed the writer's own
 * value back into the reducer and re-trigger the mirror effect → infinite loop.
 *
 * @author Γιώργος Παγώνης + Claude Opus 4.7
 * @since 2026-05-08
 */

import { useEffect, useRef } from 'react';
import { userSettingsRepository, stableHash } from '@/services/user-settings';
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
  const onHydrateRef = useRef(onRemoteHydrate);
  onHydrateRef.current = onRemoteHydrate;

  const lastWrittenHashRef = useRef<string>('');
  const settingsRef = useRef<SettingsState>(settings);
  settingsRef.current = settings;

  // ── Bind repository on auth ready + subscribe to slice ─────────────────
  useEffect(() => {
    if (!enabled || !userId || !companyId) return;

    userSettingsRepository.bind(userId, companyId);

    let firstSnapshot = true;
    const unsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.dxfSettings',
      (remote) => {
        if (remote) {
          const remoteHash = stableHash(remote);
          // Skip our own echo (synchronous optimistic notification or
          // Firestore round-trip of the value we just wrote).
          if (remoteHash === lastWrittenHashRef.current) return;
          lastWrittenHashRef.current = remoteHash;
          onHydrateRef.current(remote as unknown as SettingsState);
        } else if (firstSnapshot && isLoaded) {
          // First session — push current local settings upstream so the doc
          // materializes with the user's existing preferences.
          const initialHash = stableHash(settingsRef.current);
          lastWrittenHashRef.current = initialHash;
          userSettingsRepository.updateSlice(
            'dxfViewer.dxfSettings',
            settingsRef.current as unknown as never,
          );
        }
        firstSnapshot = false;
      },
    );

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, companyId, isLoaded]);

  // ── Mirror local state changes upstream (debounced by the repository) ──
  useEffect(() => {
    if (!enabled || !userId || !companyId || !isLoaded) return;
    const settingsHash = stableHash(settings);
    if (settingsHash === lastWrittenHashRef.current) return; // unchanged
    lastWrittenHashRef.current = settingsHash;
    userSettingsRepository.updateSlice(
      'dxfViewer.dxfSettings',
      settings as unknown as never,
    );
  }, [enabled, userId, companyId, isLoaded, settings]);
}
