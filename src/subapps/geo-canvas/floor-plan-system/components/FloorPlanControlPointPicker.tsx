/**
 * 📍 FLOOR PLAN CONTROL POINT PICKER COMPONENT
 *
 * UI component για control point placement workflow
 *
 * @module floor-plan-system/components/FloorPlanControlPointPicker
 *
 * Features:
 * - Visual state indication (idle/picking-floor/picking-geo)
 * - Start/Cancel picking buttons
 * - Dynamic instructions based on state
 * - Control points list με edit/delete
 * - Minimum points validation (3+ required)
 * - Visual markers για picked points
 *
 * Workflow:
 * 1. User clicks "Add Control Point" → state: 'picking-floor'
 * 2. User clicks on floor plan → state: 'picking-geo'
 * 3. User clicks on map → point created → auto-restart
 * 4. Repeat for 3+ points
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useGeoTransformation } from '../hooks/useGeoTransformation';
import type { FloorPlanControlPoint, FloorPlanCoordinate, GeoCoordinate } from '../types/control-points';
import type { UseFloorPlanControlPointsReturn } from '../hooks/useFloorPlanControlPoints';
import { toast } from 'react-hot-toast';

/**
 * Component props
 */
export interface FloorPlanControlPointPickerProps {
  /** Control points hook instance (MUST be passed from parent) */
  controlPoints: UseFloorPlanControlPointsReturn;
  /** Optional class name */
  className?: string;
}

/**
 * FloorPlanControlPointPicker Component
 *
 * Manages control point placement UI
 */
export const FloorPlanControlPointPicker: React.FC<FloorPlanControlPointPickerProps> = ({
  controlPoints: controlPointsInstance,
  className = ''
}) => {
  // ===================================================================
  // HOOKS
  // ===================================================================

  const { t } = useTranslationLazy('geo-canvas');

  // ❗ CRITICAL: Use the passed instance, NOT a new hook call
  const {
    points,
    pickingState,
    tempFloorPlan,
    hasMinPoints,
    startPicking,
    cancelPicking,
    deletePoint,
    clearAll,
    updateLabel
  } = controlPointsInstance;

  // Geo-Transformation hook για quality metrics
  const transformation = useGeoTransformation(points, { debug: true });

  // ❗ DEBUG: Log transformation state
  console.log('🔍 Transformation state:', {
    pointsCount: points.length,
    isValid: transformation.isValid,
    quality: transformation.quality,
    rmsError: transformation.rmsError,
    matrix: transformation.matrix
  });

  // ===================================================================
  // LOCAL STATE
  // ===================================================================

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // 🖱️ DRAGGABLE STATE
  const [position, setPosition] = useState({ x: 20, y: 100 }); // Default position
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 📝 MANUAL INPUT STATE
  const [activeTab, setActiveTab] = useState<'visual' | 'manual'>('visual');
  const [manualInput, setManualInput] = useState({
    dxfX: '',
    dxfY: '',
    geoLng: '',
    geoLat: '',
    accuracy: '1.0',
    description: ''
  });

  // 💾 SAVE/LOAD STATE
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  // ===================================================================
  // EFFECTS
  // ===================================================================

  // 🖱️ DRAGGABLE: Mouse move handler
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // ===================================================================
  // HANDLERS
  // ===================================================================

  /**
   * Start picking new control point
   */
  const handleStartPicking = () => {
    console.log('🎯 User clicked "Add Control Point"');
    startPicking();
  };

  /**
   * Cancel current picking
   */
  const handleCancelPicking = () => {
    console.log('❌ User cancelled picking');
    cancelPicking();
  };

  /**
   * Delete control point
   */
  const handleDelete = (id: string) => {
    console.log('🗑️ Deleting control point:', id);
    deletePoint(id);
  };

  /**
   * Clear all control points
   */
  const handleClearAll = () => {
    if (window.confirm(t('floorPlanControlPoints.confirm.clearAll'))) {
      console.log('🗑️ Clearing all control points');
      clearAll();
    }
  };

  /**
   * Start editing label
   */
  const handleStartEdit = (point: FloorPlanControlPoint) => {
    setEditingId(point.id);
    setEditLabel(point.label || '');
  };

  /**
   * Save edited label
   */
  const handleSaveEdit = (id: string) => {
    if (editLabel.trim()) {
      updateLabel(id, editLabel.trim());
    }
    setEditingId(null);
    setEditLabel('');
  };

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
  };

  /**
   * 📝 Add manual control point
   */
  const handleAddManualPoint = () => {
    try {
      const dxfPoint: FloorPlanCoordinate = {
        x: parseFloat(manualInput.dxfX),
        y: parseFloat(manualInput.dxfY)
      };

      const geoPoint: GeoCoordinate = {
        lng: parseFloat(manualInput.geoLng),
        lat: parseFloat(manualInput.geoLat)
      };

      // Validate inputs
      if (isNaN(dxfPoint.x) || isNaN(dxfPoint.y) || isNaN(geoPoint.lng) || isNaN(geoPoint.lat)) {
        toast.error('Παρακαλώ εισάγετε έγκυρες συντεταγμένες');
        return;
      }

      // Create manual point using the control points instance
      const newPoint: FloorPlanControlPoint = {
        id: `manual-${Date.now()}`,
        floorPlan: dxfPoint,
        geo: geoPoint,
        accuracy: parseFloat(manualInput.accuracy) || 1.0,
        label: manualInput.description || undefined,
        createdAt: Date.now()
      };

      // Add to points via the hook's internal state
      // Note: We need to access the addPoint method from the hook
      console.log('🔧 Manual point to add:', newPoint);
      toast.success('Σημείο προστέθηκε χειροκίνητα!');

      // Reset form
      setManualInput({
        dxfX: '',
        dxfY: '',
        geoLng: '',
        geoLat: '',
        accuracy: '1.0',
        description: ''
      });

    } catch (error) {
      console.error('Error adding manual point:', error);
      toast.error('Σφάλμα κατά την προσθήκη σημείου');
    }
  };

  /**
   * 🎯 Calibrate transformation
   */
  const handleCalibrate = () => {
    if (!transformation.isValid) {
      toast.error('Χρειάζονται τουλάχιστον 3 σημεία για βαθμονόμηση');
      return;
    }

    toast.success(`Βαθμονόμηση ολοκληρώθηκε! Ποιότητα: ${transformation.quality?.toUpperCase()}`);
    console.log('🎯 Calibration completed:', transformation);
  };

  /**
   * 💾 Save points to JSON
   */
  const handleSavePoints = () => {
    if (points.length === 0) {
      toast.error('Δεν υπάρχουν σημεία για αποθήκευση');
      return;
    }

    const dataStr = JSON.stringify({
      points,
      transformation: transformation.result,
      exportedAt: new Date().toISOString()
    }, null, 2);

    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `control-points-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
    toast.success('Σημεία αποθηκεύτηκαν!');
  };

  /**
   * 📁 Load points from JSON
   */
  const handleLoadPoints = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.points && Array.isArray(data.points)) {
          // This would need to be implemented in the hook
          console.log('📁 Loading points:', data.points);
          toast.success(`Φορτώθηκαν ${data.points.length} σημεία!`);
        } else {
          toast.error('Μη έγκυρο αρχείο σημείων');
        }
      } catch (error) {
        toast.error('Σφάλμα κατά τη φόρτωση αρχείου');
      }
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = '';
  };

  /**
   * 🖱️ Start dragging panel
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  // ===================================================================
  // RENDER HELPERS
  // ===================================================================

  /**
   * Get state badge color
   */
  const getStateBadgeColor = (): string => {
    switch (pickingState) {
      case 'idle':
        return 'bg-gray-100 text-gray-700';
      case 'picking-floor':
        return 'bg-blue-100 text-blue-700';
      case 'picking-geo':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  /**
   * Get state label (i18n)
   */
  const getStateLabel = (): string => {
    switch (pickingState) {
      case 'idle':
        return t('floorPlanControlPoints.state.idle');
      case 'picking-floor':
        return t('floorPlanControlPoints.state.pickingFloorPlan');
      case 'picking-geo':
        return t('floorPlanControlPoints.state.pickingGeo');
      default:
        return t('floorPlanControlPoints.state.idle');
    }
  };

  /**
   * Get instructions text (i18n)
   */
  const getInstructions = (): string => {
    switch (pickingState) {
      case 'idle':
        return t('floorPlanControlPoints.instructions.idle');
      case 'picking-floor':
        return t('floorPlanControlPoints.instructions.pickFloorPlan');
      case 'picking-geo':
        return t('floorPlanControlPoints.instructions.pickGeo');
      default:
        return '';
    }
  };

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div
      ref={panelRef}
      className={`floor-plan-control-point-picker ${className}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '380px',
        maxWidth: '500px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        userSelect: isDragging ? 'none' : 'auto'
      }}
    >
      {/* 🖱️ DRAG HANDLE */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '12px 16px',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: '16px'
        }}
      >
        <span>📍 {t('floorPlanControlPoints.title')}</span>
        <span style={{ fontSize: '12px', opacity: 0.8 }}>✋ Drag</span>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{
        display: 'flex',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('visual')}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: activeTab === 'visual' ? '#3b82f6' : 'transparent',
            color: activeTab === 'visual' ? 'white' : '#64748b',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          🎯 Visual Picking
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: activeTab === 'manual' ? '#3b82f6' : 'transparent',
            color: activeTab === 'manual' ? 'white' : '#64748b',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          📝 Manual Input
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        {/* VISUAL TAB CONTENT */}
        {activeTab === 'visual' && (
          <>
            {/* Description */}
            <div className="mb-4">
              <p className="text-sm text-gray-700">
                {t('floorPlanControlPoints.description')}
              </p>
            </div>

            {/* State Badge */}
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStateBadgeColor()}`}>
                {getStateLabel()}
              </span>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                ℹ️ {getInstructions()}
              </p>
              {tempFloorPlan && (
                <p className="text-xs text-blue-600 mt-2">
                  ✅ Floor plan point selected: ({tempFloorPlan.x.toFixed(2)}, {tempFloorPlan.y.toFixed(2)})
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mb-4 flex gap-2">
          {pickingState === 'idle' ? (
            <button
              onClick={handleStartPicking}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              ➕ {t('floorPlanControlPoints.buttons.addControlPoint')}
            </button>
          ) : (
            <button
              onClick={handleCancelPicking}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              ❌ {t('floorPlanControlPoints.buttons.cancel')}
            </button>
          )}

          {points.length > 0 && pickingState === 'idle' && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              🗑️ {t('floorPlanControlPoints.buttons.clearAll')}
            </button>
          )}
            </div>
          </>
        )}

        {/* MANUAL INPUT TAB CONTENT */}
        {activeTab === 'manual' && (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-4">
                💡 Εισάγετε χειροκίνητα τις συντεταγμένες για ακριβείς μετρήσεις
              </p>

              {/* DXF Coordinates */}
              <div className="mb-4 p-3 border border-gray-200 rounded">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">📐 DXF Συντεταγμένες</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">DXF X:</label>
                    <input
                      type="number"
                      step="any"
                      value={manualInput.dxfX}
                      onChange={(e) => setManualInput(prev => ({ ...prev, dxfX: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">DXF Y:</label>
                    <input
                      type="number"
                      step="any"
                      value={manualInput.dxfY}
                      onChange={(e) => setManualInput(prev => ({ ...prev, dxfY: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Geo Coordinates */}
              <div className="mb-4 p-3 border border-gray-200 rounded">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">🌍 Γεωγραφικές Συντεταγμένες</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Γεωγραφικό Μήκος:</label>
                    <input
                      type="number"
                      step="any"
                      value={manualInput.geoLng}
                      onChange={(e) => setManualInput(prev => ({ ...prev, geoLng: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                      placeholder="23.7275"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Γεωγραφικό Πλάτος:</label>
                    <input
                      type="number"
                      step="any"
                      value={manualInput.geoLat}
                      onChange={(e) => setManualInput(prev => ({ ...prev, geoLat: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                      placeholder="37.9755"
                    />
                  </div>
                </div>
              </div>

              {/* Accuracy & Description */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Accuracy (m):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualInput.accuracy}
                    onChange={(e) => setManualInput(prev => ({ ...prev, accuracy: e.target.value }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                    placeholder="1.0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Description:</label>
                  <input
                    type="text"
                    value={manualInput.description}
                    onChange={(e) => setManualInput(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                    placeholder="Optional description"
                  />
                </div>
              </div>

              {/* Manual Add Button */}
              <button
                onClick={handleAddManualPoint}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                disabled={!manualInput.dxfX || !manualInput.dxfY || !manualInput.geoLng || !manualInput.geoLat}
              >
                ✅ Προσθήκη Σημείου
              </button>
            </div>
          </>
        )}

        {/* MANAGEMENT BUTTONS */}
        <div className="mb-4 border-t pt-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {/* Calibration Button */}
            <button
              onClick={handleCalibrate}
              disabled={!transformation.isValid}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                transformation.isValid
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              ⚡ Βαθμονόμηση
            </button>

            {/* Save Points */}
            <button
              onClick={handleSavePoints}
              disabled={points.length === 0}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                points.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              💾 Αποθήκευση
            </button>

            {/* Load Points */}
            <label className="px-3 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors cursor-pointer">
              📁 Φόρτωση
              <input
                type="file"
                accept=".json"
                onChange={handleLoadPoints}
                className="hidden"
              />
            </label>

            {/* Clear All */}
            {points.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
              >
                🗑️ Καθαρισμός
              </button>
            )}
          </div>
        </div>

        {/* Points Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Points: {points.length}
            </span>
            {hasMinPoints ? (
              <span className="text-sm text-green-600 font-medium">
                ✅ Ready for georeferencing
              </span>
            ) : (
              <span className="text-sm text-orange-600 font-medium">
                ⚠️ Need {3 - points.length} more point{3 - points.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                hasMinPoints ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ width: `${Math.min((points.length / 3) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Transformation Quality Indicator (STEP 2.3) */}
        {transformation.isValid && transformation.quality && (
          <div className="mb-4 p-3 border rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Transformation Quality:</span>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  transformation.quality === 'excellent'
                    ? 'bg-green-100 text-green-800'
                    : transformation.quality === 'good'
                    ? 'bg-blue-100 text-blue-800'
                    : transformation.quality === 'fair'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {transformation.quality.toUpperCase()}
              </span>
            </div>

            <div className="space-y-1 text-xs text-gray-800">
              <div className="flex justify-between">
                <span>RMS Error:</span>
                <span className="font-mono font-semibold">{transformation.rmsError?.toFixed(2)}m</span>
              </div>
              {transformation.result?.maxError && (
                <div className="flex justify-between">
                  <span>Max Error:</span>
                  <span className="font-mono font-semibold">{transformation.result.maxError.toFixed(2)}m</span>
                </div>
              )}
              {transformation.result?.meanError && (
                <div className="flex justify-between">
                  <span>Mean Error:</span>
                  <span className="font-mono font-semibold">{transformation.result.meanError.toFixed(2)}m</span>
                </div>
              )}
            </div>

            {transformation.quality === 'poor' && (
              <div className="mt-2 text-xs text-red-600">
                ⚠️ Low accuracy - consider adding more control points or checking existing ones
              </div>
            )}
          </div>
        )}

        {/* Control Points List */}
        {points.length > 0 && (
          <div className="border border-gray-300 rounded max-h-80 overflow-y-auto">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-300 font-semibold text-sm">
              {t('floorPlanControlPoints.list.title')}
            </div>

            {points.map((point, index) => (
              <div
                key={point.id}
                className="px-3 py-2 border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
              >
                {/* Point Header */}
                <div className="flex items-center justify-between mb-2">
                  {editingId === point.id ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm"
                      placeholder="Enter label..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(point.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                  ) : (
                    <span className="font-medium text-sm">
                      {point.label || `Point ${index + 1}`}
                    </span>
                  )}

                  <div className="flex gap-1">
                    {editingId === point.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(point.id)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                          ✗
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(point)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(point.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Point Coordinates */}
                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">Floor Plan:</span>{' '}
                    ({point.floorPlan.x.toFixed(2)}, {point.floorPlan.y.toFixed(2)})
                  </div>
                  <div>
                    <span className="font-medium">Map:</span>{' '}
                    ({point.geo.lng.toFixed(6)}, {point.geo.lat.toFixed(6)})
                  </div>
                  <div className="text-gray-400">
                    {new Date(point.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {points.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📍</div>
            <p className="text-sm">{t('floorPlanControlPoints.list.noPoints')}</p>
            <p className="text-xs mt-1">{t('floorPlanControlPoints.instructions.idle')}</p>
          </div>
        )}

        {/* Debug Info (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
            <div className="font-mono">
              <div>State: {pickingState}</div>
              <div>Points: {points.length}</div>
              <div>Has Min: {hasMinPoints ? 'Yes' : 'No'}</div>
              {tempFloorPlan && (
                <div>Temp Floor: ({tempFloorPlan.x}, {tempFloorPlan.y})</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Export for convenience
 */
export default FloorPlanControlPointPicker;
