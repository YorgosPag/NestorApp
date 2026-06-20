/**
 * ============================================================================
 * EXPORT ENTITY SCOPE — content filter (SSoT)
 * ============================================================================
 *
 * Partitions a scene's entities by the user's content choice
 * (`dxf-only` / `bim-only` / `both`). The DXF↔BIM discriminator is the
 * existing `isBimEntity()` predicate — there is NO second hardcoded type
 * list anywhere in the export pipeline (single source of truth).
 *
 * ADR-505 §A.
 */

import type { Entity } from '../../types/entities';
import { isBimEntity } from '../../types/entities';
import type { ExportEntityScope } from '../types';

/**
 * Select the entities that belong in the export, given the content scope.
 * Returns a NEW array; never mutates the input. BIM entities selected here are
 * decomposed to DXF primitives downstream (`bim-to-dxf-primitives.ts`) when the
 * target format is DXF; native formats (IFC) consume them as-is.
 */
export function resolveExportEntities(
  entities: readonly Entity[],
  scope: ExportEntityScope,
): Entity[] {
  switch (scope) {
    case 'dxf-only':
      return entities.filter((e) => !isBimEntity(e));
    case 'bim-only':
      return entities.filter((e) => isBimEntity(e));
    case 'both':
      return [...entities];
    default:
      return assertNever(scope);
  }
}

/**
 * True when the chosen content scope yields at least one BIM entity — used by
 * the dialog to disable IFC for `dxf-only` (IFC carries only BIM elements).
 */
export function scopeIncludesBim(scope: ExportEntityScope): boolean {
  return scope === 'bim-only' || scope === 'both';
}

/**
 * True when the chosen content scope yields at least one native-DXF entity.
 */
export function scopeIncludesDxfNative(scope: ExportEntityScope): boolean {
  return scope === 'dxf-only' || scope === 'both';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ExportEntityScope: ${String(value)}`);
}
