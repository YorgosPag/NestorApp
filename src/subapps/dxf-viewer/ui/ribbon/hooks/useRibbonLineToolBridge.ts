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
} from '../../../stores/LinetypeRegistry';
// SSoT — κοινή λίστα «Τύπος Γραμμής» (ByLayer + registry) με inline-SVG thumbnails
// (ίδιο helper με το dim bridge → μία και μοναδική πηγή αλήθειας).
import { buildLinetypeRibbonOptions } from '../data/linetype-ribbon-options';
// ADR-570 Φ1 — named line-style («Στυλ Γραμμής» ByStyle) registry + options SSoT.
import {
  getLineStyleRegistry,
  getLineStyleSnapshot,
  subscribeLineStyles,
} from '../../../systems/line-styles/line-style-registry';
import { buildLineStyleRibbonOptions } from '../data/line-style-ribbon-options';
import { LINE_STYLE_BYLAYER_LWT } from '../../../systems/line-styles/line-style-types';
// ADR-510 Φ4 — per-object layer list (AutoCAD «General» → Layer) from the SSoT store.
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
} from '../../../stores/LayerStore';
import { useCurrentLayerChange } from '../../components/layer-picker/useCurrentLayerChange';
import type { LineweightMm, AnySceneEntity } from '../../../types/entities';
// ADR-510 Φ4b — το «Χρώμα» πεδίο χρησιμοποιεί τον κεντρικό dxf-color picker (HEX in/out,
// ίδιος με τις «Ρυθμίσεις DXF»). Read = SSoT `resolveEntityColorHex` (layer-aware effective
// χρώμα)· write = SSoT hex ↔ true-color/ACI. Zero ad-hoc color/layer helpers εδώ.
import { resolveEntityColorHex } from '../../../systems/properties/resolve-entity-color';
import { useLevelLayersById } from '../../../hooks/tools/useLevelLayersById';
import { findClosestAci } from '../../../settings/standards/aci';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import { isStyleEditablePrimitiveType } from '../../../types/style-editable-primitives';
// ADR-510 Φ4 — pure line geometry read/edit helpers (reuse geometry-vector-utils SSoT).
import {
  lineLength,
  lineAngleDeg,
  endForLength,
  endForAngleDeg,
  endForDelta,
  withCoord,
} from '../../../systems/properties/line-geometry-edit';
// ADR-510 Φ2E #4 — undoable entity patch via the shared SSoT hook (same wiring the
// inline «Τμήματα Μοτίβου» LinePropertiesTab uses → one command path, zero clone).
import { useEntityPatchCommand } from '../../../hooks/commands/useEntityPatchCommand';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
  isLineToolRibbonKey,
} from './bridge/line-tool-command-keys';
// ADR-510 Φ4e — FILLET radius field routes to the FilletToolStore (tool state, not
// an entity/style edit). Read for the live combobox value, write on numeric commit.
import { FilletToolStore } from '../../../systems/corner/FilletToolStore';
// ADR-510 Φ4f — CHAMFER distance/angle fields route to the ChamferToolStore.
import { ChamferToolStore } from '../../../systems/corner/ChamferToolStore';
// ADR-510 Φ4g — active-tool SSoT drives the contextual fillet/chamfer option panels
// (Revit «Options Bar»: parameters appear only while their tool is active → zero-scroll).
import { toolStateStore } from '../../../stores/ToolStateStore';
// ADR-510 Φ4 / ADR-570 — pure value/patch helpers (extracted for N.7.1 size budget).
import {
  BYLAYER,
  entityLinetypeValue,
  entityLineweightValue,
  entityLtscaleValue,
  isPolylineLike,
  entityWidthDisplayValue,
  widthPatchForEntity,
  buildLayerOptions,
  entityLayerValue,
  entityTransparencyValue,
  clampTransparency,
  byStylePatch,
  asLine,
  toDisp,
  fromDisp,
  isLineGeometryKey,
  type WidthCapableEntity,
} from './useRibbonLineToolBridge.helpers';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonLineToolBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonLineToolBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  /** ADR-510 Φ4 — the Geometry panel self-hides unless a `line` is selected. */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

export function useRibbonLineToolBridge(
  props: UseRibbonLineToolBridgeProps,
): RibbonLineToolBridge {
  const { levelManager, universalSelection } = props;
  const patchEntityCmd = useEntityPatchCommand(levelManager);

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
  // ADR-510 Φ4b — SSoT getter του id-keyed layer table της ενεργής σκηνής (ΙΔΙΟΣ που
  // τροφοδοτεί τον renderer)· το color swatch λύνει το owning/current layer από εδώ.
  const getLayersById = useLevelLayersById(levelManager);

  const linetypeOptions = useMemo(
    () => buildLinetypeRibbonOptions(),
    [registry],
  );
  const layerOptions = useMemo(
    () => buildLayerOptions(layerSnapshot.layers),
    [layerSnapshot],
  );
  // ADR-570 Φ1 — live named line-style catalog (low-frequency: CRUD is rare).
  const lineStyleSnap = useSyncExternalStore(
    subscribeLineStyles, getLineStyleSnapshot, getLineStyleSnapshot,
  );
  const lineStyleOptions = useMemo(
    () => buildLineStyleRibbonOptions(lineStyleSnap.styles),
    [lineStyleSnap],
  );
  // ADR-510 Φ4e — live FILLET radius so the ribbon field mirrors keyboard entry.
  const filletRadius = useSyncExternalStore(
    FilletToolStore.subscribe, () => FilletToolStore.getState().radius,
  );
  // ADR-510 Φ4f — live CHAMFER state so the distance/angle fields mirror keyboard entry.
  const chamfer = useSyncExternalStore(
    ChamferToolStore.subscribe, () => ChamferToolStore.getState(),
  );
  // ADR-510 Φ4g — live active tool so the fillet/chamfer OPTION panels surface only
  // while their tool is active (Revit «Options Bar» → the tab stays zero-scroll).
  const activeTool = useSyncExternalStore(
    toolStateStore.subscribe, () => toolStateStore.get().activeTool,
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
      patchEntityCmd(entity.id, patch, 'Update line style');
    },
    [patchEntityCmd],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isLineToolRibbonKey(commandKey)) return null;

      // ADR-510 Φ2E #3 — «Νέος τύπος» is a widget launcher, not a combobox: it has
      // no value to read (and must NOT fall through to the color state below).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.newLineType) return null;

      // ADR-510 Φ4e — FILLET radius: tool state, independent of any selection.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.filletRadius) {
        return { value: String(filletRadius), options: [] };
      }
      // ADR-510 Φ4f — CHAMFER distances/angle: tool state, independent of selection.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.chamferDist1) return { value: String(chamfer.d1), options: [] };
      if (commandKey === LINE_TOOL_RIBBON_KEYS.chamferDist2) return { value: String(chamfer.d2), options: [] };
      if (commandKey === LINE_TOOL_RIBBON_KEYS.chamferAngle) return { value: String(chamfer.angle), options: [] };

      const selected = resolveSelected();

      // ADR-570 Φ1 — «Στυλ Γραμμής» (ByStyle). Selected → the entity's pointer;
      // draw-defaults → the registry's active style. Options from the registry.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.lineStyle) {
        const value = selected
          ? (selected.lineStyleId ?? '')
          : lineStyleSnap.activeStyleId;
        return { value, options: lineStyleOptions };
      }
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
      // color — ο dxf-color picker μιλάει HEX (ADR-510 Φ4b, mirror του dim bridge). Το
      // effective (rendered) χρώμα το δίνει ο SSoT `resolveEntityColorHex` (layer-aware:
      // trueColor ▸ ACI ▸ ByLayer, ίδιο owning-layer resolution με τον renderer). Για
      // draw-defaults φτιάχνουμε pseudo-source στο ΤΡΕΧΟΝ layer.
      const layersById = getLayersById();
      if (selected) {
        return { value: resolveEntityColorHex(selected, layersById), options: [] };
      }
      return {
        value: resolveEntityColorHex(
          {
            colorMode: snapshot.colorMode,
            colorAci: snapshot.colorAci ?? undefined,
            colorTrueColor: snapshot.colorTrueColor,
            layerId: layerSnapshot.currentLayerId ?? undefined,
          },
          layersById,
        ),
        options: [],
      };
    },
    [resolveSelected, snapshot, linetypeOptions, layerOptions, layerSnapshot, getLayersById, lineStyleOptions, lineStyleSnap, filletRadius, chamfer],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isLineToolRibbonKey(commandKey)) return;

      // ADR-510 Φ2E #3 — «Νέος τύπος» launcher fires no combobox write of its own
      // (it re-dispatches the `linetype` key on save); ignore it here defensively.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.newLineType) return;

      // ADR-510 Φ4e — FILLET radius: drive the FilletToolStore (mirrors keyboard entry).
      if (commandKey === LINE_TOOL_RIBBON_KEYS.filletRadius) {
        const n = parseFloat(value);
        if (Number.isFinite(n) && n >= 0) FilletToolStore.setRadius(n);
        return;
      }
      // ADR-510 Φ4f — CHAMFER distances/angle: drive the ChamferToolStore.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.chamferDist1) {
        const n = parseFloat(value);
        if (Number.isFinite(n) && n >= 0) ChamferToolStore.setD1(n);
        return;
      }
      if (commandKey === LINE_TOOL_RIBBON_KEYS.chamferDist2) {
        const n = parseFloat(value);
        if (Number.isFinite(n) && n >= 0) ChamferToolStore.setD2(n);
        return;
      }
      if (commandKey === LINE_TOOL_RIBBON_KEYS.chamferAngle) {
        const n = parseFloat(value);
        if (Number.isFinite(n)) ChamferToolStore.setAngle(n);
        return;
      }

      const selected = resolveSelected();

      // ADR-570 Φ1 — «Στυλ Γραμμής» (ByStyle). Picking a style stores the pointer
      // (`lineStyleId`) AND applies its ByStyle props so the change is instantly
      // visible + undoable. Draw-defaults set the active style + seed QuickStyle
      // linetype/lineweight for the NEXT line.
      if (commandKey === LINE_TOOL_RIBBON_KEYS.lineStyle) {
        if (!value) return;
        const style = getLineStyleRegistry().getStyle(value);
        if (!style) return;
        if (selected) {
          patchEntity(selected, byStylePatch(style));
        } else {
          getLineStyleRegistry().setActiveStyleId(value);
          setQuickStyleLinetype(style.pattern);
          setQuickStyleLineweight(
            style.lineweight === LINE_STYLE_BYLAYER_LWT
              ? LINEWEIGHT_SPECIAL.BYLAYER
              : (style.lineweight as LineweightMm),
          );
        }
        return;
      }
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
      // color — hex από τον dxf-color picker. Γράφουμε ΚΑΙ τα ΤΡΙΑ κανάλια ώστε ΚΑΘΕ
      // resolution path να δείχνει το ίδιο χρώμα: `colorTrueColor` (exact, wins στο
      // resolveEntityStyle + persist)· `colorAci` (πλησιέστερο, για DXF export degrade)·
      // `color` (hex) — απαραίτητο για το FALLBACK render path (`resolveEntityRenderStyle`
      // όταν δεν βρεθεί owning layer/`layersById`) που διαβάζει ΜΟΝΟ `entity.color`.
      // ADR-510 Φ4b — αλλιώς η γραμμή έμενε στο χρώμα του layer (bug: «δεν αλλάζει»).
      const trueColor = hexToTrueColor(value);
      const closestAci = findClosestAci(value);
      if (selected) {
        patchEntity(selected, {
          colorMode: 'Concrete',
          color: value,
          colorTrueColor: trueColor,
          colorAci: closestAci,
        });
      } else {
        setQuickStyleColor('Concrete', closestAci, trueColor);
      }
    },
    [resolveSelected, patchEntity, changeCurrentLayer],
  );

  // ADR-510 Φ4 — the Geometry panel is line-only; other primitives hide it.
  // ADR-510 Φ4g — the fillet/chamfer option panels are active-tool-only (Options Bar).
  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry) {
        return asLine(resolveSelected()) !== null;
      }
      if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.filletOptions) {
        return activeTool === 'fillet';
      }
      if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.chamferOptions) {
        return activeTool === 'chamfer';
      }
      if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.widthApplicable) {
        // ADR-510 Φ3d — «Πλάτος» is polyline-only. Show it in draw-defaults mode (no
        // selection → sets the NEXT polyline's default width) or when a width-capable
        // polyline is selected; HIDE it for a selected plain LINE (or any non-polyline
        // primitive), where the field is meaningless and the write silently skips.
        const sel = resolveSelected();
        return sel === null || isPolylineLike(sel.type);
      }
      return true;
    },
    [resolveSelected, activeTool],
  );

  return useMemo(
    () => ({ getComboboxState, onComboboxChange, getPanelVisibility }),
    [getComboboxState, onComboboxChange, getPanelVisibility],
  );
}
