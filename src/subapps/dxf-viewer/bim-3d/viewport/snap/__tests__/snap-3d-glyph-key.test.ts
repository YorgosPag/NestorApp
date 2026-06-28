/**
 * ADR-040 / ADR-542 — snap-3d-glyph-key: subscribe to glyph IDENTITY, not the whole marker.
 * Position/elevation are excluded so a position-only change keeps the same key (zero re-render);
 * type/description round-trip for rendering without reading the store mid-render.
 */

import { snapGlyphKey, parseSnapGlyphKey } from '../snap-3d-glyph-key';
import type { Snap3DMarker } from '../../../stores/Snap3DOverlayStore';

const marker = (
  type: string,
  description: string | undefined,
  x = 0,
  y = 0,
  elevMm = 0,
): Snap3DMarker => ({ view: { point: { x, y }, type, description }, elevMm });

describe('snapGlyphKey', () => {
  it('null marker → null key', () => {
    expect(snapGlyphKey(null)).toBeNull();
  });

  it('non-visual snap type (grid/guide) → null key', () => {
    expect(snapGlyphKey(marker('grid', undefined))).toBeNull();
    expect(snapGlyphKey(marker('guide', 'Οδηγός'))).toBeNull();
  });

  it('same glyph identity, DIFFERENT position → SAME key (no re-render)', () => {
    const a = snapGlyphKey(marker('endpoint', 'Γωνία κολώνας', 10, 20, 0));
    const b = snapGlyphKey(marker('endpoint', 'Γωνία κολώνας', 999, -5, 3000));
    expect(a).toBe(b);
  });

  it('different type → different key', () => {
    expect(snapGlyphKey(marker('endpoint', 'Γωνία')))
      .not.toBe(snapGlyphKey(marker('midpoint', 'Γωνία')));
  });

  it('different description → different key', () => {
    expect(snapGlyphKey(marker('center', 'Κέντρο κύκλου')))
      .not.toBe(snapGlyphKey(marker('center', 'Κέντρο τόξου')));
  });
});

describe('parseSnapGlyphKey round-trip', () => {
  it('recovers type + multi-word description', () => {
    const key = snapGlyphKey(marker('endpoint', 'Γωνία κολώνας'))!;
    expect(parseSnapGlyphKey(key)).toEqual({ type: 'endpoint', description: 'Γωνία κολώνας' });
  });

  it('recovers undefined description', () => {
    const key = snapGlyphKey(marker('midpoint', undefined))!;
    expect(parseSnapGlyphKey(key)).toEqual({ type: 'midpoint', description: undefined });
  });
});
