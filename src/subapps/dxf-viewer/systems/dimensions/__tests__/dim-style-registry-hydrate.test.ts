/**
 * ADR-362 Phase F4 — `DimStyleRegistry.hydrateCustomStyles` coverage.
 *
 * The Firestore sync feeds persisted CUSTOM styles into the live registry keyed
 * by their DB id. This pins the contract: upsert-by-DB-id, built-in protection,
 * no removal of absent styles, and notify-only-on-change (ADR-040 loop guard).
 */

import { DimStyleRegistry } from '../dim-style-registry';
import { BUILTIN_DIM_STYLE_IDS } from '../dim-style-templates';
import type { DimStyle } from '../../../types/dimension';

function customStyle(id: string, name: string, patch: Partial<DimStyle> = {}): DimStyle {
  const reg = new DimStyleRegistry();
  const { id: _id, isBuiltIn: _bi, name: _n, ...base } = reg.getActiveStyle();
  return { ...base, ...patch, id, name, isBuiltIn: false };
}

describe('DimStyleRegistry.hydrateCustomStyles (ADR-362 F4)', () => {
  it('upserts a persisted custom style under ITS DB id (not a fresh id)', () => {
    const reg = new DimStyleRegistry();
    const persisted = customStyle('dimstyle_db_123', 'Persisted A');
    reg.hydrateCustomStyles([persisted]);

    const got = reg.getStyle('dimstyle_db_123');
    expect(got).toBeDefined();
    expect(got?.id).toBe('dimstyle_db_123');
    expect(got?.name).toBe('Persisted A');
    expect(got?.isBuiltIn).toBe(false);
  });

  it('forces isBuiltIn=false even if the payload claims true', () => {
    const reg = new DimStyleRegistry();
    const rogue = { ...customStyle('dimstyle_db_x', 'Rogue'), isBuiltIn: true } as DimStyle;
    reg.hydrateCustomStyles([rogue]);
    expect(reg.getStyle('dimstyle_db_x')?.isBuiltIn).toBe(false);
  });

  it('never clobbers a built-in template on id collision', () => {
    const reg = new DimStyleRegistry();
    const isoBefore = reg.getStyle(BUILTIN_DIM_STYLE_IDS.ISO_129);
    const collision = customStyle(BUILTIN_DIM_STYLE_IDS.ISO_129, 'HACKED');
    reg.hydrateCustomStyles([collision]);
    const isoAfter = reg.getStyle(BUILTIN_DIM_STYLE_IDS.ISO_129);
    expect(isoAfter?.name).toBe(isoBefore?.name);
    expect(isoAfter?.isBuiltIn).toBe(true);
  });

  it('does NOT remove custom styles absent from a later payload (upsert-only)', () => {
    const reg = new DimStyleRegistry();
    reg.hydrateCustomStyles([customStyle('dimstyle_a', 'A')]);
    reg.hydrateCustomStyles([customStyle('dimstyle_b', 'B')]);
    expect(reg.getStyle('dimstyle_a')).toBeDefined();
    expect(reg.getStyle('dimstyle_b')).toBeDefined();
  });

  it('notifies subscribers only when content actually changes', () => {
    const reg = new DimStyleRegistry();
    const listener = jest.fn();
    reg.subscribe(listener);

    reg.hydrateCustomStyles([customStyle('dimstyle_c', 'C')]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Identical payload → no re-notify.
    reg.hydrateCustomStyles([customStyle('dimstyle_c', 'C')]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Real change → notify again.
    reg.hydrateCustomStyles([customStyle('dimstyle_c', 'C-renamed')]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('empty payload is a no-op (no notify)', () => {
    const reg = new DimStyleRegistry();
    const listener = jest.fn();
    reg.subscribe(listener);
    reg.hydrateCustomStyles([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a hydrated custom style can be activated (setActiveStyleId resolves it)', () => {
    const reg = new DimStyleRegistry();
    reg.hydrateCustomStyles([customStyle('dimstyle_active', 'Active One')]);
    reg.setActiveStyleId('dimstyle_active');
    expect(reg.getActiveStyleId()).toBe('dimstyle_active');
    expect(reg.getActiveStyle().name).toBe('Active One');
  });
});
