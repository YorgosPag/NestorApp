'use client';

/**
 * ADR-344 Phase 5.E — Responsive switch between desktop and mobile.
 *
 * Single entry point for code that mounts the toolbar — internally picks
 * `TextToolbar` for ≥768 px viewports and `MobileTextToolbar` below.
 * Uses a CSS media query via `matchMedia` to avoid mounting both trees.
 */

import React, { useEffect, useState } from 'react';
import { TextToolbar } from '../TextToolbar';
import { MobileTextToolbar } from './MobileTextToolbar';
import type { LayerSelectorEntry } from '../controls';
import type { DxfDocumentVersion } from '../../../text-engine/types';

const DESKTOP_QUERY = '(min-width: 768px)';

interface ResponsiveTextToolbarProps {
  readonly layers: readonly LayerSelectorEntry[];
  readonly availableFonts: readonly string[];
  readonly documentVersion: DxfDocumentVersion;
  readonly onRequestFontUpload: () => void;
  readonly onInsertToken: (token: string) => void;
  readonly onEyedropper: () => void;
  readonly onVoice?: () => void;
  readonly onFindReplace?: () => void;
}

export function ResponsiveTextToolbar(props: ResponsiveTextToolbarProps) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop ? <TextToolbar {...props} /> : <MobileTextToolbar {...props} />;
}
