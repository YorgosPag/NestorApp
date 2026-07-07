/**
 * SnapContext
 * React Context για διαχείριση snap state και αποτελεσμάτων
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 3: Αποθήκευση στο Context
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ExtendedSnapType } from '../extended-types';
import { resolvePersistedSnapState } from './snap-state-persistence';
import { userSettingsRepository, stableHash } from '@/services/user-settings';
import type { CadTogglesSettingsSlice } from '@/services/user-settings/user-settings-schema';
import { useAuth } from '@/auth/contexts/AuthContext';

// ✅ ENTERPRISE FIX: Define SnapState locally since ../types doesn't exist
type SnapState = Record<ExtendedSnapType, boolean>;

// ALL_MODES array για αποφυγή enum-to-string issues
const ALL_MODES: ExtendedSnapType[] = [
  ExtendedSnapType.ENDPOINT,
  ExtendedSnapType.MIDPOINT,
  ExtendedSnapType.CENTER,
  ExtendedSnapType.INTERSECTION,
  ExtendedSnapType.PERPENDICULAR,
  ExtendedSnapType.TANGENT,
  ExtendedSnapType.QUADRANT,
  ExtendedSnapType.NEAREST,
  ExtendedSnapType.EXTENSION,
  ExtendedSnapType.NODE,
  ExtendedSnapType.INSERTION,
  ExtendedSnapType.NEAR,
  ExtendedSnapType.PARALLEL,
  ExtendedSnapType.ORTHO_TRACK,
  ExtendedSnapType.GRID,
  ExtendedSnapType.GUIDE,               // ADR-189: Construction guide snap
  ExtendedSnapType.CONSTRUCTION_POINT,   // ADR-189: Construction snap points
  ExtendedSnapType.AUTO,
  // ADR-362: Dimension snap types
  ExtendedSnapType.DIM_DEF_POINT,
  ExtendedSnapType.DIM_LINE,
  // ADR-378: Text snap (insertion + 4 corners + center + edge mids — coincide with the
  // text grips). The engine was registered but TEXT was missing here, so it could never
  // enter `enabledModes` → no text snap markers for ANY user (Giorgio 2026-07-07).
  ExtendedSnapType.TEXT,
  // ADR-408 Φ9: MEP connector attach-point snap
  ExtendedSnapType.BIM_MEP_CONNECTOR,
  // NOTE: ROTATION_PIVOT / ROTATION_GRIP (ADR-397) and BIM_CORNER / BIM_MIDPOINT /
  // BIM_CENTER (ADR-370) are intentionally NOT in ALL_MODES — they are always-on
  // structural snaps force-enabled with the global OSNAP toggle (see `enabledModes`
  // below), so they bypass per-mode persistence and CANNOT silently vanish for existing
  // users when a new snap id ships (Revit treats structural snaps as always available).
];

// ADR-370 — the generic BIM characteristic-point snaps (BIM_CORNER / BIM_MIDPOINT /
// BIM_CENTER) are always-on: force-enabled in `enabledModes` with the OSNAP toggle, NOT
// persisted per-mode. This is the rotation-snap pattern (ADR-397) and the definitive fix
// for "structural snaps vanish for existing users" — a stored blob can never disable a
// snap id it predates, because these ids are never read from / written to the blob.
const ALWAYS_ON_BIM_SNAPS = [
  ExtendedSnapType.BIM_CORNER, ExtendedSnapType.BIM_MIDPOINT, ExtendedSnapType.BIM_CENTER,
];

// SSoT default snap state — matches DEFAULT_PRO_SNAP_SETTINGS.enabledTypes. Owned here so
// BOTH the initial useState AND the migration-safe load merge read the SAME source: a snap
// id shipped after a persisted blob was written falls back to its default (never silently
// off). ADR-378 — fixes DIM_DEF_POINT/DIM_LINE (ADR-362) vanishing for pre-existing users.
const DEFAULT_ENABLED_SNAPS = new Set<ExtendedSnapType>([
  ExtendedSnapType.ENDPOINT,
  // ADR-510 Φ1 (Q3): full smart OSNAP set on by default. Still gated behind the global
  // OSNAP master toggle (off by default), so nothing snaps until enabled.
  ExtendedSnapType.MIDPOINT,
  ExtendedSnapType.CENTER,
  ExtendedSnapType.INTERSECTION,
  ExtendedSnapType.PERPENDICULAR,
  ExtendedSnapType.TANGENT,
  ExtendedSnapType.EXTENSION,
  ExtendedSnapType.GUIDE,
  ExtendedSnapType.CONSTRUCTION_POINT,
  ExtendedSnapType.GRID,
  ExtendedSnapType.DIM_DEF_POINT,   // ADR-362: dimension def-point snap (toggleable)
  ExtendedSnapType.DIM_LINE,        // ADR-362: dimension line snap (toggleable)
  ExtendedSnapType.TEXT,            // ADR-378: text snap (toggleable, on by default)
  ExtendedSnapType.BIM_MEP_CONNECTOR, // ADR-408 Φ9: enabled by default
  // ADR-370 BIM_CORNER/MIDPOINT/CENTER are always-on (force-enabled in enabledModes)
]);

const getDefaultSnapState = (): SnapState => {
  const state = {} as SnapState;
  ALL_MODES.forEach(type => { state[type] = DEFAULT_ENABLED_SNAPS.has(type); });
  return state;
};

interface SnapContextType {
  snapState: SnapState;
  toggleSnap: (type: ExtendedSnapType) => void;
  setSnapState: (state: SnapState) => void;
  isSnapActive: (type: ExtendedSnapType) => boolean;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  enabledModes: Set<ExtendedSnapType>;
  toggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  setExclusiveMode: (mode: ExtendedSnapType) => void;
  // 🚀 PERF (2026-02-21): currentSnapResult REMOVED from context.
  // Moved to ImmediateSnapStore (useSyncExternalStore) — only CanvasLayerStack subscribes.
  // This eliminates ~30fps re-renders for ALL other context consumers.
}

const SnapContext = createContext<SnapContextType | undefined>(undefined);

interface SnapProviderProps {
  children: ReactNode;
}

export const SnapProvider: React.FC<SnapProviderProps> = ({ children }) => {
  const [snapState, setSnapState] = useState<SnapState>(getDefaultSnapState);

  // 🏢 ENTERPRISE (2026-01-27): Snap disabled by default on app start/refresh
  // User requested snap to be OFF initially for better performance during exploration
  const [snapEnabled, setSnapEnabled] = useState<boolean>(false);

  const enabledModes = React.useMemo(() => {
    const modes = new Set<ExtendedSnapType>();
    if (snapEnabled) {
      ALL_MODES.forEach(mode => {
        if (snapState[mode]) {
          modes.add(mode);
        }
      });
      // ADR-397: rotation snap is CONTEXTUAL — it only ever produces candidates
      // while a rotation has armed the RotationSnapStore (empty otherwise → zero
      // cost). Force-enable it with the global OSNAP toggle so it works for every
      // user regardless of their stored per-mode preferences, and so it cannot be
      // accidentally turned off (it has no toolbar button).
      modes.add(ExtendedSnapType.ROTATION_PIVOT);
      modes.add(ExtendedSnapType.ROTATION_GRIP);
      // ADR-580: the SELECTED objects' grips snap is CONTEXTUAL like rotation — it only ever
      // produces candidates while `AllGripsStore` holds the selection's grips (empty otherwise →
      // zero cost). Force-enable it with the global OSNAP toggle so a selected entity's grip always
      // wins the attraction over an unselected entity beneath it, for every user, with no toolbar
      // button and no stored per-mode preference that could turn it off.
      modes.add(ExtendedSnapType.SELECTED_GRIP);
      // ADR-370: BIM characteristic-point snaps are always-on structural snaps (same
      // pattern) — force-enabled so they never depend on a stored per-mode preference.
      for (const t of ALWAYS_ON_BIM_SNAPS) modes.add(t);
    }
    return modes;
  }, [snapState, snapEnabled]);

  // 🚀 PERF: Stable callback references — prevents cascading re-renders in consumers
  const toggleSnap = useCallback((type: ExtendedSnapType) => {
    setSnapState(prev => {
      const wasActive = !!prev[type];

      if (wasActive) {
        const newState = { ...prev, [type]: false };
        const hasAnyActive = ALL_MODES.some(mode => newState[mode]);
        if (!hasAnyActive) {
          newState[ExtendedSnapType.ENDPOINT] = true;
        }
        return newState;
      } else {
        return { ...prev, [type]: true };
      }
    });
  }, []);

  const isSnapActive = useCallback((type: ExtendedSnapType) => {
    if (!snapEnabled) return false;
    return snapState[type] || false;
  }, [snapEnabled, snapState]);

  const toggleMode = useCallback((mode: ExtendedSnapType, enabled: boolean) => {
    if (enabled) {
      setSnapState(prev => ({ ...prev, [mode]: true }));
    } else {
      setSnapState(prev => {
        const newState = { ...prev, [mode]: false };
        const hasAnyActive = ALL_MODES.some(m => newState[m]);
        if (!hasAnyActive) {
          newState[ExtendedSnapType.ENDPOINT] = true;
        }
        return newState;
      });
    }
  }, []);

  const setExclusiveMode = useCallback((mode: ExtendedSnapType) => {
    setSnapState(() => {
      const next = {} as SnapState;
      ALL_MODES.forEach(m => {
        next[m] = (m === mode);
      });
      return next;
    });
  }, []);

  // 🏢 ADR-341 UserSettings SSoT — persist active snap modes + snapEnabled.
  // snapEnabled is synced with cadToggles.osnap (CadStatusBar OSNAP = canonical master toggle).
  // Echo-loop guard: lastWrittenHashRef tracks our last write so the
  // optimistic notification round-trip doesn't feed our value back.
  const { user } = useAuth();
  const snapUserId = user?.uid ?? null;
  const snapCompanyId = user?.companyId ?? null;
  const lastSnapHashRef = useRef<string>('');
  const snapStateRef = useRef(snapState);
  snapStateRef.current = snapState;

  useEffect(() => {
    if (!snapUserId || !snapCompanyId) return;
    userSettingsRepository.bind(snapUserId, snapCompanyId);
    let firstSnapshot = true;
    const unsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.snap',
      (remote) => {
        const blob = remote as { activeTypes?: string[]; knownTypes?: string[] } | undefined;
        if (blob?.activeTypes) {
          const remoteHash = stableHash(blob.activeTypes);
          if (remoteHash === lastSnapHashRef.current) return; // own echo
          lastSnapHashRef.current = remoteHash;
          // Migration-safe merge (ADR-378): unknown/newer ids fall back to their default so a
          // default-on snap (e.g. DIM_DEF_POINT/DIM_LINE, ADR-362) can't silently vanish for
          // users whose blob predates it. Toggleable preserved — no ALWAYS_ON promotion.
          setSnapState(() =>
            resolvePersistedSnapState(ALL_MODES, getDefaultSnapState(), blob.activeTypes!, blob.knownTypes),
          );
        } else if (firstSnapshot) {
          const activeTypes = ALL_MODES.filter(m => snapStateRef.current[m]);
          lastSnapHashRef.current = stableHash(activeTypes);
          // knownTypes = every mode this build knows about → future ids are distinguishable
          // from explicitly-off on the next load (see migration-safe merge above).
          userSettingsRepository.updateSlice('dxfViewer.snap', { activeTypes, knownTypes: ALL_MODES });
        }
        firstSnapshot = false;
      },
    );
    return () => { unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapUserId, snapCompanyId]);

  useEffect(() => {
    if (!snapUserId || !snapCompanyId) return;
    const activeTypes = ALL_MODES.filter(m => snapState[m]);
    const activeHash = stableHash(activeTypes);
    if (activeHash === lastSnapHashRef.current) return;
    lastSnapHashRef.current = activeHash;
    // Always persist knownTypes alongside — self-heals legacy blobs to the precise schema.
    userSettingsRepository.updateSlice('dxfViewer.snap', { activeTypes, knownTypes: ALL_MODES });
  }, [snapUserId, snapCompanyId, snapState]);

  // Sync snapEnabled ↔ cadToggles.osnap (CadStatusBar OSNAP = canonical SSoT)
  const lastCadTogglesRef = useRef<CadTogglesSettingsSlice | null>(null);
  const snapEnabledRef = useRef(snapEnabled);
  snapEnabledRef.current = snapEnabled;

  useEffect(() => {
    if (!snapUserId || !snapCompanyId) return;
    const unsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.cadToggles',
      (remote) => {
        if (!remote) return;
        lastCadTogglesRef.current = remote;
        if (remote.osnap !== snapEnabledRef.current) {
          setSnapEnabled(remote.osnap);
        }
      },
    );
    return () => { unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapUserId, snapCompanyId]);

  useEffect(() => {
    if (!snapUserId || !snapCompanyId) return;
    const current = lastCadTogglesRef.current;
    if (!current || current.osnap === snapEnabled) return;
    const updated = { ...current, osnap: snapEnabled };
    lastCadTogglesRef.current = updated;
    userSettingsRepository.updateSlice('dxfViewer.cadToggles', updated);
  }, [snapUserId, snapCompanyId, snapEnabled]);

  // 🚀 PERF: Stabilized context value — only changes when snap state/enabled actually change.
  // BEFORE: New object every render → consumers cascade re-render on every SnapProvider render.
  // AFTER: useMemo with correct deps → consumers only re-render when snap data changes.
  const contextValue = useMemo<SnapContextType>(() => ({
    snapState,
    toggleSnap,
    setSnapState,
    isSnapActive,
    snapEnabled,
    setSnapEnabled,
    enabledModes,
    toggleMode,
    setExclusiveMode,
  }), [snapState, toggleSnap, isSnapActive, snapEnabled, enabledModes, toggleMode, setExclusiveMode]);

  return (
    <SnapContext.Provider value={contextValue}>
      {children}
    </SnapContext.Provider>
  );
};

export const useSnapContext = (): SnapContextType => {
  const context = useContext(SnapContext);
  if (!context) {
    throw new Error('useSnapContext must be used within a SnapProvider');
  }
  return context;
};
