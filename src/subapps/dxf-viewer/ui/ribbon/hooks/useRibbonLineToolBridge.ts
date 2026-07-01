'use client';

/**
 * Bridge μεταξύ του Line-Tool contextual ribbon tab και (α) της επιλεγμένης
 * γεωμετρικής οντότητας ή (β) των draw-defaults (`QuickStyleStore`).
 *
 * Dual mode (Revit «διάλεξε στυλ → σχεδίασε» + «επίλεξε → επεξεργάσου» — mirror
 * του `useRibbonHatchBridge`):
 *   - Επιλεγμένο primitive (γραμμή/πολυγραμμή/κύκλος/τόξο/έλλειψη/spline/ορθογώνιο)
 *     → read/write μέσω του generic `UpdateEntityCommand` (undoable, μηδέν νέα
 *     command class). Αλλάζει το ΙΔΙΟ entity → canvas re-render με το νέο στυλ.
 *   - Καμία επιλογή (εργαλείο σχεδίασης ενεργό) → read/write στο `QuickStyleStore`
 *     (ephemeral draw-defaults για την ΕΠΟΜΕΝΗ γραμμή — ADR-357 Phase 17).
 *
 * Το ποια entities είναι «editable primitives» ορίζεται ΜΙΑ φορά στο SSoT
 * `types/style-editable-primitives.ts` — κοινό με τον `resolveContextualTrigger`.
 *
 * Linetype options = live `LinetypeRegistry` (27 ISO + runtime custom), ΟΧΙ
 * στατικό catalog → πλήρες SSoT με ό,τι μπορεί να αποδώσει ο renderer (Φ2A-D).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ2E
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §G15
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getQuickStyleSnapshot,
  subscribeQuickStyle,
  setQuickStyleLineweight,
  setQuickStyleLinetype,
  setQuickStyleColor,
  setQuickStyleLtscale,
} from '../../../stores/QuickStyleStore';
import {
  getLinetypeRegistrySnapshot,
  subscribeLinetypeRegistry,
  listSelectableLinetypeNames,
} from '../../../stores/LinetypeRegistry';
// ADR-510 Φ4 — per-object layer list (AutoCAD «General» → Layer) from the SSoT store.
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
} from '../../../stores/LayerStore';
import { useCurrentLayerChange } from '../../components/layer-picker/useCurrentLayerChange';
import type { LineweightMm, AnySceneEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import { isStyleEditablePrimitiveType } from '../../../types/style-editable-primitives';
// ADR-510 Φ3d/Φ4 — polyline width + line coordinates are model-space (mm, ADR-462):
// convert mm ↔ the live display unit so the ribbon fields match the status-bar readouts.
import { toDisplay, fromDisplay } from '../../../config/units';
import { displayUnitState } from '../../../config/display-unit-state';
// ADR-510 Φ4 — pure line geometry read/edit helpers (reuse geometry-vector-utils SSoT).
import {
  lineLength,
  lineAngleDeg,
  endForLength,
  endForAngleDeg,
  endForDelta,
  withCoord,
} from '../../../systems/properties/line-geometry-edit';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import type { RibbonComboboxOption } from '../types/ribbon-types';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
  isLineToolRibbonKey,
} from './bridge/line-tool-command-keys';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonLineToolBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonLineToolBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  /** ADR-510 Φ4 — the Geometry panel self-hides unless a `line` is selected. */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const BYLAYER = 'ByLayer';
/** AutoCAD object transparency range: 0 (opaque) .. 90 (90% transparent). */
const TRANSPARENCY_MAX = 90;

/** Live linetype options — ΙΔΙΟΣ SSoT enumerator με το radial-ring (ByLayer + registry, ISO + custom). */
function buildLinetypeOptions(): readonly RibbonComboboxOption[] {
  return listSelectableLinetypeNames().map((name) => ({
    value: name, labelKey: name, isLiteralLabel: true,
  }));
}

/** Combobox display value for an entity's linetype (declared, not resolved — Revit shows «By Layer»). */
function entityLinetypeValue(entity: AnySceneEntity): string {
  return entity.linetypeName && entity.linetypeName.length > 0 ? entity.linetypeName : BYLAYER;
}

/** Combobox display value for an entity's lineweight. */
function entityLineweightValue(entity: AnySceneEntity): string {
  const lw = entity.lineweightMm;
  if (lw === undefined || lw === LINEWEIGHT_SPECIAL.BYLAYER) return BYLAYER;
  return String(lw);
}

/** Combobox display value for an entity's per-object linetype scale (CELTSCALE). */
function entityLtscaleValue(entity: AnySceneEntity): string {
  return String(entity.ltscale ?? 1);
}

/** Polyline-like entity shape carrying the Φ3d per-segment width arrays. */
interface WidthCapableEntity {
  readonly type: string;
  readonly vertices?: ReadonlyArray<unknown>;
  readonly closed?: boolean;
  readonly startWidths?: readonly number[];
  readonly endWidths?: readonly number[];
  readonly constantWidth?: number;
}

/** Only polylines carry an edge-to-edge width. */
function isPolylineLike(type: string): boolean {
  return type === 'polyline' || type === 'lwpolyline';
}

/** Current uniform width of a polyline, in the active display unit (string). */
function entityWidthDisplayValue(entity: WidthCapableEntity): string {
  const mm = entity.startWidths?.find((w) => w > 0)
    ?? entity.endWidths?.find((w) => w > 0)
    ?? entity.constantWidth
    ?? 0;
  const { value } = toDisplay(mm, displayUnitState.getUnit());
  return String(value);
}

/**
 * Build a uniform-width patch (all segments share one width) from a display-unit
 * input. Returns null for a non-polyline, a degenerate polyline, or invalid input.
 */
function widthPatchForEntity(
  entity: WidthCapableEntity,
  displayValue: string,
): Record<string, unknown> | null {
  if (!isPolylineLike(entity.type)) return null;
  const n = entity.vertices?.length ?? 0;
  if (n < 2) return null;
  const parsed = parseFloat(displayValue);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const mm = fromDisplay(parsed, displayUnitState.getUnit());
  const segs = entity.closed ? n : n - 1;
  return {
    startWidths: new Array(segs).fill(mm),
    endWidths: new Array(segs).fill(mm),
  };
}

/** Combobox display value for an entity's color (ByLayer or ACI number). */
function entityColorValue(entity: AnySceneEntity): string {
  if (entity.colorMode === BYLAYER || entity.colorMode === undefined) return BYLAYER;
  return entity.colorAci != null ? String(entity.colorAci) : BYLAYER;
}

// ─── ADR-510 Φ4 — General (layer/transparency) + Geometry (line) helpers ───────

/** Minimal shape of a scene layer for the ribbon dropdown (SSoT: LayerStore). */
interface LayerLike {
  readonly id?: string;
  readonly name: string;
}

/** Layer combobox options (value = id ?? name, label = name) from the live store. */
function buildLayerOptions(layers: ReadonlyArray<LayerLike>): readonly RibbonComboboxOption[] {
  return layers.map((l) => ({
    value: l.id ?? l.name, labelKey: l.name, isLiteralLabel: true,
  }));
}

/** Combobox display value for an entity's per-object layer. */
function entityLayerValue(entity: AnySceneEntity): string {
  return entity.layerId ?? '';
}

/** Combobox display value for an entity's transparency (0 = opaque). */
function entityTransparencyValue(entity: AnySceneEntity): string {
  const raw = (entity as { transparency?: number }).transparency;
  return String(typeof raw === 'number' ? raw : 0);
}

/** Clamp typed transparency to the AutoCAD 0..90 integer range. */
function clampTransparency(n: number): number {
  return Math.max(0, Math.min(TRANSPARENCY_MAX, Math.round(n)));
}

/** Narrow a selected entity to a line with valid endpoints (Geometry gate). */
function asLine(entity: AnySceneEntity | null): { start: Point2D; end: Point2D } | null {
  if (!entity || entity.type !== 'line') return null;
  const l = entity as unknown as { start?: Point2D; end?: Point2D };
  if (!l.start || !l.end) return null;
  return { start: l.start, end: l.end };
}

/** mm → active display unit, as a combobox string. */
function toDisp(mm: number): string {
  return String(toDisplay(mm, displayUnitState.getUnit()).value);
}

/** Display-unit string → mm (inverse of {@link toDisp}). NaN on invalid input. */
function fromDisp(value: string): number {
  return fromDisplay(parseFloat(value), displayUnitState.getUnit());
}

/** The 8 AutoCAD «Geometry» command keys (line start/end/length/angle/delta). */
const LINE_GEOMETRY_KEYS: ReadonlySet<string> = new Set([
  LINE_TOOL_RIBBON_KEYS.length, LINE_TOOL_RIBBON_KEYS.angle,
  LINE_TOOL_RIBBON_KEYS.startX, LINE_TOOL_RIBBON_KEYS.startY,
  LINE_TOOL_RIBBON_KEYS.endX, LINE_TOOL_RIBBON_KEYS.endY,
  LINE_TOOL_RIBBON_KEYS.deltaX, LINE_TOOL_RIBBON_KEYS.deltaY,
]);
function isLineGeometryKey(key: string): boolean {
  return LINE_GEOMETRY_KEYS.has(key);
}

export function useRibbonLineToolBridge(
  props: UseRibbonLineToolBridgeProps,
): RibbonLineToolBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  const snapshot = useSyncExternalStore(
    subscribeQuickStyle, getQuickStyleSnapshot, getQuickStyleSnapshot,
  );
  // Live linetype catalog (low-frequency: registrations are rare).
  const registry = useSyncExternalStore(
    subscribeLinetypeRegistry, getLinetypeRegistrySnapshot, getLinetypeRegistrySnapshot,
  );
  // ADR-510 Φ4 — live layer catalog for the «Επίπεδο» dropdown (low-frequency).
  const layerSnapshot = useSyncExternalStore(
    subscribeLayerStore, getLayerStoreSnapshot, getLayerStoreSnapshot,
  );
  // ADR-358/510 Φ4 — the «Επίπεδο» default (no-selection) change routes through
  // the shared current-layer SSoT action (permission gate + toast + recent FIFO),
  // the SAME path as the CurrentLayerPicker popover (Revit-grade parity).
  const { changeCurrentLayer } = useCurrentLayerChange();

  const linetypeOptions = useMemo(
    () => buildLinetypeOptions(),
    [registry],
  );
  const layerOptions = useMemo(
    () => buildLayerOptions(layerSnapshot.layers),
    [layerSnapshot],
  );

  /** The selected style-editable primitive, or null (→ draw-defaults mode). */
  const resolveSelected = useCallback((): AnySceneEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    if (!e || !isStyleEditablePrimitiveType(e.type)) return null;
    return e as AnySceneEntity;
  }, [levelManager, universalSelection]);

  const patchEntity = useCallback(
    (entity: AnySceneEntity, patch: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new UpdateEntityCommand(entity.id, patch, sm, 'Update line style'));
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isLineToolRibbonKey(commandKey)) return null;
      const selected = resolveSelected();

      if (commandKey === LINE_TOOL_RIBBON_KEYS.linetype) {
        const value = selected ? entityLinetypeValue(selected) : snapshot.linetypeName;
        return { value, options: linetypeOptions };
      }
      if (commandKey === LINE_TOOL_RIBBON_KEYS.lineweight) {
        if (selected) return { value: entityLineweightValue(selected), options: [] };
        const lw = snapshot.lineweightMm;
        return { value: lw === LINEWEIGHT_SPECIAL.BYLAYER ? BYLAYER : String(lw), options: [] };
      }
      // ADR-510 Φ2E #2 — per-object linetype scale (CELTSCALE). Options come from the
      // tab declaration (numeric presets + editable); the bridge supplies only the value.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.linetypeScale) {
        const value = selected ? entityLtscaleValue(selected) : String(snapshot.ltscale);
        return { value, options: [] };
      }
      // ADR-510 Φ3d — polyline width (edge-to-edge). Only a selected polyline has a
      // width source; for other selections / draw-defaults show 0 (no QuickStyle width yet).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.width) {
        const value = selected && isPolylineLike(selected.type)
          ? entityWidthDisplayValue(selected as unknown as WidthCapableEntity)
          : '0';
        return { value, options: [] };
      }
      // ADR-510 Φ4 — per-object layer (selected) / current drawing layer (defaults).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.layer) {
        const value = selected ? entityLayerValue(selected) : (layerSnapshot.currentLayerId ?? '');
        return { value, options: layerOptions };
      }
      // ADR-510 Φ4 — object transparency (0..90). Draw-defaults show opaque.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.transparency) {
        return { value: selected ? entityTransparencyValue(selected) : '0', options: [] };
      }
      // ADR-510 Φ4 — Geometry (selected line only; panel hidden otherwise). Length /
      // start / end / delta are display-unit; angle is degrees (unit-independent).
      if (isLineGeometryKey(commandKey)) {
        const line = asLine(selected);
        if (!line) return { value: '', options: [] };
        const { start, end } = line;
        if (commandKey === LINE_TOOL_RIBBON_KEYS.length) return { value: toDisp(lineLength(start, end)), options: [] };
        if (commandKey === LINE_TOOL_RIBBON_KEYS.angle)  return { value: String(Math.round(lineAngleDeg(start, end) * 100) / 100), options: [] };
        if (commandKey === LINE_TOOL_RIBBON_KEYS.startX) return { value: toDisp(start.x), options: [] };
        if (commandKey === LINE_TOOL_RIBBON_KEYS.startY) return { value: toDisp(start.y), options: [] };
        if (commandKey === LINE_TOOL_RIBBON_KEYS.endX)   return { value: toDisp(end.x), options: [] };
        if (commandKey === LINE_TOOL_RIBBON_KEYS.endY)   return { value: toDisp(end.y), options: [] };
        if (commandKey === LINE_TOOL_RIBBON_KEYS.deltaX) return { value: toDisp(end.x - start.x), options: [] };
        return { value: toDisp(end.y - start.y), options: [] }; // deltaY
      }
      // color
      if (selected) return { value: entityColorValue(selected), options: [] };
      const colorValue = snapshot.colorMode === BYLAYER
        ? BYLAYER
        : snapshot.colorAci !== null ? String(snapshot.colorAci) : BYLAYER;
      return { value: colorValue, options: [] };
    },
    [resolveSelected, snapshot, linetypeOptions, layerOptions, layerSnapshot],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isLineToolRibbonKey(commandKey)) return;
      const selected = resolveSelected();

      if (commandKey === LINE_TOOL_RIBBON_KEYS.linetype) {
        if (selected) patchEntity(selected, { linetypeName: value });
        else setQuickStyleLinetype(value);
        return;
      }
      if (commandKey === LINE_TOOL_RIBBON_KEYS.lineweight) {
        const lw: LineweightMm = value === BYLAYER
          ? LINEWEIGHT_SPECIAL.BYLAYER
          : (parseFloat(value) as LineweightMm);
        if (selected) patchEntity(selected, { lineweightMm: lw });
        else setQuickStyleLineweight(lw);
        return;
      }
      // ADR-510 Φ2E #2 — per-object linetype scale (CELTSCALE). The editable numeric
      // combobox already enforces `min: 0.01`; guard again for safety (ignore ≤0/NaN).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.linetypeScale) {
        const n = parseFloat(value);
        if (!Number.isFinite(n) || n <= 0) return;
        if (selected) patchEntity(selected, { ltscale: n });
        else setQuickStyleLtscale(n);
        return;
      }
      // ADR-510 Φ3d — polyline width. Write a uniform per-segment width to the
      // selected polyline; draw-default width is not wired in Φ3d (no-op).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.width) {
        if (!selected || !isPolylineLike(selected.type)) {
          // eslint-disable-next-line no-console
          console.warn('[Φ3d] width write SKIPPED — selected:', selected?.type ?? 'none');
          return;
        }
        const patch = widthPatchForEntity(selected as unknown as WidthCapableEntity, value);
        // eslint-disable-next-line no-console
        console.warn('[Φ3d] width write — id:', selected.id, 'value:', value, 'patch:', JSON.stringify(patch));
        if (patch) patchEntity(selected, patch);
        return;
      }
      // ADR-510 Φ4 — layer. Selected → per-object layerId; defaults → current layer.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.layer) {
        if (!value) return;
        if (selected) patchEntity(selected, { layerId: value });
        else changeCurrentLayer(value);
        return;
      }
      // ADR-510 Φ4 — transparency (0..90). Selected entity only (no draw-default yet).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.transparency) {
        const n = parseFloat(value);
        if (!Number.isFinite(n) || !selected) return;
        patchEntity(selected, { transparency: clampTransparency(n) });
        return;
      }
      // ADR-510 Φ4 — Geometry (selected line only). Recompute an endpoint, patch it.
      if (isLineGeometryKey(commandKey)) {
        const line = asLine(selected);
        if (!line || !selected) return;
        const { start, end } = line;
        if (commandKey === LINE_TOOL_RIBBON_KEYS.angle) {
          const nextEnd = endForAngleDeg(start, end, parseFloat(value));
          if (nextEnd) patchEntity(selected, { end: nextEnd });
          return;
        }
        // The remaining Geometry fields are display-unit lengths → mm.
        const mm = fromDisp(value);
        if (!Number.isFinite(mm)) return;
        if (commandKey === LINE_TOOL_RIBBON_KEYS.length) {
          const nextEnd = endForLength(start, end, mm);
          if (nextEnd) patchEntity(selected, { end: nextEnd });
        } else if (commandKey === LINE_TOOL_RIBBON_KEYS.startX) {
          const nextStart = withCoord(start, 'x', mm);
          if (nextStart) patchEntity(selected, { start: nextStart });
        } else if (commandKey === LINE_TOOL_RIBBON_KEYS.startY) {
          const nextStart = withCoord(start, 'y', mm);
          if (nextStart) patchEntity(selected, { start: nextStart });
        } else if (commandKey === LINE_TOOL_RIBBON_KEYS.endX) {
          const nextEnd = withCoord(end, 'x', mm);
          if (nextEnd) patchEntity(selected, { end: nextEnd });
        } else if (commandKey === LINE_TOOL_RIBBON_KEYS.endY) {
          const nextEnd = withCoord(end, 'y', mm);
          if (nextEnd) patchEntity(selected, { end: nextEnd });
        } else if (commandKey === LINE_TOOL_RIBBON_KEYS.deltaX) {
          const nextEnd = endForDelta(start, end, 'x', mm);
          if (nextEnd) patchEntity(selected, { end: nextEnd });
        } else if (commandKey === LINE_TOOL_RIBBON_KEYS.deltaY) {
          const nextEnd = endForDelta(start, end, 'y', mm);
          if (nextEnd) patchEntity(selected, { end: nextEnd });
        }
        return;
      }
      // color
      if (value === BYLAYER) {
        if (selected) {
          patchEntity(selected, {
            colorMode: 'ByLayer', colorAci: undefined, color: undefined, colorTrueColor: null,
          });
        } else {
          setQuickStyleColor('ByLayer', null, null);
        }
        return;
      }
      const aci = parseInt(value, 10);
      if (selected) {
        patchEntity(selected, {
          colorMode: 'Concrete',
          colorAci: Number.isNaN(aci) ? undefined : aci,
          color: undefined,
          colorTrueColor: null,
        });
      } else {
        setQuickStyleColor('Concrete', Number.isNaN(aci) ? null : aci, null);
      }
    },
    [resolveSelected, patchEntity, changeCurrentLayer],
  );

  // ADR-510 Φ4 — the Geometry panel is line-only; other primitives hide it.
  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry) {
        return asLine(resolveSelected()) !== null;
      }
      return true;
    },
    [resolveSelected],
  );

  return useMemo(
    () => ({ getComboboxState, onComboboxChange, getPanelVisibility }),
    [getComboboxState, onComboboxChange, getPanelVisibility],
  );
}
