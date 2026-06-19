import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_HDRI_PRESET_ID } from '../lighting/hdri-environment';

/**
 * Visible-background mode — decoupled from the lighting environment (ADR-446 §2,
 * 3D «σαν 2Δ» dark view).
 *   - `environment` → the env-derived background shows (gradient sky colour or the
 *     loaded HDRI texture). The default photoreal look.
 *   - `dark` → a flat near-black `#1a1a1a` background (matches the 2D canvas), while
 *     `scene.environment` STAYS the env map so PBR faces keep their lighting/
 *     reflections. Pairs with the bright per-category edge colours in
 *     `bim-three-edges.ts` to reproduce the 2D plan line-work on black.
 */
export type BackgroundMode = 'environment' | 'dark';

interface EnvironmentState {
  hdriPresetId: string;
  hdriUrl: string | null;
  customHdriUrl: string | null;
  customHdriName: string | null;
  isLoading: boolean;
  loadError: boolean;
  backgroundMode: BackgroundMode;
}

interface EnvironmentActions {
  setHdriPreset: (id: string) => void;
  setHdriUrl: (url: string | null) => void;
  setCustomHdri: (url: string, name: string) => void;
  clearCustomHdri: () => void;
  setLoading: (v: boolean) => void;
  setError: (v: boolean) => void;
  setBackgroundMode: (m: BackgroundMode) => void;
}

type EnvironmentStore = EnvironmentState & EnvironmentActions;

export const useEnvironmentStore = create<EnvironmentStore>()(
  subscribeWithSelector((set) => ({
    hdriPresetId: DEFAULT_HDRI_PRESET_ID,
    hdriUrl: null,
    customHdriUrl: null,
    customHdriName: null,
    isLoading: false,
    loadError: false,
    backgroundMode: 'environment',
    setHdriPreset: (id) => set({ hdriPresetId: id, loadError: false }),
    setHdriUrl: (url) => set({ hdriUrl: url }),
    setCustomHdri: (url, name) =>
      set({ customHdriUrl: url, customHdriName: name, hdriUrl: url, loadError: false }),
    clearCustomHdri: () => set({ customHdriUrl: null, customHdriName: null }),
    setLoading: (v) => set({ isLoading: v }),
    setError: (v) => set({ loadError: v }),
    setBackgroundMode: (m) => set({ backgroundMode: m }),
  })),
);
