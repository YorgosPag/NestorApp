import React, { memo } from 'react';
import { ZoomWindowState } from '../hooks/useZoomWindow';

interface ZoomWindowOverlayProps {
  zoomWindowState: ZoomWindowState;
  className?: string;
}

// 🔧 FIX: Memoized component to prevent unnecessary re-renders
const ZoomWindowOverlay = memo<ZoomWindowOverlayProps>(({ zoomWindowState, className = '' }) => {
  // Show instructions when zoom window is active but not dragging
  if (zoomWindowState.isActive && !zoomWindowState.isDragging) {
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ zIndex: 2000 }}>
        <div className="absolute bottom-4 left-4 bg-blue-600 bg-opacity-90 text-white px-4 py-2 rounded-lg shadow-lg border border-blue-400">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <div>
              <div className="font-medium">Zoom Window Mode</div>
              <div className="text-xs opacity-90">Κάντε κλικ και σύρετε για επιλογή περιοχής • ESC για ακύρωση</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show rectangle preview when dragging
  if (!zoomWindowState.isActive || !zoomWindowState.isDragging || !zoomWindowState.previewRect) {
    return null;
  }

  const rect = zoomWindowState.previewRect;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ zIndex: 2000 }}>
      {/* Semi-transparent overlay with cutout */}
      <div
        className="absolute inset-0 bg-black bg-opacity-30"
        style={{
          clipPath: `polygon(
            0% 0%, 
            0% 100%, 
            ${rect.x}px 100%, 
            ${rect.x}px ${rect.y}px, 
            ${rect.x + rect.width}px ${rect.y}px, 
            ${rect.x + rect.width}px ${rect.y + rect.height}px, 
            ${rect.x}px ${rect.y + rect.height}px, 
            ${rect.x}px 100%, 
            100% 100%, 
            100% 0%
          )`
        }}
      />
      
      {/* Selection rectangle */}
      <div
        className="absolute border-2 border-blue-400 bg-blue-200 bg-opacity-20"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderStyle: 'dashed',
          borderRadius: '2px'
        }}
      >
        {/* Corner indicators */}
        <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow" />
        
        {/* Size indicator */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium shadow">
          {Math.round(rect.width)}×{Math.round(rect.height)}
        </div>
      </div>

      {/* Instructions during drag */}
      <div className="absolute bottom-4 left-4 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm shadow-lg">
        🔍 Άφησε το mouse για zoom • ESC για ακύρωση
      </div>
    </div>
  );
});

ZoomWindowOverlay.displayName = 'ZoomWindowOverlay';

export default ZoomWindowOverlay;
