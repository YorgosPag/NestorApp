'use client';

/**
 * CANVAS VISIBILITY TOGGLE BUTTONS
 * Debug controls για toggle DXF/Layer canvas visibility
 */

import React from 'react';

interface CanvasVisibilityButtonsProps {
  dxfCanvasVisible: boolean;
  layerCanvasVisible: boolean;
  onDxfToggle: () => void;
  onLayerToggle: () => void;
}

export const CanvasVisibilityButtons: React.FC<CanvasVisibilityButtonsProps> = ({
  dxfCanvasVisible,
  layerCanvasVisible,
  onDxfToggle,
  onLayerToggle
}) => {
  return (
    <>
      {/* DXF Canvas Toggle */}
      <button
        onClick={() => {
          onDxfToggle();
          console.log('🎯 DxfCanvas visibility toggled:', !dxfCanvasVisible);
        }}
        className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
        style={{ backgroundColor: dxfCanvasVisible ? '#16A34A' : '#E11D48', color: '#FFFFFF' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = dxfCanvasVisible ? '#22C55E' : '#F43F5E')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = dxfCanvasVisible ? '#16A34A' : '#E11D48')}
      >
        {dxfCanvasVisible ? '🟢 DXF ON' : '🔴 DXF OFF'}
      </button>

      {/* Layer Canvas Toggle */}
      <button
        onClick={() => {
          onLayerToggle();
          console.log('🎯 LayerCanvas visibility toggled:', !layerCanvasVisible);
        }}
        className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
        style={{ backgroundColor: layerCanvasVisible ? '#2563EB' : '#E11D48', color: '#FFFFFF' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = layerCanvasVisible ? '#3B82F6' : '#F43F5E')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = layerCanvasVisible ? '#2563EB' : '#E11D48')}
      >
        {layerCanvasVisible ? '🔵 LAYER ON' : '🔴 LAYER OFF'}
      </button>
    </>
  );
};
