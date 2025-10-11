/**
 * 📋 SIMPLE POLYGON DRAWING EXAMPLE
 *
 * Παράδειγμα χρήσης του Universal Polygon System
 *
 * @module core/polygon-system/examples/SimplePolygonDrawingExample
 */

import React, { useRef, useEffect, useState } from 'react';
import { usePolygonSystem } from '../integrations/usePolygonSystem';
import type { PolygonType, UniversalPolygon } from '../types';

/**
 * Simple polygon drawing component
 */
export function SimplePolygonDrawingExample(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize polygon system
  const {
    manager,
    polygons,
    currentMode,
    isDrawing,
    stats,
    initialize,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    setMode,
    deletePolygon,
    clearAll,
    exportAsGeoJSON
  } = usePolygonSystem({
    defaultMode: 'simple',
    autoSave: true,
    storageKey: 'example-polygons',
    debug: true
  });

  // Initialize on mount
  useEffect(() => {
    if (canvasRef.current && !isInitialized) {
      initialize(canvasRef.current);
      setIsInitialized(true);
    }
  }, [initialize, isInitialized]);

  // Handle mode change
  const handleModeChange = (mode: PolygonType) => {
    setMode(mode);
  };

  // Handle start drawing
  const handleStartDrawing = () => {
    startDrawing();
  };

  // Handle finish drawing
  const handleFinishDrawing = () => {
    const polygon = finishDrawing();
    if (polygon) {
      console.log('✅ Finished polygon:', polygon);
    }
  };

  // Handle export
  const handleExport = () => {
    const geojson = exportAsGeoJSON();
    console.log('📤 Exported GeoJSON:', geojson);

    // Download as file
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'polygons.geojson';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle delete polygon
  const handleDeletePolygon = (polygon: UniversalPolygon) => {
    if (window.confirm(`Delete polygon ${polygon.id}?`)) {
      deletePolygon(polygon.id);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🎨 Universal Polygon System - Example</h2>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {/* Mode Selection */}
        <div>
          <label>Mode: </label>
          <select
            value={currentMode}
            onChange={(e) => handleModeChange(e.target.value as PolygonType)}
            disabled={isDrawing}
          >
            <option value="simple">Simple Drawing</option>
            <option value="georeferencing">Georeferencing</option>
            <option value="alert-zone">Alert Zone</option>
            <option value="measurement">Measurement</option>
            <option value="annotation">Annotation</option>
          </select>
        </div>

        {/* Drawing Controls */}
        <div>
          {!isDrawing ? (
            <button
              onClick={handleStartDrawing}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Start Drawing
            </button>
          ) : (
            <>
              <button
                onClick={handleFinishDrawing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '8px'
                }}
              >
                Finish (Enter)
              </button>
              <button
                onClick={cancelDrawing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel (Esc)
              </button>
            </>
          )}
        </div>

        {/* Utility Controls */}
        <div>
          <button
            onClick={handleExport}
            disabled={polygons.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: polygons.length === 0 ? 'not-allowed' : 'pointer',
              opacity: polygons.length === 0 ? 0.5 : 1,
              marginRight: '8px'
            }}
          >
            Export GeoJSON
          </button>
          <button
            onClick={clearAll}
            disabled={polygons.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: polygons.length === 0 ? 'not-allowed' : 'pointer',
              opacity: polygons.length === 0 ? 0.5 : 1
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#f3f4f6',
          borderRadius: '4px',
          fontSize: '14px'
        }}
      >
        <strong>Instructions:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Click to add points</li>
          <li>Right-click to close polygon (3+ points)</li>
          <li>Press Enter to finish drawing</li>
          <li>Press Escape to cancel</li>
          <li>Press Backspace to remove last point</li>
          <li>Press 1-5 to switch modes</li>
        </ul>
      </div>

      {/* Canvas */}
      <div style={{ marginBottom: '20px' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            cursor: isDrawing ? 'crosshair' : 'default',
            display: 'block'
          }}
        />
      </div>

      {/* Stats */}
      <div style={{ marginBottom: '20px' }}>
        <h3>📊 Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <strong>Total:</strong> {stats.totalPolygons}
          </div>
          <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <strong>Simple:</strong> {stats.byType.simple}
          </div>
          <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <strong>Georef:</strong> {stats.byType.georeferencing}
          </div>
          <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <strong>Alert:</strong> {stats.byType['alert-zone']}
          </div>
          <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <strong>Mode:</strong> {currentMode}
          </div>
          <div style={{ padding: '10px', backgroundColor: isDrawing ? '#fef3c7' : '#f9fafb', borderRadius: '4px' }}>
            <strong>Status:</strong> {isDrawing ? 'Drawing...' : 'Ready'}
          </div>
        </div>
      </div>

      {/* Polygon List */}
      {polygons.length > 0 && (
        <div>
          <h3>📋 Polygons ({polygons.length})</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {polygons.map((polygon) => (
              <div
                key={polygon.id}
                style={{
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong>{polygon.type}</strong> - {polygon.points.length} points
                  {polygon.isClosed && ' (closed)'}
                  <br />
                  <small style={{ color: '#6b7280' }}>
                    ID: {polygon.id}
                  </small>
                </div>
                <button
                  onClick={() => handleDeletePolygon(polygon)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Info */}
      {manager && (
        <details style={{ marginTop: '20px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            🐛 Debug Info
          </summary>
          <pre
            style={{
              backgroundColor: '#f3f4f6',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              marginTop: '10px'
            }}
          >
            {JSON.stringify({
              initialized: isInitialized,
              manager: !!manager,
              currentMode,
              isDrawing,
              stats,
              polygonsCount: polygons.length
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default SimplePolygonDrawingExample;