/**
 * @module ai-assistant/topo-ai-tool-executor
 * @description Client-side executor mapping topography AI tool calls onto EXISTING commands.
 *
 * ADR-650 M5β «μίλα στο σχέδιο». The topo sibling of `dxf-ai-tool-executor` — but where that
 * one builds entities, this one writes NOTHING itself: every branch calls the SAME command the
 * Topography panel calls (`useTopoContours.generate` / `useContourDisplay.setStyle` via injected
 * callbacks; `terrain-3d-store` / `cut-fill-store` / `runTopoQa` / spike removal via their module
 * SSoTs). So undo, persistence, the derived-TIN memo and the QA report all behave identically to
 * a button press — the LLM only chooses which command runs (§9 AI-accelerant).
 *
 * The one destructive branch (`remove_elevation_spikes`) does NOT mutate: it previews the count
 * and returns a {@link TopoPendingConfirm}; the chat gates the delete behind an explicit confirm
 * (§9 human-certifier), then calls {@link confirmRemoveElevationSpikes}.
 *
 * Messages are i18n keys + params (N.11) — resolved by the caller with `t()`, never baked here.
 *
 * @see ADR-650 (§9, §12.2 M5β), ADR-185
 * @since 2026-07-14
 */

import type {
  DxfAiToolCall,
  TopoAiExecutionResult,
  TopoPendingConfirm,
  GenerateContoursArgs,
  SetContourStyleArgs,
  ToggleTerrain3DArgs,
  SetTerrainStyleArgs,
  SetCutfillReferenceArgs,
} from './types';
import { isTopoToolName } from './topo-tool-definitions';
import { DEFAULT_CONTOUR_CONFIG, type ContourConfig, type ContourDisplayStyle } from '../systems/topography/contour-config';
import type { GenerateContoursOutcome } from '../systems/topography/useTopoContours';
import { setTerrain3DVisible, setTerrain3DStyle } from '../systems/topography/terrain-3d-store';
import { setCutFillMode, setCutFillDatumZMm, runCutFill } from '../systems/topography/cut-fill-store';
import { runTopoQa } from '../systems/topography/qa/run-topo-qa';
import { topoQaStore } from '../systems/topography/qa/topo-qa-store';
import { previewElevationSpikes, removeElevationSpikes } from '../systems/topography/remove-elevation-spikes';

/** METRES → canonical mm, the same edge conversion the Topography panel does (never the LLM). */
const M_TO_MM = 1000;

/** One user-facing outcome as an i18n key (+ params) — resolved by the chat with `t()`. */
type TopoMsg = { key: string; params?: Record<string, string | number> };

/**
 * The two topo commands that must run through React hooks to keep undo/command SSoT intact
 * (`useTopoContours` / `useContourDisplay`). Injected by the chat panel; everything else the
 * executor reaches through module-level store SSoTs directly.
 */
export interface TopoAiCommands {
  readonly generateContours: (config: ContourConfig) => GenerateContoursOutcome;
  readonly setContourStyle: (style: ContourDisplayStyle) => void;
}

// ============================================================================
// PER-TOOL HANDLERS (each ≤ a few lines; the dispatch stays flat)
// ============================================================================

function handleGenerateContours(args: GenerateContoursArgs, commands: TopoAiCommands): TopoMsg {
  const config: ContourConfig = {
    ...DEFAULT_CONTOUR_CONFIG,
    intervalMm: args.interval_m != null ? Math.max(1, args.interval_m * M_TO_MM) : DEFAULT_CONTOUR_CONFIG.intervalMm,
    majorEvery: args.major_every != null ? Math.max(1, Math.round(args.major_every)) : DEFAULT_CONTOUR_CONFIG.majorEvery,
  };
  const r = commands.generateContours(config);
  if (r.ok) {
    return { key: 'aiAssistant.topo.contoursGenerated', params: { contours: r.contourCount, entities: r.entityCount } };
  }
  return { key: `aiAssistant.topo.contoursFailed.${r.reason ?? 'no-contours'}` };
}

function handleSetContourStyle(args: SetContourStyleArgs, commands: TopoAiCommands): TopoMsg {
  commands.setContourStyle(args.style);
  return { key: `aiAssistant.topo.contourStyle.${args.style}` };
}

function handleToggleTerrain(args: ToggleTerrain3DArgs): TopoMsg {
  setTerrain3DVisible(args.visible);
  return { key: args.visible ? 'aiAssistant.topo.terrain.shown' : 'aiAssistant.topo.terrain.hidden' };
}

function handleSetTerrainStyle(args: SetTerrainStyleArgs): TopoMsg {
  setTerrain3DStyle(args.style);
  return { key: `aiAssistant.topo.terrainStyle.${args.style}` };
}

function handleRunQualityCheck(): TopoMsg {
  const report = runTopoQa();
  topoQaStore.set(report);
  if (report.notEnoughData) return { key: 'aiAssistant.topo.qa.notEnoughData' };
  if (report.flags.length === 0) return { key: 'aiAssistant.topo.qa.clean' };
  return { key: 'aiAssistant.topo.qa.found', params: { ...report.counts } };
}

function handleSetCutfillReference(args: SetCutfillReferenceArgs): TopoMsg {
  setCutFillMode(args.mode);
  if (args.mode === 'datum' && args.datum_z_m != null) {
    setCutFillDatumZMm(args.datum_z_m * M_TO_MM);
    return { key: 'aiAssistant.topo.cutfill.referenceDatum', params: { level: args.datum_z_m } };
  }
  return { key: 'aiAssistant.topo.cutfill.referenceSurface' };
}

function handleRunCutfill(): TopoMsg {
  const next = runCutFill();
  if (next.error) return { key: `aiAssistant.topo.cutfill.error.${next.error}` };
  // Showing the analysis is part of answering — mirror the panel (Civil 3D volume-analysis style).
  setTerrain3DStyle('cutfill');
  setTerrain3DVisible(true);
  return { key: 'aiAssistant.topo.cutfill.done' };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute the topography tool calls in a response (already filtered to topo names by the caller).
 * Non-destructive tools run immediately; `remove_elevation_spikes` returns a pending confirm
 * instead of deleting. At most one pending confirm per turn (the first requested).
 */
export function executeTopoAiToolCalls(
  toolCalls: readonly DxfAiToolCall[],
  commands: TopoAiCommands,
): TopoAiExecutionResult {
  const messages: TopoMsg[] = [];
  let pendingConfirm: TopoPendingConfirm | null = null;

  for (const call of toolCalls) {
    if (!isTopoToolName(call.name)) continue;
    switch (call.name) {
      case 'generate_contours':
        messages.push(handleGenerateContours(call.arguments as GenerateContoursArgs, commands));
        break;
      case 'set_contour_style':
        messages.push(handleSetContourStyle(call.arguments as SetContourStyleArgs, commands));
        break;
      case 'toggle_terrain_3d':
        messages.push(handleToggleTerrain(call.arguments as ToggleTerrain3DArgs));
        break;
      case 'set_terrain_style':
        messages.push(handleSetTerrainStyle(call.arguments as SetTerrainStyleArgs));
        break;
      case 'run_quality_check':
        messages.push(handleRunQualityCheck());
        break;
      case 'set_cutfill_reference':
        messages.push(handleSetCutfillReference(call.arguments as SetCutfillReferenceArgs));
        break;
      case 'run_cutfill':
        messages.push(handleRunCutfill());
        break;
      case 'remove_elevation_spikes': {
        const count = previewElevationSpikes();
        if (count === 0) messages.push({ key: 'aiAssistant.topo.spikes.none' });
        else if (!pendingConfirm) pendingConfirm = { kind: 'remove-elevation-spikes', count };
        break;
      }
    }
  }

  return { messages, pendingConfirm };
}

/**
 * Run the confirmed spike removal (called by the chat after the engineer presses Confirm).
 * Returns the outcome message key + params. Re-detects at call time, so a survey that changed
 * since the preview is handled honestly (removes whatever is flagged now, reports the count).
 */
export function confirmRemoveElevationSpikes(): TopoMsg {
  const removed = removeElevationSpikes();
  return removed === 0
    ? { key: 'aiAssistant.topo.spikes.none' }
    : { key: 'aiAssistant.topo.spikes.removed', params: { count: removed } };
}
