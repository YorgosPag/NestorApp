/**
 * useCurrentLayerPickerState — ADR-358 §5.5.bis Q8 Phase 7 (Google-grade).
 *
 * Single state hook shared by the status-bar and ribbon variants of
 * `CurrentLayerPicker`. Owns:
 *
 *   - subscription to `LayerStore` (current + recent + layer list)
 *   - per-project + per-level persistence (localStorage primary,
 *     `userSettingsRepository.dxfViewer.dxfSettings.layerPicker` fallback)
 *   - hydration on project/level switch (LayerStore.setCurrentLayerId
 *     + setRecentLayerIds with stored values, only when scene already has
 *     the referenced layer)
 *   - initial seed on first scene load (Layer "0" → general category → first)
 *   - search filter state (live, no debounce — finite layer set)
 *   - popover open/close state
 *   - permission-aware selection (frozen/locked layers blocked via toast)
 *   - row-level mutations (toggle visibility/lock/freeze) for context menu
 *   - pulse token bumped on user-initiated change (drives status-bar swatch
 *     animation in CurrentLayerPicker)
 *
 * The hook avoids writing to LayerStore when persistence loads stale ids
 * (e.g. layer renamed/deleted between sessions). `setRecentLayerIds`
 * filters unknown ids internally.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getLayerStoreSnapshot,
  pushRecentLayer,
  setCurrentLayerId,
  setRecentLayerIds,
  subscribeLayerStore,
  upsertLayer,
} from '../../../stores/LayerStore';
import { compareByLocale } from '@/lib/intl-formatting';
import { useLevels } from '../../../systems/levels/useLevels';
import { useNotifications } from '../../../../../providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { userSettingsRepository } from '@/services/user-settings';
import { useCanEditText } from '../../../hooks/useCanEditText';
import type { SceneLayer, AecLayerCategory } from '../../../types/entities';
import {
  readCurrentLayerLocal,
  readRecentLayersLocal,
  writeCurrentLayerLocal,
  writeRecentLayersLocal,
  pickCurrentFromSlice,
  pickRecentFromSlice,
  mergeCurrentLayerIntoSlice,
  mergeRecentIntoSlice,
  type LayerPickerFirestoreSlice,
} from './layer-picker-persistence';

const LAYER_PICKER_SLICE_KEY = 'layerPicker' as const;
const FIRESTORE_SLICE_PATH = 'dxfViewer.dxfSettings' as const;
const RECENT_DISPLAY_TARGET = 5;

export interface LayerPickerState {
  readonly currentLayer: SceneLayer | null;
  readonly currentLayerId: string | null;
  readonly allLayers: ReadonlyArray<SceneLayer>;
  readonly recentLayers: ReadonlyArray<SceneLayer>;
  readonly groupedByCategory: ReadonlyArray<LayerGroup>;
  readonly filteredRecent: ReadonlyArray<SceneLayer>;
  readonly filteredGroups: ReadonlyArray<LayerGroup>;
  readonly searchQuery: string;
  readonly isOpen: boolean;
  readonly isReady: boolean;
  readonly canUnlockLayer: boolean;
  /** Bumped on every user-initiated change — drives swatch pulse re-mount. */
  readonly pulseToken: number;
}

export interface LayerPickerActions {
  setSearchQuery: (next: string) => void;
  setIsOpen: (next: boolean) => void;
  selectLayer: (layerId: string) => void;
  toggleVisibility: (layerId: string) => void;
  toggleLock: (layerId: string) => void;
  toggleFreeze: (layerId: string) => void;
  openProperties: (layerId: string) => void;
  openManager: () => void;
}

export interface LayerGroup {
  readonly category: AecLayerCategory;
  readonly layers: ReadonlyArray<SceneLayer>;
}

const CATEGORY_ORDER: ReadonlyArray<AecLayerCategory> = [
  'architectural',
  'structural',
  'electrical',
  'mechanical',
  'plumbing',
  'fire',
  'civil',
  'telecom',
  'interior',
  'general',
];

/**
 * Pure initial-current selector — Q8 spec line 863: Layer "0" → first general
 * category layer → first of array. Frozen layers skipped in all three tiers
 * (drawing on a frozen layer is impossible — AutoCAD parity). Locked is fine
 * for seed: user can still switch away later. Returns id-or-name key.
 */
export function pickInitialLayerId(layers: ReadonlyArray<SceneLayer>): string | null {
  if (layers.length === 0) return null;
  const key = (l: SceneLayer): string => l.id ?? l.name;
  const drawable = (l: SceneLayer): boolean => l.frozen !== true;
  const layerZero = layers.find((l) => l.name === '0' && drawable(l));
  if (layerZero) return key(layerZero);
  const general = layers.find(
    (l) => (l.category ?? 'general') === 'general' && drawable(l),
  );
  if (general) return key(general);
  const firstDrawable = layers.find(drawable);
  if (firstDrawable) return key(firstDrawable);
  return key(layers[0]);
}

export function useCurrentLayerPickerState(): {
  state: LayerPickerState;
  actions: LayerPickerActions;
} {
  const snapshot = useSyncExternalStore(
    subscribeLayerStore,
    getLayerStoreSnapshot,
    getLayerStoreSnapshot,
  );

  const levels = useLevels();
  const currentLevelId = levels.currentLevelId;
  const projectId = useMemo<string | null>(() => {
    if (!currentLevelId) return null;
    const level = levels.levels.find((l) => l.id === currentLevelId);
    return level?.projectId ?? null;
  }, [currentLevelId, levels.levels]);

  const { success: notifySuccess, warning: notifyWarning } = useNotifications();
  const { t } = useTranslation('dxf-viewer-shell');
  const { canUnlockLayer } = useCanEditText();

  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pulseToken, setPulseToken] = useState(0);

  // ── Hydration: project/level switch → load persisted current + recent + seed ──
  const hydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || !currentLevelId) return;
    if (snapshot.layers.length === 0) return;
    const hydrationKey = `${projectId}::${currentLevelId}`;
    if (hydratedKeyRef.current === hydrationKey) return;

    const localCurrent = readCurrentLayerLocal(projectId, currentLevelId);
    const localRecent = readRecentLayersLocal(projectId);

    const remoteSlice = userSettingsRepository.getSlice(FIRESTORE_SLICE_PATH) as
      | { layerPicker?: LayerPickerFirestoreSlice }
      | undefined;
    const remoteCurrent = pickCurrentFromSlice(
      remoteSlice?.layerPicker,
      projectId,
      currentLevelId,
    );
    const remoteRecent = pickRecentFromSlice(remoteSlice?.layerPicker, projectId);

    const resolvedCurrent =
      localCurrent ?? remoteCurrent ?? pickInitialLayerId(snapshot.layers);
    const resolvedRecent = localRecent.length > 0 ? localRecent : remoteRecent;

    if (resolvedCurrent && resolvedCurrent !== snapshot.currentLayerId) {
      setCurrentLayerId(resolvedCurrent);
    }
    if (resolvedRecent.length > 0) {
      setRecentLayerIds(resolvedRecent);
    }
    hydratedKeyRef.current = hydrationKey;
  }, [projectId, currentLevelId, snapshot.layers, snapshot.currentLayerId]);

  // ── Persistence: write on change (localStorage immediate + Firestore debounced) ──
  const lastWrittenCurrentRef = useRef<string | null>(null);
  const lastWrittenRecentRef = useRef<string>('');

  useEffect(() => {
    if (!projectId || !currentLevelId) return;
    if (hydratedKeyRef.current === null) return;
    const next = snapshot.currentLayerId;
    if (next === lastWrittenCurrentRef.current) return;
    lastWrittenCurrentRef.current = next;
    writeCurrentLayerLocal(projectId, currentLevelId, next);

    if (userSettingsRepository.isReady()) {
      const existing =
        (userSettingsRepository.getSlice(FIRESTORE_SLICE_PATH) as
          | { layerPicker?: LayerPickerFirestoreSlice }
          | undefined) ?? {};
      const mergedPicker = mergeCurrentLayerIntoSlice(
        existing.layerPicker ?? {},
        projectId,
        currentLevelId,
        next,
      );
      userSettingsRepository.updateSlice(FIRESTORE_SLICE_PATH, {
        ...existing,
        [LAYER_PICKER_SLICE_KEY]: mergedPicker,
      } as never);
    }
  }, [projectId, currentLevelId, snapshot.currentLayerId]);

  useEffect(() => {
    if (!projectId) return;
    if (hydratedKeyRef.current === null) return;
    const serialized = snapshot.recentLayerIds.join('|');
    if (serialized === lastWrittenRecentRef.current) return;
    lastWrittenRecentRef.current = serialized;
    writeRecentLayersLocal(projectId, snapshot.recentLayerIds);

    if (userSettingsRepository.isReady()) {
      const existing =
        (userSettingsRepository.getSlice(FIRESTORE_SLICE_PATH) as
          | { layerPicker?: LayerPickerFirestoreSlice }
          | undefined) ?? {};
      const mergedPicker = mergeRecentIntoSlice(
        existing.layerPicker ?? {},
        projectId,
        snapshot.recentLayerIds,
      );
      userSettingsRepository.updateSlice(FIRESTORE_SLICE_PATH, {
        ...existing,
        [LAYER_PICKER_SLICE_KEY]: mergedPicker,
      } as never);
    }
  }, [projectId, snapshot.recentLayerIds]);

  // ── Derived: current + recent (+ alpha fallback) + grouped + filtered ──
  const layerById = useMemo(() => {
    const map = new Map<string, SceneLayer>();
    for (const layer of snapshot.layers) {
      map.set(layer.id ?? layer.name, layer);
    }
    return map;
  }, [snapshot.layers]);

  const currentLayer = snapshot.currentLayerId
    ? layerById.get(snapshot.currentLayerId) ?? null
    : null;

  // Q8 line 858: fallback to alphabetical when recent < 5
  const recentLayers = useMemo<ReadonlyArray<SceneLayer>>(() => {
    const list: SceneLayer[] = [];
    const seen = new Set<string>();
    for (const id of snapshot.recentLayerIds) {
      if (seen.has(id)) continue;
      const layer = layerById.get(id);
      if (!layer) continue;
      list.push(layer);
      seen.add(id);
      if (list.length >= RECENT_DISPLAY_TARGET) break;
    }
    if (list.length < RECENT_DISPLAY_TARGET) {
      const alpha = [...snapshot.layers]
        .filter((l) => !seen.has(l.id ?? l.name))
        .sort((a, b) => compareByLocale(a.name, b.name));
      for (const layer of alpha) {
        list.push(layer);
        seen.add(layer.id ?? layer.name);
        if (list.length >= RECENT_DISPLAY_TARGET) break;
      }
    }
    return list;
  }, [snapshot.recentLayerIds, snapshot.layers, layerById]);

  const groupedByCategory = useMemo<ReadonlyArray<LayerGroup>>(() => {
    const buckets = new Map<AecLayerCategory, SceneLayer[]>();
    for (const layer of snapshot.layers) {
      const category = layer.category ?? 'general';
      const bucket = buckets.get(category) ?? [];
      bucket.push(layer);
      buckets.set(category, bucket);
    }
    const groups: LayerGroup[] = [];
    for (const category of CATEGORY_ORDER) {
      const layers = buckets.get(category);
      if (!layers || layers.length === 0) continue;
      const sorted = [...layers].sort((a, b) => compareByLocale(a.name, b.name));
      groups.push({ category, layers: sorted });
    }
    return groups;
  }, [snapshot.layers]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = useCallback(
    (layer: SceneLayer) => {
      if (!normalizedQuery) return true;
      return layer.name.toLowerCase().includes(normalizedQuery);
    },
    [normalizedQuery],
  );

  const filteredRecent = useMemo(
    () => recentLayers.filter(matchesQuery),
    [recentLayers, matchesQuery],
  );

  const filteredGroups = useMemo<ReadonlyArray<LayerGroup>>(() => {
    if (!normalizedQuery) return groupedByCategory;
    const result: LayerGroup[] = [];
    for (const group of groupedByCategory) {
      const layers = group.layers.filter(matchesQuery);
      if (layers.length === 0) continue;
      result.push({ category: group.category, layers });
    }
    return result;
  }, [groupedByCategory, normalizedQuery, matchesQuery]);

  // ── Actions ──
  const selectLayer = useCallback(
    (layerId: string) => {
      const target = layerById.get(layerId);
      if (!target) return;
      if (target.frozen === true) {
        notifyWarning(t('layerPicker.toastFrozen', { name: target.name }));
        setIsOpen(false);
        return;
      }
      if (target.locked && !canUnlockLayer) {
        notifyWarning(t('layerPicker.toastLocked', { name: target.name }));
        setIsOpen(false);
        return;
      }
      if (snapshot.currentLayerId === layerId) {
        pushRecentLayer(layerId);
        setPulseToken((n) => n + 1);
        setIsOpen(false);
        return;
      }
      setCurrentLayerId(layerId);
      setPulseToken((n) => n + 1);
      notifySuccess(t('layerPicker.toastChanged', { name: target.name }));
      setIsOpen(false);
    },
    [layerById, snapshot.currentLayerId, canUnlockLayer, notifySuccess, notifyWarning, t],
  );

  const toggleVisibility = useCallback(
    (layerId: string) => {
      const target = layerById.get(layerId);
      if (!target) return;
      upsertLayer({ ...target, visible: !target.visible });
    },
    [layerById],
  );

  const toggleLock = useCallback(
    (layerId: string) => {
      const target = layerById.get(layerId);
      if (!target) return;
      if (!canUnlockLayer) {
        notifyWarning(t('layerPicker.toastLocked', { name: target.name }));
        return;
      }
      upsertLayer({ ...target, locked: !target.locked });
    },
    [layerById, canUnlockLayer, notifyWarning, t],
  );

  const toggleFreeze = useCallback(
    (layerId: string) => {
      const target = layerById.get(layerId);
      if (!target) return;
      upsertLayer({ ...target, frozen: target.frozen !== true });
    },
    [layerById],
  );

  const openManager = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dxf:open-layer-manager'));
    setIsOpen(false);
  }, []);

  const openProperties = useCallback((layerId: string) => {
    window.dispatchEvent(
      new CustomEvent('dxf:open-layer-manager', { detail: { layerId } }),
    );
    setIsOpen(false);
  }, []);

  const state: LayerPickerState = {
    currentLayer,
    currentLayerId: snapshot.currentLayerId,
    allLayers: snapshot.layers,
    recentLayers,
    groupedByCategory,
    filteredRecent,
    filteredGroups,
    searchQuery,
    isOpen,
    isReady: snapshot.layers.length > 0,
    canUnlockLayer,
    pulseToken,
  };

  const actions: LayerPickerActions = {
    setSearchQuery,
    setIsOpen,
    selectLayer,
    toggleVisibility,
    toggleLock,
    toggleFreeze,
    openProperties,
    openManager,
  };

  return { state, actions };
}
