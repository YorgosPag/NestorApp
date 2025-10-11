/**
 * 🗺️ POLYGON DRAWING MAP EXAMPLE
 *
 * Παράδειγμα χρήσης του Universal Polygon System με InteractiveMap
 *
 * @module geo-canvas/examples/PolygonDrawingMapExample
 */

'use client';

import React, { useState, useCallback } from 'react';
import { InteractiveMap } from '../components/InteractiveMap';
import type { UniversalPolygon, PolygonType } from '@/core/polygon-system';
import type { GeoCoordinate } from '../types';

// Mock transform state (για το παράδειγμα)
const mockTransformState = {
  controlPoints: [],
  isCalibrated: false,
  transformMatrix: undefined,
  accuracy: undefined
};

/**
 * Polygon Drawing Map Example Component
 */
export function PolygonDrawingMapExample(): JSX.Element {
  const [enableDrawing, setEnableDrawing] = useState(false);
  const [currentMode, setCurrentMode] = useState<PolygonType>('simple');
  const [polygons, setPolygons] = useState<UniversalPolygon[]>([]);
  const [isPickingCoordinates, setIsPickingCoordinates] = useState(false);

  // Handle coordinate click (για control points)
  const handleCoordinateClick = useCallback((coordinate: GeoCoordinate) => {
    console.log('📍 Coordinate clicked:', coordinate);
    // Εδώ θα μπορούσαμε να προσθέσουμε control points
  }, []);

  // Handle polygon creation
  const handlePolygonCreated = useCallback((polygon: UniversalPolygon) => {
    console.log('✅ Polygon created:', polygon);
    setPolygons(prev => [...prev, polygon]);
  }, []);

  // Handle polygon modification
  const handlePolygonModified = useCallback((polygon: UniversalPolygon) => {
    console.log('📝 Polygon modified:', polygon);
    setPolygons(prev => prev.map(p => p.id === polygon.id ? polygon : p));
  }, []);

  // Handle polygon deletion
  const handlePolygonDeleted = useCallback((polygonId: string) => {
    console.log('🗑️ Polygon deleted:', polygonId);
    setPolygons(prev => prev.filter(p => p.id !== polygonId));
  }, []);

  // Handle map ready
  const handleMapReady = useCallback((map: any) => {
    console.log('🗺️ Map ready:', map);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Controls */}
      <div style={{
        padding: '16px',
        backgroundColor: '#1f2937',
        color: 'white',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <h2 style={{ margin: 0, color: '#60a5fa' }}>
          🗺️ Universal Polygon System - Map Integration
        </h2>

        {/* Drawing Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={enableDrawing}
            onChange={(e) => setEnableDrawing(e.target.checked)}
          />
          Enable Polygon Drawing
        </label>

        {/* Mode Selection */}
        {enableDrawing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>Mode:</label>
            <select
              value={currentMode}
              onChange={(e) => setCurrentMode(e.target.value as PolygonType)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#374151',
                color: 'white',
                border: '1px solid #4b5563',
                borderRadius: '4px'
              }}
            >
              <option value="simple">Simple Drawing</option>
              <option value="georeferencing">Georeferencing</option>
              <option value="alert-zone">Alert Zone</option>
              <option value="measurement">Measurement</option>
              <option value="annotation">Annotation</option>
            </select>
          </div>
        )}

        {/* Coordinate Picking Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={isPickingCoordinates}
            onChange={(e) => setIsPickingCoordinates(e.target.checked)}
          />
          Pick Coordinates
        </label>

        {/* Stats */}
        <div style={{
          marginLeft: 'auto',
          padding: '8px 12px',
          backgroundColor: '#374151',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Polygons: <strong>{polygons.length}</strong>
        </div>
      </div>

      {/* Instructions */}
      {enableDrawing && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          fontSize: '14px',
          borderBottom: '1px solid #fbbf24'
        }}>
          <strong>Instructions:</strong>
          <span style={{ marginLeft: '8px' }}>
            Click on map to add points • Right-click to close polygon •
            Press Enter to finish • Press Escape to cancel •
            Press 1-5 to switch modes
          </span>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <InteractiveMap
          transformState={mockTransformState}
          onCoordinateClick={handleCoordinateClick}
          isPickingCoordinates={isPickingCoordinates}
          onMapReady={handleMapReady}

          // ✅ Universal Polygon System Props
          enablePolygonDrawing={enableDrawing}
          defaultPolygonMode={currentMode}
          onPolygonCreated={handlePolygonCreated}
          onPolygonModified={handlePolygonModified}
          onPolygonDeleted={handlePolygonDeleted}

          className="w-full h-full"
        />
      </div>

      {/* Polygon List Sidebar */}
      {polygons.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '120px',
          right: '16px',
          width: '300px',
          maxHeight: '400px',
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            borderRadius: '8px 8px 0 0'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              📋 Polygons ({polygons.length})
            </h3>
          </div>

          {/* List */}
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '8px'
          }}>
            {polygons.map((polygon) => (
              <div
                key={polygon.id}
                style={{
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  backgroundColor: '#f8fafc'
                }}
              >
                {/* Polygon Info */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>
                    {polygon.type} {polygon.isClosed && '(closed)'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {polygon.points.length} points
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    ID: {polygon.id}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      // Export individual polygon
                      const geojson = JSON.stringify({
                        type: 'FeatureCollection',
                        features: [/* would use polygon converter */]
                      }, null, 2);

                      const blob = new Blob([geojson], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `polygon-${polygon.id}.geojson`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Export
                  </button>

                  <button
                    onClick={() => handlePolygonDeleted(polygon.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            borderRadius: '0 0 8px 8px'
          }}>
            <button
              onClick={() => {
                // Export all polygons
                const geojson = JSON.stringify({
                  type: 'FeatureCollection',
                  features: [] /* would use polygonSystem.exportAsGeoJSON() */
                }, null, 2);

                const blob = new Blob([geojson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'all-polygons.geojson';
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              📤 Export All GeoJSON
            </button>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <details style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        backgroundColor: 'white',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '12px',
        maxWidth: '300px',
        fontSize: '12px',
        zIndex: 1000
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
          🐛 Debug Info
        </summary>
        <pre style={{
          marginTop: '8px',
          fontSize: '10px',
          overflow: 'auto',
          backgroundColor: '#f3f4f6',
          padding: '8px',
          borderRadius: '4px'
        }}>
          {JSON.stringify({
            enableDrawing,
            currentMode,
            isPickingCoordinates,
            polygonsCount: polygons.length,
            polygonTypes: polygons.reduce((acc, p) => {
              acc[p.type] = (acc[p.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default PolygonDrawingMapExample;