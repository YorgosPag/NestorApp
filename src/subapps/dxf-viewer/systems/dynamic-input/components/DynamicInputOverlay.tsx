// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React, { useEffect, useCallback } from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE ADR-082: Centralized number formatting (replaces .toFixed())
import { getFormatter } from '../../../formatting';
import { useCursor } from '../../cursor';
import { CADFeedback } from '../../../utils/feedback-utils';
import { DynamicInputFields } from './DynamicInputFields';
import { DynamicInputHeader } from './DynamicInputHeader';
import { DynamicInputFooter } from './DynamicInputFooter';
import { DynamicInputContainer } from './DynamicInputContainer';
import {
  useDynamicInputKeyboard,
  useDynamicInputPhase,
  useDynamicInputLayout,
  useDynamicInputState,
  useDynamicInputToolReset,
  useDynamicInputAnchoring,
  useDynamicInputRealtime
} from '../hooks';
import { useDynamicInputMultiPoint } from '../hooks/useDynamicInputMultiPoint';
import { normalizeNumber, isValidNumber } from '../utils/number';
import { dispatchDynamicSubmit } from '../utils/events';
import type { DynamicInputSystemProps } from '../DynamicInputSystem';

interface DynamicInputOverlayProps extends DynamicInputSystemProps {
  // Any overlay-specific props can be added here
}

export default function DynamicInputOverlay({
  className = '',
  isActive = true,
  cursorPosition = null,
  viewport = { width: 0, height: 0 },
  activeTool = 'select',
  canvasRect = null,
  mouseWorldPosition = null,
  tempPoints = null
}: DynamicInputOverlayProps) {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const { settings } = useCursor();
  const colors = useSemanticColors();
  
  // Centralized state management
  const {
    // Core values
    showInput, xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue,
    // ADR-358 Phase 7b2b-β Stream E — stair values.
    riseValue, treadValue, widthValue, activeStairField,
    activeField, isManualInput, isCoordinateAnchored, fieldUnlocked,
    drawingPhase, hideAngleLengthFields, showLengthDuringDraw, firstClickPoint,

    // Refs
    hideAngleLengthFieldsRef, drawingPhaseRef,
    xInputRef, yInputRef, angleInputRef, lengthInputRef, radiusInputRef, diameterInputRef,
    // ADR-358 Phase 7b2b-β Stream E — stair refs.
    riseInputRef, treadInputRef, widthInputRef,

    // Setters
    setShowInput, setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue, setDiameterValue,
    // ADR-358 Phase 7b2b-β Stream E — stair setters.
    setRiseValue, setTreadValue, setWidthValue, setActiveStairField,
    setActiveField, setIsManualInput, setIsCoordinateAnchored, setFieldUnlocked,
    setDrawingPhase, setHideAngleLengthFields, setShowLengthDuringDraw, setFirstClickPoint,

    // Helper functions
    resetForNextPointFirstPhase,
    setCurrentFieldValue,

    // Interface implementations
    fieldValueActions,
    fieldStateActions,
    coordinateActions,
    phaseActions,
    inputRefActions,
  } = useDynamicInputState({
    activeTool: activeTool || 'select'
  });

  // Ενεργοποίηση δυναμικής εισαγωγής για συγκεκριμένα εργαλεία
  const shouldShowDynamicInput = useCallback(() => {
    if (!settings.behavior.dynamic_input || !isActive) {
      return false;
    }
    
    // Εμφάνιση για εργαλεία σχεδίασης και μέτρησης
    // ADR-358 Phase 7b2b-β Stream E — 'stair' added: rise/tread/width inline editor
    // visible from tool activation (industry convergence, see useDynamicInputLayout).
    const drawingTools = ['line', 'rectangle', 'circle', 'circle-diameter', 'circle-2p-diameter', 'polyline', 'measure-angle', 'polygon', 'ruler', 'measure-distance', 'measure-area', 'measure-distance', 'stair'];

    // Stair tool: show as soon as activated, no cursorPosition prerequisite
    // (params editable before first click — industry pre-set workflow).
    if (activeTool === 'stair') {
      return true;
    }
    
    // Για circle tools, εμφάνιση ανεξάρτητα από cursorPosition
    if ((activeTool === 'circle' || activeTool === 'circle-diameter' || activeTool === 'circle-2p-diameter') && drawingTools.includes(activeTool)) {
      return true;
    }
    
    // Για measurement tools που χρειάζονται πολλαπλά clicks, εμφάνιση πάντα
    const measurementTools = ['measure-distance', 'measure-area', 'measure-angle'];
    if (measurementTools.includes(activeTool)) {
      return true;
    }
    
    // Για άλλα tools, χρειάζεται cursorPosition
    return cursorPosition && drawingTools.includes(activeTool);
  }, [settings.behavior.dynamic_input, isActive, cursorPosition, activeTool]);

  // Create remaining interface implementations για το keyboard hook
  const validationActions = { normalizeNumber, isValidNumber };
  const feedbackActions = { 
    onError: CADFeedback.onError, 
    onInputConfirm: CADFeedback.onInputConfirm, 
    dispatchSubmit: dispatchDynamicSubmit 
  };
  const resetActions = { 
    resetForNextPoint: resetForNextPointFirstPhase, 
    setShowInput 
  };

  // ΑΦΑΙΡΟΥΜΕ το conflicting event listener που reset-άρει το phase
  // Η λογική phase switching γίνεται ΜΟΝΟ από τον canvas-click handler πια
  // Listen for line completion to reset fields
  // useEffect(() => {
  //   const handleLineComplete = (e: CustomEvent) => {
  //     const { tool, action } = e.detail;
  //     if (tool === 'line' && action === 'create-line-second-point') {
  //       console.debug('[DynamicInputOverlay] Line completed (2nd point) → reset to show all 4 fields');
  //       setHideAngleLengthFields(false);
  //       setDrawingPhase('first-point');
  //       
  //       // Reset field unlocking for new line
  //       setFieldUnlocked({ x: true, y: false, angle: false, length: false, radius: false });
  //       setActiveField('x');
  //     }
  //   };
  //   
  //   window.addEventListener('dynamic-input-coordinate-submit', handleLineComplete as EventListener);
  //   return () => window.removeEventListener('dynamic-input-coordinate-submit', handleLineComplete as EventListener);
  // }, []);

  // Keyboard handler hook (original με flat parameters)
  useDynamicInputKeyboard({
    showInput,
    activeTool,
    drawingPhase,
    drawingPhaseRef,
    setDrawingPhase,
    activeField,
    setActiveField,
    xValue,
    yValue,
    angleValue,
    lengthValue,
    radiusValue,
    diameterValue,
    setXValue,
    setYValue,
    setAngleValue,
    setLengthValue,
    setRadiusValue,
    setDiameterValue,
    setShowInput,
    setFieldUnlocked,
    setIsCoordinateAnchored,
    setIsManualInput,
    normalizeNumber,
    isValidNumber,
    xInputRef,
    yInputRef,
    angleInputRef,
    lengthInputRef,
    radiusInputRef,
    diameterInputRef,
    CADFeedback,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    firstClickPoint,
    setFirstClickPoint,
    // ADR-358 Phase 7b2b-β Stream E — stair-specific values + refs + active field.
    riseValue,
    treadValue,
    widthValue,
    setRiseValue,
    setTreadValue,
    setWidthValue,
    activeStairField,
    setActiveStairField,
    riseInputRef,
    treadInputRef,
    widthInputRef,
  });

  // Phase management hook
  useDynamicInputPhase({
    activeTool,
    showInput,
    mouseWorldPosition,
    isCoordinateAnchored,
    setXValue,
    setYValue,
    setLengthValue,
    setActiveField,
    setFieldUnlocked,
    setIsCoordinateAnchored,
    setIsManualInput,
    drawingPhase,
    setDrawingPhase,
    drawingPhaseRef,
    firstClickPoint,
    setFirstClickPoint,
  });

  // Border tokens hook
  const { quick, getDirectionalBorder } = useBorderTokens();

  // Layout/positioning hook
  const { getFieldsToShow, getInputPosition } = useDynamicInputLayout({
    activeTool,
    drawingPhase,
    cursorPosition,
  });

  // Tool reset hook
  useDynamicInputToolReset({
    activeTool,
    drawingPhase,
    getFieldsToShow,
    setXValue,
    setYValue,
    setAngleValue,
    setLengthValue,
    setRadiusValue,
    setDiameterValue,
    setActiveField,
    setIsManualInput,
    setHideAngleLengthFields,
    setShowLengthDuringDraw,
    setFirstClickPoint,
    setFieldUnlocked,
    hideAngleLengthFieldsRef,
  });

  // Real-time coordinates hook
  useDynamicInputRealtime({
    mouseWorldPosition,
    showInput,
    activeTool,
    firstClickPoint,
    isManualInput,
    showLengthDuringDraw,
    setXValue,
    setYValue,
    setLengthValue,
    setRadiusValue,
    setShowLengthDuringDraw,
  });

  // Anchoring/highlight hook
  useDynamicInputAnchoring({
    isCoordinateAnchored,
    drawingPhase,
    activeTool,
    setIsCoordinateAnchored,
    setIsManualInput,
    setFieldUnlocked,
  });

  // Multi-point calculation hook για polyline/polygon
  const multiPointInfo = useDynamicInputMultiPoint({
    tempPoints: tempPoints || [],
    mouseWorldPosition,
    activeTool,
    showInput
  });

  // Εμφάνιση/απόκρυψη input
  useEffect(() => {
    const newShowInput = shouldShowDynamicInput();
    setShowInput(newShowInput as boolean);
    
    // Focus στο ενεργό input όταν εμφανίζεται
    if (newShowInput) {
      setTimeout(() => {
        // ADR-358 Phase 7b2b-β Stream E — stair tool uses activeStairField cycle.
        const currentRef = activeTool === 'stair'
          ? (activeStairField === 'rise' ? riseInputRef
            : activeStairField === 'tread' ? treadInputRef
            : widthInputRef)
          : (activeField === 'x' ? xInputRef
            : activeField === 'y' ? yInputRef
            : activeField === 'angle' ? angleInputRef
            : activeField === 'radius' ? radiusInputRef
            : activeField === 'diameter' ? diameterInputRef
            : lengthInputRef);
        currentRef.current?.focus();
        currentRef.current?.select(); // Επιλέγει το περιεχόμενο αν υπάρχει
      }, 100); // Μικρή καθυστέρηση για να render το component
    }
  }, [shouldShowDynamicInput, activeField, activeTool, activeStairField]);

  // Backup event listeners για τα input fields - προστασία από global shortcuts
  useEffect(() => {
    const inputs = [xInputRef.current, yInputRef.current, lengthInputRef.current];
    
    const handleInputKeyDown = (e: KeyboardEvent) => {
      const numericKeys = ['-', '+', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', ','];
      if (numericKeys.includes(e.key)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    inputs.forEach(input => {
      if (input) {
        input.addEventListener('keydown', handleInputKeyDown, { capture: true });
      }
    });

    return () => {
      inputs.forEach(input => {
        if (input) {
          input.removeEventListener('keydown', handleInputKeyDown, { capture: true });
        }
      });
    };
  }, []);

  // Κρατάμε το component πάντα mounted, παίζουμε μόνο με visibility
  // if (!showInput) return null; // <-- ΑΥΤΟ προκαλούσε το unmount/remount loop!

  const position = getInputPosition();

  // Χρησιμοποιούμε τα fields που ορίζει το drawingPhase
  const fieldsToShow = getFieldsToShow();
  console.debug('[DIO] render fields:', fieldsToShow, 'drawingPhase:', drawingPhase, 'showInput:', showInput);
  
  // Mount/Unmount tracker για να δούμε αν σταμάτησε το remounting
  useEffect(() => {
    console.debug('[DIO] ✅ COMPONENT MOUNTED');
    return () => console.debug('[DIO] ❌ COMPONENT UNMOUNTING');
  }, []);

  return (
    <DynamicInputContainer position={position} showInput={showInput}>
      <DynamicInputHeader activeTool={activeTool} />

        <DynamicInputFields
          fieldsToShow={fieldsToShow}
          t={t}
          xValue={xValue}
          yValue={yValue}
          angleValue={angleValue}
          lengthValue={lengthValue}
          radiusValue={radiusValue}
          diameterValue={diameterValue}
          riseValue={riseValue}
          treadValue={treadValue}
          widthValue={widthValue}
          setXValue={setXValue}
          setYValue={setYValue}
          setAngleValue={setAngleValue}
          setLengthValue={setLengthValue}
          setRadiusValue={setRadiusValue}
          setDiameterValue={setDiameterValue}
          setRiseValue={setRiseValue}
          setTreadValue={setTreadValue}
          setWidthValue={setWidthValue}
          setIsManualInput={setIsManualInput}
          activeField={activeField}
          setActiveField={setActiveField}
          activeStairField={activeStairField}
          setActiveStairField={setActiveStairField}
          fieldUnlocked={fieldUnlocked}
          isCoordinateAnchored={isCoordinateAnchored}
          xInputRef={xInputRef}
          yInputRef={yInputRef}
          angleInputRef={angleInputRef}
          lengthInputRef={lengthInputRef}
          radiusInputRef={radiusInputRef}
          diameterInputRef={diameterInputRef}
          riseInputRef={riseInputRef}
          treadInputRef={treadInputRef}
          widthInputRef={widthInputRef}
        />

        {/* Multi-point information για polyline/polygon */}
        {/* 🏢 ENTERPRISE ADR-082: Uses FormatterRegistry for locale-aware formatting */}
        {multiPointInfo.shouldShowMultiPoint && (
          <div className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.PADDING.TOP_SM} ${getDirectionalBorder('muted', 'top')} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.tertiary}`}>
            {multiPointInfo.lastPointDistance !== null && (
              <div>{t('dynamicInput.multiPoint.distance')} {getFormatter().formatDistance(multiPointInfo.lastPointDistance, 3)}</div>
            )}
            {multiPointInfo.segmentAngle !== null && (
              <div>{t('dynamicInput.multiPoint.angle')} {getFormatter().formatAngle(multiPointInfo.segmentAngle, 1)}</div>
            )}
            {multiPointInfo.segments.length > 0 && (
              <div>{t('dynamicInput.multiPoint.segments')} {multiPointInfo.segments.length}</div>
            )}
            {multiPointInfo.totalDistance > 0 && (
              <div>{t('dynamicInput.multiPoint.total')} {getFormatter().formatDistance(multiPointInfo.totalDistance, 3)}</div>
            )}
          </div>
        )}
        
        <DynamicInputFooter activeTool={activeTool} drawingPhase={drawingPhase} />
    </DynamicInputContainer>
  );
}