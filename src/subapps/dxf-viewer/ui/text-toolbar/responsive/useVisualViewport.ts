'use client';

/**
 * ADR-344 Phase 5.E — visualViewport listener (Q10).
 *
 * Tracks the visual viewport so the TipTap overlay can reposition above
 * the on-screen keyboard on iOS / Android. Returns the keyboard "inset"
 * in CSS pixels — 0 when no keyboard is visible.
 */

import { useEffect, useState } from 'react';

interface ViewportInfo {
  readonly height: number;
  readonly width: number;
  readonly keyboardInset: number;
}

function read(): ViewportInfo {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return { height: 0, width: 0, keyboardInset: 0 };
  }
  const vv = window.visualViewport;
  const layoutHeight = window.innerHeight;
  return {
    height: vv.height,
    width: vv.width,
    keyboardInset: Math.max(0, layoutHeight - vv.height - vv.offsetTop),
  };
}

export function useVisualViewport(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>(() => read());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setInfo(read());
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return info;
}
