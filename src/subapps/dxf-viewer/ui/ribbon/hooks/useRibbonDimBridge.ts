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
 * Options SSoT (καμία διπλή λίστα): linetypes = `buildLinetypeRibbonOptions()`
 * (ΚΟΙΝΟΣ helper με το line bridge — ByLayer + registry + inline thumbnails),
 * arrow styles = `listArrowheadBlockNames()`
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
} from '../../../stores/LinetypeRegistry';
// SSoT — κοινή λίστα «Τύπος Γραμμής» (ByLayer + registry) με inline-SVG thumbnails.
import { buildLinetypeRibbonOptions } from '../data/linetype-ribbon-options';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import type { LineweightMm } from '../../../types/entities';
import {
  isDimensionEntity,
  type DimensionEntity,
  type DimStyle,
} from '../../../types/entities';
import { resolveDimStyle } from '../../../systems/dimensions/dim-style-resolver';
import { resolveDimColorTC } from '../../../rendering/entities/dimension/dim-color-resolver';
import { findClosestAci } from '../../../settings/standards/aci';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import { getDimStyleRegistry } from '../../../systems/dimensions/dim-style-registry';
import { listArrowheadBlockNames, resolveArrowBlockNames } from '../../../systems/dimensions/dim-arrowhead-blocks';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { RibbonComboboxOption } from '../types/ribbon-types';
import { DIM_RIBBON_KEYS, isDimRibbonKey, isDimVisibilityKey } from './bridge/dim-command-keys';
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
  // ADR-362 Round 36 — per-part visibility toggles (show/hide each dim part).
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
}

// ADR-362 Round 36 — visibility command key → the `suppress*` DIMSTYLE fields it
// drives. «Visible» = NONE of the mapped flags set; toggling writes the inverse to
// every field (the central dim line owns BOTH halves → one toggle sets both).
const V = DIM_RIBBON_KEYS.visibility;
const VISIBILITY_FIELD_MAP: Readonly<Record<string, readonly (keyof DimStyle)[]>> = {
  [V.extLine1]: ['suppressExtLine1'],
  [V.extLine2]: ['suppressExtLine2'],
  [V.dimLine]:  ['suppressDimLine1', 'suppressDimLine2'],
  [V.arrow1]:   ['suppressArrow1'],
  [V.arrow2]:   ['suppressArrow2'],
};

const BYLAYER = 'ByLayer';
/** ACI 256 = ByLayer sentinel for the dim color channels. */
const ACI_BYLAYER = 256;

// ──────────────────────────────────────────────────────────────────────────────
// Per-part key → DimStyle field mapping (ONE source; drives read + write)
// ──────────────────────────────────────────────────────────────────────────────

type DimFieldKind = 'color' | 'lineweight' | 'linetype' | 'arrowStyle' | 'number' | 'font' | 'enum';

interface DimKeySpec {
  /** Primary DIMSTYLE field this control reads/writes. */
  readonly field: keyof DimStyle;
  readonly kind: DimFieldKind;
  /** Extra fields written with the IDENTICAL value (unified ext linetype). */
  readonly sameValue?: readonly (keyof DimStyle)[];
  /** Fields reset to '' so both arrowheads inherit the unified `dimblk`. */
  readonly clear?: readonly (keyof DimStyle)[];
  /**
   * ADR-562 Φ7 — for `kind:'color'`, the true-color companion field. Written with
   * the packed hex on change (exact colour), while `field` gets the nearest ACI.
   */
  readonly trueColorField?: keyof DimStyle;
  /**
   * ADR-362 — for `kind:'number'`, the value shown when the field is absent on the
   * resolved style (e.g. `dimltscale` default = 1, not 0). Defaults to 0.
   */
  readonly numberDefault?: number;
}

const K = DIM_RIBBON_KEYS.override;
/** The DIMSTYLE chooser key — applies a whole style to the selected dim (styleId). */
const CHOOSER = DIM_RIBBON_KEYS.style.chooser;
/** Text rotation is an ENTITY field (`textRotation`, deg), not a DIMSTYLE override. */
const TEXT_ROTATION = DIM_RIBBON_KEYS.text.rotation;

const DIM_KEY_MAP: Readonly<Record<string, DimKeySpec>> = {
  [K.color]:      { field: 'dimclrd', kind: 'color', trueColorField: 'dimclrdTrueColor' },
  [K.lineWeight]: { field: 'dimlwd', kind: 'lineweight' },
  [K.lineType]:   { field: 'dimltype', kind: 'linetype' },
  // ADR-362 — linetype density (Path A). Shared by dim + ext lines (one dimltscale
  // per style); numeric override, default 1 (= catalog density).
  [K.lineTypeScale]: { field: 'dimltscale', kind: 'number', numberDefault: 1 },
  [K.extColor]:   { field: 'dimclre', kind: 'color', trueColorField: 'dimclreTrueColor' },
  [K.extWeight]:  { field: 'dimlwe', kind: 'lineweight' },
  [K.extType]:    { field: 'dimltex1', kind: 'linetype', sameValue: ['dimltex2'] },
  // ADR-362 — extension-line linetype density (Path A), independent of dimltscale.
  [K.extTypeScale]: { field: 'dimltexscale', kind: 'number', numberDefault: 1 },
  [K.arrowStyle]: { field: 'dimblk', kind: 'arrowStyle', clear: ['dimblk1', 'dimblk2'] },
  [K.arrowColor]: { field: 'arrowColor', kind: 'color', trueColorField: 'arrowTrueColor' },
  [K.arrowSize]:  { field: 'dimasz', kind: 'number' },
  [K.textColor]:  { field: 'dimclrt', kind: 'color', trueColorField: 'dimclrtTrueColor' },
  [K.textFont]:   { field: 'textFontFamily', kind: 'font' },
  // Text height → DIMTXT (code 140), the SSoT the renderer + all DXF I/O read
  // (paper-mm; render applies dimscale). NOT `paperTextHeight` — writing that
  // left a stale `dimtxt`, so the text never resized (fix 2026-07-06).
  [DIM_RIBBON_KEYS.text.height]: { field: 'dimtxt', kind: 'number' },
  // Vertical text placement (DIMTAD) — a DIMSTYLE override (above/centered/below/…).
  [DIM_RIBBON_KEYS.text.position]: { field: 'dimtad', kind: 'enum' },
};

// ──────────────────────────────────────────────────────────────────────────────
// Value formatting (read) + parsing (write) — pure
// ──────────────────────────────────────────────────────────────────────────────

/** LineweightMm → combobox string (-2 → 'ByLayer'). */
function lineweightToValue(lw: LineweightMm): string {
  return lw === LINEWEIGHT_SPECIAL.BYLAYER ? BYLAYER : String(lw);
}

/**
 * ADR-562 Φ7 — effective hex for a color channel (the ribbon color picker is
 * hex in/out). The true-color companion wins; else the ACI channel. No
 * `layerColour` is passed → a ByLayer channel resolves to the default hex, so
 * the picker opens on a sane initial swatch instead of an empty value.
 */
function colorToHex(spec: DimKeySpec, style: DimStyle): string {
  if (spec.field === 'arrowColor') {
    // Mirror the render inheritance: arrow channel wins, else inherit dim line.
    const tc = style.arrowTrueColor ?? (style.arrowColor == null ? style.dimclrdTrueColor : null);
    return resolveDimColorTC(tc, style.arrowColor ?? style.dimclrd);
  }
  const tc = spec.trueColorField
    ? (style[spec.trueColorField] as number | null | undefined)
    : undefined;
  return resolveDimColorTC(tc, style[spec.field] as number);
}

/** Read one control's display value from the resolved style. */
function readValue(spec: DimKeySpec, style: DimStyle): string {
  switch (spec.kind) {
    case 'color':
      return colorToHex(spec, style);
    case 'lineweight':
      return lineweightToValue(style[spec.field] as LineweightMm);
    case 'arrowStyle':
      // ADR-362 §7 — same `dimblk1 || dimblk` fallback SSoT as the renderers.
      return String(resolveArrowBlockNames(style).block1);
    case 'linetype':
    case 'font':
    case 'enum':
      return String(style[spec.field] ?? '');
    case 'number':
      return String(style[spec.field] ?? spec.numberDefault ?? 0);
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
    case 'enum':
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

  // ADR-562 Φ8 — each option carries an inline-SVG preview descriptor (linetype
  // dash / arrowhead shape). Feeds «Τύπος» (line + extension) and «Στυλ» previews.
  // SSoT: κοινό `buildLinetypeRibbonOptions()` (ίδιο με το line-tool bridge).
  const linetypeOptions = useMemo<readonly RibbonComboboxOption[]>(
    () => buildLinetypeRibbonOptions(),
    [registry],
  );
  const arrowStyleOptions = useMemo<readonly RibbonComboboxOption[]>(
    () => listArrowheadBlockNames().map((name) => ({
      value: name, labelKey: name, isLiteralLabel: true,
      thumbnail: { kind: 'arrowhead' as const, name },
    })),
    [],
  );

  // Live DIMSTYLE registry for the style chooser (all styles by id → name, incl.
  // user-created). Revit «Type Selector» pattern — options come from the SSoT
  // registry, not a static list, so custom styles appear automatically.
  const dimStyleSnapshot = useSyncExternalStore(
    (cb) => getDimStyleRegistry().subscribe(cb),
    () => getDimStyleRegistry().getSnapshot(),
    () => getDimStyleRegistry().getSnapshot(),
  );
  const styleOptions = useMemo<readonly RibbonComboboxOption[]>(
    () => dimStyleSnapshot.styles.map((s) => ({
      value: s.id, labelKey: s.name, isLiteralLabel: true,
    })),
    [dimStyleSnapshot],
  );

  /** The selected dimension entity, or null. */
  const resolveSelectedDim = useCallback((): DimensionEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isDimensionEntity(e) ? e : null;
  }, [levelManager, universalSelection]);

  /** Undoable patch of arbitrary fields on the selected dim (overrides / styleId). */
  const patchEntity = useCallback(
    (entity: DimensionEntity, patch: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateEntityCommand(entity.id, patch, sm, 'Update dimension style'),
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
      // DIMSTYLE chooser — reads the selected dim's `styleId` (Revit type selector).
      if (commandKey === CHOOSER) {
        const entity = resolveSelectedDim();
        return { value: entity?.styleId ?? '', options: styleOptions };
      }
      // Text rotation — an ENTITY field (`textRotation`, deg); tab supplies the presets.
      if (commandKey === TEXT_ROTATION) {
        const entity = resolveSelectedDim();
        return { value: entity ? String(entity.textRotation ?? 0) : '', options: [] };
      }
      const spec = DIM_KEY_MAP[commandKey];
      if (!spec) return null; // action-only dim keys (apply / modify) — not a combobox
      const entity = resolveSelectedDim();
      if (!entity) return { value: '', options: optionsFor(spec.kind) };
      const style = resolveDimStyle(entity, getDimStyleRegistry());
      return { value: readValue(spec, style), options: optionsFor(spec.kind) };
    },
    [resolveSelectedDim, optionsFor, styleOptions],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isDimRibbonKey(commandKey)) return;
      const entity = resolveSelectedDim();
      if (!entity) return;
      // DIMSTYLE chooser — applies the whole style to the dim immediately (styleId).
      if (commandKey === CHOOSER) {
        if (value && value !== entity.styleId) patchEntity(entity, { styleId: value });
        return;
      }
      // Text rotation — write the ENTITY field `textRotation` (deg), not an override.
      if (commandKey === TEXT_ROTATION) {
        const deg = parseFloat(value);
        if (Number.isFinite(deg)) patchEntity(entity, { textRotation: deg });
        return;
      }
      const spec = DIM_KEY_MAP[commandKey];
      if (!spec) return;
      // ADR-562 Φ7 — color channels are hex (ribbon picker). Store BOTH the exact
      // true-color companion (drives render + persist) and the nearest ACI (kept
      // for DXF export degrade, since DIMSTYLE has no true-color group code).
      if (spec.kind === 'color') {
        const next: Record<string, unknown> = {
          ...entity.overrides,
          [spec.field]: findClosestAci(value),
        };
        if (spec.trueColorField) next[spec.trueColorField] = hexToTrueColor(value);
        patchEntity(entity, { overrides: next });
        return;
      }
      const parsed = parseValue(spec, value);
      if (parsed === undefined) return;
      patchEntity(entity, { overrides: buildOverridesPatch(spec, parsed, entity.overrides) });
    },
    [resolveSelectedDim, patchEntity],
  );

  // ADR-362 Round 36 — read one visibility toggle: «pressed» (visible) when NONE of
  // the mapped `suppress*` flags are set on the resolved style. No selection → false.
  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isDimVisibilityKey(commandKey)) return false;
      const fields = VISIBILITY_FIELD_MAP[commandKey];
      const entity = resolveSelectedDim();
      if (!entity || !fields) return false;
      const style = resolveDimStyle(entity, getDimStyleRegistry());
      return fields.every((f) => !style[f]);
    },
    [resolveSelectedDim],
  );

  // Write the inverse (`suppress = !visible`) to every mapped field via the same
  // undoable `overrides` path as the combobox controls (ADR-562 D7).
  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isDimVisibilityKey(commandKey)) return;
      const fields = VISIBILITY_FIELD_MAP[commandKey];
      const entity = resolveSelectedDim();
      if (!entity || !fields) return;
      const next: Record<string, unknown> = { ...entity.overrides };
      for (const f of fields) next[f] = !nextValue;
      patchEntity(entity, { overrides: next });
    },
    [resolveSelectedDim, patchEntity],
  );

  return useMemo(
    () => ({ getComboboxState, onComboboxChange, getToggleState, onToggle }),
    [getComboboxState, onComboboxChange, getToggleState, onToggle],
  );
}
