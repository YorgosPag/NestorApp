/**
 * @module ai-assistant/topo-tool-definitions
 * @description OpenAI tool definitions for AI-driven Topography operations (ADR-650 M5β).
 *
 * «Μίλα στο σχέδιο» — NL editing of the topographic survey through the SAME commands the
 * Topography panel calls. The LLM NEVER writes geometry or stores directly: each tool maps,
 * in `topo-ai-tool-executor.ts`, onto an existing command (`useTopoContours.generate`,
 * `useContourDisplay.setStyle`, `terrain-3d-store`, `cut-fill-store`, `runTopoQa`,
 * `removeElevationSpikes`). Big-player pattern (§8: SuperMap/Speckle) — NL editing is
 * tool-calling over an existing command API, not raw geometry from the model.
 *
 * Same Chat Completions shape as `grid-tool-definitions.ts`: `strict: true`,
 * `additionalProperties: false`, optional fields typed `['number', 'null']` and listed in
 * `required`. Units follow the panel: the model passes METRES (as the user speaks them); the
 * executor converts to canonical mm — never the model (mirrors the «no unit conversion» rule).
 *
 * @see ADR-650 (§9, §12.2 M5β), ADR-185 (AI Drawing Assistant)
 * @since 2026-07-14
 */

import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';

// ============================================================================
// TOOL NAME SSoT — reused by the type union, the route allow-list and the executor
// (one array so the three can never drift, unlike the hand-mirrored grid set).
// ============================================================================

export const TOPO_TOOL_NAMES = [
  'generate_contours',
  'set_contour_style',
  'toggle_terrain_3d',
  'set_terrain_style',
  'run_quality_check',
  'set_cutfill_reference',
  'run_cutfill',
  'remove_elevation_spikes',
] as const;

export type TopoAiToolName = typeof TOPO_TOOL_NAMES[number];

/** Whether a tool-call name belongs to the topography set (route + executor partition). */
export function isTopoToolName(name: string): name is TopoAiToolName {
  return (TOPO_TOOL_NAMES as readonly string[]).includes(name);
}

// ============================================================================
// ENUM VALUES — mirror the domain string unions (contour-config / topo-types).
// ============================================================================

const CONTOUR_STYLES = ['exact', 'smooth'] as const;
const TERRAIN_STYLES = ['shaded', 'hypsometric', 'cutfill'] as const;
const CUTFILL_MODES = ['datum', 'surface'] as const;

// ============================================================================
// TOPO AI TOOL DEFINITIONS (Chat Completions API format)
// ============================================================================

export const TOPO_TOOL_DEFINITIONS: AgenticToolDefinition[] = [
  // ── 1. generate_contours ──
  {
    type: 'function',
    function: {
      name: 'generate_contours',
      description:
        'Generate topographic contour lines from the loaded survey points. ' +
        'Use for "φτιάξε/υπολόγισε τις ισοϋψείς", "κάνε interval 0.5m" (regenerate at a new ' +
        'spacing). interval_m and major_every are OPTIONAL — pass null to keep the defaults ' +
        '(0.5 m minor, index every 5th). interval_m is in METRES exactly as the user says it ' +
        '("0.5m" → 0.5); do NOT convert to millimetres.',
      parameters: {
        type: 'object',
        properties: {
          interval_m: {
            type: ['number', 'null'],
            description: 'Minor contour interval in METRES (e.g. 0.5). null = keep default.',
          },
          major_every: {
            type: ['number', 'null'],
            description: 'Every N-th contour is a MAJOR/index contour (e.g. 5). null = default.',
          },
        },
        required: ['interval_m', 'major_every'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 2. set_contour_style ──
  {
    type: 'function',
    function: {
      name: 'set_contour_style',
      description:
        'Switch how the plan-view contours are DRAWN. "smooth" = fitted curve («κάνε τις ' +
        'ισοϋψείς όμορφες», Civil 3D contour smoothing); "exact" = straight chords through the ' +
        'surveyed crossings (the legal default). Non-destructive — the surveyed vertices and ' +
        'the export stay exact either way.',
      parameters: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            enum: [...CONTOUR_STYLES],
            description: '"exact" (accurate chords) or "smooth" (pretty fitted curve)',
          },
        },
        required: ['style'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 3. toggle_terrain_3d ──
  {
    type: 'function',
    function: {
      name: 'toggle_terrain_3d',
      description:
        'Show or hide the 3D terrain surface in the viewport («εμφάνισε/κρύψε το 3Δ έδαφος», ' +
        '"γύρνα τον λόφο"). visible=true shows the derived TIN mesh, false hides it. The survey ' +
        'is never touched — this is a display toggle only.',
      parameters: {
        type: 'object',
        properties: {
          visible: {
            type: 'boolean',
            description: 'true = show the 3D terrain mesh, false = hide it',
          },
        },
        required: ['visible'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 4. set_terrain_style ──
  {
    type: 'function',
    function: {
      name: 'set_terrain_style',
      description:
        'Set the 3D terrain analysis style. "shaded" = plain hillshade; "hypsometric" = ' +
        'elevation colour banding («βάλε υψομετρικά χρώματα»); "cutfill" = cut/fill analysis ' +
        'colours. Changes only how the SAME surface is coloured, not the triangulation.',
      parameters: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            enum: [...TERRAIN_STYLES],
            description: '"shaded", "hypsometric" (elevation banding), or "cutfill"',
          },
        },
        required: ['style'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 5. run_quality_check ──
  {
    type: 'function',
    function: {
      name: 'run_quality_check',
      description:
        'Run the deterministic survey quality check («τρέξε έλεγχο ποιότητας», "έλεγξε για ' +
        'λάθη/spikes"). Flags elevation busts, duplicate points, boundary problems and missing ' +
        'breaklines with on-drawing markers — it only REPORTS, never edits (the engineer ' +
        'certifies). Use this for any "find/check" request; use remove_elevation_spikes only ' +
        'when the user explicitly asks to DELETE the spikes.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 6. set_cutfill_reference ──
  {
    type: 'function',
    function: {
      name: 'set_cutfill_reference',
      description:
        'Set what the earthworks volumes are measured against. mode "datum" = a fixed design ' +
        'level («σκάψε μέχρι το +12.50» → datum_z_m=12.5); mode "surface" = a separately ' +
        'imported designed ground. datum_z_m is in METRES (null unless mode is "datum"); do NOT ' +
        'convert to millimetres. Does not compute — call run_cutfill after.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: [...CUTFILL_MODES],
            description: '"datum" (fixed level) or "surface" (designed ground)',
          },
          datum_z_m: {
            type: ['number', 'null'],
            description: 'Design level in METRES for datum mode (e.g. 12.5). null otherwise.',
          },
        },
        required: ['mode', 'datum_z_m'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 7. run_cutfill ──
  {
    type: 'function',
    function: {
      name: 'run_cutfill',
      description:
        'Compute the cut/fill earthwork volumes against the current reference («υπολόγισε ' +
        'όγκους/χωματουργικά») and show the cut/fill analysis on the 3D terrain. Set the ' +
        'reference first with set_cutfill_reference if the user named a level or surface.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 8. remove_elevation_spikes ── (DESTRUCTIVE — executor gates behind explicit confirm)
  {
    type: 'function',
    function: {
      name: 'remove_elevation_spikes',
      description:
        'Delete the elevation-bust "spike" points (survey Z blunders) from the raw survey ' +
        '(«σβήσε τα spikes»). DESTRUCTIVE — the app asks the engineer to confirm before ' +
        'anything is deleted. Spikes are exactly the points the quality check flags as ' +
        'elevation busts. Do NOT call this for a mere "check/find" — use run_quality_check.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
