'use client';

import React from 'react';
import { usePreviewMode } from './hooks/usePreviewMode';

/**
 * TEMPORARY DEBUG COMPONENT
 * Για testing του preview mode manually
 */
export function DebugModeTest() {
  const { mode, setMode, isPreview, isNormal } = usePreviewMode();

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: 10,
      zIndex: 10000,
      fontSize: 12
    }}>
      <div>Mode: {mode}</div>
      <div>Preview: {isPreview ? 'Yes' : 'No'}</div>
      <div>Normal: {isNormal ? 'Yes' : 'No'}</div>
      <button
        onClick={() => setMode('preview')}
        style={{ margin: 2, padding: 2 }}
      >
        Preview
      </button>
      <button
        onClick={() => setMode('normal')}
        style={{ margin: 2, padding: 2 }}
      >
        Normal
      </button>
    </div>
  );
}