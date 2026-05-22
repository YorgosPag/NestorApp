/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import React, { useState, useEffect } from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('TestCursorPage');

// Dynamic import για SSR compatibility
// 🏢 ENTERPRISE: Type-safe component state
interface CursorSettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const TestCursorPageClient = () => {
  const colors = useSemanticColors();
  const [CursorComponent, setCursorComponent] = useState<React.ComponentType<CursorSettingsPanelProps> | null>(null);
  // 🏢 ENTERPRISE: State for cursor settings panel visibility
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  useEffect(() => {
    // Import the component only on client side
    import('../../subapps/dxf-viewer/ui/CursorSettingsPanel')
      .then((module) => {
        setCursorComponent(() => module.default as React.ComponentType<CursorSettingsPanelProps>);
      })
      .catch((error) => {
        logger.error('Failed to load CursorSettingsPanel', { error });
      });
  }, []);

  return (
    <div className={`min-h-screen ${colors.bg.secondary} flex items-center justify-center`}>
      <div className={`${colors.bg.hover} p-8 rounded-lg shadow-lg`}>
        <h1 className="text-white text-2xl mb-4">Test Cursor Settings Panel</h1>
        <p className="text-muted-foreground mb-4">
          Το κουμπί cursor θα εμφανιστεί κάτω αριστερά.
          Πατήστε το για να δοκιμάσετε τη λειτουργικότητα.
        </p>
        <div className="text-sm text-muted-foreground">
          Ανοίξτε τα Developer Tools (F12) και δείτε το Console για debug μηνύματα.
        </div>
        {CursorComponent ? (
          <div className="mt-4 text-green-707 text-sm">
            ✓ CursorSettingsPanel loaded successfully
          </div>
        ) : (
          <div className="mt-4 text-[hsl(var(--text-warning))] text-sm">
            ⏳ Loading CursorSettingsPanel...
          </div>
        )}
      </div>
      
      {CursorComponent && (
        <CursorComponent
          isVisible={isPanelVisible}
          onClose={() => setIsPanelVisible(false)}
        />
      )}
    </div>
  );
};

export default TestCursorPageClient;