'use client';

// ============================================================================
// ♿ SELECTION CURSOR ICON — modifier badge near cursor (ADR-366 §A.7.Q3)
// ============================================================================
//
// Shows a small SVG badge next to the cursor when Ctrl / Shift is held,
// previewing the selection modifier that the next click will apply:
//   Ctrl        → "+"  (add to selection)
//   Shift       → "−"  (remove from selection)
//   Ctrl+Shift  → "±"  (toggle)
//
// Mounted once in CanvasLayerStack — cross-mode: works in 2D + 3D.
//
// ADR-040 compliance:
//   - No useSyncExternalStore → orchestrators stay subscription-free
//   - Cursor position updated via imperative style.transform (no React
//     re-renders at 60fps — mirrors FocusIndicator3D RAF pattern)
//   - Mode changes (keydown/keyup) → low-freq setState only
//   - Window blur → resets modifier state (prevents stuck icon)
// ============================================================================

import { useEffect, useRef, useState } from 'react';

type CursorMode = 'add' | 'remove' | 'toggle';

const ICON_OFFSET_PX = 12;

function deriveMode(e: KeyboardEvent): CursorMode | null {
  if (e.ctrlKey && e.shiftKey) return 'toggle';
  if (e.ctrlKey) return 'add';
  if (e.shiftKey) return 'remove';
  return null;
}

export function SelectionCursorIcon() {
  const iconRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<CursorMode | null>(null);
  const posRef = useRef({ x: -9999, y: -9999 });
  const [mode, setMode] = useState<CursorMode | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      const el = iconRef.current;
      if (!el || modeRef.current === null) return;
      el.style.transform = `translate3d(${e.clientX + ICON_OFFSET_PX}px, ${e.clientY + ICON_OFFSET_PX}px, 0)`;
    };

    const onKey = (e: KeyboardEvent) => {
      const next = deriveMode(e);
      modeRef.current = next;
      setMode(next);
      if (next !== null) {
        const el = iconRef.current;
        if (el) {
          const { x, y } = posRef.current;
          el.style.transform = `translate3d(${x + ICON_OFFSET_PX}px, ${y + ICON_OFFSET_PX}px, 0)`;
        }
      }
    };

    const onBlur = () => {
      modeRef.current = null;
      setMode(null);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div
      ref={iconRef}
      className={`pointer-events-none fixed left-0 top-0 z-[300] select-none${mode === null ? ' hidden' : ''}`}
      aria-hidden="true"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="rgba(0,0,0,0.82)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        {mode === 'add' && (
          <>
            <line x1="10" y1="5" x2="10" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {mode === 'remove' && (
          <line x1="5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
        )}
        {mode === 'toggle' && (
          <text x="10" y="14" fontSize="11" fill="white" textAnchor="middle">±</text>
        )}
      </svg>
    </div>
  );
}
