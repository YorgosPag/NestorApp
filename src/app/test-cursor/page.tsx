'use client';

import React, { useState, useEffect } from 'react';

// Dynamic import για SSR compatibility
const TestCursorPageClient = () => {
  const [CursorComponent, setCursorComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    // Import the component only on client side
    import('../../subapps/dxf-viewer/ui/CursorSettingsPanel')
      .then((module) => {
        setCursorComponent(() => module.default);
      })
      .catch((error) => {
        console.error('Failed to load CursorSettingsPanel:', error);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-white text-2xl mb-4">Test Cursor Settings Panel</h1>
        <p className="text-gray-300 mb-4">
          Το κουμπί cursor θα εμφανιστεί κάτω αριστερά.
          Πατήστε το για να δοκιμάσετε τη λειτουργικότητα.
        </p>
        <div className="text-sm text-gray-400">
          Ανοίξτε τα Developer Tools (F12) και δείτε το Console για debug μηνύματα.
        </div>
        {CursorComponent ? (
          <div className="mt-4 text-green-400 text-sm">
            ✓ CursorSettingsPanel loaded successfully
          </div>
        ) : (
          <div className="mt-4 text-yellow-400 text-sm">
            ⏳ Loading CursorSettingsPanel...
          </div>
        )}
      </div>
      
      {CursorComponent && <CursorComponent />}
    </div>
  );
};

export default TestCursorPageClient;