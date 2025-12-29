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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createStoreSync } from './storeSync';
import type { SyncDependencies, ToolStylePort, LoggerPort, Unsubscribe } from './ports';
import type { EffectiveSettingsGetter } from './storeSync';
import { UI_COLORS } from '../../config/color-config';

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
  public changeHandlers: Array<(partial: unknown) => void> = [];

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

  onChange(handler: (partial: unknown) => void): Unsubscribe {
    this.changeHandlers.push(handler as (partial: Parameters<ToolStylePort['apply']>[0]) => void);
    return () => {
      const index = this.changeHandlers.indexOf(handler as (partial: Parameters<ToolStylePort['apply']>[0]) => void);
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
    line: () => ({
      enabled: true,
      lineType: 'solid',
      lineWidth: 0.25,
      color: UI_COLORS.WHITE,
      opacity: 1.0,
      dashScale: 1.0,
      dashOffset: 0,
      lineCap: 'round',
      lineJoin: 'round',
      breakAtCenter: false,
      hoverColor: UI_COLORS.LEGACY_COLORS.YELLOW,
      hoverType: 'solid',
      hoverWidth: 0.35,
      hoverOpacity: 0.8,
      finalColor: UI_COLORS.LEGACY_COLORS.GREEN,
      finalType: 'solid',
      finalWidth: 0.35,
      finalOpacity: 1.0,
      activeTemplate: null
    }),
    text: () => ({
      enabled: true,
      fontFamily: 'Arial',
      fontSize: 12,
      color: UI_COLORS.WHITE,
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrikethrough: false,
      isSuperscript: false,
      isSubscript: false
    }),
    grip: () => ({
      enabled: true,
      gripSize: 5,
      pickBoxSize: 3,
      apertureSize: 10,
      opacity: 1.0,
      colors: {
        cold: UI_COLORS.CAD_UI_COLORS.grips.cold,
        warm: UI_COLORS.CAD_UI_COLORS.grips.warm,
        hot: UI_COLORS.CAD_UI_COLORS.grips.hot,
        contour: UI_COLORS.BLACK
      },
      showAperture: true,
      multiGripEdit: true,
      snapToGrips: true,
      showGripTips: false,
      dpiScale: 1.0,
      showMidpoints: true,
      showCenters: true,
      showQuadrants: true,
      maxGripsPerEntity: 50
    })
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

  it('should push to ports on start', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    const { pushFromSettings } = sync.start(effectiveGetter);

    // Initial push happens automatically
    expect(fakeToolStyle.applyCalls.length).toBeGreaterThan(0);
  });

  it('should push from settings on demand', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    const { pushFromSettings } = sync.start(effectiveGetter);

    fakeToolStyle.clear();
    pushFromSettings();

    expect(fakeToolStyle.applyCalls.length).toBeGreaterThan(0);
  });

  it('should push correct data format', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    sync.start(effectiveGetter);

    const lastCall = fakeToolStyle.applyCalls[fakeToolStyle.applyCalls.length - 1];
    expect(lastCall).toHaveProperty('stroke');
    expect(lastCall).toHaveProperty('width');
    expect(lastCall).toHaveProperty('opacity');
  });

  it('should cleanup subscriptions on stop', () => {
    const sync = createStoreSync(deps);
    const effectiveGetter = createFakeEffectiveGetter();

    const { stop } = sync.start(effectiveGetter);

    expect(fakeToolStyle.changeHandlers.length).toBeGreaterThan(0);

    stop();

    expect(fakeToolStyle.changeHandlers.length).toBe(0);
  });

  it('should handle apply errors gracefully', () => {
    const faultyPort: ToolStylePort = {
      getCurrent: () => ({ stroke: '', fill: '', width: 0, opacity: 0, dashArray: [] }),
      apply: () => { throw new Error('Apply failed'); },
      onChange: () => () => {}
    };

    const faultyDeps: SyncDependencies = {
      logger: fakeLogger,
      toolStyle: faultyPort
    };

    const sync = createStoreSync(faultyDeps);
    const effectiveGetter = createFakeEffectiveGetter();

    // Should not throw
    expect(() => sync.start(effectiveGetter)).not.toThrow();

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
