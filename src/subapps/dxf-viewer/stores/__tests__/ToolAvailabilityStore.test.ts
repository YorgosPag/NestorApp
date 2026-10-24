/**
 * ToolAvailabilityStore — ADR-921 πύλη ενεργοποίησης εργαλείων.
 *
 * Κλειδώνει: απουσία εγγραφής = διαθέσιμο (μηδέν regression), η πύλη εκπέμπει ΜΙΑ φορά
 * `tool:activation-blocked` με αιτία + διόρθωση, idempotent δήλωση (καμία ειδοποίηση συνδρομητών
 * χωρίς αλλαγή), και ότι το `toolStateStore.selectTool` (διαδρομή γραμμής εντολών) σέβεται την πύλη.
 */

import { EventBus } from '../../systems/events/EventBus';
import {
  setToolUnavailability,
  getToolUnavailability,
  guardToolActivation,
  resetToolAvailabilityForTests,
} from '../ToolAvailabilityStore';
import { toolStateStore } from '../ToolStateStore';

const BLOCKED = { reasonKey: 'overlayReadiness.noBackground', remedyAction: 'import-floorplan-wizard' };

describe('ToolAvailabilityStore', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers(); // selectTool σβήνει το `isTransitioning` με setTimeout
    resetToolAvailabilityForTests();
    toolStateStore.reset();
    emitSpy = jest.spyOn(EventBus, 'emit');
  });

  afterEach(() => {
    emitSpy.mockRestore();
    jest.useRealTimers();
  });

  it('a tool with no owner declaration is available and the guard stays silent', () => {
    expect(getToolUnavailability('layering')).toBeNull();
    expect(guardToolActivation('layering')).toBe(true);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('blocks a declared-unavailable tool and emits the reason + remedy once', () => {
    setToolUnavailability('layering', BLOCKED);
    expect(guardToolActivation('layering')).toBe(false);
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('tool:activation-blocked', {
      tool: 'layering',
      reasonKey: BLOCKED.reasonKey,
      remedyAction: BLOCKED.remedyAction,
    });
  });

  it('omits remedyAction from the event when the reason has no remedy', () => {
    setToolUnavailability('layering', { reasonKey: 'overlayReadiness.noFloor' });
    guardToolActivation('layering');
    expect(emitSpy).toHaveBeenCalledWith('tool:activation-blocked', {
      tool: 'layering',
      reasonKey: 'overlayReadiness.noFloor',
    });
  });

  it('clearing the declaration (null) makes the tool available again', () => {
    setToolUnavailability('layering', BLOCKED);
    setToolUnavailability('layering', null);
    expect(guardToolActivation('layering')).toBe(true);
  });

  it('only the declared tool is gated', () => {
    setToolUnavailability('layering', BLOCKED);
    expect(guardToolActivation('line')).toBe(true);
  });

  it('re-declaring the same unavailability does not churn subscribers (idempotent)', () => {
    setToolUnavailability('layering', BLOCKED);
    const before = getToolUnavailability('layering');
    setToolUnavailability('layering', { ...BLOCKED });
    expect(getToolUnavailability('layering')).toBe(before);
  });

  describe('toolStateStore.selectTool (command-line path) honours the gate', () => {
    it('does not activate a blocked tool', () => {
      setToolUnavailability('layering', BLOCKED);
      toolStateStore.selectTool('layering');
      expect(toolStateStore.get().activeTool).toBe('select');
      expect(emitSpy).toHaveBeenCalledWith('tool:activation-blocked', expect.objectContaining({ tool: 'layering' }));
    });

    it('activates the tool once it becomes available', () => {
      toolStateStore.selectTool('layering');
      expect(toolStateStore.get().activeTool).toBe('layering');
    });

    it('returnToPreviousTool does not re-open a tool that became unavailable meanwhile', () => {
      toolStateStore.selectTool('layering');
      toolStateStore.selectTool('line');
      setToolUnavailability('layering', BLOCKED);
      toolStateStore.returnToPreviousTool();
      expect(toolStateStore.get().activeTool).toBe('select');
    });
  });
});
