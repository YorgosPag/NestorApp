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
export { OffsetEntityCommand } from './OffsetEntityCommand';
export type { OffsetCommandParams } from './OffsetEntityCommand';
// ADR-510 Φ5 — generic EXPLODE (polyline/rectangle → primitives, undoable).
export { ExplodeEntityCommand } from './ExplodeEntityCommand';
// ADR-575 — GROUP «Ομαδοποίηση» (N entities → 1 block container; UNGROUP = EXPLODE).
export { CreateGroupCommand } from './CreateGroupCommand';
// ADR-652 M6 — «Δημιουργία Block» (N entities → 1 BlockEntity instance; AutoCAD BLOCK/BMAKE).
export { CreateBlockFromSelectionCommand } from './CreateBlockFromSelectionCommand';
export { CornerEntityCommand } from './CornerEntityCommand';
export type { CornerCommandParams, CornerTrimOp, CornerKind } from './CornerEntityCommand';
export { WallSplitCommand } from './WallSplitCommand';
export type { WallSplitCommandParams } from './WallSplitCommand';
export { WallMergeCommand } from './WallMergeCommand';
export type { WallMergeCommandParams } from './WallMergeCommand';
export { ReorderEntityCommand } from './ReorderEntityCommand';
// ADR-661 — atomic multi-entity send-to-back / bring-to-front (multi-select + topo auto-send-to-back).
export { BatchReorderEntityCommand } from './BatchReorderEntityCommand';
