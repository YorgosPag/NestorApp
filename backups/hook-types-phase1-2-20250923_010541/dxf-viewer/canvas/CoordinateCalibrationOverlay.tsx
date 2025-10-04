'use client';
import React from 'react';
import type { CalibrationProps } from './calibration/types';
import { useCoordinateCalibrationIntegration } from './calibration/useCoordinateCalibrationIntegration';

export default function CoordinateCalibrationOverlay(props: CalibrationProps) {
  const { show = false, onToggle } = props;
  
  const {
    state,
    actions,
    currentRoundTripError,
    currentAccuracy,
    entitiesCount,
    layersCount,
    dpr,
    testEntity,
    handleCalibrationClick,
  } = useCoordinateCalibrationIntegration(props);

  if (!show) return null;

  const { mousePos, worldPos } = props;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 3000 }}>
      {/* gridLines removed - διέγραψα το calibration grid system που έκανε τα κόκκινα γράμματα κάτω αριστερά */}
      <div className="absolute top-4 left-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg pointer-events-auto" style={{ minWidth: 380, maxWidth: 450, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-cyan-400">🔧 Καλιμπράρισμα Συντεταγμένων</h3>
          <button onClick={() => onToggle?.(false)} className="text-gray-400 hover:text-white text-xl" title="Κλείσιμο">×</button>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800 p-3 rounded text-sm">
            <div className="text-cyan-300 font-semibold mb-2">📊 Κατάσταση Σκηνής:</div>
            <div className="flex justify-between items-center">
              <div>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${entitiesCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-white">Οντότητες: {entitiesCount}</span>
              </div>
              <div><span className="text-gray-400">Επίπεδα: {layersCount}</span></div>
            </div>
            {entitiesCount === 0 && <div className="text-red-300 text-xs mt-1">⚠️ Δεν υπάρχουν οντότητες - το hit testing θα αποτύχει</div>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => actions.setShowGrid(!state.showGrid)} className={`px-3 py-1 rounded text-sm ${state.showGrid ? 'bg-cyan-600' : 'bg-gray-600'}`}>{state.showGrid ? '📐 Απόκρυψη Πλέγματος' : '📐 Εμφάνιση Πλέγματος'}</button>
            <button onClick={() => actions.setShowDetails(!state.showDetails)} className={`px-3 py-1 rounded text-sm ${state.showDetails ? 'bg-cyan-600' : 'bg-gray-600'}`}>{state.showDetails ? '📊 Απόκρυψη' : '📊 Εμφάνιση'}</button>
          </div>
          {state.showDetails && (
            <div className="bg-gray-800 p-3 rounded text-sm">
              <div className="text-cyan-300 font-semibold mb-2">📍 Συντεταγμένες:</div>
              {mousePos ? (
                <>
                  <div className="text-green-300">🖱️ CSS: ({mousePos.x.toFixed(1)}, {mousePos.y.toFixed(1)})</div>
                  {worldPos && <div className="text-yellow-300">🌍 Κόσμος: ({worldPos.x.toFixed(2)}, {worldPos.y.toFixed(2)})</div>}
                  {currentAccuracy && (
                    <div className={`text-xs mt-1 ${currentAccuracy.overall ? 'text-green-400' : 'text-orange-400'}`}>🎯 Ακρίβεια: X:{currentAccuracy.xOk ? '✅' : '❌'} Y:{currentAccuracy.yOk ? '✅' : '❌'} {currentAccuracy.overall ? ' ΤΕΛΕΙΟ' : ' ΧΡΕΙΑΖΕΤΑΙ ΔΙΟΡΘΩΣΗ'}</div>
                  )}
                  {currentRoundTripError !== null && (
                    <div className={`text-xs mt-1 ${currentRoundTripError < 0.5 ? 'text-green-400' : 'text-orange-400'}`}>🔄 Σφάλμα round-trip: {currentRoundTripError.toFixed(2)}px {currentRoundTripError < 0.5 ? '✅' : '⚠️'}</div>
                  )}
                  <div className="text-gray-400 text-xs mt-1">dPR: {dpr.toFixed(2)} | Ζουμ: {(100/dpr).toFixed(0)}%</div>
                </>
              ) : <div className="text-gray-500">Μετακινήστε το ποντίκι πάνω από τον καμβά...</div>}
            </div>
          )}
          {testEntity.canInjectEntity && (
            <div className="bg-purple-900 p-3 rounded text-sm">
              <div className="text-purple-300 font-semibold mb-2">🧪 Δοκιμαστική Οντότητα:</div>
              <div className="flex gap-2">
                <button onClick={testEntity.injectTestEntity} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs" title="Δημιουργία δοκιμαστικής γραμμής στην τρέχουσα θέση">🧪 Εισαγωγή Δοκιμαστικής Γραμμής</button>
                {state.testEntityInjected && <div className="text-green-300 text-xs flex items-center">✅ Ενεργή</div>}
              </div>
              <div className="text-purple-200 text-xs mt-1">Μετακινήστε το ποντίκι και πατήστε το κουμπί για δημιουργία test line</div>
            </div>
          )}
          <div className="bg-gray-800 p-3 rounded text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-cyan-300 font-semibold">🎯 Τεστ Κλικ:</span>
              <button onClick={actions.clearTests} className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded">Καθαρισμός</button>
            </div>
            <div className="border-2 border-dashed border-cyan-600 p-2 rounded cursor-crosshair pointer-events-auto" onClick={handleCalibrationClick}>
              <div className="text-center text-xs text-cyan-300 mb-2">Κλικ εδώ για τεστ ακρίβειας</div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {state.clickTests.length === 0 ? <div className="text-gray-500 text-xs text-center">Δεν υπάρχουν δοκιμές</div> : state.clickTests.slice(-2).map(test => (
                  <div key={test.id} className="text-xs border-l-2 border-cyan-500 pl-2">
                    <div className="text-white">#{test.id} @ {test.timestamp}</div>
                    <div className="text-green-300">CSS: ({test.cssPoint.x.toFixed(1)}, {test.cssPoint.y.toFixed(1)})</div>
                    <div className="text-yellow-300">Κόσμος: ({test.worldPoint.x.toFixed(2)}, {test.worldPoint.y.toFixed(2)})</div>
                    {test.coordinateAccuracy && <div className={`text-xs ${test.coordinateAccuracy.overall ? 'text-green-400' : 'text-orange-400'}`}>{test.coordinateAccuracy.overall ? 'ΤΕΛΕΙΟ ✅' : 'ΧΡΕΙΑΖΕΤΑΙ ΔΙΟΡΘΩΣΗ ⚠️'}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-blue-900 p-2 rounded text-xs">
            <div className="text-blue-300 font-semibold mb-1">💡 Συμβουλές:</div>
            <ul className="text-blue-200 space-y-1">
              <li>• Πλέγμα πρέπει να ταιριάζει με χάρακες</li>
              <li>• Round-trip σφάλμα &lt; 0.5px</li>
              <li>• Δοκιμάστε σε διαφορετικά zoom</li>
              <li>• {entitiesCount > 0 ? 'Οντότητες OK ✅' : 'Φορτώστε DXF ⚠️'}</li>
            </ul>
          </div>
        </div>
      </div>
      {state.clickTests.slice(-3).map(test => (
        <div key={test.id} style={{ position: 'absolute', left: test.cssPoint.x - 8, top: test.cssPoint.y - 8, width: 16, height: 16, borderRadius: '50%', background: test.coordinateAccuracy?.overall ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)', border: '2px solid white', boxShadow: `0 0 10px ${test.coordinateAccuracy?.overall ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)'}`, pointerEvents: 'none', animation: 'pulse 2s infinite' }}>
          <div style={{ position: 'absolute', top: 20, left: -10, fontSize: 10, color: 'white', background: 'rgba(0,0,0,0.8)', padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap' }}>#{test.id}</div>
        </div>
      ))}
      <style jsx>{` @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } } `}</style>
    </div>
  );
}