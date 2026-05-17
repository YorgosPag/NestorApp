/**
 * @file Layer Naming Guard — server-side trust boundary (ADR-358 §5.6 Q9 Phase 9B).
 *
 * Wraps the SSoT `validateLayerName` and projects its result into a
 * `LayerOperationResult` ready to be returned by `LayerOperationsService`.
 *
 * Consumers: `LayerOperationsService.createLayer` / `.renameLayer`.
 * Defender hierarchy ref: ADR-358 §5.6 line 993-998.
 */

import type { SceneModel } from '../../types/scene';
import {
  validateLayerName,
  type LayerNameValidationError,
} from '../layer-name-validator';

export interface LayerNamingGuardInput {
  readonly name: string;
  readonly scene: SceneModel;
  /** Id of the layer being renamed; omit for create. */
  readonly excludeId?: string;
}

export interface LayerNamingGuardFailure {
  updatedScene: SceneModel;
  success: false;
  message: string;
  validationError: LayerNameValidationError;
}

const MESSAGES: Record<LayerNameValidationError, string> = {
  EMPTY: 'Layer name cannot be empty',
  WHITESPACE_ONLY: 'Layer name cannot be whitespace only',
  LEADING_TRAILING_WS: 'Layer name cannot start or end with whitespace',
  TOO_LONG: 'Layer name exceeds 255 characters',
  INVALID_CHARS: 'Layer name contains invalid characters (<>/\\":;?*|,=`\')',
  RESERVED: 'Layer "0" is system-reserved and cannot be renamed or reused',
  DUPLICATE: 'A layer with this name already exists',
};

/**
 * Validate a candidate layer name; on failure returns a ready-to-return
 * `LayerOperationResult`-shaped failure, on success returns `null` so the
 * caller proceeds with its normal mutation path.
 */
export function guardLayerName(
  input: LayerNamingGuardInput,
): LayerNamingGuardFailure | null {
  const { name, scene, excludeId } = input;
  const result = validateLayerName({
    name,
    existingLayers: Object.values(scene.layersById ?? {}),
    excludeId,
  });
  if (result.valid) return null;

  const error = result.error as LayerNameValidationError;
  const baseMessage = MESSAGES[error];
  const message = result.suggestion
    ? `${baseMessage} (suggestion: "${result.suggestion}")`
    : baseMessage;

  return {
    updatedScene: scene,
    success: false,
    message,
    validationError: error,
  };
}
