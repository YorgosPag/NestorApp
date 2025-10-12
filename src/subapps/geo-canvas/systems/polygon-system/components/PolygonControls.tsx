/**
 * 🏢 ENTERPRISE POLYGON CONTROLS COMPONENT
 * Unified control interface for polygon operations
 *
 * @module polygon-system/components
 */

'use client';

import React from 'react';
import { MapPin, Hexagon, Hand, Trash2, Check, X, Home } from 'lucide-react';
import type { PolygonType } from '@geo-alert/core';
import { usePolygonSystemContext } from '../hooks/usePolygonSystemContext';
import type { PolygonControlsProps } from '../types/polygon-system.types';

/**
 * Unified polygon controls component
 *
 * Provides consistent control interface across all user roles
 * with role-based styling and behavior.
 */
export function PolygonControls({
  onToolSelect,
  onComplete,
  onCancel,
  onClearAll,
  className = ''
}: PolygonControlsProps) {
  const { state, actions, config } = usePolygonSystemContext();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleToolSelect = (tool: PolygonType | null) => {
    if (tool) {
      actions.startDrawing(tool);
    } else {
      actions.cancelDrawing();
    }

    if (onToolSelect) {
      onToolSelect(tool);
    }
  };

  const handleComplete = () => {
    const polygon = actions.finishDrawing();
    if (polygon && onComplete) {
      onComplete();
    }
  };

  const handleCancel = () => {
    actions.cancelDrawing();
    if (onCancel) {
      onCancel();
    }
  };

  const handleClearAll = () => {
    actions.clearAll();
    if (onClearAll) {
      onClearAll();
    }
  };

  // ============================================================================
  // ROLE-BASED STYLING
  // ============================================================================

  const getRoleStyles = () => {
    switch (config.role) {
      case 'citizen':
        return {
          container: 'bg-white rounded-lg shadow-lg border border-gray-200',
          button: 'flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors text-sm font-medium',
          primary: 'bg-blue-500 text-white hover:bg-blue-600',
          secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          success: 'bg-green-500 text-white hover:bg-green-600',
          danger: 'bg-red-500 text-white hover:bg-red-600'
        };

      case 'professional':
        return {
          container: 'bg-white rounded-xl shadow-xl border border-amber-200',
          button: 'flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-colors text-sm font-semibold',
          primary: 'bg-amber-500 text-white hover:bg-amber-600',
          secondary: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
          success: 'bg-emerald-500 text-white hover:bg-emerald-600',
          danger: 'bg-red-500 text-white hover:bg-red-600'
        };

      case 'technical':
        return {
          container: 'bg-slate-900 rounded-md shadow-2xl border border-violet-500',
          button: 'flex items-center justify-center gap-1 py-1 px-2 rounded transition-colors text-xs font-mono',
          primary: 'bg-violet-600 text-white hover:bg-violet-700',
          secondary: 'bg-slate-700 text-slate-300 hover:bg-slate-600',
          success: 'bg-cyan-600 text-white hover:bg-cyan-700',
          danger: 'bg-red-600 text-white hover:bg-red-700'
        };

      default:
        return {
          container: 'bg-white rounded-lg shadow-lg border border-gray-200',
          button: 'flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors text-sm font-medium',
          primary: 'bg-blue-500 text-white hover:bg-blue-600',
          secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          success: 'bg-green-500 text-white hover:bg-green-600',
          danger: 'bg-red-500 text-white hover:bg-red-600'
        };
    }
  };

  const styles = getRoleStyles();

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${styles.container} p-4 ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className={`text-lg font-semibold ${config.role === 'technical' ? 'text-white' : 'text-gray-900'}`}>
          {config.role === 'citizen' && 'Εργαλεία Πολίτη'}
          {config.role === 'professional' && 'Professional Tools'}
          {config.role === 'technical' && 'TECH_POLYGON_SYS'}
        </h3>
        <p className={`text-sm ${config.role === 'technical' ? 'text-slate-400' : 'text-gray-600'}`}>
          Role: {config.role.toUpperCase()} | Tolerance: {config.snapTolerance}px
        </p>
      </div>

      {/* Drawing Tools */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => handleToolSelect('simple')}
          disabled={state.isDrawing && state.currentTool === 'simple'}
          className={`${styles.button} ${
            state.currentTool === 'simple' ? styles.primary : styles.secondary
          }`}
        >
          <Hexagon className="w-4 h-4" />
          {config.role === 'technical' ? 'POLY' : 'Περίγραμμα'}
        </button>

        <button
          onClick={() => handleToolSelect('freehand')}
          disabled={state.isDrawing && state.currentTool === 'freehand'}
          className={`${styles.button} ${
            state.currentTool === 'freehand' ? styles.primary : styles.secondary
          }`}
        >
          <Hand className="w-4 h-4" />
          {config.role === 'technical' ? 'FREE' : 'Ελεύθερο'}
        </button>

        {config.role === 'citizen' && (
          <>
            <button
              onClick={() => handleToolSelect('point')}
              disabled={state.isDrawing && state.currentTool === 'point'}
              className={`${styles.button} ${
                state.currentTool === 'point' ? styles.primary : styles.secondary
              }`}
            >
              <MapPin className="w-4 h-4" />
              Σημείο
            </button>

            <button
              onClick={() => handleToolSelect('real-estate')}
              disabled={state.isDrawing && state.currentTool === 'real-estate'}
              className={`${styles.button} ${
                state.currentTool === 'real-estate' ? styles.primary : styles.secondary
              }`}
            >
              <Home className="w-4 h-4" />
              Ακίνητο
            </button>
          </>
        )}
      </div>

      {/* Action Buttons */}
      {state.isDrawing && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleComplete}
            className={`flex-1 ${styles.button} ${styles.success}`}
          >
            <Check className="w-4 h-4" />
            {config.role === 'technical' ? 'DONE' : 'Τέλος'}
          </button>

          <button
            onClick={handleCancel}
            className={`flex-1 ${styles.button} ${styles.danger}`}
          >
            <X className="w-4 h-4" />
            {config.role === 'technical' ? 'STOP' : 'Άκυρο'}
          </button>
        </div>
      )}

      {/* Clear All */}
      {state.polygons.length > 0 && !state.isDrawing && (
        <button
          onClick={handleClearAll}
          className={`w-full ${styles.button} ${styles.secondary}`}
        >
          <Trash2 className="w-4 h-4" />
          {config.role === 'technical' ? `CLR_ALL(${state.polygons.length})` : `Καθάρισμα (${state.polygons.length})`}
        </button>
      )}

      {/* Statistics */}
      {(state.polygons.length > 0 || state.isDrawing) && (
        <div className={`mt-4 p-2 rounded text-xs ${
          config.role === 'technical'
            ? 'bg-slate-800 text-slate-300 font-mono'
            : 'bg-gray-50 text-gray-600'
        }`}>
          <div className="space-y-1">
            <div>
              {config.role === 'technical' ? 'POLY_COUNT: ' : 'Πολύγωνα: '}
              <span className="font-semibold">{state.polygons.length}</span>
            </div>
            {state.isDrawing && (
              <div>
                {config.role === 'technical' ? 'ACTIVE_TOOL: ' : 'Ενεργό: '}
                <span className="font-semibold">{state.currentTool?.toUpperCase()}</span>
              </div>
            )}
            {state.isPolygonComplete && (
              <div className={config.role === 'technical' ? 'text-cyan-400' : 'text-green-600'}>
                {config.role === 'technical' ? 'LEGACY_COMPLETE: TRUE' : '✅ Πολύγωνο κλειστό'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}