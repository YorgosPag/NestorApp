/**
 * Shared primitives for the tool-handle "drawing-mode" ribbon bridges
 * (`floorplan-symbol` / `furniture` / `mep-fixture-library` / the drawing branch of
 * `foundation`, ADR-583/597 de-dup, N.18).
 *
 * These bridges do NOT edit a selected entity — they read/write the active
 * placement tool handle (`setAssetId` / `setParamOverrides`) so the NEXT click
 * places the chosen asset with the chosen transform. Every one of them copy-pasted
 * the same numeric-override read/write idiom and the same thumbnail-preload effect;
 * this module owns them once.
 */
import { useCallback, useEffect } from 'react';

import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import { bimMeshThumbnailStore } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache';
import {
  useInertBridgeExtras,
  useStableBridge,
  type RibbonEntityBridgeCore,
} from './ribbon-entity-bridge-shared';

/** The minimal tool-handle surface the numeric override helpers need. */
export interface ToolNumericOverrideHandle {
  readonly overrides: Readonly<Record<string, unknown>>;
  setParamOverrides(patch: Record<string, number>): void;
}

/**
 * Read a numeric override off the tool handle as ribbon combobox state. `keyDefault`
 * supplies the fallback when the override is unset (e.g. rotation → 0, scale → 1);
 * absent → 0. Mirrors the `getComboboxState` numeric branch shared by the furniture
 * / fixture-library / floorplan bridges (N.18).
 */
export function readToolOverrideNumber(
  handle: ToolNumericOverrideHandle,
  commandKey: string,
  keyToField: Readonly<Record<string, string>>,
  keyDefault?: Readonly<Record<string, number>>,
): RibbonComboboxState {
  const field = keyToField[commandKey];
  const raw = handle.overrides[field];
  const val = typeof raw === 'number' ? raw : keyDefault?.[commandKey] ?? 0;
  return { value: String(val), options: [] };
}

/**
 * Parse `value` and write it to the mapped numeric override field on the tool
 * handle. No-op on a non-numeric value. Mirrors the `onComboboxChange` numeric
 * branch shared by the furniture / fixture-library / floorplan / foundation
 * drawing bridges (N.18).
 */
export function writeToolOverrideNumber(
  handle: ToolNumericOverrideHandle,
  commandKey: string,
  value: string,
  keyToField: Readonly<Record<string, string>>,
): void {
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return;
  handle.setParamOverrides({ [keyToField[commandKey]]: numeric });
}

/**
 * Preload catalog thumbnails while the placement tool is active so the picker
 * dropdown shows preview images as soon as Storage URLs resolve. Extracted from the
 * identical `useEffect` in the furniture + fixture-library bridges (N.18). Depends
 * only on `isActive`/`category` (the id list is derived from the static catalog).
 */
export function useThumbnailPreload(
  isActive: boolean,
  category: string,
  ids: readonly string[],
): void {
  useEffect(() => {
    if (isActive) bimMeshThumbnailStore.preloadMany(category, ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, category]);
}

/**
 * Build picker options from a CC0-mesh catalog, each carrying its resolved preview
 * thumbnail. The furniture + light-fixture library bridges built the identical
 * `{ value, labelKey, isLiteralLabel, imageUrl }` option list off their catalog;
 * this owns it once (N.18). `category` is the Storage library folder.
 */
export function buildMeshCatalogOptions(
  catalog: readonly { readonly id: string; readonly labelKey: string }[],
  category: string,
): RibbonComboboxState['options'] {
  return catalog.map((p) => ({
    value: p.id,
    labelKey: p.labelKey,
    isLiteralLabel: false,
    imageUrl: bimMeshThumbnailStore.get(category, p.id),
  }));
}

/**
 * The full tool-handle surface a drawing-mode bridge reads/writes.
 *
 * The asset picker (`assetId` / `setAssetId`) is OPTIONAL: a tool is numeric-only when
 * the ribbon does not own "which asset" — e.g. `block-library` (ADR-652), where the
 * palette («Τα Blocks μου») owns the selection via its own SSoT store and the ribbon
 * only tunes rotation/scale. Picker bridges (furniture / floorplan-symbol /
 * mep-fixture-library) still declare both as required on their own handle type, so they
 * keep full type-safety — this widening only lets the ONE factory serve both shapes
 * instead of forcing a numeric-only sibling clone of it (N.18).
 */
export interface ToolHandleLike extends ToolNumericOverrideHandle {
  readonly isActive: boolean;
  readonly assetId?: string;
  setAssetId?(assetId: string): void;
}

/** Per-bridge configuration for {@link useToolHandleBridge}. */
export interface ToolHandleBridgeConfig<H extends ToolHandleLike> {
  /** The live tool handle from the store subscription (`store.use()`), or null. */
  readonly toolHandle: H | null;
  /** Imperative read of the current handle for event dispatch (`store.get()`). */
  readonly readImperative: () => H | null;
  /** commandKey identifying the asset/model picker. Omit for numeric-only tools. */
  readonly assetIdKey?: string;
  /** Builds the picker options (catalog SSoT, may carry thumbnails). Omit with `assetIdKey`. */
  readonly buildOptions?: () => RibbonComboboxState['options'];
  /** commandKey → numeric override field on the handle's `overrides`. */
  readonly numberKeyToField: Readonly<Record<string, string>>;
  /** Fallback per-key numeric value when the override is unset. */
  readonly numberKeyDefault?: Readonly<Record<string, number>>;
  /** Displayed asset value (default: `handle.assetId`; e.g. map `'' → parametric`). */
  readonly displayAssetId?: (handle: H) => string;
  /** Maps the picked value before `setAssetId` (e.g. parametric sentinel → `''`). */
  readonly mapAssetIdValue?: (value: string) => string;
  /** Extra `getComboboxState` deps so options re-resolve (e.g. thumbnail version). */
  readonly optionsDeps?: readonly unknown[];
}

/**
 * The full drawing-mode ribbon bridge, assembled once from per-bridge config. The
 * `floorplan-symbol` / `furniture` / `mep-fixture-library` bridges all had the
 * byte-identical `getComboboxState` (asset picker branch + numeric-override branch)
 * + `onComboboxChange` (imperative handle read + `setAssetId` / numeric write) +
 * inert tail; this owns the whole surface once and each bridge supplies only its
 * store, keys, catalog and value mappings (N.18, factory SSoT).
 */
export function useToolHandleBridge<H extends ToolHandleLike>(
  config: ToolHandleBridgeConfig<H>,
): RibbonEntityBridgeCore {
  const {
    toolHandle,
    readImperative,
    assetIdKey,
    buildOptions,
    numberKeyToField,
    numberKeyDefault,
    displayAssetId,
    mapAssetIdValue,
    optionsDeps,
  } = config;

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!toolHandle || !toolHandle.isActive) return null;
      // Picker branch — skipped entirely on numeric-only tools (no `assetIdKey`).
      if (assetIdKey !== undefined && commandKey === assetIdKey) {
        const value = displayAssetId ? displayAssetId(toolHandle) : toolHandle.assetId ?? '';
        return { value, options: buildOptions ? buildOptions() : [] };
      }
      if (Object.prototype.hasOwnProperty.call(numberKeyToField, commandKey)) {
        return readToolOverrideNumber(toolHandle, commandKey, numberKeyToField, numberKeyDefault);
      }
      return null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [toolHandle, ...(optionsDeps ?? [])],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const handle = readImperative();
      if (!handle || !handle.isActive) return;
      // Picker branch — skipped entirely on numeric-only tools (no `assetIdKey`).
      if (assetIdKey !== undefined && commandKey === assetIdKey) {
        handle.setAssetId?.(mapAssetIdValue ? mapAssetIdValue(value) : value);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(numberKeyToField, commandKey)) {
        writeToolOverrideNumber(handle, commandKey, value, numberKeyToField);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  const extras = useInertBridgeExtras();
  return useStableBridge({ onComboboxChange, getComboboxState, ...extras });
}
