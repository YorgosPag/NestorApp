/**
 * ADR-570 Φ1 — unit tests for the named line-style registry + ByStyle resolver.
 * Mirror of the DIMSTYLE registry contract (ADR-362).
 */

import {
  LineStyleRegistry,
  getLineStyleRegistry,
  getLineStyleSnapshot,
  __setLineStyleRegistryForTests,
} from '../line-style-registry';
import {
  BUILTIN_LINE_STYLES,
  BUILTIN_LINE_STYLE_IDS,
  DEFAULT_ACTIVE_LINE_STYLE_ID,
} from '../line-style-templates';
import { resolveLineStyle } from '../line-style-resolver';
import {
  LINE_STYLE_BYLAYER_LWT,
  LINE_STYLE_BYLAYER_PEN,
} from '../line-style-types';

describe('LineStyleRegistry — built-in seed', () => {
  let registry: LineStyleRegistry;
  beforeEach(() => {
    registry = new LineStyleRegistry();
  });

  it('seeds all 8 built-in styles', () => {
    expect(registry.getAllStyles()).toHaveLength(BUILTIN_LINE_STYLES.length);
    expect(BUILTIN_LINE_STYLES).toHaveLength(8);
  });

  it('resolves each built-in by its deterministic slug', () => {
    for (const style of BUILTIN_LINE_STYLES) {
      expect(registry.getStyle(style.id)).toEqual(style);
    }
  });

  it('defaults the active style to Medium', () => {
    expect(registry.getActiveStyleId()).toBe(DEFAULT_ACTIVE_LINE_STYLE_ID);
    expect(registry.getActiveStyle().id).toBe(BUILTIN_LINE_STYLE_IDS.MEDIUM);
  });

  it('stores built-in names as i18n keys (N.11 — no hardcoded Greek)', () => {
    for (const style of BUILTIN_LINE_STYLES) {
      expect(style.isBuiltIn).toBe(true);
      expect(style.name).toMatch(/^ribbon\.commands\.lineStyleNames\./);
    }
  });
});

describe('LineStyleRegistry — custom CRUD', () => {
  let registry: LineStyleRegistry;
  beforeEach(() => {
    registry = new LineStyleRegistry();
  });

  it('creates a custom style with a generated enterprise id', () => {
    const created = registry.createCustomStyle({
      name: 'Παχιά Ερυθρή',
      penColor: '#FF0000',
      lineweight: 0.7,
      pattern: 'Continuous',
      category: 'drafting',
    });
    expect(created.isBuiltIn).toBe(false);
    expect(created.id).toMatch(/^linestyle_/);
    expect(registry.getStyle(created.id)).toEqual(created);
    expect(registry.getAllStyles()).toHaveLength(9);
  });

  it('updates a custom style but rejects built-in mutation', () => {
    const created = registry.createCustomStyle({
      name: 'Custom', penColor: '#000', lineweight: 0.3,
      pattern: 'Continuous', category: 'drafting',
    });
    const updated = registry.updateCustomStyle(created.id, { lineweight: 0.9 });
    expect(updated.lineweight).toBe(0.9);
    expect(() =>
      registry.updateCustomStyle(BUILTIN_LINE_STYLE_IDS.THIN, { lineweight: 1 }),
    ).toThrow(/BUILTIN_READONLY/);
  });

  it('deletes a custom style and resets active if it was active', () => {
    const created = registry.createCustomStyle({
      name: 'Temp', penColor: '#000', lineweight: 0.3,
      pattern: 'Continuous', category: 'drafting',
    });
    registry.setActiveStyleId(created.id);
    registry.deleteCustomStyle(created.id);
    expect(registry.getStyle(created.id)).toBeUndefined();
    expect(registry.getActiveStyleId()).toBe(DEFAULT_ACTIVE_LINE_STYLE_ID);
  });

  it('refuses to delete a built-in', () => {
    expect(() => registry.deleteCustomStyle(BUILTIN_LINE_STYLE_IDS.CUT)).toThrow(
      /BUILTIN_READONLY/,
    );
  });

  it('duplicates a built-in into an editable custom copy', () => {
    const dup = registry.duplicateStyle(BUILTIN_LINE_STYLE_IDS.HIDDEN, 'Κρυφή μου');
    expect(dup.isBuiltIn).toBe(false);
    expect(dup.name).toBe('Κρυφή μου');
    expect(dup.pattern).toBe('Hidden');
    expect(dup.id).not.toBe(BUILTIN_LINE_STYLE_IDS.HIDDEN);
  });

  it('rejects an empty duplicate name', () => {
    expect(() =>
      registry.duplicateStyle(BUILTIN_LINE_STYLE_IDS.THIN, '   '),
    ).toThrow(/NAME_REQUIRED/);
  });
});

describe('LineStyleRegistry — snapshot + subscription', () => {
  it('returns a stable snapshot reference until a mutation notifies', () => {
    const registry = new LineStyleRegistry();
    const first = registry.getSnapshot();
    expect(registry.getSnapshot()).toBe(first);
    registry.createCustomStyle({
      name: 'X', penColor: '#000', lineweight: 0.3,
      pattern: 'Continuous', category: 'drafting',
    });
    expect(registry.getSnapshot()).not.toBe(first);
  });

  it('notifies subscribers on mutation and stops after unsubscribe', () => {
    const registry = new LineStyleRegistry();
    let hits = 0;
    const unsubscribe = registry.subscribe(() => { hits += 1; });
    registry.setActiveStyleId(BUILTIN_LINE_STYLE_IDS.THICK);
    expect(hits).toBe(1);
    unsubscribe();
    registry.setActiveStyleId(BUILTIN_LINE_STYLE_IDS.THIN);
    expect(hits).toBe(1);
  });
});

describe('getLineStyleRegistry — session singleton', () => {
  afterEach(() => __setLineStyleRegistryForTests(null));

  it('returns the same instance and exposes a bound snapshot', () => {
    const a = getLineStyleRegistry();
    const b = getLineStyleRegistry();
    expect(a).toBe(b);
    expect(getLineStyleSnapshot()).toBe(a.getSnapshot());
  });

  it('honors the test setter override', () => {
    const fresh = new LineStyleRegistry();
    __setLineStyleRegistryForTests(fresh);
    expect(getLineStyleRegistry()).toBe(fresh);
  });
});

describe('resolveLineStyle — override → ByStyle → ByLayer', () => {
  const registry = new LineStyleRegistry();

  it('falls back to ByLayer when no style and no overrides', () => {
    expect(resolveLineStyle(undefined, {}, registry)).toEqual({
      penColor: LINE_STYLE_BYLAYER_PEN,
      lineweight: LINE_STYLE_BYLAYER_LWT,
      pattern: 'Continuous',
    });
  });

  it('applies ByStyle properties from the referenced style', () => {
    const resolved = resolveLineStyle(BUILTIN_LINE_STYLE_IDS.HIDDEN, {}, registry);
    expect(resolved.pattern).toBe('Hidden');
    expect(resolved.lineweight).toBe(0.18);
    expect(resolved.penColor).toBe(LINE_STYLE_BYLAYER_PEN);
  });

  it('lets a per-object override win over ByStyle', () => {
    const resolved = resolveLineStyle(
      BUILTIN_LINE_STYLE_IDS.THICK,
      { penColor: '#00FF00', lineweight: 1.2 },
      registry,
    );
    expect(resolved.penColor).toBe('#00FF00');
    expect(resolved.lineweight).toBe(1.2);
    // pattern not overridden → inherits ByStyle (Continuous for Thick).
    expect(resolved.pattern).toBe('Continuous');
  });

  it('ignores an unknown lineStyleId (pure ByLayer)', () => {
    expect(resolveLineStyle('linestyle_missing', {}, registry).lineweight).toBe(
      LINE_STYLE_BYLAYER_LWT,
    );
  });
});
