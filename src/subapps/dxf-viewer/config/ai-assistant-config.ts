/**
 * @module config/ai-assistant-config
 * @description Centralized configuration for DXF AI Drawing Assistant
 *
 * Single source of truth for all AI assistant constants.
 * Zero hardcoded values — everything flows from here.
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-17
 */

import { DXF_DEFAULT_LAYER } from './layer-config';
import { UI_COLORS } from './color-config';

// ============================================================================
// UNIT CONVERSION
// ============================================================================

/** Unit conversion factors — DXF works in mm internally */
export const DXF_AI_UNITS = {
  /** Multiply meters by this to get mm (DXF internal unit) */
  METERS_TO_MM: 1000,
} as const;

// ============================================================================
// SAFETY LIMITS
// ============================================================================

/** Safety limits to prevent abuse and runaway tool calls */
export const DXF_AI_LIMITS = {
  /** Maximum entities a single AI command can create */
  MAX_ENTITIES_PER_COMMAND: 10,
  /** Maximum user message length in characters */
  MAX_MESSAGE_LENGTH: 500,
  /** Maximum chat history entries sent to API */
  MAX_HISTORY_ENTRIES: 6,
} as const;

// ============================================================================
// API CONFIGURATION
// ============================================================================

/** API endpoint and timeout configuration */
export const DXF_AI_API = {
  /** REST endpoint for AI commands */
  ENDPOINT: '/api/dxf-ai/command',
  /** Request timeout in milliseconds */
  TIMEOUT_MS: 30_000,
} as const;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/** Default values for AI-created entities — reuses centralized configs */
export const DXF_AI_DEFAULTS = {
  /** Default layer for new entities (AutoCAD '0') */
  LAYER: DXF_DEFAULT_LAYER,
  /** Default color for new entities */
  COLOR: UI_COLORS.WHITE,
} as const;
