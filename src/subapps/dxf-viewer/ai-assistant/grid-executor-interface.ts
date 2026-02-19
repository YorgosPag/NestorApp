/**
 * @module ai-assistant/grid-executor-interface
 * @description Interfaces for AI-driven Grid execution (Dependency Inversion)
 *
 * These interfaces define what the AI executor expects from the Grid System.
 * The Grid System (ADR-189) will implement these interfaces when built.
 *
 * Pattern: Dependency Inversion Principle
 * - AI module defines the contract (this file)
 * - Grid module implements the contract
 * - No circular dependency — AI depends on interfaces, Grid depends on interfaces
 *
 * IMPORTANT: These are pure interfaces — zero runtime cost.
 * Implementation is provided when Grid System (ADR-189) is built.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-19
 */

import type {
  GridGuide,
  GridContextSnapshot,
  GridOperationResult,
  GridGhostPreview,
  AddGuideArgs,
  RemoveGuideArgs,
  MoveGuideArgs,
  CreateGridGroupArgs,
  SetGridSpacingArgs,
  ToggleGridSnapArgs,
} from './grid-types';

// ============================================================================
// HEADLESS API (for AI tool execution — no UI dependency)
// ============================================================================

/**
 * Headless API for grid operations invoked by the AI.
 * Each method corresponds to a grid tool in grid-tool-definitions.ts.
 *
 * The Grid System implements this interface and registers it
 * with the AI executor at runtime.
 */
export interface IGridHeadlessAPI {
  /** Add a guide line to the grid */
  addGuide(args: AddGuideArgs): GridOperationResult;
  /** Remove a guide line by ID */
  removeGuide(args: RemoveGuideArgs): GridOperationResult;
  /** Move a guide to a new offset */
  moveGuide(args: MoveGuideArgs): GridOperationResult;
  /** Create a named group of evenly-spaced guides */
  createGroup(args: CreateGridGroupArgs): GridOperationResult;
  /** Change the uniform spacing of a grid group */
  setSpacing(args: SetGridSpacingArgs): GridOperationResult;
  /** Enable or disable snap-to-grid */
  toggleSnap(args: ToggleGridSnapArgs): GridOperationResult;
  /** Get the current grid state snapshot (for DxfCanvasContext) */
  getSnapshot(): GridContextSnapshot;
}

// ============================================================================
// GHOST PREVIEW PROVIDER (for AI visual feedback before commit)
// ============================================================================

/**
 * Provider for ghost (preview) rendering of grid guides.
 * Used to show a visual preview of where a guide will be placed
 * before the AI commits the operation.
 */
export interface IGridGhostProvider {
  /** Show a ghost preview of a guide on the canvas */
  previewGuide(guide: GridGuide): GridGhostPreview;
  /** Clear all ghost grid previews */
  clearPreview(): void;
}
