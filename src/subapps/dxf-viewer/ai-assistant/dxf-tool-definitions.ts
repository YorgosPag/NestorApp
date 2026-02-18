/**
 * @module ai-assistant/dxf-tool-definitions
 * @description OpenAI tool definitions for the DXF AI Drawing Assistant
 *
 * 6 tools in Chat Completions API format (same pattern as agentic-tool-definitions.ts):
 * - draw_line: Draw a line segment
 * - draw_rectangle: Draw a rectangle
 * - draw_circle: Draw a circle
 * - draw_polyline: Draw a polyline or polygon
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

  // ── 4. draw_polyline ──
  {
    type: 'function',
    function: {
      name: 'draw_polyline',
      description:
        'Draw a polyline (connected line segments) or polygon (closed polyline) on the canvas. ' +
        'Requires at least 2 vertices. Set closed=true for a polygon. ' +
        'Pass coordinates exactly as the user specifies them. Do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          vertices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { type: 'number', description: 'X coordinate of vertex' },
                y: { type: 'number', description: 'Y coordinate of vertex' },
              },
              required: ['x', 'y'],
              additionalProperties: false,
            },
            description: 'Array of vertices defining the polyline path',
          },
          closed: {
            type: 'boolean',
            description: 'Whether to close the polyline (last vertex connects to first). Use true for polygons.',
          },
          layer: {
            type: ['string', 'null'],
            description: 'Target layer name (null = default layer "0")',
          },
          color: {
            type: ['string', 'null'],
            description: 'Polyline color as hex string (null = default white)',
          },
        },
        required: ['vertices', 'closed', 'layer', 'color'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 5. query_entities ──
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

  // ── 6. draw_shapes (compound tool for multiple entities in one call) ──
  {
    type: 'function',
    function: {
      name: 'draw_shapes',
      description:
        'Draw MULTIPLE shapes in a single call. Use this when the user asks for 2+ shapes ' +
        '(e.g. "2 parallel lines", "house = square + triangle roof", "3 vertical lines"). ' +
        'Each shape has a type and coordinates. ALWAYS use this instead of calling draw_line/draw_rectangle/draw_circle ' +
        'multiple times.',
      parameters: {
        type: 'object',
        properties: {
          shapes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                shape_type: {
                  type: 'string',
                  description: 'Shape type: "line", "rectangle", "circle", "polyline"',
                },
                x1: { type: 'number', description: 'Line: start_x. Rectangle: origin_x. Circle: center_x. Polyline: not used (0).' },
                y1: { type: 'number', description: 'Line: start_y. Rectangle: origin_y. Circle: center_y. Polyline: not used (0).' },
                x2: { type: 'number', description: 'Line: end_x. Rectangle: width. Circle: radius. Polyline: not used (0).' },
                y2: { type: 'number', description: 'Line: end_y. Rectangle: height. Circle: not used (0). Polyline: not used (0).' },
                vertices: {
                  type: ['array', 'null'],
                  items: {
                    type: 'object',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                    },
                    required: ['x', 'y'],
                    additionalProperties: false,
                  },
                  description: 'Only for polyline: array of {x,y} vertices. null for other shapes.',
                },
                closed: { type: ['boolean', 'null'], description: 'Only for polyline: close the shape? null for other shapes.' },
                color: { type: ['string', 'null'], description: 'Color hex string (null = default white)' },
                layer: { type: ['string', 'null'], description: 'Layer name (null = default "0")' },
              },
              required: ['shape_type', 'x1', 'y1', 'x2', 'y2', 'vertices', 'closed', 'color', 'layer'],
              additionalProperties: false,
            },
            description: 'Array of shapes to draw',
          },
        },
        required: ['shapes'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 7. undo_action ──
  {
    type: 'function',
    function: {
      name: 'undo_action',
      description:
        'Undo the last drawing action(s). Removes the most recently added entities from the canvas.',
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
