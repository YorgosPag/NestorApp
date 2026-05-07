import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  FloorplanBackground,
  ProviderSource,
  ProviderId,
  BackgroundTransform,
  NaturalBounds,
  ProviderMetadata,
  CalibrationData,
  Point2D,
} from '../providers/types';
import { DEFAULT_BACKGROUND_TRANSFORM } from '../providers/types';
import { getProvider } from '../providers/provider-registry';
import type { IFloorplanBackgroundProvider } from '../providers/IFloorplanBackgroundProvider';
import { generateFloorplanBackgroundId } from '@/services/enterprise-id.service';

// ── Slot: per-floor state (no provider — class instances live outside immer) ──

export interface FloorSlot {
  background: FloorplanBackground | null;
  isLoading: boolean;
  error: string | null;
}

// ── Replace request: emitted when a floor already has a background ─────────────

export interface PendingReplaceRequest {
  floorId: string;
  source: ProviderSource;
  providerId: ProviderId;
}

// ── Calibration session: active while user is picking 2 canvas points ──────────

export interface CalibrationSession {
  floorId: string;
  pointA: Point2D | null;
  pointB: Point2D | null;
  /** worldToCanvas.scale captured at first point click (fixed for the session). */
  worldToCanvasScale: number;
}

// ── Store types ───────────────────────────────────────────────────────────────

interface StoreState {
  floors: Record<string, FloorSlot>;
  activeFloorId: string | null;
  pendingReplaceRequest: PendingReplaceRequest | null;
  calibrationSession: CalibrationSession | null;
}

interface StoreActions {
  addBackground(floorId: string, source: ProviderSource, providerId: ProviderId): Promise<void>;
  removeBackground(floorId: string): Promise<void>;
  setTransform(floorId: string, transform: Partial<BackgroundTransform>): void;
  setOpacity(floorId: string, opacity: number): void;
  setVisible(floorId: string, visible: boolean): void;
  setLocked(floorId: string, locked: boolean): void;
  setActiveFloor(floorId: string | null): void;
  confirmReplace(): Promise<void>;
  cancelReplace(): void;
  startCalibration(floorId: string): void;
  setCalibrationPoint(pt: Point2D, scale: number): void;
  cancelCalibration(): void;
  applyCalibration(floorId: string, partial: Partial<BackgroundTransform>, calibrationData: CalibrationData): void;
  /** Internal: load without replace-check. Use addBackground from outside. */
  _loadBackground(floorId: string, source: ProviderSource, providerId: ProviderId): Promise<void>;
  /**
   * Phase 7: hydrate from a server-persisted background. Loads the provider
   * binary via the supplied source (typically `kind: 'url'`) and adopts the
   * server-provided id/companyId/fileId/createdBy/transform/calibration/etc.
   */
  _hydratePersistedBackground(floorId: string, persisted: FloorplanBackground, source: ProviderSource): Promise<void>;
}

type FloorplanBackgroundStoreType = StoreState & StoreActions;

// ── Module-level provider map (outside immer — class instances) ───────────────

const _floorProviders = new Map<string, IFloorplanBackgroundProvider>();

export function getFloorProvider(floorId: string): IFloorplanBackgroundProvider | null {
  return _floorProviders.get(floorId) ?? null;
}

// ── Hydrate dedup: per-floorId in-flight promise map ──────────────────────────
// Two parallel call sites (CanvasSection + FloorplanBackgroundPanel) both
// trigger `_hydratePersistedBackground` for the same floor. Without dedup the
// PdfPageProvider singleton renders twice concurrently → pdfjs cancels the
// first render ("Rendering cancelled, page 1"). This map collapses concurrent
// hydrates into a single shared promise.

const _hydrateInFlight = new Map<string, Promise<void>>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProviderMetadata(metadata: Record<string, unknown>): ProviderMetadata {
  return {
    imageOrientation: typeof metadata.imageOrientation === 'number'
      ? metadata.imageOrientation
      : undefined,
    imageMimeType: typeof metadata.imageMimeType === 'string'
      ? metadata.imageMimeType
      : undefined,
    imageDecoderUsed: metadata.imageDecoderUsed === 'utif' ? 'utif' : 'native',
    pdfPageNumber: typeof metadata.pdfPageNumber === 'number'
      ? metadata.pdfPageNumber
      : undefined,
  };
}

function buildBackground(
  floorId: string,
  providerId: ProviderId,
  naturalBounds: NaturalBounds,
  metadata: Record<string, unknown>,
): FloorplanBackground {
  const now = Date.now();
  return {
    id: generateFloorplanBackgroundId(),
    companyId: '',      // Phase 3: in-memory only — populated in Phase 7 (persistence)
    floorId,
    fileId: '',         // Phase 3: in-memory only — populated in Phase 7 (persistence)
    providerId,
    providerMetadata: buildProviderMetadata(metadata),
    naturalBounds,
    transform: { ...DEFAULT_BACKGROUND_TRANSFORM },
    calibration: null,
    opacity: 1,
    visible: true,
    locked: false,
    createdAt: now,
    updatedAt: now,
    createdBy: '',      // Phase 3: in-memory only
    updatedBy: '',
  };
}

function clampOpacity(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useFloorplanBackgroundStore = create<FloorplanBackgroundStoreType>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // ── Initial state ─────────────────────────────────────────────────────

        floors: {},
        activeFloorId: null,
        pendingReplaceRequest: null,
        calibrationSession: null,

        // ── Public actions ────────────────────────────────────────────────────

        addBackground: async (floorId, source, providerId) => {
          const existing = get().floors[floorId];
          if (existing?.background) {
            set((draft) => {
              draft.pendingReplaceRequest = { floorId, source, providerId };
            });
            return;
          }
          await get()._loadBackground(floorId, source, providerId);
        },

        removeBackground: async (floorId) => {
          const provider = _floorProviders.get(floorId);
          if (provider) {
            await Promise.resolve(provider.dispose());
            _floorProviders.delete(floorId);
          }
          set((draft) => {
            delete draft.floors[floorId];
          });
        },

        setTransform: (floorId, partial) => {
          set((draft) => {
            const slot = draft.floors[floorId];
            if (!slot?.background) return;
            Object.assign(slot.background.transform, partial);
            slot.background.updatedAt = Date.now();
          });
        },

        setOpacity: (floorId, opacity) => {
          set((draft) => {
            const slot = draft.floors[floorId];
            if (!slot?.background) return;
            slot.background.opacity = clampOpacity(opacity);
            slot.background.updatedAt = Date.now();
          });
        },

        setVisible: (floorId, visible) => {
          set((draft) => {
            const slot = draft.floors[floorId];
            if (!slot?.background) return;
            slot.background.visible = visible;
          });
        },

        setLocked: (floorId, locked) => {
          set((draft) => {
            const slot = draft.floors[floorId];
            if (!slot?.background) return;
            slot.background.locked = locked;
          });
        },

        setActiveFloor: (floorId) => {
          set((draft) => {
            draft.activeFloorId = floorId;
          });
        },

        confirmReplace: async () => {
          const req = get().pendingReplaceRequest;
          if (!req) return;
          set((draft) => { draft.pendingReplaceRequest = null; });
          await get().removeBackground(req.floorId);
          await get()._loadBackground(req.floorId, req.source, req.providerId);
        },

        cancelReplace: () => {
          set((draft) => { draft.pendingReplaceRequest = null; });
        },

        startCalibration: (floorId) => {
          set((draft) => {
            draft.calibrationSession = { floorId, pointA: null, pointB: null, worldToCanvasScale: 1 };
          });
        },

        setCalibrationPoint: (pt, scale) => {
          set((draft) => {
            if (!draft.calibrationSession) return;
            if (!draft.calibrationSession.pointA) {
              draft.calibrationSession.pointA = pt;
              draft.calibrationSession.worldToCanvasScale = scale;
            } else if (!draft.calibrationSession.pointB) {
              draft.calibrationSession.pointB = pt;
            }
          });
        },

        cancelCalibration: () => {
          set((draft) => { draft.calibrationSession = null; });
        },

        applyCalibration: (floorId, partial, calibrationData) => {
          set((draft) => {
            const slot = draft.floors[floorId];
            if (!slot?.background) return;
            Object.assign(slot.background.transform, partial);
            slot.background.calibration = calibrationData;
            slot.background.updatedAt = Date.now();
            draft.calibrationSession = null;
          });
        },

        // ── Internal ─────────────────────────────────────────────────────────

        _hydratePersistedBackground: async (floorId, persisted, source) => {
          // Idempotent short-circuit: same persisted background already loaded.
          const existingSlot = get().floors[floorId];
          if (
            existingSlot?.background?.id === persisted.id &&
            existingSlot.background.fileId === persisted.fileId &&
            !existingSlot.isLoading
          ) {
            return;
          }

          // Race-safe dedup: collapse concurrent hydrates for the same floor.
          const inFlight = _hydrateInFlight.get(floorId);
          if (inFlight) return inFlight;

          const promise = (async () => {
            set((draft) => {
              draft.floors[floorId] = { background: null, isLoading: true, error: null };
            });

            try {
              const provider = getProvider(persisted.providerId);
              const result = await provider.loadAsync(source);
              if (!result.success || !result.bounds) {
                throw new Error(result.error ?? 'Provider load failed');
              }
              _floorProviders.set(floorId, provider);
              set((draft) => {
                draft.floors[floorId] = {
                  background: { ...persisted },
                  isLoading: false,
                  error: null,
                };
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              set((draft) => {
                draft.floors[floorId] = { background: null, isLoading: false, error: message };
              });
            }
          })().finally(() => {
            _hydrateInFlight.delete(floorId);
          });

          _hydrateInFlight.set(floorId, promise);
          return promise;
        },

        _loadBackground: async (floorId, source, providerId) => {
          set((draft) => {
            draft.floors[floorId] = { background: null, isLoading: true, error: null };
          });

          try {
            const provider = getProvider(providerId);
            const result = await provider.loadAsync(source);

            if (!result.success || !result.bounds) {
              throw new Error(result.error ?? 'Provider load failed');
            }

            const background = buildBackground(
              floorId,
              providerId,
              result.bounds,
              result.metadata ?? {},
            );

            _floorProviders.set(floorId, provider);

            set((draft) => {
              draft.floors[floorId] = { background, isLoading: false, error: null };
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            set((draft) => {
              draft.floors[floorId] = { background: null, isLoading: false, error: message };
            });
          }
        },
      }))
    ),
    {
      name: 'floorplan-background-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectFloorSlot = (floorId: string) =>
  (s: FloorplanBackgroundStoreType): FloorSlot | undefined => s.floors[floorId];

export const selectActiveFloorId = (s: FloorplanBackgroundStoreType): string | null =>
  s.activeFloorId;

export const selectPendingReplaceRequest = (s: FloorplanBackgroundStoreType): PendingReplaceRequest | null =>
  s.pendingReplaceRequest;

export const selectCalibrationSession = (s: FloorplanBackgroundStoreType): CalibrationSession | null =>
  s.calibrationSession;
