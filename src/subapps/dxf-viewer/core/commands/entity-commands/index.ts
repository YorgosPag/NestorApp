/**
 * ENTITY COMMANDS
 *
 * 🏢 ENTERPRISE (2026-01-25): Commands for entity-level operations
 * - CreateEntityCommand: Create new entities
 * - DeleteEntityCommand: Delete entities (with restore support)
 * - JoinEntityCommand: Join multiple entities (AutoCAD JOIN semantics)
 */

export { CreateEntityCommand } from './CreateEntityCommand';
export { DeleteEntityCommand, DeleteMultipleEntitiesCommand } from './DeleteEntityCommand';
export { JoinEntityCommand } from './JoinEntityCommand';
export { TrimEntityCommand } from './TrimEntityCommand';
export type { TrimCommandParams } from './TrimEntityCommand';
export { ReorderEntityCommand } from './ReorderEntityCommand';
