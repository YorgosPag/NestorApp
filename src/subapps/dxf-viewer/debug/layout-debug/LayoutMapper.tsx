'use client';
import React, { useEffect, useState, useRef } from 'react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { portalComponents } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface ElementMetrics {
  name: string;
  element: HTMLElement | null;
  rect: DOMRect | null;
  className?: string;
}

export default function LayoutMapper() {
  const [metrics, setMetrics] = useState<ElementMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();

  const measureElements = () => {
    const elementsToMeasure = [
      // Core UI Elements
      { name: '🔧 Central Toolbar', selector: '[class*="toolbar"], .toolbar-container', className: 'bg-blue-500' },
      { name: '📏 Horizontal Ruler', selector: '.horizontal-ruler, [class*="horizontal-ruler"]', className: 'bg-yellow-500' },
      { name: '📐 Vertical Ruler', selector: '.vertical-ruler, [class*="vertical-ruler"]', className: 'bg-yellow-500' },

      // Canvas Elements
      { name: '🎨 DXF Canvas', selector: '.dxf-canvas, canvas[class*="dxf"]', className: 'bg-green-500' },
      { name: '🎭 Layer Canvas', selector: '.layer-canvas, canvas[class*="layer"]', className: 'bg-purple-500' },
      { name: '⭕ Crosshair Canvas', selector: 'canvas[class*="crosshair"]', className: 'bg-red-500' },

      // Container Elements
      { name: '📦 Canvas Section', selector: '[class*="canvas-section"], [class*="CanvasSection"]', className: 'bg-orange-500' },
      { name: '🏠 Canvas Container', selector: '[class*="canvas-container"], [class*="CanvasContainer"]', className: 'bg-pink-500' },
      { name: '🖼️ Main Layout', selector: '[class*="dxf-layout"], [class*="DxfLayout"]', className: 'bg-indigo-500' },

      // Status & UI Elements
      { name: '📊 Status Bar', selector: '[class*="status"], [class*="StatusBar"]', className: 'bg-gray-500' },
      { name: '🎛️ Control Panel', selector: '[class*="control"], [class*="panel"]', className: 'bg-teal-500' }
    ];

    const newMetrics: ElementMetrics[] = elementsToMeasure.map(({ name, selector, className }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const rect = element?.getBoundingClientRect() || null;

      return {
        name,
        element,
        rect,
        className
      };
    });

    setMetrics(newMetrics);

    // 🎯 DEBUG: Εκτύπωση μετρήσεων
    console.log('🔧 LAYOUT MEASUREMENTS:');
    newMetrics.forEach(({ name, rect }) => {
      if (rect) {
        console.log(`  - ${name}:`, {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left)
        });
      } else {
        console.log(`  - ${name}: NOT FOUND`);
      }
    });
  };

  useEffect(() => {
    if (isVisible) {
      measureElements();
      intervalRef.current = setInterval(measureElements, 1000); // Μέτρηση κάθε δευτερόλεπτο
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  // Keyboard shortcut για toggle
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setIsVisible(prev => !prev);
        console.log('🎯 Layout Debug:', isVisible ? 'OFF' : 'ON');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <div className="fixed top-2 right-2 text-xs text-gray-500 bg-black bg-opacity-50 px-2 py-1 rounded" style={{ zIndex: portalComponents.overlay.debug.info.zIndex() }}>
        Press Ctrl+Shift+L για Layout Debug
      </div>
    );
  }

  return (
    <>
      {/* Corner Markers */}
      {metrics.length > 0 && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: portalComponents.overlay.debug.main.zIndex() }}>
          {metrics.map(({ name, rect, className }) =>
            rect && (
              <div
                key={name}
                className={`absolute border border-dashed opacity-60 ${className}`}
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  pointerEvents: 'none'
                }}
                title={name}
              >
                {/* Ετικέτα με διαστάσεις */}
                <div className="absolute -top-6 left-0 text-xs font-mono bg-black text-white px-1 rounded whitespace-nowrap">
                  {name}: {Math.round(rect.width)}×{Math.round(rect.height)}
                </div>

                {/* Συντεταγμένες στις γωνίες */}
                <div className="absolute top-0 left-0 text-xs font-mono text-white bg-red-600 px-1">
                  ({Math.round(rect.left)},{Math.round(rect.top)})
                </div>
                <div className="absolute bottom-0 right-0 text-xs font-mono text-white bg-red-600 px-1">
                  ({Math.round(rect.right)},{Math.round(rect.bottom)})
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Info Panel */}
      <div
        className="fixed top-20 right-4 bg-black bg-opacity-95 text-green-400 p-4 rounded text-xs font-mono max-w-md"
        style={{ zIndex: portalComponents.overlay.debug.controls.zIndex() }}
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-bold">🎯 LAYOUT MAPPER</h3>
          <button
            onClick={() => setIsVisible(false)}
            className={`text-red-400 ${HOVER_TEXT_EFFECTS.RED_LIGHT}`}
          >
            ×
          </button>
        </div>

        {metrics.map(({ name, rect }) => (
          <div key={name} className="mb-1">
            <strong className="text-cyan-400">{name}:</strong>
            {rect ? (
              <div className="ml-2 text-xs">
                Position: ({Math.round(rect.x)}, {Math.round(rect.y)})<br/>
                Size: {Math.round(rect.width)} × {Math.round(rect.height)}<br/>
                Bounds: L{Math.round(rect.left)} T{Math.round(rect.top)} R{Math.round(rect.right)} B{Math.round(rect.bottom)}
              </div>
            ) : (
              <span className="text-red-400 ml-2">NOT FOUND</span>
            )}
          </div>
        ))}

        <div className={`mt-4 pt-2 ${getDirectionalBorder('muted', 'top')} text-yellow-400`}>
          Ctrl+Shift+L: Toggle | Auto-refresh: 1s
        </div>
      </div>
    </>
  );
}