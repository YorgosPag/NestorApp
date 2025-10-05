/**
 * COORDINATE CALIBRATION OVERLAY
 * ✅ ΦΑΣΗ 7: Χρήση κεντρικού CoordinateTransforms - SINGLE SOURCE OF TRUTH
 * Εργαλείο debugging για έλεγχο ακρίβειας coordinate transformations
 */

'use client';
import React, { useState, useRef } from 'react';
import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
import type { Point2D, Viewport } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';

interface CoordinateCalibrationOverlayProps {
  mousePos: Point2D | null;
  worldPos: Point2D | null;
  canvasRect?: DOMRect;
  currentScene?: SceneModel;
  show?: boolean;
  onToggle?: (show: boolean) => void;
}

interface ClickTest {
  id: number;
  cssPoint: Point2D;
  worldPoint: Point2D;
  roundTripError: number;
  timestamp: string;
}

export default function CoordinateCalibrationOverlay({
  mousePos,
  worldPos,
  canvasRect,
  currentScene,
  show = false,
  onToggle
}: CoordinateCalibrationOverlayProps) {
  const [clickTests, setClickTests] = useState<ClickTest[]>([]);
  const [showDetails, setShowDetails] = useState(true);
  const clickIdRef = useRef(0);

  if (!show) return null;

  // Scene info
  const entitiesCount = currentScene?.entities?.length ?? 0;
  const layersCount = currentScene?.layers ? Object.keys(currentScene.layers).length : 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // ✅ Χρήση κεντρικού CoordinateTransforms για round-trip test
  const calculateRoundTripError = (cssPoint: Point2D): number => {
    if (!canvasRect) return -1;

    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms
    const worldPt = CoordinateTransforms.screenToWorld(cssPoint, { scale: 1, offsetX: 0, offsetY: 0 }, viewport);
    const backToCss = CoordinateTransforms.worldToScreen(worldPt, { scale: 1, offsetX: 0, offsetY: 0 }, viewport);

    const deltaX = cssPoint.x - backToCss.x;
    const deltaY = cssPoint.y - backToCss.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  };

  // Handle calibration click test
  const handleCalibrationClick = (e: React.MouseEvent) => {
    if (!canvasRect) return;

    const cssPoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms
    const worldPoint = CoordinateTransforms.screenToWorld(cssPoint, { scale: 1, offsetX: 0, offsetY: 0 }, viewport);
    const roundTripError = calculateRoundTripError(cssPoint);

    const newTest: ClickTest = {
      id: ++clickIdRef.current,
      cssPoint,
      worldPoint,
      roundTripError,
      timestamp: new Date().toLocaleTimeString()
    };

    setClickTests(prev => [...prev, newTest]);
  };

  // Current mouse round-trip error
  const currentRoundTripError = mousePos ? calculateRoundTripError(mousePos) : null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 3000 }}>
      <div className="absolute top-4 left-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg pointer-events-auto" style={{ minWidth: 380, maxWidth: 450, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-cyan-400">🔧 Καλιμπράρισμα Συντεταγμένων</h3>
          <button onClick={() => onToggle?.(false)} className="text-gray-400 hover:text-white text-xl" title="Κλείσιμο">×</button>
        </div>
        <div className="space-y-3">
          {/* ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms */}
          <div className="bg-blue-900 p-2 rounded text-xs">
            <div className="text-blue-300 font-semibold mb-1">✅ Coordinate System:</div>
            <div className="text-blue-200">Using centralized <strong>CoordinateTransforms</strong></div>
            <div className="text-green-300 text-xs">Single Source of Truth ✅</div>
          </div>

          <div className="bg-gray-800 p-3 rounded text-sm">
            <div className="text-cyan-300 font-semibold mb-2">📊 Κατάσταση Σκηνής:</div>
            <div className="flex justify-between items-center">
              <div>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${entitiesCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-white">Οντότητες: {entitiesCount}</span>
              </div>
              <div><span className="text-gray-400">Επίπεδα: {layersCount}</span></div>
            </div>
            {entitiesCount === 0 && <div className="text-red-300 text-xs mt-1">⚠️ Δεν υπάρχουν οντότητες</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowDetails(!showDetails)} className={`px-3 py-1 rounded text-sm ${showDetails ? 'bg-cyan-600' : 'bg-gray-600'}`}>
              {showDetails ? '📊 Απόκρυψη' : '📊 Εμφάνιση'}
            </button>
          </div>

          {showDetails && (
            <div className="bg-gray-800 p-3 rounded text-sm">
              <div className="text-cyan-300 font-semibold mb-2">📍 Συντεταγμένες:</div>
              {mousePos ? (
                <>
                  <div className="text-green-300">🖱️ CSS: ({mousePos.x.toFixed(1)}, {mousePos.y.toFixed(1)})</div>
                  {worldPos && <div className="text-yellow-300">🌍 Κόσμος: ({worldPos.x.toFixed(2)}, {worldPos.y.toFixed(2)})</div>}
                  {currentRoundTripError !== null && (
                    <div className={`text-xs mt-1 ${currentRoundTripError < 0.5 ? 'text-green-400' : 'text-orange-400'}`}>
                      🔄 Σφάλμα round-trip: {currentRoundTripError.toFixed(2)}px {currentRoundTripError < 0.5 ? '✅' : '⚠️'}
                    </div>
                  )}
                  <div className="text-gray-400 text-xs mt-1">dPR: {dpr.toFixed(2)} | Ζουμ: {(100/dpr).toFixed(0)}%</div>
                </>
              ) : <div className="text-gray-500">Μετακινήστε το ποντίκι πάνω από τον καμβά...</div>}
            </div>
          )}

          <div className="bg-gray-800 p-3 rounded text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-cyan-300 font-semibold">🎯 Τεστ Κλικ:</span>
              <button onClick={() => setClickTests([])} className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded">Καθαρισμός</button>
            </div>
            <div className="border-2 border-dashed border-cyan-600 p-2 rounded cursor-crosshair pointer-events-auto" onClick={handleCalibrationClick}>
              <div className="text-center text-xs text-cyan-300 mb-2">Κλικ εδώ για τεστ ακρίβειας</div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {clickTests.length === 0 ? (
                  <div className="text-gray-500 text-xs text-center">Δεν υπάρχουν δοκιμές</div>
                ) : (
                  clickTests.slice(-2).map(test => (
                    <div key={test.id} className="text-xs border-l-2 border-cyan-500 pl-2">
                      <div className="text-white">#{test.id} @ {test.timestamp}</div>
                      <div className="text-green-300">CSS: ({test.cssPoint.x.toFixed(1)}, {test.cssPoint.y.toFixed(1)})</div>
                      <div className="text-yellow-300">Κόσμος: ({test.worldPoint.x.toFixed(2)}, {test.worldPoint.y.toFixed(2)})</div>
                      <div className={`text-xs ${test.roundTripError < 0.5 ? 'text-green-400' : 'text-orange-400'}`}>
                        Error: {test.roundTripError.toFixed(2)}px {test.roundTripError < 0.5 ? 'ΤΕΛΕΙΟ ✅' : 'ΧΡΕΙΑΖΕΤΑΙ ΔΙΟΡΘΩΣΗ ⚠️'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-900 p-2 rounded text-xs">
            <div className="text-blue-300 font-semibold mb-1">💡 Συμβουλές:</div>
            <ul className="text-blue-200 space-y-1">
              <li>• Round-trip σφάλμα &lt; 0.5px</li>
              <li>• Δοκιμάστε σε διαφορετικά zoom</li>
              <li>• {entitiesCount > 0 ? 'Οντότητες OK ✅' : 'Φορτώστε DXF ⚠️'}</li>
              <li>• Χρήση κεντρικού CoordinateTransforms ✅</li>
            </ul>
          </div>
        </div>
      </div>
      {clickTests.slice(-3).map(test => (
        <div
          key={test.id}
          style={{
            position: 'absolute',
            left: test.cssPoint.x - 8,
            top: test.cssPoint.y - 8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: test.roundTripError < 0.5 ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)',
            border: '2px solid white',
            boxShadow: `0 0 10px ${test.roundTripError < 0.5 ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)'}`,
            pointerEvents: 'none',
            animation: 'pulse 2s infinite'
          }}
        >
          <div style={{ position: 'absolute', top: 20, left: -10, fontSize: 10, color: 'white', background: 'rgba(0,0,0,0.8)', padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap' }}>
            #{test.id}
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
