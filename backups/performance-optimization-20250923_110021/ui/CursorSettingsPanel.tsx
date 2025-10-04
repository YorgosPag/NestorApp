/**
 * AUTOCAD-STYLE CURSOR SETTINGS PANEL
 * Ενημερωμένο να χρησιμοποιεί το unified cursor configuration system
 * Διατηρεί την ίδια AutoCAD-style διεπαφή
 */
import React, { useState, useEffect } from "react";
import { 
  getCursorSettings, 
  updateCursorSettings, 
  subscribeToCursorSettings,
  cursorConfig,
  type CursorSettings 
} from "../systems/cursor/config";

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
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
      />
    </div>
  );
}

function ColorPicker({
  label, value, onChange, disabled = false
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="text-sm text-gray-300 mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 rounded border border-gray-600 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
          placeholder="#ffffff"
        />
      </div>
    </div>
  );
}

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
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());

  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

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

  return (
    <div className="fixed top-20 right-4 z-[99999] w-96 bg-gray-800 text-white p-4 rounded-lg shadow-xl border border-gray-600">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-cyan-400">Ρυθμίσεις Κέρσορα AutoCAD</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ×
            </button>
          </div>

          {/* Crosshair Settings */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-200 mb-3">Σταυρόνημα</h4>
            
            <CheckboxRow
              label="Ενεργοποίηση Σταυρονήματος"
              checked={settings.crosshair.enabled}
              onChange={(enabled) => updateCrosshairSettings({ enabled })}
            />

            <SliderRow
              label="Μέγεθος (%)"
              value={settings.crosshair.size_percent}
              min={1}
              max={50}
              step={1}
              onChange={(size_percent) => updateCrosshairSettings({ size_percent })}
              disabled={!settings.crosshair.enabled}
            />

            <ColorPicker
              label="Χρώμα"
              value={settings.crosshair.color}
              onChange={(color) => updateCrosshairSettings({ color })}
              disabled={!settings.crosshair.enabled}
            />

            <SliderRow
              label="Πάχος Γραμμής"
              value={settings.crosshair.line_width}
              min={1}
              max={5}
              step={0.5}
              onChange={(line_width) => updateCrosshairSettings({ line_width })}
              disabled={!settings.crosshair.enabled}
            />

            <SliderRow
              label="Κενό στο Κέντρο (px)"
              value={settings.crosshair.center_gap_px}
              min={0}
              max={20}
              step={1}
              onChange={(center_gap_px) => updateCrosshairSettings({ center_gap_px })}
              disabled={!settings.crosshair.enabled}
            />

            <CheckboxRow
              label="Κλείδωμα στην Αναλογία Pixels"
              checked={settings.crosshair.lock_to_dpr}
              onChange={(lock_to_dpr) => updateCrosshairSettings({ lock_to_dpr })}
              disabled={!settings.crosshair.enabled}
            />
          </div>

          {/* Behavior Settings */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-200 mb-3">Συμπεριφορά AutoCAD</h4>
            <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-600/30 rounded text-xs text-yellow-200">
              ⚠️ Σημείωση: Μερικές λειτουργίες είναι σε ανάπτυξη και μπορεί να μην είναι πλήρως ενεργές
            </div>
            
            <CheckboxRow
              label="Ενδείξεις Snap"
              checked={settings.behavior.snap_indicator}
              onChange={(snap_indicator) => updateBehaviorSettings({ snap_indicator })}
            />
            <div className="text-xs text-gray-400 mb-3 ml-6">
              Εμφανίζει οπτικές ενδείξεις όταν το snap εντοπίζει σημεία
            </div>

            <CheckboxRow
              label="Εμφάνιση Συντεταγμένων"
              checked={settings.behavior.coordinate_display}
              onChange={(coordinate_display) => updateBehaviorSettings({ coordinate_display })}
            />
            <div className="text-xs text-gray-400 mb-3 ml-6">
              Δείχνει τις συντεταγμένες X,Y στη γραμμή κατάστασης
            </div>

            <CheckboxRow
              label="Δυναμική Εισαγωγή"
              checked={settings.behavior.dynamic_input}
              onChange={(dynamic_input) => updateBehaviorSettings({ dynamic_input })}
            />
            <div className="text-xs text-gray-400 mb-3 ml-6">
              Εμφανίζει πεδία εισαγωγής κοντά στον κέρσορα κατά το σχεδιασμό
            </div>

            <CheckboxRow
              label="Cursor Tooltip"
              checked={settings.behavior.cursor_tooltip}
              onChange={(cursor_tooltip) => updateBehaviorSettings({ cursor_tooltip })}
            />
            <div className="text-xs text-gray-400 mb-3 ml-6">
              Εμφανίζει tooltip με πληροφορίες εργαλείου κοντά στον κέρσορα
            </div>
          </div>

          {/* Performance Settings */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-200 mb-3">Απόδοση</h4>
            
            <CheckboxRow
              label="Χρήση RAF (60fps)"
              checked={settings.performance.use_raf}
              onChange={(use_raf) => updatePerformanceSettings({ use_raf })}
            />
            <div className="text-xs text-gray-400 mb-3 ml-6">
              Χρησιμοποιεί RequestAnimationFrame για ομαλότερη κίνηση κέρσορα
            </div>

            <CheckboxRow
              label="Λειτουργία Ακρίβειας"
              checked={settings.performance.precision_mode}
              onChange={(precision_mode) => updatePerformanceSettings({ precision_mode })}
            />
            <div className="text-xs text-gray-400 mb-3 ml-6">
              Ενεργοποιεί μεγαλύτερη ακρίβεια στον υπολογισμό θέσης κέρσορα
            </div>
            {settings.performance.precision_mode && (
              <div className="mb-3 ml-6 p-2 bg-blue-900/30 border border-blue-600/30 rounded text-xs text-blue-200 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>PRECISION MODE ΕΝΕΡΓΟ - 4 δεκαδικά ψηφία</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-2 rounded bg-orange-600 hover:bg-orange-700 text-xs"
              onClick={resetSettings}
            >
              Επαναφορά Προκαθορισμένων
            </button>
            <button
              className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
              onClick={clearAndReload}
            >
              Καθαρισμός & Επαναφόρτωση
            </button>
          </div>
    </div>
  );
}
