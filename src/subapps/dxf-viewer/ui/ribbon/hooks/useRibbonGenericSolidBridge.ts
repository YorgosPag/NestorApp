'use client';

/**
 * ADR-684 — Bridge για την contextual καρτέλα «Ιδιότητες Στερεού». **Dual mode** (Φ4-B, mirror
 * `useRibbonAnnotationSymbolBridge` / `useRibbonScaleBarBridge`):
 *
 *   - **Επιλεγμένο** generic-solid → read/write ΤΟ ΙΔΙΟ entity μέσω `UpdateGenericSolidParamsCommand`
 *     (undoable, geometry recompute ατομικά). Ο χρήστης επεξεργάζεται σχήμα/διαστάσεις/περιστροφή/
 *     υψόμετρο του υπάρχοντος στερεού — ό,τι δεν βγαίνει με λαβή (ύψος/πάχος/πλευρές/άνω-ακτίνα, Φ4-A).
 *   - **Καμία επιλογή** (εργαλείο `generic-solid` ενεργό) → read/write στο `genericSolidToolBridgeStore`
 *     (defaults για την ΕΠΟΜΕΝΗ τοποθέτηση — η τωρινή Φ3 συμπεριφορά, ΑΘΙΚΤΗ).
 *
 * Η μία δομική διαφορά από furniture (gotcha §3.2): οι διαστάσεις ζουν ΜΕΣΑ στο `shape` discriminated
 * union → το write περνά από το SSoT `applyGenericSolidRibbonEdit` (πλήρες nextParams), όχι flat
 * overrides. Το κλείσιμο key → field ζει μία φορά στο `generic-solid-ribbon-edit` (κοινό στα 2 modes).
 *
 * No-ops για commandKeys εκτός `GENERIC_SOLID_RIBBON_KEYS` → composes με τα άλλα bridges.
 *
 * @see ./bridge/generic-solid-ribbon-edit — pure key→params SSoT (React-free, testable)
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import { useCallback } from 'react';
import { genericSolidToolBridgeStore, type GenericSolidToolBridgeHandle } from './bridge/generic-solid-tool-bridge-store';
import {
  GENERIC_SOLID_RIBBON_KEYS_ACTIONS,
  GENERIC_SOLID_PANEL_KEY_TO_KIND,
  isGenericSolidPanelVisibilityKey,
} from './bridge/generic-solid-command-keys';
import {
  classifyGenericSolidKey,
  readGenericSolidValue,
  applyGenericSolidRibbonEdit,
  type GenericSolidEditTarget,
} from './bridge/generic-solid-ribbon-edit';
import {
  DEFAULT_GENERIC_SOLID_SHAPE,
  DEFAULT_GENERIC_SOLID_STRUCTURAL_ROLE,
  type GenericSolidEntity,
  type GenericSolidParams,
  type GenericSolidShapeKind,
  type GenericSolidStructuralRole,
} from '../../../bim/entities/generic-solid/generic-solid-types';
import { defaultGenericSolidShapeOfKind } from '../../../bim/entities/generic-solid/generic-solid-shape-defaults';
import { isGenericSolidEntity } from '../../../types/entities';
import { useCommandHistory } from '../../../core/commands';
import { UpdateGenericSolidParamsCommand } from '../../../core/commands/entity-commands/UpdateGenericSolidParamsCommand';
import { emitBimEntityParamsUpdated } from '../../../systems/events/emit-bim-entity-params-updated';
import type { RibbonEntityBridgeCore, RibbonComboboxState } from './ribbon-entity-bridge-shared';
import {
  useNoopToggles,
  useStableBridge,
  useResolveSelectedEntity,
  useActiveSceneManager,
  type LevelSceneWriter,
  type PrimaryIdSelection,
} from './ribbon-entity-bridge-shared';

export interface UseRibbonGenericSolidBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: PrimaryIdSelection;
}

export type RibbonGenericSolidBridge = RibbonEntityBridgeCore;

/** `{ value, options: [] }` combobox state (options come from the static tab data). */
const state = (value: string): RibbonComboboxState => ({ value, options: [] });

/**
 * Tool-defaults write (drawing mode): εφαρμόζει το `target = value` πάνω στο tool handle store. Το
 * `shape` union ζει στο handle → shapeKind/dim γράφουν το `shape`, rotation/mounting → overrides.
 */
function writeToolDefault(
  handle: GenericSolidToolBridgeHandle,
  target: GenericSolidEditTarget,
  value: string,
): void {
  if (target.t === 'shapeKind') {
    handle.setShape(defaultGenericSolidShapeOfKind(value as GenericSolidShapeKind));
    return;
  }
  if (target.t === 'structuralRole') {
    if (value === 'structural' || value === 'decorative') {
      handle.setParamOverrides({ structuralRole: value as GenericSolidStructuralRole });
    }
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  if (target.t === 'rotation') return handle.setParamOverrides({ rotationDeg: n });
  if (target.t === 'mounting') return handle.setParamOverrides({ mountingElevationMm: n });
  // dim — patch the live shape (guarded: a stale key from another shape is a no-op).
  const current = handle.shape;
  if (!(target.field in current)) return;
  handle.setShape({ ...current, [target.field]: n });
}

export function useRibbonGenericSolidBridge(
  props: UseRibbonGenericSolidBridgeProps,
): RibbonGenericSolidBridge {
  const { levelManager, universalSelection } = props;

  // Subscribe to the tool handle so the ribbon re-renders on tool state changes.
  const toolHandle = genericSolidToolBridgeStore.use();
  const toolShape = toolHandle?.shape ?? DEFAULT_GENERIC_SOLID_SHAPE;
  const overrides = toolHandle?.overrides ?? {};

  /** The selected generic-solid entity (edit mode), or null (tool-defaults mode). */
  const resolveSelected = useResolveSelectedEntity(levelManager, universalSelection, isGenericSolidEntity);
  const buildSceneManager = useActiveSceneManager(levelManager);
  const { execute } = useCommandHistory();
  const { onToggle, getToggleState } = useNoopToggles();

  /** Commit an edit onto the SELECTED entity via the params command (geometry recompute + undo). */
  const commitSelected = useCallback(
    (entity: GenericSolidEntity, next: GenericSolidParams): void => {
      if (next === entity.params) return; // no-op edit → short-circuit
      const sm = buildSceneManager();
      if (!sm) return;
      const command = new UpdateGenericSolidParamsCommand(entity.id, next, entity.params, sm, false);
      if (command.validate() !== null) return;
      execute(command);
      emitBimEntityParamsUpdated('generic-solid', entity.id);
    },
    [buildSceneManager, execute],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const target = classifyGenericSolidKey(commandKey);
      if (!target) return;
      const selected = resolveSelected();
      if (selected) {
        commitSelected(selected, applyGenericSolidRibbonEdit(selected.params, target, value));
        return;
      }
      const handle = genericSolidToolBridgeStore.get();
      if (handle) writeToolDefault(handle, target, value);
    },
    [resolveSelected, commitSelected],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const target = classifyGenericSolidKey(commandKey);
      if (!target) return null;
      const selected = resolveSelected();
      const shape = selected ? selected.params.shape : toolShape;
      const rotationDeg = selected ? selected.params.rotationDeg : overrides.rotationDeg ?? 0;
      const mounting = selected ? selected.params.mountingElevationMm : overrides.mountingElevationMm ?? 0;
      const role: GenericSolidStructuralRole = selected
        ? selected.params.structuralRole ?? DEFAULT_GENERIC_SOLID_STRUCTURAL_ROLE
        : overrides.structuralRole ?? DEFAULT_GENERIC_SOLID_STRUCTURAL_ROLE;
      const value = readGenericSolidValue(target, shape, rotationDeg, mounting, role);
      return value === null ? null : state(value);
    },
    [resolveSelected, toolShape, overrides],
  );

  const onAction = useCallback((_action: string): void => {
    /* no-op — the tab auto-hides when neither an entity is selected nor the tool active */
  }, []);

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      const panelKind = GENERIC_SOLID_PANEL_KEY_TO_KIND[visibilityKey];
      // Keys outside the generic-solid panel set → true (compose without collisions).
      if (panelKind === undefined) return true;
      const selected = resolveSelected();
      const shape = selected ? selected.params.shape : toolShape;
      return panelKind === shape.kind;
    },
    [resolveSelected, toolShape],
  );

  return useStableBridge({
    onComboboxChange,
    getComboboxState,
    onToggle,
    getToggleState,
    onAction,
    getPanelVisibility,
  });
}

/** Type guard used by `useRibbonCommands` composer (per-shape panel visibility). */
export { isGenericSolidPanelVisibilityKey };

/** Exposed so the action interceptor can recognise generic-solid actions. */
export const GENERIC_SOLID_BRIDGE_ACTIONS = GENERIC_SOLID_RIBBON_KEYS_ACTIONS;
