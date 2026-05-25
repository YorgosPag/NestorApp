import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_HDRI_PRESET_ID } from '../lighting/hdri-environment';

interface EnvironmentState {
  hdriPresetId: string;
  hdriUrl: string | null;
  customHdriUrl: string | null;
  customHdriName: string | null;
  isLoading: boolean;
  loadError: boolean;
}

interface EnvironmentActions {
  setHdriPreset: (id: string) => void;
  setHdriUrl: (url: string | null) => void;
  setCustomHdri: (url: string, name: string) => void;
  clearCustomHdri: () => void;
  setLoading: (v: boolean) => void;
  setError: (v: boolean) => void;
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
    setHdriPreset: (id) => set({ hdriPresetId: id, loadError: false }),
    setHdriUrl: (url) => set({ hdriUrl: url }),
    setCustomHdri: (url, name) =>
      set({ customHdriUrl: url, customHdriName: name, hdriUrl: url, loadError: false }),
    clearCustomHdri: () => set({ customHdriUrl: null, customHdriName: null }),
    setLoading: (v) => set({ isLoading: v }),
    setError: (v) => set({ loadError: v }),
  })),
);
