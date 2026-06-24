/**
 * origin-indicator-overlay.ts — pulsing SVG crosshair shown briefly after
 * `panToWorldOrigin()` to confirm the camera centered on world (0,0).
 *
 * Extracted from useDxfViewerCallbacks.ts to keep that file under the
 * 500-line Google SRP limit (N.7.1).
 */

import { UI_COLORS } from '../config/color-config';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { DXF_TIMING } from '../config/dxf-timing';

const OVERLAY_ID = 'origin-indicator-overlay';
const OVERLAY_TTL_MS = DXF_TIMING.animation.OVERLAY_TTL; // ADR-516

/** Creates a pulsing SVG crosshair overlay at the given screen coordinates. */
export function createOriginIndicatorOverlay(finalScreenX: number, finalScreenY: number): void {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    left: ${finalScreenX}px;
    top: ${finalScreenY}px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 10000;
  `;

  overlay.innerHTML = `
    <svg width="200" height="200" style="overflow: visible;">
      <circle cx="100" cy="100" r="60" fill="none" stroke="${UI_COLORS.BRIGHT_YELLOW}" stroke-width="3" opacity="0.8">
        <animate attributeName="r" values="60;80;60" dur="2s" repeatCount="3" />
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="3" />
      </circle>
      <circle cx="100" cy="100" r="30" fill="none" stroke="${UI_COLORS.BRIGHT_GREEN}" stroke-width="2" opacity="0.9">
        <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="3" />
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="3" />
      </circle>
      <line x1="100" y1="50" x2="100" y2="150" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="2" opacity="0.9" />
      <line x1="50" y1="100" x2="150" y2="100" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="2" opacity="0.9" />
      <circle cx="100" cy="100" r="5" fill="${UI_COLORS.BRIGHT_YELLOW}" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="1">
        <animate attributeName="r" values="5;8;5" dur="1s" repeatCount="6" />
      </circle>
      <path d="M 100 20 L 95 35 L 105 35 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 10; 0 0" dur="1.5s" repeatCount="indefinite" />
      </path>
      <path d="M 180 100 L 165 95 L 165 105 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
        <animateTransform attributeName="transform" type="translate" values="0 0; -10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
      </path>
      <path d="M 100 180 L 95 165 L 105 165 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
      </path>
      <path d="M 20 100 L 35 95 L 35 105 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
      </path>
      <text x="100" y="210" text-anchor="middle" fill="${UI_COLORS.WHITE}" font-size="14" font-weight="bold"
            stroke="${UI_COLORS.BLACK}" stroke-width="3" paint-order="stroke">
        WORLD (0,0)
      </text>
      <text x="100" y="210" text-anchor="middle" fill="${UI_COLORS.BRIGHT_GREEN}" font-size="14" font-weight="bold">
        WORLD (0,0)
      </text>
    </svg>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    const elem = document.getElementById(OVERLAY_ID);
    if (elem) {
      elem.style.transition = 'opacity 0.5s';
      elem.style.opacity = '0';
      setTimeout(() => elem.remove(), PANEL_LAYOUT.TIMING.ELEMENT_REMOVE);
    }
  }, OVERLAY_TTL_MS);
}
