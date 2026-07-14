'use client';

/**
 * ADR-654 — read/write bridge για τα πεδία ενός επιλεγμένου entourage `ImageEntity`
 * (έπιπλο/άνθρωπος/όχημα/φυτό) στο Properties palette. Mirror του `useBlockPropertyBridge`.
 *
 * Επιστρέφει το `{ getComboboxState, onComboboxChange }` ζεύγος που καταναλώνει ο κοινός
 * `EntityPropertySection` renderer (ίδιος με block/line/hatch). Κάθε write περνά από το SSoT
 * `useEntityPatchCommand` → `UpdateEntityCommand` (undoable, ΤΟ ΙΔΙΟ command με τα image grips,
 * ADR-654) — μηδέν νέα geometry math. Το layer field reuse-άρει τον κοινό `useEntityLayerField`.
 *
 * Το `position` είναι η κάτω-αριστερή γωνία (y-up, σύμβαση DXF INSERT)· `width/height` σε μονάδες
 * σχεδίου (fill render, ADR-654). Η `source` είναι read-only (το filename του asset).
 */

import { useCallback } from 'react';
import type { ImageEntity } from '../../types/image';
import type { RibbonComboboxState } from '../ribbon/context/RibbonCommandContext';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { useEntityPatchCommand } from '../../hooks/commands/useEntityPatchCommand';
import { useEntityLayerField } from '../ribbon/hooks/bridge/useEntityLayerField';
import { toDisp, fromDisp } from '../ribbon/hooks/useRibbonLineToolBridge.helpers';
import { formatAngleValue } from '../../config/units';
import { IMAGE_PROPERTY_KEYS as K } from '../ribbon/hooks/bridge/image-command-keys';

export interface ImagePropertyBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

/** Φιλικό όνομα πηγής: το τελευταίο path segment του url (χωρίς query), αλλιώς το ίδιο το url. */
export function imageSourceLabel(url: string): string {
  if (!url) return '';
  const withoutQuery = url.split(/[?#]/)[0];
  const segment = withoutQuery.split('/').pop() ?? withoutQuery;
  return decodeURIComponent(segment) || url;
}

export function useImagePropertyBridge(
  image: ImageEntity | null,
  levelManager: SceneAdapterLevelManager,
): ImagePropertyBridge {
  const patchEntity = useEntityPatchCommand(levelManager);
  const layerField = useEntityLayerField(levelManager);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!image) return null;
      switch (commandKey) {
        case K.source: return { value: imageSourceLabel(image.url), options: [] };
        case K.layer: return layerField.getState(image);
        case K.posX: return { value: toDisp(image.position.x), options: [] };
        case K.posY: return { value: toDisp(image.position.y), options: [] };
        case K.width: return { value: toDisp(image.width), options: [] };
        case K.height: return { value: toDisp(image.height), options: [] };
        case K.rotation: return { value: formatAngleValue(image.rotation ?? 0), options: [] };
        default: return null;
      }
    },
    [image, layerField],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!image) return;
      switch (commandKey) {
        case K.layer:
          layerField.apply(image, value);
          return;
        case K.posX:
        case K.posY: {
          const n = fromDisp(value);
          if (!Number.isFinite(n)) return;
          const position = commandKey === K.posX
            ? { x: n, y: image.position.y }
            : { x: image.position.x, y: n };
          patchEntity(image.id, { position }, 'Move image');
          return;
        }
        case K.width: {
          const n = fromDisp(value);
          if (!Number.isFinite(n) || n <= 0) return;
          patchEntity(image.id, { width: n }, 'Resize image');
          return;
        }
        case K.height: {
          const n = fromDisp(value);
          if (!Number.isFinite(n) || n <= 0) return;
          patchEntity(image.id, { height: n }, 'Resize image');
          return;
        }
        case K.rotation: {
          const n = Number.parseFloat(value);
          if (!Number.isFinite(n)) return;
          patchEntity(image.id, { rotation: n }, 'Rotate image');
          return;
        }
        default:
          return;
      }
    },
    [image, patchEntity, layerField],
  );

  return { getComboboxState, onComboboxChange };
}
