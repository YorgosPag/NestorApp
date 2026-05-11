/**
 * COMMAND OPTIONS — entity creation
 *
 * Extracted from `core/commands/interfaces.ts` (ADR-031) to keep that file
 * under the Google file-size limit while staying inside the types/ tier
 * exempted from line-count enforcement. See ADR-057 for the `existingId`
 * usage contract.
 */

export interface CreateEntityOptions {
  layer?: string;
  color?: string;
  lineweight?: number;
  opacity?: number;
  /**
   * Preserve a pre-existing entity ID instead of generating a new one.
   * Used by `completeEntity()` (ADR-057) so the entity id assigned at
   * tool-completion time survives through the command into the scene —
   * keeping grip selection, AI tools, and overlay persistence consistent.
   */
  existingId?: string;
}
