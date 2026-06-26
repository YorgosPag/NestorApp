/**
 * ADR-538 — resolveHoverBadge: the shared "+"/"−" hover badge decision (2D crosshair + 3D).
 */

import { resolveHoverBadge, HOVER_BADGE_STYLE } from '../hover-add-badge';

describe('resolveHoverBadge', () => {
  it('is hidden when nothing is hovered', () => {
    expect(resolveHoverBadge(null, false).visible).toBe(false);
    expect(resolveHoverBadge(null, true).visible).toBe(false);
  });

  it('shows green "+" when hovered without Shift (add to selection)', () => {
    const v = resolveHoverBadge('e1', false);
    expect(v).toEqual({
      visible: true,
      text: HOVER_BADGE_STYLE.add.text,
      color: HOVER_BADGE_STYLE.add.color,
      backgroundColor: HOVER_BADGE_STYLE.add.backgroundColor,
    });
    expect(v.text).toBe('+');
    expect(v.color).toBe('#44FF88');
  });

  it('shows red "−" when hovered with Shift held (remove)', () => {
    const v = resolveHoverBadge('e1', true);
    expect(v.text).toBe('−');
    expect(v.color).toBe('#FF5555');
    expect(v.backgroundColor).toBe('#2b0d0d');
  });
});
