/**
 * OVERLAY COMMANDS INDEX
 *
 * 🏢 ENTERPRISE (2026-01-26): Export all overlay-related commands - ADR-032
 *
 * Commands:
 * - DeleteOverlayCommand: Delete single overlay with undo support
 * - DeleteMultipleOverlaysCommand: Batch delete overlays with undo support
 * - DeleteOverlayVertexCommand: Delete single vertex with undo support
 * - DeleteMultipleOverlayVerticesCommand: Batch delete vertices with undo support
 * - MoveOverlayCommand: Move entire overlay with undo support (NEW 2027-01-27)
 * - MoveMultipleOverlaysCommand: Batch move overlays with undo support (NEW 2027-01-27)
 * - MoveOverlayVertexCommand: Move single vertex with undo support
 * - MoveMultipleOverlayVerticesCommand: Batch move vertices with undo support (multi-grip)
 */

export { DeleteOverlayCommand, DeleteMultipleOverlaysCommand } from './DeleteOverlayCommand';
export { DeleteOverlayVertexCommand, DeleteMultipleOverlayVerticesCommand } from './DeleteOverlayVertexCommand';
export { MoveOverlayCommand, MoveMultipleOverlaysCommand } from './MoveOverlayCommand'; // 🆕 2027-01-27
export { MoveOverlayVertexCommand, MoveMultipleOverlayVerticesCommand } from './MoveOverlayVertexCommand';
export type { VertexMovement } from './MoveOverlayVertexCommand';
