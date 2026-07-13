/**
 * ADR-650 M5β — topo AI tool-executor mapping tests.
 *
 * The executor's whole job is «tool call → the RIGHT existing command» — so the tests mock the
 * topo command/store SSoTs and assert each branch calls exactly the command the panel would,
 * with the panel's unit conversion (metres → mm). The destructive branch must NOT delete: it
 * returns a pending confirm; deletion happens only via `confirmRemoveElevationSpikes`.
 */

import {
  executeTopoAiToolCalls,
  confirmRemoveElevationSpikes,
  type TopoAiCommands,
} from '../topo-ai-tool-executor';
import type { DxfAiToolCall } from '../types';

// ── Mock the module-level topo SSoTs the executor reaches directly ──
jest.mock('../../systems/topography/terrain-3d-store', () => ({
  setTerrain3DVisible: jest.fn(),
  setTerrain3DStyle: jest.fn(),
}));
jest.mock('../../systems/topography/cut-fill-store', () => ({
  setCutFillMode: jest.fn(),
  setCutFillDatumZMm: jest.fn(),
  runCutFill: jest.fn(() => ({ error: null, result: {}, crossCheck: null, mode: 'datum', datumZMm: 0 })),
}));
jest.mock('../../systems/topography/qa/run-topo-qa', () => ({
  runTopoQa: jest.fn(() => ({
    surfaceId: 'existing', flags: [{}], counts: { high: 1, medium: 0, low: 0 },
    droppedByCap: 0, notEnoughData: false,
  })),
}));
jest.mock('../../systems/topography/qa/topo-qa-store', () => ({
  topoQaStore: { set: jest.fn(), reset: jest.fn(), get: jest.fn() },
}));
jest.mock('../../systems/topography/remove-elevation-spikes', () => ({
  previewElevationSpikes: jest.fn(() => 3),
  removeElevationSpikes: jest.fn(() => 3),
}));

import { setTerrain3DVisible, setTerrain3DStyle } from '../../systems/topography/terrain-3d-store';
import { setCutFillMode, setCutFillDatumZMm, runCutFill } from '../../systems/topography/cut-fill-store';
import { runTopoQa } from '../../systems/topography/qa/run-topo-qa';
import { topoQaStore } from '../../systems/topography/qa/topo-qa-store';
import { previewElevationSpikes, removeElevationSpikes } from '../../systems/topography/remove-elevation-spikes';

function makeCommands(): TopoAiCommands & {
  generateContours: jest.Mock;
  setContourStyle: jest.Mock;
} {
  return {
    generateContours: jest.fn(() => ({ ok: true, contourCount: 3, entityCount: 5 })),
    setContourStyle: jest.fn(),
  };
}

function call(name: DxfAiToolCall['name'], args: Record<string, unknown> = {}): DxfAiToolCall {
  return { name, arguments: args as DxfAiToolCall['arguments'] };
}

beforeEach(() => jest.clearAllMocks());

describe('executeTopoAiToolCalls — contours', () => {
  it('generate_contours converts interval metres → mm and calls the injected command', () => {
    const commands = makeCommands();
    const res = executeTopoAiToolCalls([call('generate_contours', { interval_m: 0.5, major_every: 4 })], commands);

    expect(commands.generateContours).toHaveBeenCalledTimes(1);
    const config = commands.generateContours.mock.calls[0]![0];
    expect(config.intervalMm).toBe(500);
    expect(config.majorEvery).toBe(4);
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.contoursGenerated');
    expect(res.messages[0]!.params).toEqual({ contours: 3, entities: 5 });
  });

  it('generate_contours with nulls keeps the default interval/major', () => {
    const commands = makeCommands();
    executeTopoAiToolCalls([call('generate_contours', { interval_m: null, major_every: null })], commands);
    const config = commands.generateContours.mock.calls[0]![0];
    expect(config.intervalMm).toBe(500); // DEFAULT_CONTOUR_CONFIG
    expect(config.majorEvery).toBe(5);
  });

  it('generate_contours surfaces a failure reason as a key', () => {
    const commands = makeCommands();
    commands.generateContours.mockReturnValueOnce({ ok: false, contourCount: 0, entityCount: 0, reason: 'too-few-points' });
    const res = executeTopoAiToolCalls([call('generate_contours', { interval_m: null, major_every: null })], commands);
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.contoursFailed.too-few-points');
  });

  it('set_contour_style routes to the injected setContourStyle', () => {
    const commands = makeCommands();
    const res = executeTopoAiToolCalls([call('set_contour_style', { style: 'smooth' })], commands);
    expect(commands.setContourStyle).toHaveBeenCalledWith('smooth');
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.contourStyle.smooth');
  });
});

describe('executeTopoAiToolCalls — terrain', () => {
  it('toggle_terrain_3d calls the store setter', () => {
    executeTopoAiToolCalls([call('toggle_terrain_3d', { visible: true })], makeCommands());
    expect(setTerrain3DVisible).toHaveBeenCalledWith(true);
  });

  it('set_terrain_style calls the store setter', () => {
    executeTopoAiToolCalls([call('set_terrain_style', { style: 'hypsometric' })], makeCommands());
    expect(setTerrain3DStyle).toHaveBeenCalledWith('hypsometric');
  });
});

describe('executeTopoAiToolCalls — quality check', () => {
  it('run_quality_check runs the pass and stores the report', () => {
    const res = executeTopoAiToolCalls([call('run_quality_check')], makeCommands());
    expect(runTopoQa).toHaveBeenCalledTimes(1);
    expect(topoQaStore.set).toHaveBeenCalledTimes(1);
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.qa.found');
    expect(res.messages[0]!.params).toEqual({ high: 1, medium: 0, low: 0 });
  });
});

describe('executeTopoAiToolCalls — cut/fill', () => {
  it('set_cutfill_reference (datum) converts metres → mm', () => {
    const res = executeTopoAiToolCalls([call('set_cutfill_reference', { mode: 'datum', datum_z_m: 12.5 })], makeCommands());
    expect(setCutFillMode).toHaveBeenCalledWith('datum');
    expect(setCutFillDatumZMm).toHaveBeenCalledWith(12500);
    expect(res.messages[0]!.params).toEqual({ level: 12.5 });
  });

  it('run_cutfill on success shows the cut/fill analysis on the terrain', () => {
    const res = executeTopoAiToolCalls([call('run_cutfill')], makeCommands());
    expect(runCutFill).toHaveBeenCalledTimes(1);
    expect(setTerrain3DStyle).toHaveBeenCalledWith('cutfill');
    expect(setTerrain3DVisible).toHaveBeenCalledWith(true);
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.cutfill.done');
  });

  it('run_cutfill surfaces an engine error and does NOT touch the terrain', () => {
    (runCutFill as jest.Mock).mockReturnValueOnce({ error: 'no-surface', result: null });
    const res = executeTopoAiToolCalls([call('run_cutfill')], makeCommands());
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.cutfill.error.no-surface');
    expect(setTerrain3DStyle).not.toHaveBeenCalled();
  });
});

describe('executeTopoAiToolCalls — destructive spike removal (§9 human-certifier)', () => {
  it('remove_elevation_spikes returns a pending confirm and deletes NOTHING', () => {
    const res = executeTopoAiToolCalls([call('remove_elevation_spikes')], makeCommands());
    expect(res.pendingConfirm).toEqual({ kind: 'remove-elevation-spikes', count: 3 });
    expect(previewElevationSpikes).toHaveBeenCalledTimes(1);
    expect(removeElevationSpikes).not.toHaveBeenCalled();
  });

  it('remove_elevation_spikes with no spikes reports «none», no confirm', () => {
    (previewElevationSpikes as jest.Mock).mockReturnValueOnce(0);
    const res = executeTopoAiToolCalls([call('remove_elevation_spikes')], makeCommands());
    expect(res.pendingConfirm).toBeNull();
    expect(res.messages[0]!.key).toBe('aiAssistant.topo.spikes.none');
  });

  it('confirmRemoveElevationSpikes performs the deletion and reports the count', () => {
    const msg = confirmRemoveElevationSpikes();
    expect(removeElevationSpikes).toHaveBeenCalledTimes(1);
    expect(msg.key).toBe('aiAssistant.topo.spikes.removed');
    expect(msg.params).toEqual({ count: 3 });
  });
});

describe('executeTopoAiToolCalls — partitioning', () => {
  it('ignores non-topo tool calls', () => {
    const res = executeTopoAiToolCalls([call('draw_line' as DxfAiToolCall['name'])], makeCommands());
    expect(res.messages).toHaveLength(0);
    expect(res.pendingConfirm).toBeNull();
  });
});
