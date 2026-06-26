'use client';

/**
 * HoverAddBadge3D — the AutoCAD-style "+"/"−" hover badge for the 3D viewport (ADR-538).
 *
 * Mirror of the 2D crosshair badge (`CrosshairOverlay.applyBadge`): a small DOM div placed
 * just NE of the cursor, showing green "+" when an entity is hovered (add) or red "−" with
 * Shift (remove). It reuses the EXACT same decision SSoT (`resolveHoverBadge`) and the same
 * NE offset (`computeBadgeOffset`) as the 2D crosshair — one source of truth.
 *
 * The 3D viewport keeps the normal OS cursor (no full crosshair, per the design decision),
 * so this is ONLY the badge. ADR-040: zero React re-render — direct DOM writes driven by the
 * unified `HoverStore` + Shift + a `position: fixed` cursor follower.
 */

import { useRef, useEffect } from 'react';
import { getHoveredEntity, subscribeHoveredEntity } from '../../systems/hover/HoverStore';
import { resolveHoverBadge } from '../../systems/hover/hover-add-badge';
import { computeBadgeOffset } from '../../canvas-v2/overlays/crosshair-compositor-layout';

/** Badge box size (px) — mirror the 2D crosshair badge. */
const BADGE_SIZE = 11;
/** NE offset from the cursor (no aperture in 3D → a small fixed gap). */
const BADGE_OFFSET = computeBadgeOffset(6);

export function HoverAddBadge3D() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(false);

  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge) return;

    const applyBadge = (): void => {
      const view = resolveHoverBadge(getHoveredEntity(), shiftRef.current);
      if (view.visible) {
        badge.textContent = view.text;
        badge.style.color = view.color;
        badge.style.backgroundColor = view.backgroundColor;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    };
    const applyPosition = (e: MouseEvent): void => {
      badge.style.left = `${e.clientX + BADGE_OFFSET}px`;
      badge.style.top = `${e.clientY - BADGE_OFFSET - BADGE_SIZE}px`;
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Shift') return;
      shiftRef.current = e.type === 'keydown';
      applyBadge();
    };

    applyBadge();
    const unsub = subscribeHoveredEntity(applyBadge);
    window.addEventListener('mousemove', applyPosition);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      unsub();
      window.removeEventListener('mousemove', applyPosition);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  return (
    <div
      ref={badgeRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        display: 'none',
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        fontSize: BADGE_SIZE,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        lineHeight: `${BADGE_SIZE}px`,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
}
