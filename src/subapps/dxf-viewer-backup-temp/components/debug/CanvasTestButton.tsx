'use client';

/**
 * CANVAS ALIGNMENT TEST BUTTON
 * Tests canvas alignment, z-index, and green border detection
 */

import React from 'react';

interface CanvasTestButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CanvasTestButton: React.FC<CanvasTestButtonProps> = ({ onNotify }) => {
  const handleTest = () => {
    console.log('🎯 MANUAL CANVAS ALIGNMENT TEST TRIGGERED FROM HEADER');

    // Import το CanvasAlignmentTester
    import('../../debug/canvas-alignment-test').then(module => {
      const CanvasAlignmentTester = module.CanvasAlignmentTester;
      const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
      const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
      const greenBorder = CanvasAlignmentTester.findGreenBorder();

      console.log('🔍 DETAILED Z-INDEX DEBUG:', {
        alignmentResult,
        zIndexResult,
        greenBorder: !!greenBorder
      });

      // Direct DOM inspection
      const dxfEl = document.querySelector('canvas[data-canvas-type="dxf"]');
      const layerEl = document.querySelector('canvas[data-canvas-type="layer"]');
      console.log('🔍 DIRECT DOM INSPECTION:', {
        dxfCanvas: dxfEl ? {
          inlineStyle: (dxfEl as HTMLElement).style.cssText,
          computedZIndex: window.getComputedStyle(dxfEl).zIndex,
          computedPosition: window.getComputedStyle(dxfEl).position
        } : 'NOT FOUND',
        layerCanvas: layerEl ? {
          inlineStyle: (layerEl as HTMLElement).style.cssText,
          computedZIndex: window.getComputedStyle(layerEl).zIndex,
          computedPosition: window.getComputedStyle(layerEl).position
        } : 'NOT FOUND'
      });

      const testMessage = `Canvas Alignment: ${alignmentResult.isAligned ? '✅ OK' : '❌ MISALIGNED'}\nZ-Index Order: ${zIndexResult.isCorrectOrder ? '✅ OK' : '❌ WRONG'}\nGreen Border Found: ${greenBorder ? '✅ YES' : '❌ NO'}`;
      const allTestsPass = alignmentResult.isAligned && zIndexResult.isCorrectOrder && greenBorder;
      onNotify(testMessage, allTestsPass ? 'success' : 'warning');
    }).catch(err => {
      console.error('Failed to load CanvasAlignmentTester:', err);
      onNotify('Failed to load test module', 'error');
    });
  };

  return (
    <button
      onClick={handleTest}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#FCD34D', color: '#000000' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FBBF24')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FCD34D')}
    >
      🎯 Test Canvas
    </button>
  );
};
