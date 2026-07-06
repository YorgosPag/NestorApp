/**
 * ADR-362 Phase F4 — dxf-dimension-styles zod schema coverage.
 *
 * Pins the passthrough contract for the ~60-field DimStyle `style` payload (it
 * must NOT be stripped — same class of silent-strip bug as dxf-levels v2.13) and
 * the set-default action discriminator.
 */

import {
  CreateDimStyleSchema,
  UpdateDimStyleSchema,
  SetDefaultDimStyleSchema,
} from './dxf-dimension-styles.schemas';

describe('CreateDimStyleSchema', () => {
  it('accepts a custom style with a full passthrough style payload', () => {
    const input = {
      name: 'My Style',
      style: {
        dimclrd: 96, dimclrdTrueColor: 0x008000, dimtxt: 2.5, dimtad: 'above',
        dimdsep: ',', targetLayer: 'ΔΙΑΣΤΑΣΕΙΣ', dimasz: 2.5,
      },
    };
    const parsed = CreateDimStyleSchema.parse(input);
    expect(parsed.name).toBe('My Style');
    // Passthrough: every DimStyle field survives (no strip).
    expect(parsed.style).toEqual(input.style);
  });

  it('rejects an empty name', () => {
    expect(CreateDimStyleSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('accepts a thin built-in-ref shape (id + isBuiltInRef, no style)', () => {
    const parsed = CreateDimStyleSchema.parse({
      name: 'ISO 129', id: 'dimstyle_iso_129', isBuiltInRef: true,
    });
    expect(parsed.id).toBe('dimstyle_iso_129');
    expect(parsed.isBuiltInRef).toBe(true);
  });
});

describe('UpdateDimStyleSchema', () => {
  it('requires styleId and passes through the style payload', () => {
    const parsed = UpdateDimStyleSchema.parse({
      styleId: 'dimstyle_db_1',
      name: 'Renamed',
      style: { dimtxt: 5, dimasz: 3, custom_extra: true },
      _v: 4,
    });
    expect(parsed.styleId).toBe('dimstyle_db_1');
    expect(parsed.style).toEqual({ dimtxt: 5, dimasz: 3, custom_extra: true });
    expect(parsed._v).toBe(4);
  });

  it('rejects a missing styleId', () => {
    expect(UpdateDimStyleSchema.safeParse({ name: 'x' }).success).toBe(false);
  });
});

describe('SetDefaultDimStyleSchema', () => {
  it('accepts a custom set-default', () => {
    const parsed = SetDefaultDimStyleSchema.parse({ action: 'set-default', styleId: 'dimstyle_db_2' });
    expect(parsed.styleId).toBe('dimstyle_db_2');
    expect(parsed.isBuiltInRef).toBeUndefined();
  });

  it('accepts a built-in set-default with slug + name', () => {
    const parsed = SetDefaultDimStyleSchema.parse({
      action: 'set-default', styleId: 'dimstyle_iso_129', isBuiltInRef: true, name: 'ISO 129',
    });
    expect(parsed.isBuiltInRef).toBe(true);
    expect(parsed.name).toBe('ISO 129');
  });

  it('rejects a payload without the set-default action literal', () => {
    expect(SetDefaultDimStyleSchema.safeParse({ styleId: 'x' }).success).toBe(false);
    expect(SetDefaultDimStyleSchema.safeParse({ action: 'update', styleId: 'x' }).success).toBe(false);
  });
});
