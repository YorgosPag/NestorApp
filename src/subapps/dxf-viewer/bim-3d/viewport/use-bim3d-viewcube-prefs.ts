import { useEffect, useCallback, useState, type RefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { Bim3DPreferencesService } from '../services/Bim3DPreferencesService';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';

export interface ViewCubePrefsApi {
  compassVisible: boolean;
  contextMenuPos: { x: number; y: number } | null;
  setContextMenuPos: (pos: { x: number; y: number } | null) => void;
  handleToggleCompass: () => void;
}

/**
 * ADR-366 Phase 4.3 / C.5 — ViewCube compass + accessibility preferences (extracted hook, N.7.1).
 * Owns the compass-visibility + context-menu-anchor state, loads persisted prefs on user mount,
 * wires the ViewCube context-menu callback + compass state into the manager on 3D activation,
 * and exposes an optimistic compass toggle with Firestore persistence.
 */
export function useBim3DViewCubePrefs(
  managerRef: RefObject<ThreeJsSceneManager | null>,
  userUid: string | undefined,
  effectiveVisible: boolean,
): ViewCubePrefsApi {
  const [compassVisible, setCompassVisible] = useState(true);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Phase 4.3 + C.5: load persisted preferences (ViewCube + accessibility) on user mount.
  useEffect(() => {
    if (!userUid) return;
    Bim3DPreferencesService.load(userUid).then((prefs) => {
      if (!prefs) return;
      setCompassVisible(prefs.compassRingVisible);
      if (prefs.accessibility) {
        const a = prefs.accessibility;
        const store = useViewMode3DStore.getState();
        store.setAnnouncementsEnabled(a.announcementsEnabled);
        store.setAccessibilityReducedMotion(a.reducedMotion);
        store.setAccessibilityEntityNavOrder(a.entityNavOrder);
        managerRef.current?.setReducedMotionOverride(a.reducedMotion);
      }
    }).catch(() => { /* silently ignore — defaults apply */ });
  }, [userUid, managerRef]);

  // Phase 4.3: wire context menu callback + initial compass state into manager on 3D activation.
  // Also re-applies when compassVisible changes so prefs loaded async before 3D opens take effect.
  useEffect(() => {
    managerRef.current?.setViewCubeContextMenuCallback((x, y) => setContextMenuPos({ x, y }));
    managerRef.current?.setViewCubeCompassVisible(compassVisible);
  }, [effectiveVisible, compassVisible, managerRef]);

  // Phase 4.3: compass ring toggle — optimistic update + Firestore persistence.
  const handleToggleCompass = useCallback(() => {
    const next = !compassVisible;
    setCompassVisible(next);
    setContextMenuPos(null);
    if (userUid) {
      Bim3DPreferencesService.save(userUid, { compassRingVisible: next }).catch(() => {
        setCompassVisible(!next); // On save failure revert optimistic update.
      });
    }
  }, [compassVisible, userUid]);

  return { compassVisible, contextMenuPos, setContextMenuPos, handleToggleCompass };
}
