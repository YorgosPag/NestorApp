'use client';

/**
 * ADR-641 (single-click selection surface) — read/write bridge για τα πεδία ενός
 * επιλεγμένου BLOCK στο Properties palette.
 *
 * Επιστρέφει το `{ getComboboxState, onComboboxChange }` ζεύγος που καταναλώνει ο
 * κοινός `EntityPropertySection` renderer (ίδιος με γραμμή/γραμμοσκίαση). Κάθε write
 * περνά από το SSoT `useEntityPatchCommand` → `UpdateEntityCommand` (undoable, ίδιο
 * command με τα block box grips, ADR-641) — μηδέν νέα geometry/scale math. Το layer
 * field reuse-άρει τον κοινό `useEntityLayerField` (live LayerStore + per-object write).
 *
 * INSERT semantics: το `block.entities` (definition-local μέλη) μένουν αμετάβλητα —
 * αλλάζει ΜΟΝΟ το flat `{ position, scale, rotation }` transform + appearance fields.
 */

import { useCallback } from 'react';
import type { BlockEntity } from '../../types/entities';
import type { RibbonComboboxState } from '../ribbon/context/RibbonCommandContext';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { useEntityPatchCommand } from '../../hooks/commands/useEntityPatchCommand';
import { useEntityLayerField } from '../ribbon/hooks/bridge/useEntityLayerField';
import {
  entityTransparencyValue,
  clampTransparency,
} from '../ribbon/hooks/ribbon-entity-bridge-shared';
import { toDisp, fromDisp } from '../ribbon/hooks/useRibbonLineToolBridge.helpers';
import { hexToTrueColor } from '../../utils/dxf-true-color';
import { findClosestAci } from '../../settings/standards/aci';
import { BLOCK_PROPERTY_KEYS as K } from '../ribbon/hooks/bridge/block-command-keys';

export interface BlockPropertyBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

export function useBlockPropertyBridge(
  block: BlockEntity | null,
  levelManager: SceneAdapterLevelManager,
): BlockPropertyBridge {
  const patchEntity = useEntityPatchCommand(levelManager);
  const layerField = useEntityLayerField(levelManager);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!block) return null;
      switch (commandKey) {
        case K.name: return { value: block.name, options: [] };
        case K.count: return { value: String(block.entities.length), options: [] };
        case K.layer: return layerField.getState(block);
        case K.color: return { value: block.color ?? '', options: [] };
        case K.transparency: return { value: entityTransparencyValue(block), options: [] };
        case K.posX: return { value: toDisp(block.position.x), options: [] };
        case K.posY: return { value: toDisp(block.position.y), options: [] };
        case K.scaleX: return { value: String(block.scale.x), options: [] };
        case K.scaleY: return { value: String(block.scale.y), options: [] };
        case K.rotation: return { value: String(block.rotation), options: [] };
        default: return null;
      }
    },
    [block, layerField],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!block) return;
      switch (commandKey) {
        case K.layer:
          layerField.apply(block, value);
          return;
        case K.color:
          // Explicit per-object color (AutoCAD «Concrete»/True Color) — mirror του line `byStylePatch`.
          patchEntity(
            block.id,
            { colorMode: 'Concrete', color: value, colorTrueColor: hexToTrueColor(value), colorAci: findClosestAci(value) },
            'Update block color',
          );
          return;
        case K.transparency: {
          const n = Number.parseFloat(value);
          if (Number.isNaN(n)) return;
          patchEntity(block.id, { transparency: clampTransparency(n) }, 'Update block transparency');
          return;
        }
        case K.posX:
        case K.posY: {
          const n = fromDisp(value);
          if (!Number.isFinite(n)) return;
          const position = commandKey === K.posX
            ? { x: n, y: block.position.y }
            : { x: block.position.x, y: n };
          patchEntity(block.id, { position }, 'Move block');
          return;
        }
        case K.scaleX:
        case K.scaleY: {
          const n = Number.parseFloat(value);
          if (!Number.isFinite(n) || n === 0) return;
          const scale = commandKey === K.scaleX
            ? { x: n, y: block.scale.y }
            : { x: block.scale.x, y: n };
          patchEntity(block.id, { scale }, 'Scale block');
          return;
        }
        case K.rotation: {
          const n = Number.parseFloat(value);
          if (!Number.isFinite(n)) return;
          patchEntity(block.id, { rotation: n }, 'Rotate block');
          return;
        }
        default:
          return;
      }
    },
    [block, patchEntity, layerField],
  );

  return { getComboboxState, onComboboxChange };
}
