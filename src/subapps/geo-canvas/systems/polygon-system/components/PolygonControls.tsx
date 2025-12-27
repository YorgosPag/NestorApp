/**
 * 🏢 ENTERPRISE POLYGON CONTROLS COMPONENT
 * Unified control interface for polygon operations
 *
 * @module polygon-system/components
 */

'use client';

import React from 'react';
import { MapPin, Hexagon, Hand, Trash2, Check, X, Home } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { PolygonType } from '@geo-alert/core';
import { usePolygonSystemContext } from '../hooks/usePolygonSystemContext';
import type { PolygonControlsProps } from '../types/polygon-system.types';
import {
  INTERACTIVE_PATTERNS,
  HOVER_TEXT_EFFECTS,
  HOVER_BACKGROUND_EFFECTS,
  TRANSITION_PRESETS
} from '@/components/ui/effects';

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
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
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
          container: `${colors.bg.primary} ${quick.card} shadow-lg`,
          button: `flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium ${TRANSITION_PRESETS.STANDARD_COLORS}`,
          primary: `${colors.bg.info} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
          secondary: `${colors.bg.secondary} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`,
          success: `${colors.bg.success} text-white ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
          danger: `${colors.bg.error} text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`
        };

      case 'professional':
        return {
          container: `${colors.bg.primary} ${quick.card} shadow-xl ${getStatusBorder('warning')}`,  // Professional = Warning semantic
          button: `flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold ${TRANSITION_PRESETS.STANDARD_COLORS}`,
          primary: `${colors.bg.warning} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
          secondary: `${colors.bg.secondary} ${colors.text.warning} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`,
          success: `${colors.bg.success} text-white ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
          danger: `${colors.bg.error} text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`
        };

      case 'technical':
        return {
          container: `${colors.bg.elevated} ${quick.input} shadow-2xl ${getStatusBorder('info')}`,    // Technical = Info semantic
          button: `flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-mono ${TRANSITION_PRESETS.STANDARD_COLORS}`,
          primary: `${colors.bg.info} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
          secondary: `${colors.bg.secondary} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`,
          success: `${colors.bg.success} text-white ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
          danger: `${colors.bg.error} text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`
        };

      default:
        return {
          container: `${colors.bg.primary} ${quick.card} shadow-lg`,
          button: `flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium ${TRANSITION_PRESETS.STANDARD_COLORS}`,
          primary: `${colors.bg.info} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
          secondary: `${colors.bg.secondary} ${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`,
          success: `${colors.bg.success} text-white ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
          danger: `${colors.bg.error} text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`
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
        <h3 className={`text-lg font-semibold ${config.role === 'technical' ? colors.text.foreground : colors.text.foreground}`}>
          {config.role === 'citizen' && 'Εργαλεία Πολίτη'}
          {config.role === 'professional' && 'Professional Tools'}
          {config.role === 'technical' && 'TECH_POLYGON_SYS'}
        </h3>
        <p className={`text-sm ${config.role === 'technical' ? colors.text.muted : colors.text.muted}`}>
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
          <Hexagon className={iconSizes.sm} />
          {config.role === 'technical' ? 'POLY' : 'Περίγραμμα'}
        </button>

        <button
          onClick={() => handleToolSelect('freehand')}
          disabled={state.isDrawing && state.currentTool === 'freehand'}
          className={`${styles.button} ${
            state.currentTool === 'freehand' ? styles.primary : styles.secondary
          }`}
        >
          <Hand className={iconSizes.sm} />
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
              <MapPin className={iconSizes.sm} />
              Σημείο
            </button>

            <button
              onClick={() => handleToolSelect('real-estate')}
              disabled={state.isDrawing && state.currentTool === 'real-estate'}
              className={`${styles.button} ${
                state.currentTool === 'real-estate' ? styles.primary : styles.secondary
              }`}
            >
              <Home className={iconSizes.sm} />
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
            <Check className={iconSizes.sm} />
            {config.role === 'technical' ? 'DONE' : 'Τέλος'}
          </button>

          <button
            onClick={handleCancel}
            className={`flex-1 ${styles.button} ${styles.danger}`}
          >
            <X className={iconSizes.sm} />
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
          <Trash2 className={iconSizes.sm} />
          {config.role === 'technical' ? `CLR_ALL(${state.polygons.length})` : `Καθάρισμα (${state.polygons.length})`}
        </button>
      )}

      {/* Statistics */}
      {(state.polygons.length > 0 || state.isDrawing) && (
        <div className={`mt-4 p-2 rounded text-xs ${
          config.role === 'technical'
            ? `${colors.bg.elevated} ${colors.text.muted} font-mono`
            : `${colors.bg.secondary} ${colors.text.muted}`
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