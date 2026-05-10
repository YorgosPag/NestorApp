import { useState, useCallback, useEffect, useRef } from 'react';
import { userSettingsRepository, stableHash } from '@/services/user-settings';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { CadTogglesSettingsSlice } from '@/services/user-settings/user-settings-schema';

export interface CadToggle {
  on: boolean;
  toggle: () => void;
  set: (value: boolean) => void;
}

export interface CadToggles {
  osnap: CadToggle;
  grid: CadToggle;
  snap: CadToggle;
  ortho: CadToggle;
  polar: CadToggle;
  dynInput: CadToggle;
}

const DEFAULTS: CadTogglesSettingsSlice = {
  osnap: true,
  grid: true,
  snap: false,
  ortho: false,
  polar: false,
  dynInput: false,
};

export const useCadToggles = (): CadToggles => {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const companyId = user?.companyId ?? null;

  const [state, setState] = useState<CadTogglesSettingsSlice>(DEFAULTS);
  const lastHashRef = useRef<string>('');
  const stateRef = useRef(state);
  stateRef.current = state;

  // Subscribe to Firestore slice — hydrate on load, guard echo-loops
  useEffect(() => {
    if (!userId || !companyId) return;
    userSettingsRepository.bind(userId, companyId);
    let firstSnapshot = true;
    const unsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.cadToggles',
      (remote) => {
        if (remote) {
          const remoteHash = stableHash(remote);
          if (remoteHash === lastHashRef.current) return;
          lastHashRef.current = remoteHash;
          setState(remote);
        } else if (firstSnapshot) {
          const hash = stableHash(DEFAULTS);
          lastHashRef.current = hash;
          userSettingsRepository.updateSlice('dxfViewer.cadToggles', DEFAULTS);
        }
        firstSnapshot = false;
      },
    );
    return () => { unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, companyId]);

  // Persist state changes to Firestore (debounced 500ms by repository)
  useEffect(() => {
    if (!userId || !companyId) return;
    const hash = stableHash(state);
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;
    userSettingsRepository.updateSlice('dxfViewer.cadToggles', state);
  }, [userId, companyId, state]);

  const toggleOsnap = useCallback(() => setState(prev => ({ ...prev, osnap: !prev.osnap })), []);
  const setOsnap = useCallback((v: boolean) => setState(prev => ({ ...prev, osnap: v })), []);

  const toggleGrid = useCallback(() => setState(prev => ({ ...prev, grid: !prev.grid })), []);
  const setGrid = useCallback((v: boolean) => setState(prev => ({ ...prev, grid: v })), []);

  const toggleSnap = useCallback(() => setState(prev => ({ ...prev, snap: !prev.snap })), []);
  const setSnap = useCallback((v: boolean) => setState(prev => ({ ...prev, snap: v })), []);

  // ORTHO/POLAR mutual exclusion — AutoCAD-like
  const toggleOrtho = useCallback(() => setState(prev => {
    const next = !prev.ortho;
    return { ...prev, ortho: next, ...(next ? { polar: false } : {}) };
  }), []);
  const setOrtho = useCallback((v: boolean) => setState(prev => ({
    ...prev, ortho: v, ...(v ? { polar: false } : {})
  })), []);

  const togglePolar = useCallback(() => setState(prev => {
    const next = !prev.polar;
    return { ...prev, polar: next, ...(next ? { ortho: false } : {}) };
  }), []);
  const setPolar = useCallback((v: boolean) => setState(prev => ({
    ...prev, polar: v, ...(v ? { ortho: false } : {})
  })), []);

  const toggleDynInput = useCallback(() => setState(prev => ({ ...prev, dynInput: !prev.dynInput })), []);
  const setDynInput = useCallback((v: boolean) => setState(prev => ({ ...prev, dynInput: v })), []);

  return {
    osnap:    { on: state.osnap,    toggle: toggleOsnap,    set: setOsnap    },
    grid:     { on: state.grid,     toggle: toggleGrid,     set: setGrid     },
    snap:     { on: state.snap,     toggle: toggleSnap,     set: setSnap     },
    ortho:    { on: state.ortho,    toggle: toggleOrtho,    set: setOrtho    },
    polar:    { on: state.polar,    toggle: togglePolar,    set: setPolar    },
    dynInput: { on: state.dynInput, toggle: toggleDynInput, set: setDynInput },
  };
};
