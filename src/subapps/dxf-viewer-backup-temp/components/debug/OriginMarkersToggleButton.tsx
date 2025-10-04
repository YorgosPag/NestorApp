'use client';

import React from 'react';

interface OriginMarkersToggleButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const OriginMarkersToggleButton: React.FC<OriginMarkersToggleButtonProps> = ({ onNotify }) => {
  const handleToggle = () => {
    console.log('🛠️ ORIGIN MARKERS DEBUG TOGGLE TRIGGERED');
    import('../../debug/OriginMarkersDebugOverlay').then(module => {
      const { originMarkersDebug } = module;

      const enabled = originMarkersDebug.toggle();

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('origin-markers-toggle', {
            detail: { enabled }
          }));
        }, 50);
      }

      const originMessage = `Origin Markers: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\nMarkers ${enabled ? 'are now visible!' : 'are now hidden!'}`;
      onNotify(originMessage, enabled ? 'success' : 'info');
    }).catch(error => {
      console.error('Failed to load origin markers debug:', error);
      onNotify('Failed to load origin markers debug module', 'error');
    });
  };

  return (
    <button
      onClick={handleToggle}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#F97316', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FB923C')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F97316')}
    >
      🎯 Origin (0,0)
    </button>
  );
};
