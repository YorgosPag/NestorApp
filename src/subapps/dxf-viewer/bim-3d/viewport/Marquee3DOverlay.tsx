/**
 * Marquee3DOverlay — the rubber-band rectangle for the 3D window/crossing marquee (ADR-692 Φ1).
 *
 * A thin DOM leaf: the ONLY subscriber to `Marquee3DStore`, so the ~60fps drag repaints just this
 * element and never the BimViewport3D tree (ADR-040 micro-leaf rule). `pointer-events-none` so it
 * never intercepts the drag it is drawing.
 *
 * Direction-based visual feedback (AutoCAD/Revit convention, verdict shared with the 2D marquee):
 *   • WINDOW  (L→R) → solid blue border, faint blue fill   (select fully-enclosed)
 *   • CROSSING(R→L) → dashed green border, faint green fill (select anything touched)
 *
 * Colors are NOT hardcoded: they read the SAME user-configurable SSoT the 2D marquee uses
 * (`cursorConfig.getSettings().selection.window|crossing`), so a palette tweak in Settings applies
 * to both viewports at once (SSoT, no drift). Geometry (left/top/width/height) and those data-driven
 * colors are values, not static styling, so they ride the inline `style`; only layout utilities stay
 * in Tailwind classes (N.3). Coordinates are client px → `fixed` positioning matches.
 */

import { useSyncExternalStore } from 'react';
import { Marquee3DStore } from '../systems/marquee/Marquee3DStore';
import { getMarqueeSelectionType } from '../../systems/selection/marquee-direction';
import { cursorConfig } from '../../systems/cursor/config';
import { hexToRgba } from '../../config/color-math';

export function Marquee3DOverlay(): React.JSX.Element | null {
  const state = useSyncExternalStore(
    (cb) => Marquee3DStore.subscribe(cb),
    () => Marquee3DStore.getSnapshot(),
    () => Marquee3DStore.getSnapshot(),
  );

  if (!state.isSelecting || !state.start || !state.current) return null;

  const { start, current } = state;
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  const isWindow = getMarqueeSelectionType(start.x, current.x) === 'window';

  // Mirror the 2D marquee palette SSoT (AutoCAD blue window / green crossing, user-configurable).
  const mode = isWindow ? cursorConfig.getSettings().selection.window : cursorConfig.getSettings().selection.crossing;

  return (
    <div
      role="presentation"
      className="pointer-events-none fixed z-[60]"
      style={{
        left, top, width, height,
        borderWidth: mode.borderWidth,
        borderStyle: mode.borderStyle,
        borderColor: hexToRgba(mode.borderColor, mode.borderOpacity),
        backgroundColor: hexToRgba(mode.fillColor, mode.fillOpacity),
      }}
    />
  );
}
