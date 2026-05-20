import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_HDRI_PRESET_ID } from '../lighting/hdri-environment';

interface EnvironmentState {
  hdriPresetId: string;
  hdriUrl: string | null;
  isLoading: boolean;
  loadError: boolean;
}

interface EnvironmentActions {
  setHdriPreset: (id: string) => void;
  setHdriUrl: (url: string | null) => void;
  setLoading: (v: boolean) => void;
  setError: (v: boolean) => void;
}

type EnvironmentStore = EnvironmentState & EnvironmentActions;

export const useEnvironmentStore = create<EnvironmentStore>()(
  subscribeWithSelector((set) => ({
    hdriPresetId: DEFAULT_HDRI_PRESET_ID,
    hdriUrl: null,
    isLoading: false,
    loadError: false,
    setHdriPreset: (id) => set({ hdriPresetId: id, loadError: false }),
    setHdriUrl: (url) => set({ hdriUrl: url }),
    setLoading: (v) => set({ isLoading: v }),
    setError: (v) => set({ loadError: v }),
  })),
);
