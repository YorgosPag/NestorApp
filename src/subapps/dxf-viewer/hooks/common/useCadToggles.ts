import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { userSettingsRepository, stableHash } from '@/services/user-settings';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { CadTogglesSettingsSlice } from '@/services/user-settings/user-settings-schema';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { DEFAULT_GRIP_SNAP_STEP } from '../../bim/grips/grip-step-quantize';

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
  /** SNAP-MODE (F9) increment step (scene units) + setter. */
  snapStep: number;
  setSnapStep: (value: number) => void;
}

const DEFAULTS: CadTogglesSettingsSlice = {
  // Giorgio 2026-06-30: app-open active defaults = OSNAP + SNAP + POLAR (+ AutoAlign,
  // owned by ambientAlignmentConfigStore, already default ON). GRID/ORTHO/DYN start OFF.
  osnap: true,
  grid: false,
  snap: true,
  ortho: false,
  polar: true,
  // ADR-357 §5.1 (revised 2026-05-27): Dynamic Input default OFF — user opt-in via status-bar toggle.
  // Rationale: Giorgio explicit override of original AutoCAD/BricsCAD "always-on" parity preference.
  dynInput: false,
  // SNAP-MODE step — quantizes the 2D grip-drag delta (move + resize).
  snapStep: DEFAULT_GRIP_SNAP_STEP,
};

export const useCadToggles = (): CadToggles => {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const companyId = user?.companyId ?? null;

  const [state, setState] = useState<CadTogglesSettingsSlice>(DEFAULTS);
  const lastHashRef = useRef<string>('');
  const stateRef = useRef(state);
  stateRef.current = state;

  // ORTHO (F8) / POLAR (F10) live truth — read from the shared in-memory store
  // (NOT this hook's local `state`) so every `useCadToggles` instance observes
  // the same value the instant any of them toggles, without waiting for the
  // Firestore round-trip. `state.ortho`/`state.polar` below stay updated purely
  // for persistence/hydration. (2026-06-12 fix: F8 switch flipped green but the
  // drawing consumer's isolated instance never saw it → ortho never locked.)
  const orthoOn = useSyncExternalStore(
    cadToggleState.subscribe, cadToggleState.isOrthoOn, cadToggleState.isOrthoOn,
  );
  const polarOn = useSyncExternalStore(
    cadToggleState.subscribe, cadToggleState.isPolarOn, cadToggleState.isPolarOn,
  );
  // Dynamic Input live truth — SAME multi-instance fix as ortho/polar: the status-bar
  // toggle and the `DynamicInputSubscriber` are different hook instances, so a local-only
  // `state.dynInput` flipped green but never reached the consumer (it waited on the Firestore
  // echo, which never lands unauthenticated → the overlay/ring stayed off). Shared store = instant.
  const dynInputOn = useSyncExternalStore(
    cadToggleState.subscribe, cadToggleState.isDynInputOn, cadToggleState.isDynInputOn,
  );

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
          // Hydrate the live ortho/polar store from the AUTHORITATIVE Firestore
          // value (identical across all instances ⇒ idempotent, no stale-instance
          // clobber — the trap the SNAP-MODE note below documents). The
          // synchronous setter push already covers the live in-session window.
          cadToggleState.set(remote.ortho, remote.polar);
          cadToggleState.setDynInput(remote.dynInput);
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

  // ORTHO/POLAR live mirror into `cadToggleState` is now pushed by two
  // race-free sources only: (1) the setters below, synchronously on toggle, and
  // (2) the Firestore-hydration callback above, from the authoritative remote.
  // It is deliberately NOT driven by this hook's per-instance `state` — a stale
  // instance's `state.ortho` would clobber the live value mid-session (the exact
  // SNAP-MODE trap noted next). The non-React event-time consumers (BIM commit
  // path in useCanvasClickHandler, grip-drag) read the same store via getters.
  //
  // NOTE: the SNAP-MODE (F9) mirror into `cadToggleState` is written ONLY by the
  // single always-mounted `CadStatusBar` (the toggle UI), NOT here — this hook has
  // ~6 live instances and a stale one (snap=false before its Firestore echo lands)
  // would clobber `snapOn` back to false mid-drag. Single-writer = race-free.

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

  // ORTHO/POLAR mutual exclusion — AutoCAD-like. Each writer pushes to the
  // shared store SYNCHRONOUSLY (so all instances see it on this same click) and
  // mirrors into `state` for Firestore persistence. The live value is derived
  // from the store via `useSyncExternalStore` above — `state` is bookkeeping.
  const setOrtho = useCallback((v: boolean) => {
    cadToggleState.set(v, v ? false : cadToggleState.isPolarOn());
    setState(prev => ({ ...prev, ortho: v, ...(v ? { polar: false } : {}) }));
  }, []);
  const toggleOrtho = useCallback(() => setOrtho(!cadToggleState.isOrthoOn()), [setOrtho]);

  const setPolar = useCallback((v: boolean) => {
    cadToggleState.set(v ? false : cadToggleState.isOrthoOn(), v);
    setState(prev => ({ ...prev, polar: v, ...(v ? { ortho: false } : {}) }));
  }, []);
  const togglePolar = useCallback(() => setPolar(!cadToggleState.isPolarOn()), [setPolar]);

  // Dynamic Input — push to the shared store SYNCHRONOUSLY (so the consumer instance sees it on
  // this same click) + mirror into `state` for Firestore persistence (parity με ortho/polar setters).
  const setDynInput = useCallback((v: boolean) => {
    cadToggleState.setDynInput(v);
    setState(prev => ({ ...prev, dynInput: v }));
  }, []);
  const toggleDynInput = useCallback(() => setDynInput(!cadToggleState.isDynInputOn()), [setDynInput]);

  // SNAP-MODE step — clamp to ≥0; non-finite input falls back to the default.
  const setSnapStep = useCallback((v: number) => setState(prev => ({
    ...prev, snapStep: Number.isFinite(v) && v >= 0 ? v : DEFAULT_GRIP_SNAP_STEP,
  })), []);

  return {
    osnap:    { on: state.osnap,    toggle: toggleOsnap,    set: setOsnap    },
    grid:     { on: state.grid,     toggle: toggleGrid,     set: setGrid     },
    snap:     { on: state.snap,     toggle: toggleSnap,     set: setSnap     },
    ortho:    { on: orthoOn,        toggle: toggleOrtho,    set: setOrtho    },
    polar:    { on: polarOn,        toggle: togglePolar,    set: setPolar    },
    dynInput: { on: dynInputOn,     toggle: toggleDynInput, set: setDynInput },
    snapStep: state.snapStep ?? DEFAULT_GRIP_SNAP_STEP,
    setSnapStep,
  };
};
