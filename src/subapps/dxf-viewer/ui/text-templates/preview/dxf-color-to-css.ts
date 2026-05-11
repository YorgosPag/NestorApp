/**
 * ADR-344 Phase 7.D — DxfColor → CSS string for the preview canvas.
 *
 * The full DxfRenderer resolves ByLayer/ByBlock against scene layers; the
 * preview has no scene context so:
 *   - ByLayer / ByBlock → caller's `inherit` (defaults to black)
 *   - ACI               → minimal 8-entry palette (the common case;
 *                          falls back to inherit beyond index 8)
 *   - TrueColor         → `rgb(r, g, b)`
 *
 * Extending the palette later is straightforward, but for the preview a
 * minimal table is enough to convey colour intent without dragging in the
 * full 256-entry AutoCAD palette.
 */
import type { DxfColor } from '@/subapps/dxf-viewer/text-engine/types/text-toolbar.types';

const ACI_PALETTE: Readonly<Record<number, string>> = {
  1: '#ff0000', // red
  2: '#ffff00', // yellow
  3: '#00ff00', // green
  4: '#00ffff', // cyan
  5: '#0000ff', // blue
  6: '#ff00ff', // magenta
  7: '#000000', // white → black on white-bg preview
  8: '#808080', // gray
};

export function dxfColorToCss(color: DxfColor, inherit: string = '#000000'): string {
  switch (color.kind) {
    case 'ByLayer':
    case 'ByBlock':
      return inherit;
    case 'ACI':
      return ACI_PALETTE[color.index] ?? inherit;
    case 'TrueColor':
      return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }
}
