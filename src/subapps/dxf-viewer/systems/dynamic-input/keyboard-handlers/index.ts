/**
 * 🏢 ENTERPRISE: Keyboard Handler Registry
 * Strategy Pattern - Tool → Handler mapping
 *
 * Architecture:
 * - Single entry point for all keyboard handlers
 * - getKeyboardHandler() returns appropriate handler for tool
 * - Easy to extend with new tools
 */

import { handleLineKeyboard } from './line-keyboard-handler';
import { handleCircleKeyboard } from './circle-keyboard-handler';
import { handleDefaultKeyboard } from './default-keyboard-handler';
import { handleStairKeyboard } from './stair-keyboard-handler';
import type { KeyboardHandler, KeyboardHandlerRegistry } from './types';

/**
 * 🏢 ENTERPRISE: Tool → Handler Registry
 * Maps tool names to their keyboard handlers
 */
const KEYBOARD_HANDLER_REGISTRY: KeyboardHandlerRegistry = {
  // Line tool
  'line': handleLineKeyboard,

  // Circle tools (all use same handler)
  'circle': handleCircleKeyboard,
  'circle-diameter': handleCircleKeyboard,
  'circle-2p-diameter': handleCircleKeyboard,

  // ADR-358 Phase 5a — Stair tool
  'stair': handleStairKeyboard,
};

/**
 * 🏢 ENTERPRISE: Get Keyboard Handler for Tool
 * Returns the appropriate handler or default fallback
 *
 * @param tool - The active tool name
 * @returns KeyboardHandler function for the tool
 */
export function getKeyboardHandler(tool: string): KeyboardHandler {
  return KEYBOARD_HANDLER_REGISTRY[tool] ?? handleDefaultKeyboard;
}

/**
 * 🏢 ENTERPRISE: Check if Tool has Custom Handler
 * Useful for UI hints or debugging
 */
export function hasCustomKeyboardHandler(tool: string): boolean {
  return tool in KEYBOARD_HANDLER_REGISTRY;
}

/**
 * 🏢 ENTERPRISE: Get All Registered Tools
 * Returns array of tools with custom handlers
 */
export function getRegisteredKeyboardTools(): string[] {
  return Object.keys(KEYBOARD_HANDLER_REGISTRY);
}

// Export types
export type {
  KeyboardHandler,
  KeyboardHandlerContext,
  KeyboardHandlerActions,
  KeyboardHandlerRefs,
  DynamicSubmitPayload,
  Phase
} from './types';

// ADR-357 Phase 6: coord-mode type + parser utilities
export type { CoordMode } from '../coordinate-parser';
export { looksLikeCoordSyntax, applyCoordMode, parseCoordInput } from '../coordinate-parser';

// Export individual handlers for testing
export { handleLineKeyboard } from './line-keyboard-handler';
export { handleCircleKeyboard } from './circle-keyboard-handler';
export { handleDefaultKeyboard } from './default-keyboard-handler';
export { handleStairKeyboard, validateStairField, STAIR_FIELD_RANGES } from './stair-keyboard-handler';
