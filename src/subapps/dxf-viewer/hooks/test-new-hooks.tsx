/**
 * TEST UTILITY ΓΙΑ ΤΑ ΝΕΑ HOOKS
 * Απλό test component για verification της λειτουργικότητας
 * ΠΡΟΣΟΧΗ: Αυτό το αρχείο είναι ΜΟΝΟ για testing - θα διαγραφεί αργότερα
 */

'use client';

import React from 'react';
import { ConfigurationProvider } from '../providers/ConfigurationProvider';
import { StyleManagerProvider } from '../providers/StyleManagerProvider';
import { useEntityStyles } from './useEntityStyles';
import { usePreviewMode } from './usePreviewMode';
import { useOverrideSystem } from './useOverrideSystem';
import { layoutUtilities } from '@/styles/design-tokens';

// ===== TEST COMPONENT =====

function HooksTestComponent() {
  // Test των hooks
  const lineStyles = useEntityStyles('line');
  const textStyles = useEntityStyles('text');
  const gripStyles = useEntityStyles('grip');

  const { mode, setMode, isPreview } = usePreviewMode();
  const { isEnabled, toggle } = useOverrideSystem();

  return (
    <div style={layoutUtilities.cssVars.testContainer}>
      <h3>🧪 HOOKS TEST (TEMPORARY)</h3>

      <div>
        <h4>Mode Management:</h4>
        <p>Current Mode: {mode}</p>
        <p>Is Preview: {isPreview ? 'YES' : 'NO'}</p>
        <button onClick={() => setMode('preview')}>Set Preview</button>
        <button onClick={() => setMode('normal')}>Set Normal</button>
      </div>

      <div>
        <h4>Override System:</h4>
        <p>Line Override: {isEnabled('line') ? 'ON' : 'OFF'}</p>
        <p>Text Override: {isEnabled('text') ? 'ON' : 'OFF'}</p>
        <p>Grip Override: {isEnabled('grip') ? 'ON' : 'OFF'}</p>
        <button onClick={() => toggle('line')}>Toggle Line Override</button>
        <button onClick={() => toggle('text')}>Toggle Text Override</button>
        <button onClick={() => toggle('grip')}>Toggle Grip Override</button>
      </div>

      <div>
        <h4>Entity Styles:</h4>
        <p>Line Color: {lineStyles.settings.color}</p>
        <p>Text Color: {textStyles.settings.color}</p>
        <p>Grip Size: {gripStyles.settings.gripSize}</p>
        <button onClick={() => lineStyles.update({ color: '#FF0000' })}>
          Set Line Red
        </button>
        <button onClick={() => textStyles.update({ color: '#00FF00' })}>
          Set Text Green
        </button>
        <button onClick={() => gripStyles.update({ gripSize: 12 })}>
          Set Grip Size 12
        </button>
      </div>

      <div>
        <h4>Reset Actions:</h4>
        <button onClick={() => lineStyles.reset()}>Reset Line</button>
        <button onClick={() => textStyles.reset()}>Reset Text</button>
        <button onClick={() => gripStyles.reset()}>Reset Grip</button>
      </div>
    </div>
  );
}

// ===== WRAPPED TEST COMPONENT =====

export function HooksTestWrapper() {
  return (
    <ConfigurationProvider>
      <StyleManagerProvider>
        <HooksTestComponent />
      </StyleManagerProvider>
    </ConfigurationProvider>
  );
}

// ===== EXPORT FOR TESTING =====

export default HooksTestWrapper;