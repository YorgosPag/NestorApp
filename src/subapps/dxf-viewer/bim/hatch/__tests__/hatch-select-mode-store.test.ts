/**
 * ADR-507 — tests για το hatch select-mode store («Επιλογή γραμμοσκίασης»,
 * armed pick-existing, reuse `createToggleStore`).
 */

import {
  isHatchSelectArmed,
  subscribeHatchSelect,
  armHatchSelect,
  disarmHatchSelect,
  finishHatchSelectPick,
  runArmedHatchPick,
} from '../hatch-select-mode-store';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';
import { toolStateStore } from '../../../stores/ToolStateStore';
import type { Entity } from '../../../types/entities';

/** Square hatch fixture (mirror του hatch-pick-at.test.ts). */
function hatch(id: string, minX: number, minY: number, size: number): Entity {
  return {
    id,
    type: 'hatch',
    boundaryPaths: [[
      { x: minX, y: minY },
      { x: minX + size, y: minY },
      { x: minX + size, y: minY + size },
      { x: minX, y: minY + size },
    ]],
  } as unknown as Entity;
}

describe('hatch-select-mode-store', () => {
  beforeEach(() => {
    disarmHatchSelect();
    toolHintOverrideStore.setOverride(null);
    toolStateStore.reset();
  });

  it('defaults to disarmed', () => {
    expect(isHatchSelectArmed()).toBe(false);
  });

  it('arms and disarms', () => {
    armHatchSelect();
    expect(isHatchSelectArmed()).toBe(true);
    disarmHatchSelect();
    expect(isHatchSelectArmed()).toBe(false);
  });

  it('disarm is idempotent (no-op when already off)', () => {
    expect(isHatchSelectArmed()).toBe(false);
    disarmHatchSelect();
    expect(isHatchSelectArmed()).toBe(false);
  });

  it('notifies subscribers on arm/disarm (toggle button reflects armed state)', () => {
    let calls = 0;
    const unsub = subscribeHatchSelect(() => { calls++; });
    armHatchSelect();
    expect(calls).toBe(1);
    disarmHatchSelect();
    expect(calls).toBe(2);
    unsub();
    armHatchSelect();
    expect(calls).toBe(2);
  });

  it('clears the status-hint override on disarm (any path)', () => {
    armHatchSelect();
    toolHintOverrideStore.setOverride('Κάνε κλικ σε γραμμοσκίαση για επιλογή');
    expect(toolHintOverrideStore.getSnapshot()).not.toBeNull();
    disarmHatchSelect();
    expect(toolHintOverrideStore.getSnapshot()).toBeNull();
  });

  it('runArmedHatchPick (hit) → selects + disarms + exits tool, returns true', () => {
    toolStateStore.selectTool('hatch');
    armHatchSelect();
    const selected: string[][] = [];

    const hit = runArmedHatchPick({ x: 5, y: 5 }, [hatch('h1', 0, 0, 10)], (ids) => selected.push(ids));

    expect(hit).toBe(true);
    expect(selected).toEqual([['h1']]);
    expect(isHatchSelectArmed()).toBe(false);
    expect(toolStateStore.get().activeTool).toBe('select');
  });

  it('runArmedHatchPick (miss) → no select, stays armed, returns false (forgiving)', () => {
    toolStateStore.selectTool('hatch');
    armHatchSelect();
    let calls = 0;

    const hit = runArmedHatchPick({ x: 99, y: 99 }, [hatch('h1', 0, 0, 10)], () => { calls++; });

    expect(hit).toBe(false);
    expect(calls).toBe(0);
    expect(isHatchSelectArmed()).toBe(true); // ξαναδοκιμάζεις
    expect(toolStateStore.get().activeTool).toBe('hatch'); // δεν φεύγει το tool
  });

  it('finishHatchSelectPick disarms AND exits the hatch tool to select', () => {
    toolStateStore.selectTool('hatch');
    armHatchSelect();
    expect(isHatchSelectArmed()).toBe(true);
    expect(toolStateStore.get().activeTool).toBe('hatch');

    finishHatchSelectPick();

    // Disarmed (one-shot) + tool back to 'select' → no create-ghost on next move,
    // no new hatch on next click (the regression this fixes).
    expect(isHatchSelectArmed()).toBe(false);
    expect(toolStateStore.get().activeTool).toBe('select');
    expect(toolHintOverrideStore.getSnapshot()).toBeNull();
  });
});
