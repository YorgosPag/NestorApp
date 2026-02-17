/**
 * @module ai-assistant/dxf-tool-definitions
 * @description OpenAI tool definitions for the DXF AI Drawing Assistant
 *
 * 5 tools in Chat Completions API format (same pattern as agentic-tool-definitions.ts):
 * - draw_line: Draw a line segment
 * - draw_rectangle: Draw a rectangle
 * - draw_circle: Draw a circle
 * - query_entities: Query existing entities on canvas
 * - undo_action: Undo recent actions
 *
 * All tools use strict: true with additionalProperties: false.
 * Optional fields use type: ['string', 'null'] and are listed in required.
 *
 * IMPORTANT: Coordinates are in canvas units (pass-through, NO conversion).
 * The user provides values in the same units the canvas displays.
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-17
 */

import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';

// ============================================================================
// DXF AI TOOL DEFINITIONS (Chat Completions API format)
// ============================================================================

export const DXF_AI_TOOL_DEFINITIONS: AgenticToolDefinition[] = [
  // ── 1. draw_line ──
  {
    type: 'function',
    function: {
      name: 'draw_line',
      description:
        'Draw a line segment on the canvas. Pass coordinates exactly as the user specifies them. ' +
        'Do NOT convert units — values go directly to the canvas.',
      parameters: {
        type: 'object',
        properties: {
          start_x: {
            type: 'number',
            description: 'Start X coordinate',
          },
          start_y: {
            type: 'number',
            description: 'Start Y coordinate',
          },
          end_x: {
            type: 'number',
            description: 'End X coordinate',
          },
          end_y: {
            type: 'number',
            description: 'End Y coordinate',
          },
          layer: {
            type: ['string', 'null'],
            description: 'Target layer name (null = default layer "0")',
          },
          color: {
            type: ['string', 'null'],
            description: 'Line color as hex string, e.g. "#FF0000" (null = default white)',
          },
        },
        required: ['start_x', 'start_y', 'end_x', 'end_y', 'layer', 'color'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 2. draw_rectangle ──
  {
    type: 'function',
    function: {
      name: 'draw_rectangle',
      description:
        'Draw a rectangle on the canvas. The origin (x, y) is the bottom-left corner. ' +
        'Pass coordinates and dimensions exactly as the user specifies them. ' +
        'Do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'Bottom-left X coordinate',
          },
          y: {
            type: 'number',
            description: 'Bottom-left Y coordinate',
          },
          width: {
            type: 'number',
            description: 'Width (positive)',
          },
          height: {
            type: 'number',
            description: 'Height (positive)',
          },
          layer: {
            type: ['string', 'null'],
            description: 'Target layer name (null = default layer "0")',
          },
          color: {
            type: ['string', 'null'],
            description: 'Rectangle color as hex string (null = default white)',
          },
        },
        required: ['x', 'y', 'width', 'height', 'layer', 'color'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 3. draw_circle ──
  {
    type: 'function',
    function: {
      name: 'draw_circle',
      description:
        'Draw a circle on the canvas. ' +
        'Pass center and radius exactly as the user specifies them. ' +
        'Do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          center_x: {
            type: 'number',
            description: 'Center X coordinate',
          },
          center_y: {
            type: 'number',
            description: 'Center Y coordinate',
          },
          radius: {
            type: 'number',
            description: 'Radius (must be positive)',
          },
          layer: {
            type: ['string', 'null'],
            description: 'Target layer name (null = default layer "0")',
          },
          color: {
            type: ['string', 'null'],
            description: 'Circle color as hex string (null = default white)',
          },
        },
        required: ['center_x', 'center_y', 'radius', 'layer', 'color'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 4. query_entities ──
  {
    type: 'function',
    function: {
      name: 'query_entities',
      description:
        'Query existing entities on the canvas. Returns a summary of entities ' +
        'with their type, layer, and coordinates. Use this to answer questions like ' +
        '"τι υπάρχει στο σχέδιο;" or "πόσες γραμμές έχω;".',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: ['string', 'null'],
            description:
              'Filter by entity type: "line", "circle", "rectangle", etc. (null = all types)',
          },
          layer: {
            type: ['string', 'null'],
            description: 'Filter by layer name (null = all layers)',
          },
        },
        required: ['type', 'layer'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 5. undo_action ──
  {
    type: 'function',
    function: {
      name: 'undo_action',
      description:
        'Undo the last drawing action(s). Removes the most recently created entities.',
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: ['number', 'null'],
            description: 'Number of actions to undo (null = 1)',
          },
        },
        required: ['count'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
