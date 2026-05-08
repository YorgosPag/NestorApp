/**
 * @file useUserSettingsRulersGridSync — Firestore mirror for rulers+grid state
 * @module systems/rulers-grid/useUserSettingsRulersGridSync
 *
 * 🏢 ADR-341 UserSettings SSoT — Firestore-backed industry pattern.
 *
 * Sits alongside the localStorage persistence effect in `RulersGridSystem`.
 * Pushes rulers/grid/origin/isVisible into the user's preferences slice on
 * every change, and pulls remote updates back into local state for cross-device
 * sync. Local storage remains as instant boot cache.
 *
 * Echo-loop guard: `lastWrittenHashRef` tracks the value we last wrote and
 * skips listener callbacks (sync echo + Firestore round-trip) that match it.
 *
 * @author Γιώργος Παγώνης + Claude Opus 4.7
 * @since 2026-05-08
 */

import { useEffect, useRef } from 'react';
import { userSettingsRepository, stableHash } from '@/services/user-settings';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { Point2D } from '../../rendering/types/Types';
import type { GridSettings, RulerSettings } from './config';
import { migrateAdaptiveFadeDefaults } from './rulers-grid-state-init';

interface RulersGridBlob {
  rulers?: RulerSettings;
  grid?: GridSettings;
  origin?: Point2D;
  isVisible?: boolean;
}

interface UseRulersGridSyncParams {
  enabled: boolean;
  rulers: RulerSettings;
  grid: GridSettings;
  origin: Point2D;
  isVisible: boolean;
  setRulers: React.Dispatch<React.SetStateAction<RulerSettings>>;
  setGrid: React.Dispatch<React.SetStateAction<GridSettings>>;
  setOriginState: React.Dispatch<React.SetStateAction<Point2D>>;
  setIsVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useUserSettingsRulersGridSync(
  params: UseRulersGridSyncParams,
): void {
  const {
    enabled,
    rulers,
    grid,
    origin,
    isVisible,
    setRulers,
    setGrid,
    setOriginState,
    setIsVisible,
  } = params;

  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const companyId = user?.companyId ?? null;

  const lastWrittenHashRef = useRef<string>('');
  const localRef = useRef<RulersGridBlob>({ rulers, grid, origin, isVisible });
  localRef.current = { rulers, grid, origin, isVisible };

  // ── Bind repo + subscribe slice ────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !userId || !companyId) return;

    userSettingsRepository.bind(userId, companyId);

    let firstSnapshot = true;
    const unsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.rulersGrid',
      (remote) => {
        const blob = remote as RulersGridBlob | undefined;
        if (blob && (blob.rulers || blob.grid || blob.origin || typeof blob.isVisible === 'boolean')) {
          const remoteHash = stableHash(blob);
          if (remoteHash === lastWrittenHashRef.current) return; // own echo
          lastWrittenHashRef.current = remoteHash;
          if (blob.rulers) setRulers(blob.rulers);
          if (blob.grid) setGrid(migrateAdaptiveFadeDefaults(blob.grid));
          if (blob.origin) setOriginState(blob.origin);
          if (typeof blob.isVisible === 'boolean') setIsVisible(blob.isVisible);
        } else if (firstSnapshot) {
          const init = localRef.current;
          lastWrittenHashRef.current = stableHash(init);
          userSettingsRepository.updateSlice(
            'dxfViewer.rulersGrid',
            init as unknown as never,
          );
        }
        firstSnapshot = false;
      },
    );

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, companyId]);

  // ── Mirror local changes upstream (debounced by repository) ────────────
  useEffect(() => {
    if (!enabled || !userId || !companyId) return;
    const blob: RulersGridBlob = { rulers, grid, origin, isVisible };
    const blobHash = stableHash(blob);
    if (blobHash === lastWrittenHashRef.current) return;
    lastWrittenHashRef.current = blobHash;
    userSettingsRepository.updateSlice('dxfViewer.rulersGrid', blob as unknown as never);
  }, [enabled, userId, companyId, rulers, grid, origin, isVisible]);
}
