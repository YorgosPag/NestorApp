'use client';

import React from 'react';

interface RulerDebugButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
}

export const RulerDebugButton: React.FC<RulerDebugButtonProps> = ({ onNotify, canvasTransform }) => {
  const handleToggle = () => {
    console.log('🛠️ RULER DEBUG TOGGLE TRIGGERED');
    import('../../debug/RulerDebugOverlay').then(module => {
      const { rulerDebugOverlay } = module;

      const enabled = rulerDebugOverlay.toggle();

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ruler-debug-toggle', {
            detail: { enabled }
          }));
        }, 50);
      }

      const diagnostics = rulerDebugOverlay.getDiagnostics();

      let debugInfo = `Ruler Debug: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\n`;

      if (enabled) {
        debugInfo += `🎯 Tick Markers: RED (major) / GREEN (minor)\n`;
        debugInfo += `📐 Calibration Grid: CYAN 100mm grid\n`;
        debugInfo += `🔍 Auto-verification: ACTIVE\n\n`;

        debugInfo += `📊 CURRENT TRANSFORM:\n`;
        debugInfo += `  Scale: ${canvasTransform.scale.toFixed(3)}\n`;
        debugInfo += `  Offset: (${canvasTransform.offsetX.toFixed(1)}, ${canvasTransform.offsetY.toFixed(1)})\n\n`;

        const canvasEl = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          debugInfo += `📐 VIEWPORT:\n`;
          debugInfo += `  Size: ${rect.width.toFixed(0)} × ${rect.height.toFixed(0)} px\n`;
          debugInfo += `  Position: (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})\n\n`;

          const canvasX = 80 + canvasTransform.offsetX;
          const canvasY = (rect.height - 30) - canvasTransform.offsetY;
          const screenX = rect.left + canvasX;
          const screenY = rect.top + canvasY;
          debugInfo += `🎯 WORLD (0,0) POSITION:\n`;
          debugInfo += `  Canvas: (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)})\n`;
          debugInfo += `  Screen: (${screenX.toFixed(1)}, ${screenY.toFixed(1)})\n\n`;
        }

        debugInfo += `📏 RULER SETTINGS:\n`;
        debugInfo += `  Tick Interval: 50 units\n`;
        debugInfo += `  Major Ticks: 10px\n`;
        debugInfo += `  Minor Ticks: 5px\n`;
      } else {
        debugInfo += `All debug overlays hidden`;
      }

      onNotify(debugInfo, enabled ? 'success' : 'info');

      console.log('📏 RULER DEBUG DIAGNOSTICS:', diagnostics);
      console.log('🎯 Transform:', canvasTransform);
    });
  };

  return (
    <button
      onClick={handleToggle}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#4F46E5', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#6366F1')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4F46E5')}
    >
      📏 Rulers
    </button>
  );
};
