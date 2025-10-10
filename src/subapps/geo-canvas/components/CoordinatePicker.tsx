'use client';

import React, { useState, useCallback } from 'react';
import { useGeoTransform } from '../hooks/useGeoTransform';
import type { DxfCoordinate, GeoCoordinate } from '../types';

// ============================================================================
// COORDINATE PICKER COMPONENT TYPES
// ============================================================================

export interface CoordinatePickerProps {
  onCoordinateSelected?: (dxfPoint: DxfCoordinate, geoPoint: GeoCoordinate) => void;
  onCancel?: () => void;
  className?: string;
}

export type PickingMode = 'idle' | 'dxf_input' | 'geo_picking' | 'both_ready';

// ============================================================================
// COORDINATE PICKER COMPONENT
// ============================================================================

/**
 * VISUAL COORDINATE PICKER
 * Enterprise component για interactive coordinate selection
 * Phase 3: Combines manual input με map-based picking
 */
export function CoordinatePicker({
  onCoordinateSelected,
  onCancel,
  className = ''
}: CoordinatePickerProps) {
  const [transformState, transformActions] = useGeoTransform();
  const [pickingMode, setPickingMode] = useState<PickingMode>('idle');

  // Form state για coordinate input
  const [dxfInput, setDxfInput] = useState({
    x: '',
    y: '',
    z: ''
  });

  const [geoInput, setGeoInput] = useState({
    lng: '',
    lat: '',
    alt: ''
  });

  const [selectedGeoPoint, setSelectedGeoPoint] = useState<GeoCoordinate | null>(null);
  const [accuracy, setAccuracy] = useState('1.0');
  const [description, setDescription] = useState('');

  // ========================================================================
  // COORDINATE INPUT HANDLERS
  // ========================================================================

  const handleDxfInputChange = useCallback((field: keyof typeof dxfInput, value: string) => {
    setDxfInput(prev => ({ ...prev, [field]: value }));

    // Check if we have both coordinates
    if (field === 'x' || field === 'y') {
      const newInput = { ...dxfInput, [field]: value };
      if (newInput.x && newInput.y && selectedGeoPoint) {
        setPickingMode('both_ready');
      }
    }
  }, [dxfInput, selectedGeoPoint]);

  const handleGeoInputChange = useCallback((field: keyof typeof geoInput, value: string) => {
    setGeoInput(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleMapCoordinateClick = useCallback((coordinate: GeoCoordinate) => {
    setSelectedGeoPoint(coordinate);
    setGeoInput({
      lng: coordinate.lng.toFixed(6),
      lat: coordinate.lat.toFixed(6),
      alt: coordinate.alt?.toString() || ''
    });

    // Check if we have DXF coordinates too
    if (dxfInput.x && dxfInput.y) {
      setPickingMode('both_ready');
    } else {
      setPickingMode('geo_picking');
    }
  }, [dxfInput]);

  // ========================================================================
  // COORDINATE VALIDATION
  // ========================================================================

  const validateDxfCoordinates = (): DxfCoordinate | null => {
    const x = parseFloat(dxfInput.x);
    const y = parseFloat(dxfInput.y);
    const z = dxfInput.z ? parseFloat(dxfInput.z) : undefined;

    if (isNaN(x) || isNaN(y)) return null;
    if (dxfInput.z && isNaN(z!)) return null;

    return { x, y, z };
  };

  const validateGeoCoordinates = (): GeoCoordinate | null => {
    const lng = parseFloat(geoInput.lng);
    const lat = parseFloat(geoInput.lat);
    const alt = geoInput.alt ? parseFloat(geoInput.alt) : undefined;

    if (isNaN(lng) || isNaN(lat)) return null;
    if (geoInput.alt && isNaN(alt!)) return null;

    // Validate coordinate bounds
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;

    return { lng, lat, alt };
  };

  const isFormValid = (): boolean => {
    return validateDxfCoordinates() !== null && validateGeoCoordinates() !== null;
  };

  // ========================================================================
  // COORDINATE SUBMISSION
  // ========================================================================

  const handleSubmitCoordinates = useCallback(async () => {
    const dxfPoint = validateDxfCoordinates();
    const geoPoint = validateGeoCoordinates();

    if (!dxfPoint || !geoPoint) {
      alert('Please provide valid coordinates');
      return;
    }

    try {
      // Add to control point manager
      await transformActions.addControlPoint(dxfPoint, geoPoint, {
        accuracy: parseFloat(accuracy),
        description: description || undefined
      });

      // Notify parent component
      if (onCoordinateSelected) {
        onCoordinateSelected(dxfPoint, geoPoint);
      }

      // Reset form
      resetForm();
    } catch (error) {
      alert(`Failed to add control point: ${error}`);
    }
  }, [dxfInput, geoInput, accuracy, description, transformActions, onCoordinateSelected]);

  const resetForm = useCallback(() => {
    setDxfInput({ x: '', y: '', z: '' });
    setGeoInput({ lng: '', lat: '', alt: '' });
    setSelectedGeoPoint(null);
    setAccuracy('1.0');
    setDescription('');
    setPickingMode('idle');
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    if (onCancel) {
      onCancel();
    }
  }, [resetForm, onCancel]);

  // ========================================================================
  // AUTO-FILL FROM EXISTING POINTS
  // ========================================================================

  const fillFromSelectedPoint = useCallback(() => {
    if (!transformState.selectedPointId) return;

    const selectedPoint = transformState.controlPoints.find(
      cp => cp.id === transformState.selectedPointId
    );

    if (selectedPoint) {
      setDxfInput({
        x: selectedPoint.dxfPoint.x.toString(),
        y: selectedPoint.dxfPoint.y.toString(),
        z: selectedPoint.dxfPoint.z?.toString() || ''
      });

      setGeoInput({
        lng: selectedPoint.geoPoint.lng.toFixed(6),
        lat: selectedPoint.geoPoint.lat.toFixed(6),
        alt: selectedPoint.geoPoint.alt?.toString() || ''
      });

      setSelectedGeoPoint(selectedPoint.geoPoint);
      setAccuracy(selectedPoint.accuracy.toString());
      setDescription(selectedPoint.description || '');
      setPickingMode('both_ready');
    }
  }, [transformState.selectedPointId, transformState.controlPoints]);

  // ========================================================================
  // RENDER COORDINATE INPUT FORMS
  // ========================================================================

  const renderDxfInputSection = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-blue-400">
        📐 DXF Coordinates
      </h3>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">X:</label>
          <input
            type="number"
            value={dxfInput.x}
            onChange={(e) => handleDxfInputChange('x', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="0.00"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Y:</label>
          <input
            type="number"
            value={dxfInput.y}
            onChange={(e) => handleDxfInputChange('y', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="0.00"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Z (optional):</label>
          <input
            type="number"
            value={dxfInput.z}
            onChange={(e) => handleDxfInputChange('z', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="0.00"
            step="0.01"
          />
        </div>
      </div>

      {transformState.selectedPointId && (
        <div className="mt-3">
          <button
            onClick={fillFromSelectedPoint}
            className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors"
          >
            📋 Fill από Selected Point
          </button>
        </div>
      )}
    </div>
  );

  const renderGeoInputSection = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-400">
          🌍 Geographic Coordinates
        </h3>
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${
            selectedGeoPoint ? 'bg-green-400' : 'bg-gray-400'
          }`} />
          <span className="text-xs text-gray-400">
            {selectedGeoPoint ? 'Point Selected' : 'Click on Map'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Longitude:</label>
          <input
            type="number"
            value={geoInput.lng}
            onChange={(e) => handleGeoInputChange('lng', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="23.7275"
            step="0.000001"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Latitude:</label>
          <input
            type="number"
            value={geoInput.lat}
            onChange={(e) => handleGeoInputChange('lat', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="37.9755"
            step="0.000001"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Altitude (optional):</label>
          <input
            type="number"
            value={geoInput.alt}
            onChange={(e) => handleGeoInputChange('alt', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="0.00"
            step="0.01"
          />
        </div>
      </div>

      <div className="mt-3 p-3 bg-blue-900/20 border border-blue-600 rounded">
        <div className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Click on the map για automatic coordinate selection
        </div>
      </div>
    </div>
  );

  const renderMetadataSection = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-blue-400">
        📊 Point Metadata
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Accuracy (meters):</label>
          <input
            type="number"
            value={accuracy}
            onChange={(e) => setAccuracy(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="1.0"
            step="0.1"
            min="0.1"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description:</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            placeholder="Optional description"
            maxLength={100}
          />
        </div>
      </div>
    </div>
  );

  // ========================================================================
  // RENDER STATUS & ACTIONS
  // ========================================================================

  const renderStatusSection = () => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-blue-400">
        📋 Status
      </h3>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>DXF Coordinates:</span>
          <span className={dxfInput.x && dxfInput.y ? 'text-green-400' : 'text-gray-400'}>
            {dxfInput.x && dxfInput.y ? '✅ Ready' : '⭕ Pending'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Geographic Coordinates:</span>
          <span className={selectedGeoPoint ? 'text-green-400' : 'text-gray-400'}>
            {selectedGeoPoint ? '✅ Ready' : '⭕ Pending'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Form Valid:</span>
          <span className={isFormValid() ? 'text-green-400' : 'text-gray-400'}>
            {isFormValid() ? '✅ Valid' : '⭕ Invalid'}
          </span>
        </div>
      </div>
    </div>
  );

  const renderActionButtons = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex space-x-3">
        <button
          onClick={handleSubmitCoordinates}
          disabled={!isFormValid()}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
        >
          ✅ Add Control Point
        </button>

        <button
          onClick={resetForm}
          className="bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-4 rounded-lg transition-colors"
        >
          🔄 Reset
        </button>

        <button
          onClick={handleCancel}
          className="bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-colors"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <div className={`w-full max-w-md space-y-4 ${className}`}>
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-bold text-blue-400 mb-2">
          📍 Add Control Point
        </h2>
        <p className="text-sm text-gray-400">
          Combine DXF coordinates με geographic coordinates
        </p>
      </div>

      {/* Error Display */}
      {transformState.error && (
        <div className="bg-red-900 border border-red-600 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-300">❌ {transformState.error}</span>
            <button
              onClick={transformActions.clearError}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Coordinate Input Sections */}
      {renderDxfInputSection()}
      {renderGeoInputSection()}
      {renderMetadataSection()}

      {/* Status */}
      {renderStatusSection()}

      {/* Action Buttons */}
      {renderActionButtons()}

      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <h4 className="font-semibold text-blue-400 mb-2">📋 Instructions:</h4>
        <ol className="text-sm text-blue-300 space-y-1">
          <li>1. Enter DXF coordinates (X, Y, optional Z)</li>
          <li>2. Click on map για geographic coordinates</li>
          <li>3. Set accuracy και optional description</li>
          <li>4. Click "Add Control Point" για save</li>
        </ol>
      </div>
    </div>
  );
}

export default CoordinatePicker;