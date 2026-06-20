/// <reference types="jest" />
/**
 * @file Store Sync Unit Tests
 * @module settings/sync/storeSync.test
 *
 * ✅ ENTERPRISE: Unit Tests with Fake Ports (No Mocks!)
 *
 * **TESTING STRATEGY**:
 * - Use fake ports (not mocks) for testability
 * - Test pure functions in isolation
 * - No dependencies on React, legacy stores, or DOM
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { createStoreSync } from './storeSync';
import type { SyncDependencies, ToolStylePort, LoggerPort, Unsubscribe } from './ports';
import type { EffectiveSettingsGetter } from './storeSync';
import { UI_COLORS } from '../../config/color-config';
import {
  DEFAULT_LINE_SETTINGS,
  DEFAULT_TEXT_SETTINGS
} from '../../settings-core/defaults';
import { DEFAULT_GRIP_SETTINGS } from '../../types/gripSettings';
// 🏢 SSoT (2026-06-20): storeSync now pushes FULL state into the real style
// stores via style-store-sync.ts — assert outcomes on the stores, not port.apply.
import { toolStyleStore } from '../../stores/ToolStyleStore';

// ============================================================================
// FAKE PORTS (Test Doubles)
// ============================================================================

/**
 * Fake Logger Port (captures all log calls)
 */
class FakeLogger implements LoggerPort {
  public logs: Array<{ level: 'info' | 'warn' | 'error'; msg: string; data?: unknown }> = [];

  info(msg: string, data?: unknown) {
    this.logs.push({ level: 'info', msg, data });
  }

  warn(msg: string, data?: unknown) {
    this.logs.push({ level: 'warn', msg, data });
  }

  error(msg: string, data?: unknown) {
    this.logs.push({ level: 'error', msg, data });
  }

  clear() {
    this.logs = [];
  }
}

/**
 * Fake Tool Style Port (captures all apply calls)
 */
class FakeToolStylePort implements ToolStylePort {
  public applyCalls: Array<Parameters<ToolStylePort['apply']>[0]> = [];
  public changeHandlers: Array<(partial: Parameters<ToolStylePort['apply']>[0]) => void> = [];

  getCurrent() {
    return {
      stroke: UI_COLORS.BLACK,
      fill: UI_COLORS.WHITE,
      width: 1,
      opacity: 1,
      dashArray: []
    };
  }

  apply(partial: Parameters<ToolStylePort['apply']>[0]) {
    this.applyCalls.push(partial);
  }

  onChange(handler: (partial: Parameters<ToolStylePort['apply']>[0]) => void): Unsubscribe {
    this.changeHandlers.push(handler);
    return () => {
      const index = this.changeHandlers.indexOf(handler);
      if (index >= 0) this.changeHandlers.splice(index, 1);
    };
  }

  // Test helper: simulate external change
  simulateChange(partial: Parameters<ToolStylePort['apply']>[0]) {
    this.changeHandlers.forEach(h => h(partial));
  }

  clear() {
    this.applyCalls = [];
  }
}

/**
 * Fake Effective Settings Getter
 */
function createFakeEffectiveGetter(): EffectiveSettingsGetter {
  return {
    line: () => ({ ...DEFAULT_LINE_SETTINGS }),
    text: () => ({ ...DEFAULT_TEXT_SETTINGS }),
    grip: () => ({ ...DEFAULT_GRIP_SETTINGS })
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('createStoreSync', () => {
  let fakeLogger: FakeLogger;
  let fakeToolStyle: FakeToolStylePort;
  let deps: SyncDependencies;

  beforeEach(() => {
    fakeLogger = new FakeLogger();
    fakeToolStyle = new FakeToolStylePort();
    deps = {
      logger: fakeLogger,
      toolStyle: fakeToolStyle
    };
  });

  it('should create sync instance', () => {
    const sync = createStoreSync(deps);

    expect(sync).toBeDefined();
    expect(typeof sync.start).toBe('function');
  });

  it('should log creation', () => {
    createStoreSync(deps);

    expect(fakeLogger.logs).toContainEqual({
      level: 'info',
      msg: '[StoreSync] Creating sync instance',
      data: undefined
    });
  });

  it('should push full state into the tool store on start', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    // Pollute the store first so we can prove start() overwrote it.
    toolStyleStore.set({ strokeColor: '#deadbe', lineWidth: 999, enabled: false });

    sync.start(effectiveGetter);

    // Initial push happens automatically — full (non-lossy) state from settings.
    const state = toolStyleStore.get();
    expect(state.strokeColor).toBe(DEFAULT_LINE_SETTINGS.color);
    expect(state.lineWidth).toBe(DEFAULT_LINE_SETTINGS.lineWidth);
    expect(state.enabled).toBe(DEFAULT_LINE_SETTINGS.enabled);
    expect(state.lineType).toBe(DEFAULT_LINE_SETTINGS.lineType);
  });

  it('should push from settings on demand', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    const { pushFromSettings } = sync.start(effectiveGetter);

    // Mutate the store, then re-push and confirm it was restored from settings.
    toolStyleStore.set({ strokeColor: '#000000' });
    pushFromSettings();

    expect(toolStyleStore.get().strokeColor).toBe(DEFAULT_LINE_SETTINGS.color);
  });

  it('should push FULL (non-lossy) tool style — incl. enabled + lineType', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    sync.start(effectiveGetter);

    const state = toolStyleStore.get();
    // The old lossy port path only wrote stroke/fill/width/opacity; the SSoT
    // writer also covers enabled + lineType.
    expect(state).toHaveProperty('strokeColor');
    expect(state).toHaveProperty('lineWidth');
    expect(state).toHaveProperty('opacity');
    expect(state).toHaveProperty('enabled');
    expect(state).toHaveProperty('lineType');
  });

  it('should cleanup subscriptions on stop', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    const { stop } = sync.start(effectiveGetter);

    expect(fakeToolStyle.changeHandlers.length).toBeGreaterThan(0);

    stop();

    expect(fakeToolStyle.changeHandlers.length).toBe(0);
  });

  it('should handle a faulty effective-settings getter gracefully', () => {
    const sync = createStoreSync(deps);
    // A getter whose line() throws — the push must be caught, logged, not thrown.
    const faultyGetter: EffectiveSettingsGetter = {
      line: () => { throw new Error('effective line settings failed'); },
      text: () => ({ ...DEFAULT_TEXT_SETTINGS }),
      grip: () => ({ ...DEFAULT_GRIP_SETTINGS })
    };

    // Should not throw
    expect(() => sync.start(faultyGetter)).not.toThrow();

    // Should log warning
    const warnings = fakeLogger.logs.filter(l => l.level === 'warn');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should work without optional ports', () => {
    const minimalDeps: SyncDependencies = {
      logger: fakeLogger
      // No ports at all
    };

    const sync = createStoreSync(minimalDeps);
    const effectiveGetter = createFakeEffectiveGetter();

    // Should not throw
    expect(() => sync.start(effectiveGetter)).not.toThrow();
  });

  it('should support multiple stop calls', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    const { stop } = sync.start(effectiveGetter);

    // Should not throw on multiple stops
    expect(() => {
      stop();
      stop();
      stop();
    }).not.toThrow();
  });
});
