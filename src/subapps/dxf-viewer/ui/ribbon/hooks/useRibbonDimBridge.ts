'use client';

/**
 * ADR-562 Φ3 — Bridge between the Dimension contextual ribbon tab and the
 * selected `DimensionEntity`'s per-part style overrides.
 *
 * Mirror του `useRibbonLineToolBridge` (ADR-510 Φ2E): κάθε per-part control
 * (χρώμα / πάχος / τύπος γραμμής / βελάκι / γραμματοσειρά κάθε μέρους) διαβάζει
 * την ΤΡΕΧΟΥΣΑ resolved τιμή (`resolveDimStyle`) και γράφει στο `entity.overrides`
 * μέσω του generic `UpdateEntityCommand` (undoable — μηδέν νέα command class).
 *
 * Single-mode (σε αντίθεση με το line bridge dual-mode): οι διαστάσεις παίρνουν
 * per-part overrides ΜΟΝΟ σε επιλεγμένη οντότητα· τα global DIMSTYLE defaults
 * επεξεργάζονται από τον Style Manager (Φ5), όχι από draw-defaults εδώ.
 *
 * Options SSoT (καμία διπλή λίστα): linetypes = `listSelectableLinetypeNames()`
 * (ίδιο με line bridge/radial-ring), arrow styles = `listArrowheadBlockNames()`
 * (τα 20 πραγματικά blocks που αποδίδει ο renderer). Colors/weights/sizes/font
 * = editable/color-swatch — τα presets τα δηλώνει το tab (Φ4), το bridge δίνει
 * μόνο την τιμή (ίδιο pattern με `text.height`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-562-dimension-per-part-styling.md §Φ3
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getLinetypeRegistrySnapshot,
  subscribeLinetypeRegistry,
  listSelectableLinetypeNames,
} from '../../../stores/LinetypeRegistry';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import type { LineweightMm } from '../../../types/entities';
import {
  isDimensionEntity,
  type DimensionEntity,
  type DimStyle,
} from '../../../types/entities';
import { resolveDimStyle } from '../../../systems/dimensions/dim-style-resolver';
import { getDimStyleRegistry } from '../../../systems/dimensions/dim-style-registry';
import { listArrowheadBlockNames } from '../../../systems/dimensions/dim-arrowhead-blocks';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import type { RibbonComboboxOption } from '../types/ribbon-types';
import { DIM_RIBBON_KEYS, isDimRibbonKey } from './bridge/dim-command-keys';
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

export interface UseRibbonDimBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonDimBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

const BYLAYER = 'ByLayer';
/** ACI 256 = ByLayer sentinel for the dim color channels. */
const ACI_BYLAYER = 256;

// ──────────────────────────────────────────────────────────────────────────────
// Per-part key → DimStyle field mapping (ONE source; drives read + write)
// ──────────────────────────────────────────────────────────────────────────────

type DimFieldKind = 'color' | 'lineweight' | 'linetype' | 'arrowStyle' | 'number' | 'font';

interface DimKeySpec {
  /** Primary DIMSTYLE field this control reads/writes. */
  readonly field: keyof DimStyle;
  readonly kind: DimFieldKind;
  /** Extra fields written with the IDENTICAL value (unified ext linetype). */
  readonly sameValue?: readonly (keyof DimStyle)[];
  /** Fields reset to '' so both arrowheads inherit the unified `dimblk`. */
  readonly clear?: readonly (keyof DimStyle)[];
}

const K = DIM_RIBBON_KEYS.override;

const DIM_KEY_MAP: Readonly<Record<string, DimKeySpec>> = {
  [K.color]:      { field: 'dimclrd', kind: 'color' },
  [K.lineWeight]: { field: 'dimlwd', kind: 'lineweight' },
  [K.lineType]:   { field: 'dimltype', kind: 'linetype' },
  [K.extColor]:   { field: 'dimclre', kind: 'color' },
  [K.extWeight]:  { field: 'dimlwe', kind: 'lineweight' },
  [K.extType]:    { field: 'dimltex1', kind: 'linetype', sameValue: ['dimltex2'] },
  [K.arrowStyle]: { field: 'dimblk', kind: 'arrowStyle', clear: ['dimblk1', 'dimblk2'] },
  [K.arrowColor]: { field: 'arrowColor', kind: 'color' },
  [K.arrowSize]:  { field: 'dimasz', kind: 'number' },
  [K.textColor]:  { field: 'dimclrt', kind: 'color' },
  [K.textFont]:   { field: 'textFontFamily', kind: 'font' },
  [DIM_RIBBON_KEYS.text.height]: { field: 'paperTextHeight', kind: 'number' },
};

// ──────────────────────────────────────────────────────────────────────────────
// Value formatting (read) + parsing (write) — pure
// ──────────────────────────────────────────────────────────────────────────────

/** ACI → combobox string (256 → 'ByLayer'). */
function colorToValue(aci: number): string {
  return aci === ACI_BYLAYER ? BYLAYER : String(aci);
}

/** LineweightMm → combobox string (-2 → 'ByLayer'). */
function lineweightToValue(lw: LineweightMm): string {
  return lw === LINEWEIGHT_SPECIAL.BYLAYER ? BYLAYER : String(lw);
}

/** Effective arrow color: the separate channel when set, else the dim-line color. */
function arrowColorValue(style: DimStyle): string {
  return colorToValue(style.arrowColor ?? style.dimclrd);
}

/** Read one control's display value from the resolved style. */
function readValue(spec: DimKeySpec, style: DimStyle): string {
  switch (spec.kind) {
    case 'color':
      return spec.field === 'arrowColor' ? arrowColorValue(style) : colorToValue(style[spec.field] as number);
    case 'lineweight':
      return lineweightToValue(style[spec.field] as LineweightMm);
    case 'arrowStyle':
      return String(style.dimblk1 || style.dimblk);
    case 'linetype':
    case 'font':
      return String(style[spec.field] ?? '');
    case 'number':
      return String(style[spec.field] ?? 0);
  }
}

/** Parse a combobox string into the DIMSTYLE field value, or `undefined` to skip. */
function parseValue(spec: DimKeySpec, value: string): DimStyle[keyof DimStyle] | undefined {
  switch (spec.kind) {
    case 'color':
      return (value === BYLAYER ? ACI_BYLAYER : parseInt(value, 10)) as DimStyle[keyof DimStyle];
    case 'lineweight':
      return (value === BYLAYER
        ? LINEWEIGHT_SPECIAL.BYLAYER
        : (parseFloat(value) as LineweightMm)) as DimStyle[keyof DimStyle];
    case 'number': {
      const n = parseFloat(value);
      return Number.isFinite(n) && n >= 0 ? (n as DimStyle[keyof DimStyle]) : undefined;
    }
    case 'linetype':
    case 'font':
    case 'arrowStyle':
      return value as DimStyle[keyof DimStyle];
  }
}

/** Build the merged `overrides` patch for one key change (primary + mirrors + clears). */
function buildOverridesPatch(
  spec: DimKeySpec,
  parsed: DimStyle[keyof DimStyle],
  prev: DimensionEntity['overrides'],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev, [spec.field]: parsed };
  for (const f of spec.sameValue ?? []) next[f] = parsed;
  for (const f of spec.clear ?? []) next[f] = '';
  return next;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export function useRibbonDimBridge(props: UseRibbonDimBridgeProps): RibbonDimBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  // Live linetype catalog for the linetype dropdowns (low-frequency).
  const registry = useSyncExternalStore(
    subscribeLinetypeRegistry, getLinetypeRegistrySnapshot, getLinetypeRegistrySnapshot,
  );

  const linetypeOptions = useMemo<readonly RibbonComboboxOption[]>(
    () => listSelectableLinetypeNames().map((name) => ({
      value: name, labelKey: name, isLiteralLabel: true,
    })),
    [registry],
  );
  const arrowStyleOptions = useMemo<readonly RibbonComboboxOption[]>(
    () => listArrowheadBlockNames().map((name) => ({
      value: name, labelKey: name, isLiteralLabel: true,
    })),
    [],
  );

  /** The selected dimension entity, or null. */
  const resolveSelectedDim = useCallback((): DimensionEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isDimensionEntity(e) ? e : null;
  }, [levelManager, universalSelection]);

  const patchOverrides = useCallback(
    (entity: DimensionEntity, nextOverrides: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateEntityCommand(entity.id, { overrides: nextOverrides }, sm, 'Update dimension style'),
      );
    },
    [executeCommand, levelManager],
  );

  const optionsFor = useCallback(
    (kind: DimFieldKind): readonly RibbonComboboxOption[] => {
      if (kind === 'linetype') return linetypeOptions;
      if (kind === 'arrowStyle') return arrowStyleOptions;
      return [];
    },
    [linetypeOptions, arrowStyleOptions],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isDimRibbonKey(commandKey)) return null;
      const spec = DIM_KEY_MAP[commandKey];
      if (!spec) return null; // action-only dim keys (style chooser / modify) — not a combobox
      const entity = resolveSelectedDim();
      if (!entity) return { value: '', options: optionsFor(spec.kind) };
      const style = resolveDimStyle(entity, getDimStyleRegistry());
      return { value: readValue(spec, style), options: optionsFor(spec.kind) };
    },
    [resolveSelectedDim, optionsFor],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isDimRibbonKey(commandKey)) return;
      const spec = DIM_KEY_MAP[commandKey];
      if (!spec) return;
      const entity = resolveSelectedDim();
      if (!entity) return;
      const parsed = parseValue(spec, value);
      if (parsed === undefined) return;
      patchOverrides(entity, buildOverridesPatch(spec, parsed, entity.overrides));
    },
    [resolveSelectedDim, patchOverrides],
  );

  return useMemo(
    () => ({ getComboboxState, onComboboxChange }),
    [getComboboxState, onComboboxChange],
  );
}
