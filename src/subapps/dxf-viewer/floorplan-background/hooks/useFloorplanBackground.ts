import { useShallow } from 'zustand/react/shallow';
import {
  useFloorplanBackgroundStore,
  getFloorProvider,
} from '../stores/floorplanBackgroundStore';
import type { BackgroundTransform, FloorplanBackground, ProviderSource, ProviderId } from '../providers/types';
import type { IFloorplanBackgroundProvider } from '../providers/IFloorplanBackgroundProvider';

// ── Public return type ────────────────────────────────────────────────────────

export interface UseFloorplanBackgroundResult {
  background: FloorplanBackground | null;
  provider: IFloorplanBackgroundProvider | null;
  isLoading: boolean;
  error: string | null;
  addBackground(source: ProviderSource, providerId: ProviderId): Promise<void>;
  removeBackground(): Promise<void>;
  setTransform(transform: Partial<BackgroundTransform>): void;
  setOpacity(opacity: number): void;
  setVisible(visible: boolean): void;
  setLocked(locked: boolean): void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFloorplanBackground(floorId: string): UseFloorplanBackgroundResult {
  const {
    slot,
    addBackground: addBg,
    removeBackground: removeBg,
    setTransform: setTx,
    setOpacity: setOp,
    setVisible: setVis,
    setLocked: setLck,
  } = useFloorplanBackgroundStore(
    useShallow((s) => ({
      slot: s.floors[floorId],
      addBackground: s.addBackground,
      removeBackground: s.removeBackground,
      setTransform: s.setTransform,
      setOpacity: s.setOpacity,
      setVisible: s.setVisible,
      setLocked: s.setLocked,
    }))
  );

  // Provider lives outside Zustand — retrieved from module-level Map.
  // Re-read on every render; stable after addBackground resolves.
  const provider = getFloorProvider(floorId);

  return {
    background: slot?.background ?? null,
    provider,
    isLoading: slot?.isLoading ?? false,
    error: slot?.error ?? null,
    addBackground: (source, providerId) => addBg(floorId, source, providerId),
    removeBackground: () => removeBg(floorId),
    setTransform: (transform) => setTx(floorId, transform),
    setOpacity: (opacity) => setOp(floorId, opacity),
    setVisible: (visible) => setVis(floorId, visible),
    setLocked: (locked) => setLck(floorId, locked),
  };
}
