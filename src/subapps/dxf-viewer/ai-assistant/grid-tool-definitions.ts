/**
 * @module ai-assistant/grid-tool-definitions
 * @description OpenAI tool definitions for AI-driven Grid & Guide operations
 *
 * 6 grid tools in Chat Completions API format (same pattern as dxf-tool-definitions.ts):
 * - add_grid_guide: Add a guide line to the canvas grid
 * - remove_grid_guide: Remove a guide line by ID
 * - move_grid_guide: Move a guide to a new offset
 * - create_grid_group: Create a named group of evenly-spaced guides
 * - set_grid_spacing: Change uniform spacing of a grid group
 * - toggle_grid_snap: Enable/disable snap-to-grid
 *
 * All tools use strict: true with additionalProperties: false.
 * Optional fields use type: ['string', 'null'] and are listed in required.
 *
 * IMPORTANT: These definitions are NOT activated yet. They are exported as
 * GRID_TOOL_DEFINITIONS but NOT appended to the active tool set.
 * Activation happens when Grid System (ADR-189) is implemented.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-19
 */

import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';

// ============================================================================
// GRID AI TOOL DEFINITIONS (Chat Completions API format)
// NOT ACTIVE — exported for future activation when ADR-189 is implemented
// ============================================================================

export const GRID_TOOL_DEFINITIONS: AgenticToolDefinition[] = [
  // ── 1. add_grid_guide ──
  {
    type: 'function',
    function: {
      name: 'add_grid_guide',
      description:
        'Add a guide line to the canvas grid. ' +
        'Axis "X" creates a VERTICAL guide at the given offset, ' +
        'Axis "Y" creates a HORIZONTAL guide at the given offset. ' +
        'Pass offset exactly as the user specifies — do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          axis: {
            type: 'string',
            description: 'Guide direction: "X" = vertical line, "Y" = horizontal line',
          },
          offset: {
            type: 'number',
            description: 'Position along the perpendicular axis (in canvas units)',
          },
          label: {
            type: ['string', 'null'],
            description: 'Optional label for the guide (e.g. "A", "1"). null = auto-generated.',
          },
          group_id: {
            type: ['string', 'null'],
            description: 'Target grid group ID. null = active group or default.',
          },
        },
        required: ['axis', 'offset', 'label', 'group_id'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 2. remove_grid_guide ──
  {
    type: 'function',
    function: {
      name: 'remove_grid_guide',
      description:
        'Remove a guide line from the canvas grid by its ID.',
      parameters: {
        type: 'object',
        properties: {
          guide_id: {
            type: 'string',
            description: 'The unique ID of the guide to remove',
          },
        },
        required: ['guide_id'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 3. move_grid_guide ──
  {
    type: 'function',
    function: {
      name: 'move_grid_guide',
      description:
        'Move an existing guide line to a new offset position. ' +
        'Pass the new offset exactly as the user specifies — do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          guide_id: {
            type: 'string',
            description: 'The unique ID of the guide to move',
          },
          new_offset: {
            type: 'number',
            description: 'New position along the perpendicular axis (in canvas units)',
          },
        },
        required: ['guide_id', 'new_offset'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 4. create_grid_group ──
  {
    type: 'function',
    function: {
      name: 'create_grid_group',
      description:
        'Create a named group of evenly-spaced guide lines. ' +
        'For example, "structural grid 5m spacing, 6 guides" creates 6 parallel guides ' +
        'at 0, 5, 10, 15, 20, 25. Axis "both" creates guides in both X and Y directions. ' +
        'Pass spacing exactly as the user specifies — do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the grid group (e.g. "Structural Grid", "Module Grid")',
          },
          axis: {
            type: 'string',
            description: 'Guide directions: "X" = vertical only, "Y" = horizontal only, "both" = both directions',
          },
          spacing: {
            type: 'number',
            description: 'Uniform spacing between guides (in canvas units, must be > 0)',
          },
          count: {
            type: 'number',
            description: 'Number of guides to create per axis',
          },
          origin_x: {
            type: 'number',
            description: 'Origin X coordinate for the grid group',
          },
          origin_y: {
            type: 'number',
            description: 'Origin Y coordinate for the grid group',
          },
        },
        required: ['name', 'axis', 'spacing', 'count', 'origin_x', 'origin_y'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 5. set_grid_spacing ──
  {
    type: 'function',
    function: {
      name: 'set_grid_spacing',
      description:
        'Change the uniform spacing of a grid group. All guides in the group will be ' +
        'redistributed with the new spacing. ' +
        'Pass spacing exactly as the user specifies — do NOT convert units.',
      parameters: {
        type: 'object',
        properties: {
          group_id: {
            type: ['string', 'null'],
            description: 'Target grid group ID. null = currently active group.',
          },
          spacing: {
            type: 'number',
            description: 'New spacing between guides (in canvas units, must be > 0)',
          },
        },
        required: ['group_id', 'spacing'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 6. toggle_grid_snap ──
  {
    type: 'function',
    function: {
      name: 'toggle_grid_snap',
      description:
        'Enable or disable snap-to-grid. When enabled, drawing tools snap to the nearest ' +
        'grid intersection point.',
      parameters: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'true = enable snap-to-grid, false = disable',
          },
        },
        required: ['enabled'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
