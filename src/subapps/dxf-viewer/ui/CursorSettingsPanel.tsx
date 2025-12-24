/**
 * AUTOCAD-STYLE CURSOR SETTINGS PANEL
 * Ενημερωμένο να χρησιμοποιεί το unified cursor configuration system
 * Διατηρεί την ίδια AutoCAD-style διεπαφή
 */
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  getCursorSettings,
  updateCursorSettings,
  subscribeToCursorSettings,
  cursorConfig,
  type CursorSettings
} from "../systems/cursor/config";
import { useRulersGridContext } from "../systems/rulers-grid/RulersGridSystem";
import { SimpleColorPicker } from "./color";
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// Force cursor styles for the panel to override canvas cursor settings
const panelStyles = `
  .cursor-settings-panel * {
    cursor: auto !important;
  }
  .cursor-settings-panel .drag-handle {
    cursor: grab !important;
  }
  .cursor-settings-panel .drag-handle:active {
    cursor: grabbing !important;
  }
  .cursor-settings-panel button:hover {
    cursor: pointer !important;
  }
  .cursor-settings-panel input[type="range"]:hover {
    cursor: pointer !important;
  }
  .cursor-settings-panel input[type="checkbox"]:hover {
    cursor: pointer !important;
  }
  .cursor-settings-panel input[type="color"]:hover {
    cursor: pointer !important;
  }
  .cursor-settings-panel input[type="text"]:hover {
    cursor: text !important;
  }
`;

// Add styles to document head
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('cursor-settings-panel-styles');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'cursor-settings-panel-styles';
    style.textContent = panelStyles;
    document.head.appendChild(style);
  }
}

function SliderRow({
  label, value, min, max, step = 1, onChange, disabled = false
}: {
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step?: number;
  onChange: (v: number) => void; 
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm text-gray-300">{label}</label>
        <span className="text-xs text-gray-400 font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`w-full h-2 bg-gray-700 ${quick.input} appearance-none cursor-pointer slider`}
      />
    </div>
  );
}

// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρησιμοποιεί το Enterprise Color System
// ColorPicker function αντικαταστάθηκε με SimpleColorPicker από το κεντρικό σύστημα

function CheckboxRow({
  label, checked, onChange, disabled = false
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mr-2"
        />
        <span className="text-sm text-gray-300">{label}</span>
      </label>
    </div>
  );
}

interface CursorSettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function CursorSettingsPanel({ isVisible, onClose }: CursorSettingsPanelProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder, quick } = useBorderTokens();
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());

  // Get actual ruler settings from the system
  const { state: { rulers: rulerContextSettings } } = useRulersGridContext();

  // Calculate initial position (bottom-right corner, precisely above ruler)
  const getInitialPosition = () => {
    const viewportWidth = window.innerWidth;
    const panelWidth = 500; // Panel width
    const panelHeight = 600; // Panel height
    const rightMargin = 20; // Right edge margin

    // Get ACTUAL ruler height from the system
    const actualRulerHeight = rulerContextSettings?.horizontal?.height ?? 30;

    // Find the EXACT position of the DXF canvas
    const dxfCanvas = document.querySelector('.dxf-canvas') as HTMLCanvasElement;

    let rulerTopY;
    if (dxfCanvas) {
      // Get the exact canvas position
      const canvasRect = dxfCanvas.getBoundingClientRect();
      // The ruler is at the bottom of the canvas, so ruler top = canvas bottom - ruler height
      rulerTopY = canvasRect.bottom - actualRulerHeight;

      // 🔧 DEBUG: Log exact positioning calculations
      console.log('🎯 PANEL POSITIONING EXACT VALUES:');
      console.log('  - Viewport:', viewportWidth, 'x', window.innerHeight);
      console.log('  - Canvas top:', canvasRect.top, 'bottom:', canvasRect.bottom);
      console.log('  - Canvas size:', canvasRect.width, 'x', canvasRect.height);
      console.log('  - Ruler height:', actualRulerHeight, 'topY:', rulerTopY);
      console.log('  - Panel size:', panelWidth, 'x', panelHeight);
      console.log('  - Calculated panelTopY:', rulerTopY - panelHeight);
      console.log('  - Final position: x=', viewportWidth - panelWidth - rightMargin, 'y=', Math.max(20, rulerTopY - panelHeight));
    } else {
      // Fallback if canvas not found
      rulerTopY = window.innerHeight - actualRulerHeight - 60;
      console.warn('⚠️ DXF Canvas not found - using fallback positioning');
    }

    // 🎯 CAD-PRECISION POSITIONING: Calculate safe position with buffer
    const taskbarBuffer = 60; // Safe space for Windows taskbar/dock
    const topBuffer = 20; // Minimum space from top

    // Calculate ideal position (panel bottom touches ruler top)
    const idealPanelTopY = rulerTopY - panelHeight;

    // Calculate maximum safe position (leave buffer for taskbar)
    const maxSafePanelTopY = window.innerHeight - panelHeight - taskbarBuffer;

    // ✅ ΔΙΟΡΘΩΣΗ: Use the LOWER position (higher up on screen = smaller Y value)
    const safePanelTopY = Math.min(idealPanelTopY, maxSafePanelTopY);
    const finalPanelTopY = Math.max(topBuffer, safePanelTopY);

    console.log('🎯 POSITIONING LOGIC:');
    console.log('  - Ideal panelTopY (touching ruler):', idealPanelTopY);
    console.log('  - Max safe panelTopY (with taskbar buffer):', maxSafePanelTopY);
    console.log('  - Final panelTopY (chosen):', finalPanelTopY);
    console.log('  - Panel bottom will be at:', finalPanelTopY + panelHeight);
    console.log('  - Distance from ruler:', rulerTopY - (finalPanelTopY + panelHeight));

    // 🎯 ΚΟΛΛΗΜΑ ΣΤΗ ΝΟΗΤΗ ΚΑΤΩ ΓΡΑΜΜΗ (Red line connecting bottom corners)
    const bottomCornerLineY = window.innerHeight; // Exactly where red line appears
    const exactPanelTopY = bottomCornerLineY - panelHeight;

    console.log('🔴 ΚΟΚΚΙΝΗ ΓΡΑΜΜΗ POSITIONING:');
    console.log('  - Bottom corner line Y:', bottomCornerLineY);
    console.log('  - Panel height:', panelHeight);
    console.log('  - Panel top for perfect alignment:', exactPanelTopY);
    console.log('  - Panel bottom will touch red line at Y:', exactPanelTopY + panelHeight);

    return {
      x: viewportWidth - panelWidth - rightMargin,
      y: exactPanelTopY
    };
  };

  const [position, setPosition] = useState(getInitialPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dynamicWidth, setDynamicWidth] = useState(500); // Track dynamic width
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

  // Reset position to bottom-right when panel opens + measure real height
  useEffect(() => {
    if (isVisible) {
      setPosition(getInitialPosition());

      // 🎯 MEASURE REAL PANEL HEIGHT after render
      setTimeout(() => {
        if (panelRef.current) {
          const realHeight = panelRef.current.getBoundingClientRect().height;
          console.log('📏 REAL PANEL MEASUREMENTS:');
          console.log('  - Expected height (hardcoded):', 600);
          console.log('  - ACTUAL height (DOM):', Math.round(realHeight));
          console.log('  - Height difference:', Math.round(realHeight - 600));

          // Recalculate position with real height
          const bottomCornerLineY = window.innerHeight;
          const correctPanelTopY = bottomCornerLineY - realHeight;
          console.log('  - Corrected panel top for red line alignment:', Math.round(correctPanelTopY));

          // Update position with real measurements
          setPosition(prev => ({
            ...prev,
            y: correctPanelTopY
          }));
        }
      }, 100); // Wait for DOM to render
    }
  }, [isVisible]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const originalWidth = 500; // Original panel width
      const minWidth = 200; // Minimum compressed width
      const panelHeight = 600; // Approximate panel height
      const taskbarHeight = 60; // Space for Windows taskbar

      // Calculate new position
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // Y bounds - conservative constraints to prevent overflow
      const actualRulerHeight = rulerContextSettings?.horizontal?.height ?? 30;
      const minY = 20; // Don't go too high
      const maxY = window.innerHeight - panelHeight - actualRulerHeight - 60; // Conservative positioning
      newY = Math.max(minY, Math.min(newY, maxY));

      // X bounds with compression logic
      let finalWidth = originalWidth;
      let finalX = newX;

      if (newX < 0) {
        // Compressing from left side
        const compressionAmount = Math.abs(newX);
        finalWidth = Math.max(minWidth, originalWidth - compressionAmount);
        finalX = 0; // Stick to left edge
      } else if (newX + originalWidth > window.innerWidth) {
        // Compressing from right side
        const overflowAmount = (newX + originalWidth) - window.innerWidth;
        finalWidth = Math.max(minWidth, originalWidth - overflowAmount);
        finalX = Math.max(window.innerWidth - finalWidth, 0); // Stick to available space
      }

      setPosition({ x: finalX, y: newY });
      setDynamicWidth(finalWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Reset width to original when not constrained
      setDynamicWidth(500);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const updateCrosshairSettings = (updates: Partial<CursorSettings['crosshair']>) => {
    updateCursorSettings({
      crosshair: { ...settings.crosshair, ...updates }
    });
  };

  const updateBehaviorSettings = (updates: Partial<CursorSettings['behavior']>) => {
    updateCursorSettings({
      behavior: { ...settings.behavior, ...updates }
    });
  };

  const updatePerformanceSettings = (updates: Partial<CursorSettings['performance']>) => {
    updateCursorSettings({
      performance: { ...settings.performance, ...updates }
    });
  };

  const resetSettings = () => {
    cursorConfig.resetToDefaults();
  };

  const clearAndReload = () => {
    try { 
      localStorage.removeItem("autocad_cursor_settings"); 
    } catch {}
    window.location.reload();
  };

  if (!isVisible) return null;

  const panelContent = (
    <div
      ref={panelRef}
      className={`cursor-settings-panel fixed z-[2147483647] bg-gray-900 text-white ${quick.card} shadow-2xl ${getStatusBorder('default')} select-none pointer-events-auto`}
      style={{
        left: position.x,
        top: position.y,
        width: dynamicWidth, // Use dynamic width instead of w-96
        backgroundColor: 'rgb(31, 41, 55)',
        opacity: 1,
        pointerEvents: 'all',
        zIndex: 2147483647, // Maximum z-index value
        position: 'fixed',
        transition: 'width 0.1s ease-out' // Smooth width transitions
      }}
    >
          <div
            className="drag-handle flex justify-between items-center mb-4 p-4"
            onMouseDown={handleMouseDown}
          >
            <h3 className="text-lg font-bold text-cyan-400">🔧 Ρυθμίσεις Κέρσορα AutoCAD</h3>
            <button
              onClick={onClose}
              className={`text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HOVER} text-xl ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} rounded px-2 py-1`}
              onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking X
            >
              ×
            </button>
          </div>
          <div className="px-4 pb-4">

          {/* Crosshair Settings - Simplified */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-200 mb-3">Σταυρόνημα</h4>

            <CheckboxRow
              label="Ενεργοποίηση Σταυρονήματος"
              checked={settings.crosshair.enabled}
              onChange={(enabled) => updateCrosshairSettings({ enabled })}
            />

            <div className={`mt-2 p-2 bg-blue-900/30 ${getStatusBorder('info')} rounded text-xs text-blue-200`}>
              💡 Μέγεθος, χρώμα και πάχος ρυθμίζονται από τις Ρυθμίσεις DXF
            </div>
          </div>

          {/* Behavior Settings */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-200 mb-3">Συμπεριφορά AutoCAD</h4>
            <div className={`mb-3 p-2 bg-yellow-900/30 ${getStatusBorder('warning')} rounded text-xs text-yellow-200`}>
              ⚠️ Σημείωση: Μερικές λειτουργίες είναι σε ανάπτυξη και μπορεί να μην είναι πλήρως ενεργές
            </div>
            
            <CheckboxRow
              label="✅ Ενδείξεις Snap (Συνδεδεμένο)"
              checked={settings.behavior.snap_indicator}
              onChange={(snap_indicator) => updateBehaviorSettings({ snap_indicator })}
            />
            <div className="text-xs text-green-400 mb-3 ml-6">
              🔗 Ενεργό: Εμφανίζει κίτρινες ενδείξεις snap στο crosshair
            </div>

            <CheckboxRow
              label="✅ Εμφάνιση Συντεταγμένων (Συνδεδεμένο)"
              checked={settings.behavior.coordinate_display}
              onChange={(coordinate_display) => updateBehaviorSettings({ coordinate_display })}
            />
            <div className="text-xs text-green-400 mb-3 ml-6">
              🔗 Ενεργό: Δείχνει X,Y συντεταγμένες στο status bar
            </div>

            <CheckboxRow
              label="✅ Δυναμική Εισαγωγή (Συνδεδεμένο)"
              checked={settings.behavior.dynamic_input}
              onChange={(dynamic_input) => updateBehaviorSettings({ dynamic_input })}
            />
            <div className="text-xs text-green-400 mb-3 ml-6">
              🔗 Ενεργό: Πεδία εισαγωγής κοντά στον κέρσορα κατά το σχεδιασμό
            </div>

            <CheckboxRow
              label="✅ Cursor Tooltip (Συνδεδεμένο)"
              checked={settings.behavior.cursor_tooltip}
              onChange={(cursor_tooltip) => updateBehaviorSettings({ cursor_tooltip })}
            />
            <div className="text-xs text-green-400 mb-3 ml-6">
              🔗 Ενεργό: Tooltip με πληροφορίες εργαλείου κοντά στον κέρσορα
            </div>
          </div>

          {/* Performance Settings */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-200 mb-3">Απόδοση</h4>
            
            <CheckboxRow
              label="✅ Χρήση RAF 60fps (Συνδεδεμένο)"
              checked={settings.performance.use_raf}
              onChange={(use_raf) => updatePerformanceSettings({ use_raf })}
            />
            <div className="text-xs text-green-400 mb-3 ml-6">
              🔗 Ενεργό: RequestAnimationFrame για ομαλότερη κίνηση crosshair
            </div>

            <CheckboxRow
              label="✅ Λειτουργία Ακρίβειας (Συνδεδεμένο)"
              checked={settings.performance.precision_mode}
              onChange={(precision_mode) => updatePerformanceSettings({ precision_mode })}
            />
            <div className="text-xs text-green-400 mb-3 ml-6">
              🔗 Ενεργό: Sub-pixel ακρίβεια για crosshair και snap indicators
            </div>
            {settings.performance.precision_mode && (
              <div className={`mb-3 ml-6 p-2 bg-blue-900/30 ${getStatusBorder('info')} rounded text-xs text-blue-200 flex items-center gap-2`}>
                <div className={`${iconSizes.xs} bg-blue-400 ${quick.button} animate-pulse`}></div>
                <span>PRECISION MODE ΕΝΕΡΓΟ - 4 δεκαδικά ψηφία</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              className={`flex-1 px-3 py-2 rounded bg-orange-600 ${INTERACTIVE_PATTERNS.WARNING_HOVER} text-xs`}
              onClick={resetSettings}
            >
              Επαναφορά Προκαθορισμένων
            </button>
            <button
              className={`px-3 py-1 rounded bg-slate-700 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-xs`}
              onClick={clearAndReload}
            >
              Καθαρισμός & Επαναφόρτωση
            </button>
          </div>
        </div>
    </div>
  );

  // Use portal to render outside the canvas container
  return typeof document !== 'undefined'
    ? createPortal(panelContent, document.body)
    : panelContent;
}
