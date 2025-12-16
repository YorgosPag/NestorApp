'use client';

import React from 'react';
import { usePreviewMode } from '../../hooks/usePreviewMode';
import { layoutUtilities } from '@/styles/design-tokens';

/**
 * TEMPORARY DEBUG COMPONENT
 * Για testing του preview mode manually
 */
export function DebugModeTest() {
  const { mode, setMode, isPreview, isNormal } = usePreviewMode();

  return (
    <div style={layoutUtilities.cssVars.debugFloat.main}>
      <div>Mode: {mode}</div>
      <div>Preview: {isPreview ? 'Yes' : 'No'}</div>
      <div>Normal: {isNormal ? 'Yes' : 'No'}</div>
      <button
        onClick={() => setMode('preview')}
        style={layoutUtilities.cssVars.debugFloat.button}
      >
        Preview
      </button>
      <button
        onClick={() => setMode('normal')}
        style={layoutUtilities.cssVars.debugFloat.button}
      >
        Normal
      </button>
    </div>
  );
}