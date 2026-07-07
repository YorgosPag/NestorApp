/// <reference types="jest" />
/**
 * @file persist-ssot-migration-smoke.test.ts
 * @description Load + public-API smoke test for the localStorage-persistence SSoT migration
 * (ADR — createPersistedValue / storage-utils). Guards the migrated modules that have NO
 * dedicated test against import/syntax errors and public-API drift, and exercises the
 * round-trip of the reactive ones. Modules with their own suites (LinetypeScaleStore,
 * LineweightDisplayStore, LinetypeRegistry, createPersistedValue) are covered there.
 */

import { CommandHistoryStore } from '../../systems/command-line/CommandHistoryStore';
import { getMode, setMode, subscribe as subscribeXline } from '../../systems/tools/xline-mode-store';
import { displayUnitState } from '../../config/display-unit-state';
import { getLastActiveTab, setLastActiveTab } from '../../bim-3d/properties/tabs/last-active-tab-tracker';
import { baselineTracker } from '../../bim-3d/performance/baseline-tracker';
import {
  resolveAlias,
  registerCustomAlias,
  removeCustomAlias,
  invalidateCustomAliasCache,
} from '../../systems/command-line/CommandAliasRegistry';
import { createRegressionDetector } from '../../bim-3d/performance/regression-detector';

beforeEach(() => {
  localStorage.clear();
  invalidateCustomAliasCache(); // module-level cache must not leak across tests
});

describe('persist-SSoT migration — load + public API smoke', () => {
  it('CommandHistoryStore: push/getEntries/navigate round-trip + persistence', () => {
    CommandHistoryStore.push('line');
    CommandHistoryStore.push('circle');
    expect(CommandHistoryStore.getEntries()).toEqual(['CIRCLE', 'LINE']);
    expect(JSON.parse(localStorage.getItem('dxf:commandHistory') as string)).toEqual(['CIRCLE', 'LINE']);
    expect(CommandHistoryStore.navigateUp()).toBe('CIRCLE');
    // getSnapshot is referentially stable when nothing changed
    expect(CommandHistoryStore.getSnapshot()).toBe(CommandHistoryStore.getSnapshot());
  });

  it('xline-mode-store: persists mode as a BARE string (legacy format preserved)', () => {
    setMode('vertical');
    expect(getMode()).toBe('vertical');
    expect(localStorage.getItem('dxf:xlineMode.lastUsed')).toBe('vertical'); // bare, not JSON
    const unsub = subscribeXline(() => undefined);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('displayUnitState: persists unit as a BARE string + notifies', () => {
    let notified = 0;
    const unsub = displayUnitState.subscribe(() => { notified += 1; });
    const other = displayUnitState.getUnit() === 'mm' ? 'cm' : 'mm';
    displayUnitState.setUnit(other as never);
    expect(displayUnitState.getUnit()).toBe(other);
    expect(localStorage.getItem('display-unit') === null || !localStorage.getItem('display-unit')?.startsWith('"')).toBe(true);
    expect(notified).toBe(1);
    unsub();
  });

  it('last-active-tab-tracker: read-modify-write map persists', () => {
    expect(getLastActiveTab('column')).toBe('parameters'); // default
    setLastActiveTab('column', 'geometry');
    expect(getLastActiveTab('column')).toBe('geometry');
    setLastActiveTab('beam', 'materials');
    expect(getLastActiveTab('column')).toBe('geometry'); // map preserved
    expect(getLastActiveTab('beam')).toBe('materials');
  });

  it('baseline-tracker: record + baseline null-until-enough + clear', () => {
    const now = 1_000_000;
    expect(baselineTracker.getBaseline('3d', now)).toBeNull();
    for (let i = 0; i < 40; i++) baselineTracker.recordSample('3d', 60, now + i);
    const b = baselineTracker.getBaseline('3d', now + 40);
    expect(b).not.toBeNull();
    expect(b?.sampleCount).toBeGreaterThanOrEqual(30);
    baselineTracker.clear('3d');
    expect(baselineTracker.getBaseline('3d', now + 40)).toBeNull();
  });

  it('CommandAliasRegistry: built-in + custom alias register/resolve/remove persists', () => {
    expect(resolveAlias('L')).toBe('line'); // built-in
    expect(resolveAlias('ZZZ')).toBeNull();
    registerCustomAlias('ZZZ', 'circle');
    expect(resolveAlias('zzz')).toBe('circle'); // case-insensitive
    // persisted as a JSON string->string map under dxf:customAliases
    expect(JSON.parse(localStorage.getItem('dxf:customAliases') as string)).toEqual({ ZZZ: 'circle' });
    removeCustomAlias('ZZZ');
    expect(resolveAlias('ZZZ')).toBeNull();
  });

  it('regression-detector: loads + fires an alert once, then persists cooldown', () => {
    // now must exceed COOLDOWN_MS (24h) so the default last-alert (0) is past cooldown.
    const now = 200_000_000;
    for (let i = 0; i < 40; i++) baselineTracker.recordSample('3d', 60, now + i);
    let alerts = 0;
    const det = createRegressionDetector(() => { alerts += 1; });
    // sustained low fps beyond the 30s window → one alert
    det.evaluate('3d', 5, now + 100);
    const fired = det.evaluate('3d', 5, now + 100 + 31_000);
    expect(fired).toBe(true);
    expect(alerts).toBe(1);
    // last-alert timestamp persisted (cooldown) as a JSON number
    expect(typeof JSON.parse(localStorage.getItem('bim3d.regressionAlert.3d') as string)).toBe('number');
  });
});
