'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_COLOR_PALETTE_PANEL = false;

import React, { useState, useEffect } from 'react';
import { CursorColorPalette, type CursorColors } from './palettes/CursorColorPalette';
import { DEFAULT_CURSOR_SETTINGS } from '../../systems/cursor/config';
import { useCursorSettings } from '../../systems/cursor';
import {
  type GridSettings,
  type RulerSettings
} from '../../systems/rulers-grid/config';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { EntitiesSettings } from './dxf-settings/settings/special/EntitiesSettings';
import LineSettings from './dxf-settings/settings/core/LineSettings';
import { LayersSettings } from './dxf-settings/settings/special/LayersSettings';
import { ComingSoonSettings } from './dxf-settings/settings/ComingSoonSettings';
import { TextSettings } from './dxf-settings/settings/core/TextSettings';
import { CursorSettings } from './dxf-settings/settings/special/CursorSettings';
import { SelectionSettings } from './dxf-settings/settings/special/SelectionSettings';
import { GripSettings } from './dxf-settings/settings/core/GripSettings';
import { LinePreview } from './dxf-settings/settings/shared/LinePreview';
import { CurrentSettingsDisplay } from './dxf-settings/settings/shared/CurrentSettingsDisplay';
import { useLineSettingsFromProvider, useTextSettingsFromProvider } from '../../providers/DxfSettingsProvider';
import { useGripContext } from '../../providers/GripProvider';
import {
  CrosshairIcon,
  SelectionIcon,
  GridIcon,
  GripsIcon,
  LayersIcon,
  EntitiesIcon,
  LightingIcon
} from './dxf-settings/icons/DxfSettingsIcons';

export interface ColorPalettePanelProps {
  className?: string;
}

type ColorCategory = 'cursor' | 'selection' | 'grid' | 'grips' | 'layers' | 'entities' | 'lighting';

interface CategoryConfig {
  id: ColorCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}


type MainTab = 'general' | 'specific';
type GeneralTab = 'lines' | 'text' | 'grips';

export function ColorPalettePanel({ className = '' }: ColorPalettePanelProps) {
  if (DEBUG_COLOR_PALETTE_PANEL) console.log('🎨 [ColorPalettePanel] *** COMPONENT LOADED ***');

  // Main tabs state
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('specific');

  // General settings sub-tabs state
  const [activeGeneralTab, setActiveGeneralTab] = useState<GeneralTab>('lines');

  // Use cursor settings hook για live connection
  let cursorHookResult;
  try {
    cursorHookResult = useCursorSettings();
  } catch (error) {
    console.error('❌ CursorSystem context not available:', error);
    // Fallback to default
    cursorHookResult = {
      settings: DEFAULT_CURSOR_SETTINGS,
      updateSettings: (updates: any) => { if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Mock updateSettings:', updates); }
    };
  }

  const { settings, updateSettings } = cursorHookResult;

  // Accordion state
  const [activeCategory, setActiveCategory] = useState<ColorCategory>('selection');
  
  // Sub-category state for cursor (crosshair vs cursor settings)
  const [activeCursorTab, setActiveCursorTab] = useState<'crosshair' | 'cursor'>('crosshair');
  
  // Sub-category state for selection (window vs crossing)
  const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');
  
  // Sub-category state for grid & rulers
  const [activeGridTab, setActiveGridTab] = useState<'grid' | 'rulers'>('grid');
  if (DEBUG_COLOR_PALETTE_PANEL) console.log('🎨 [ColorPalettePanel] Active Grid Tab:', activeGridTab);
  
  // Sub-category state for rulers (background, lines, text, units)
  const [activeRulerTab, setActiveRulerTab] = useState<'background' | 'lines' | 'text' | 'units'>('background');
  if (DEBUG_COLOR_PALETTE_PANEL) console.log('🎨 [ColorPalettePanel] Active Ruler Tab:', activeRulerTab);
  
  // Sub-category state for lines (major lines, minor lines)
  const [activeLinesTab, setActiveLinesTab] = useState<'major' | 'minor'>('major');
  if (DEBUG_COLOR_PALETTE_PANEL) console.log('🎨 [ColorPalettePanel] Active Lines Tab:', activeLinesTab);
  
  // Grid & Rulers context (connected to real system)
  const {
    state: { grid: gridSettings, rulers: rulerSettings },
    updateGridSettings,
    updateRulerSettings,
    setGridVisibility,
    setRulerVisibility
  } = useRulersGridContext();

  // Line, Text and Grip settings contexts for preview
  const lineSettings = useLineSettingsFromProvider();
  const textSettings = useTextSettingsFromProvider();
  const { gripSettings } = useGripContext();

  // Debug log settings changes
  React.useEffect(() => {
    if (DEBUG_COLOR_PALETTE_PANEL) {
      console.log('🔧 [ColorPalettePanel] Settings changed:', {
        lineSettings: lineSettings.settings,
        gripSettings
      });
    }
  }, [lineSettings.settings, gripSettings]);

  
  // Ruler lines visibility state (synchronized with actual ruler settings)
  const [rulerUnitsEnabled, setRulerUnitsEnabled] = useState<boolean>(rulerSettings?.horizontal?.showMinorTicks ?? true);
  
  // Units visibility state - controls if units are shown in ruler labels (synced with showUnits)
  const [unitsVisible, setUnitsVisible] = useState<boolean>(rulerSettings?.horizontal?.showUnits ?? true);
  
  // Text visibility state - controls if text/numbers are shown on rulers (synced with showLabels)
  const [textVisible, setTextVisible] = useState<boolean>(rulerSettings?.horizontal?.showLabels ?? true);
  
  // Background visibility state - controls if background is shown on rulers (synced with showBackground)
  const [backgroundVisible, setBackgroundVisible] = useState<boolean>(rulerSettings?.horizontal?.showBackground ?? true);
  
  // Sync state with ruler settings changes
  useEffect(() => {
    if (rulerSettings?.horizontal?.showMinorTicks !== undefined) {
      setRulerUnitsEnabled(rulerSettings.horizontal.showMinorTicks);
    }
  }, [rulerSettings?.horizontal?.showMinorTicks]);

  useEffect(() => {
    if (rulerSettings?.horizontal?.showUnits !== undefined) {
      setUnitsVisible(rulerSettings.horizontal.showUnits);
    }
  }, [rulerSettings?.horizontal?.showUnits]);

  useEffect(() => {
    if (rulerSettings?.horizontal?.showLabels !== undefined) {
      setTextVisible(rulerSettings.horizontal.showLabels);
    }
  }, [rulerSettings?.horizontal?.showLabels]);

  useEffect(() => {
    if (rulerSettings?.horizontal?.showBackground !== undefined) {
      setBackgroundVisible(rulerSettings.horizontal.showBackground);
    }
  }, [rulerSettings?.horizontal?.showBackground]);
  
  // 🔍 DEBUG LOGS για πλέγμα
  if (DEBUG_COLOR_PALETTE_PANEL) console.log('🟢 [ColorPalettePanel] Grid Settings από RulersGrid Context:', {
    gridSettings,
    visual: gridSettings.visual,
    enabled: gridSettings.visual.enabled,
    step: gridSettings.visual.step,
    color: gridSettings.visual.color,
    opacity: gridSettings.visual.opacity
  });
  
  // Cursor-specific state
  const [cursorShape, setCursorShape] = useState<'circle' | 'square'>(settings.cursor?.shape || 'circle');
  const [cursorSize, setCursorSize] = useState<number>(settings.cursor?.size || 10);
  const [cursorColor, setCursorColor] = useState<string>(settings.cursor?.color || '#ffffff');
  const [cursorLineStyle, setCursorLineStyle] = useState<'solid' | 'dashed'>(settings.cursor?.line_style || 'solid');
  const [cursorOpacity, setCursorOpacity] = useState<number>(settings.cursor?.opacity || 0.9);
  const [cursorEnabled, setCursorEnabled] = useState<boolean>(settings.cursor?.enabled !== false);

  // Ruler background color state (για εύκολο syncing με color picker)
  const [rulerBackgroundColor, setRulerBackgroundColor] = useState<string>('#ffffff');
  
  // Category definitions
  const categories: CategoryConfig[] = [
    {
      id: 'cursor',
      title: 'Crosshair & Cursor',
      description: 'Ρυθμίσεις σταυρώνυματος και δρομέα',
      icon: <CrosshairIcon />
    },
    {
      id: 'selection',
      title: 'Selection Boxes',
      description: 'Κουτιά επιλογής Window & Crossing',
      icon: <SelectionIcon />
    },
    {
      id: 'grid',
      title: 'Grid & Rulers',
      description: 'Πλέγμα και χάρακες σχεδίασης',
      icon: <GridIcon />
    },
    {
      id: 'grips',
      title: 'Grips & Handles',
      description: 'Λαβές επεξεργασίας αντικειμένων',
      icon: <GripsIcon />,
      comingSoon: true
    },
    {
      id: 'layers',
      title: 'Layer Colors',
      description: 'Χρώματα επιπέδων σχεδίασης',
      icon: <LayersIcon />
    },
    {
      id: 'entities',
      title: 'Entities',
      description: 'Ρυθμίσεις οντοτήτων σχεδίασης',
      icon: <EntitiesIcon />
    },
    {
      id: 'lighting',
      title: 'Lighting & Effects',
      description: 'Φωτισμός και εφέ απόδοσης',
      icon: <LightingIcon />,
      comingSoon: true
    }
  ];
  
  // State για cursor χρώματα - sync με cursor settings
  const [cursorColors, setCursorColors] = useState<CursorColors>({
    crosshairColor: settings.crosshair.color,
    
    // Window Selection από settings
    windowFillColor: settings.selection.window.fillColor,
    windowFillOpacity: settings.selection.window.fillOpacity,
    windowBorderColor: settings.selection.window.borderColor,
    windowBorderOpacity: settings.selection.window.borderOpacity,
    windowBorderStyle: settings.selection.window.borderStyle,
    windowBorderWidth: settings.selection.window.borderWidth,
    
    // Crossing Selection από settings
    crossingFillColor: settings.selection.crossing.fillColor,
    crossingFillOpacity: settings.selection.crossing.fillOpacity,
    crossingBorderColor: settings.selection.crossing.borderColor,
    crossingBorderOpacity: settings.selection.crossing.borderOpacity,
    crossingBorderStyle: settings.selection.crossing.borderStyle,
    crossingBorderWidth: settings.selection.crossing.borderWidth
  });

  // Sync local state όταν αλλάζουν τα cursor settings
  useEffect(() => {
    setCursorColors({
      crosshairColor: settings.crosshair.color,
      windowFillColor: settings.selection.window.fillColor,
      windowFillOpacity: settings.selection.window.fillOpacity,
      windowBorderColor: settings.selection.window.borderColor,
      windowBorderOpacity: settings.selection.window.borderOpacity,
      windowBorderStyle: settings.selection.window.borderStyle,
      windowBorderWidth: settings.selection.window.borderWidth,
      crossingFillColor: settings.selection.crossing.fillColor,
      crossingFillOpacity: settings.selection.crossing.fillOpacity,
      crossingBorderColor: settings.selection.crossing.borderColor,
      crossingBorderOpacity: settings.selection.crossing.borderOpacity,
      crossingBorderStyle: settings.selection.crossing.borderStyle,
      crossingBorderWidth: settings.selection.crossing.borderWidth
    });
    
    // Sync cursor-specific state
    setCursorShape(settings.cursor?.shape || 'circle');
    setCursorSize(settings.cursor?.size || 10);
    setCursorColor(settings.cursor?.color || '#ffffff');
    setCursorLineStyle(settings.cursor?.line_style || 'solid');
    setCursorOpacity(settings.cursor?.opacity || 0.9);
    setCursorEnabled(settings.cursor?.enabled !== false);
    
    // Sync ruler background color από το rulerSettings
    if (rulerSettings?.horizontal?.backgroundColor) {
      const bgColor = rulerSettings.horizontal.backgroundColor;
      // Μετατροπή rgba σε hex για color picker
      if (bgColor.includes('rgba')) {
        const rgbaMatch = bgColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[^)]+\)/);
        if (rgbaMatch) {
          const [, r, g, b] = rgbaMatch;
          const hex = '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
          setRulerBackgroundColor(hex);
        }
      } else if (bgColor.includes('rgb')) {
        const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const [, r, g, b] = rgbMatch;
          const hex = '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
          setRulerBackgroundColor(hex);
        }
      } else if (bgColor.startsWith('#')) {
        setRulerBackgroundColor(bgColor);
      }
    }
  }, [settings, rulerSettings]);

  // TEMPORARY DEBUG - θα αφαιρεθεί μετά το testing
  const handleResetSelectionSettings = () => {
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔄 Resetting selection settings to fix borderStyle...');
    const { resetCursorSettings } = require('../../systems/cursor/config');
    resetCursorSettings();
    window.location.reload(); // Force reload για clean state
  };

  const handleCursorColorsChange = (colors: CursorColors) => {
    setCursorColors(colors);
    
    // 🔥 LIVE UPDATE - Apply changes στο πραγματικό cursor system
    updateSettings({
      crosshair: {
        ...settings.crosshair,
        color: colors.crosshairColor
      },
      selection: {
        window: {
          fillColor: colors.windowFillColor,
          fillOpacity: colors.windowFillOpacity,
          borderColor: colors.windowBorderColor,
          borderOpacity: colors.windowBorderOpacity,
          borderStyle: colors.windowBorderStyle,
          borderWidth: colors.windowBorderWidth
        },
        crossing: {
          fillColor: colors.crossingFillColor,
          fillOpacity: colors.crossingFillOpacity,
          borderColor: colors.crossingBorderColor,
          borderOpacity: colors.crossingBorderOpacity,
          borderStyle: colors.crossingBorderStyle,
          borderWidth: colors.crossingBorderWidth
        }
      }
    });
    
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🎨 Cursor colors applied to system:', colors);
  };

  // Cursor settings handlers
  const handleCursorShapeChange = (shape: 'circle' | 'square') => {
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Changing cursor shape to:', shape);
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Current cursor settings:', settings.cursor);
    setCursorShape(shape);
    
    // Δημιουργία πλήρους cursor object αν δεν υπάρχει  
    const currentCursor = settings.cursor || {
      enabled: true,
      shape: 'circle',
      size: 10,
      color: '#ffffff',
      line_style: 'solid',
      opacity: 0.9
    };
    
    // FORCE enable cursor for shape change
    const updatedCursor = { ...currentCursor, shape, enabled: true };
    
    updateSettings({ cursor: updatedCursor });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Updated cursor settings:', updatedCursor);
  };

  const handleCursorSizeChange = (size: number) => {
    setCursorSize(size);
    const currentCursor = settings.cursor || { enabled: true, shape: 'circle', size: 10, color: '#ffffff', line_style: 'solid', opacity: 0.9 };
    updateSettings({ cursor: { ...currentCursor, size, enabled: true } });
  };

  const handleCursorColorChange = (color: string) => {
    setCursorColor(color);
    const currentCursor = settings.cursor || { enabled: true, shape: 'circle', size: 10, color: '#ffffff', line_style: 'solid', opacity: 0.9 };
    updateSettings({ cursor: { ...currentCursor, color, enabled: true } });
  };

  const handleCursorLineStyleChange = (line_style: 'solid' | 'dashed') => {
    setCursorLineStyle(line_style);
    const currentCursor = settings.cursor || { enabled: true, shape: 'circle', size: 10, color: '#ffffff', line_style: 'solid', opacity: 0.9 };
    updateSettings({ cursor: { ...currentCursor, line_style, enabled: true } });
  };

  const handleCursorOpacityChange = (opacity: number) => {
    setCursorOpacity(opacity);
    const currentCursor = settings.cursor || { enabled: true, shape: 'circle', size: 10, color: '#ffffff', line_style: 'solid', opacity: 0.9 };
    updateSettings({ cursor: { ...currentCursor, opacity, enabled: true } });
  };

  const handleCursorEnabledChange = (enabled: boolean) => {
    setCursorEnabled(enabled);
    const currentCursor = settings.cursor || { enabled: true, shape: 'circle', size: 10, color: '#ffffff', line_style: 'solid', opacity: 0.9 };
    updateSettings({ cursor: { ...currentCursor, enabled } });
  };

  // Grid Settings Handlers (connected to real system)
  const handleGridVisibilityChange = (enabled: boolean) => {
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] BEFORE setGridVisibility:', { 
      enabled, 
      currentState: gridSettings.visual.enabled 
    });
    setGridVisibility(enabled);
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] AFTER setGridVisibility called with:', enabled);
  };

  const handleGridSizeChange = (step: number) => {
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] BEFORE updateGridSettings size:', { 
      step, 
      currentStep: gridSettings.visual.step,
      fullVisual: gridSettings.visual 
    });
    updateGridSettings({
      visual: { ...gridSettings.visual, step }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] AFTER updateGridSettings size called with:', step);
  };

  const handleGridColorChange = (color: string) => {
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] BEFORE updateGridSettings color:', { 
      color, 
      currentColor: gridSettings.visual.color,
      currentMajorGridColor: gridSettings.visual.majorGridColor,
      fullVisual: gridSettings.visual 
    });
    updateGridSettings({
      visual: { 
        ...gridSettings.visual, 
        color,
        majorGridColor: color, // Ενημερώνει και το majorGridColor που χρησιμοποιείται για το rendering
        axesColor: color // Ενημερώνει και το axesColor για τους άξονες
      }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] AFTER updateGridSettings color called with:', { 
      color, 
      majorGridColor: color, 
      axesColor: color 
    });
  };

  const handleGridOpacityChange = (opacity: number) => {
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] BEFORE updateGridSettings opacity:', { 
      opacity, 
      currentOpacity: gridSettings.visual.opacity,
      fullVisual: gridSettings.visual 
    });
    updateGridSettings({
      visual: { ...gridSettings.visual, opacity }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 [ColorPalettePanel] AFTER updateGridSettings opacity called with:', opacity);
  };

  // Ruler Settings Handlers (connected to real system)
  const handleRulersVisibilityChange = (enabled: boolean) => {
    setRulerVisibility('horizontal', enabled);
    setRulerVisibility('vertical', enabled);
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Rulers visibility changed:', enabled);
  };

  const handleBackgroundVisibilityChange = (visible: boolean) => {
    setBackgroundVisible(visible);
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showBackground: visible },
      vertical: { ...rulerSettings.vertical, showBackground: visible }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Background visibility changed:', visible);
  };

  const handleRulerUnitsChange = (units: 'mm' | 'cm' | 'm') => {
    updateRulerSettings({ units });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler units changed:', units);
  };

  const handleRulerUnitsEnabledChange = (enabled: boolean) => {
    setRulerUnitsEnabled(enabled);
    // Αλλάζουμε την εμφάνιση των γραμμών (ticks) του χάρακα
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler lines visibility changed:', enabled);
  };

  const handleUnitsVisibilityChange = (visible: boolean) => {
    setUnitsVisible(visible);
    // Control units visibility using showUnits property
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showUnits: visible },
      vertical: { ...rulerSettings.vertical, showUnits: visible }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Units visibility changed:', visible);
  };

  const handleTextVisibilityChange = (visible: boolean) => {
    setTextVisible(visible);
    // Control text visibility using showLabels property
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showLabels: visible },
      vertical: { ...rulerSettings.vertical, showLabels: visible }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Text visibility changed:', visible);
  };

  const handleRulerColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, color, textColor: color },
      vertical: { ...rulerSettings.vertical, color, textColor: color }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler color changed:', color);
  };

  const handleRulerTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, tickColor: color },
      vertical: { ...rulerSettings.vertical, tickColor: color }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler tick color changed:', color);
  };

  const handleRulerTextColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, textColor: color },
      vertical: { ...rulerSettings.vertical, textColor: color }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler text color changed:', color);
  };

  const handleRulerOpacityChange = (opacity: number) => {
    // Διατηρούμε το τρέχον χρώμα και αλλάζουμε μόνο την opacity
    const hex = rulerBackgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, backgroundColor },
      vertical: { ...rulerSettings.vertical, backgroundColor }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler opacity changed:', opacity, 'keeping color:', rulerBackgroundColor);
  };

  const handleRulerWidthChange = (width: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, height: width },
      vertical: { ...rulerSettings.vertical, width: width }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler width changed:', width);
  };

  const handleRulerThicknessChange = (thickness: number) => {
    const majorTickLength = thickness * 10;
    const minorTickLength = thickness * 5;
    updateRulerSettings({
      horizontal: { 
        ...rulerSettings.horizontal, 
        majorTickLength,
        minorTickLength 
      },
      vertical: { 
        ...rulerSettings.vertical, 
        majorTickLength,
        minorTickLength 
      }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler thickness changed:', thickness);
  };

  const handleRulerTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler ticks visibility changed:', enabled);
  };

  // NEW HANDLERS FOR MAJOR/MINOR TICKS SEPARATION
  const handleMajorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMajorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMajorTicks: enabled }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Major ticks visibility changed:', enabled);
  };

  const handleMinorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Minor ticks visibility changed:', enabled);
  };

  const handleMajorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickColor: color },
      vertical: { ...rulerSettings.vertical, majorTickColor: color }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Major tick color changed:', color);
  };

  const handleMinorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: color },
      vertical: { ...rulerSettings.vertical, minorTickColor: color }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Minor tick color changed:', color);
  };

  const handleMajorTickOpacityChange = (opacity: number) => {
    const majorTickColor = rulerSettings.horizontal.majorTickColor || '#00FF80';
    let r, g, b;
    
    if (majorTickColor.startsWith('rgba(')) {
      // Extract RGB from existing rgba
      const match = majorTickColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[^)]+\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        r = g = b = 102; // fallback to #00FF80
      }
    } else {
      // Convert hex to RGB
      const hex = majorTickColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    
    const newColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickColor: newColor },
      vertical: { ...rulerSettings.vertical, majorTickColor: newColor }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Major tick opacity changed:', opacity, newColor);
  };

  const handleMinorTickOpacityChange = (opacity: number) => {
    const minorTickColor = rulerSettings.horizontal.minorTickColor || '#00FF80';
    let r, g, b;
    
    if (minorTickColor.startsWith('rgba(')) {
      // Extract RGB from existing rgba
      const match = minorTickColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[^)]+\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        r = g = b = 153; // fallback to #00FF80
      }
    } else {
      // Convert hex to RGB
      const hex = minorTickColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    
    const newColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: newColor },
      vertical: { ...rulerSettings.vertical, minorTickColor: newColor }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Minor tick opacity changed:', opacity, newColor);
  };

  const handleMajorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, majorTickLength: thickness * 10 }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Major tick thickness changed:', thickness);
  };

  const handleMinorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, minorTickLength: thickness * 10 }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Minor tick thickness changed:', thickness);
  };

  const handleUnitsColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, unitsColor: color },
      vertical: { ...rulerSettings.vertical, unitsColor: color }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Units color changed:', color);
  };

  const handleRulerTicksOpacityChange = (opacity: number) => {
    // Για την opacity των γραμμών χρησιμοποιούμε το tickColor με alpha
    const tickColor = rulerSettings.horizontal.tickColor;
    const hex = tickColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const tickColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, tickColor: tickColorWithOpacity },
      vertical: { ...rulerSettings.vertical, tickColor: tickColorWithOpacity }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler ticks opacity changed:', opacity);
  };

  const handleRulerFontSizeChange = (fontSize: number) => {
    // Only change fontSize for numbers, keep unitsFontSize separate
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, fontSize },
      vertical: { ...rulerSettings.vertical, fontSize }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler font size changed (numbers only):', fontSize);
  };

  const handleRulerUnitsFontSizeChange = (unitsFontSize: number) => {
    // Only change unitsFontSize for units
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, unitsFontSize },
      vertical: { ...rulerSettings.vertical, unitsFontSize }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler units font size changed:', unitsFontSize);
  };

  const handleRulerBackgroundColorChange = (color: string) => {
    // Ενημέρωσε το local state αμέσως για συγχρονισμό με color picker
    setRulerBackgroundColor(color);
    
    // Διατηρούμε την opacity από το τρέχον backgroundColor
    const currentBg = rulerSettings.horizontal.backgroundColor;
    let opacity = 0.8; // default
    if (currentBg.includes('rgba')) {
      const match = currentBg.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
      if (match) opacity = parseFloat(match[1]);
    }
    
    // Μετατρέπουμε το hex color σε rgba με την τρέχουσα opacity
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, backgroundColor },
      vertical: { ...rulerSettings.vertical, backgroundColor }
    });
    if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Ruler background color changed:', color, 'rgba:', backgroundColor);
  };

  // Helper function to get color for preview icon (handles rgba)
  const getPreviewColor = (color: string): string => {
    if (color.includes('rgba')) {
      // Extract RGB values from rgba and convert to hex for color input compatibility
      const match = color.match(/rgba\(([^,]+),([^,]+),([^,]+),\s*[^)]+\)/);
      if (match) {
        const r = parseInt(match[1].trim());
        const g = parseInt(match[2].trim());
        const b = parseInt(match[3].trim());
        // Convert RGB to hex
        const toHex = (n: number) => {
          const hex = n.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }
    return color; // Return as-is if it's already hex or rgb
  };

  // Helper function to get preview background for divs (preserves rgba)
  const getPreviewBackground = (color: string): string => {
    // Keep rgba as-is for div background, but ensure it's visible against dark background
    return color;
  };

  // Render category content
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'cursor':
        return (
          <div className="p-4">
            {/* Sub-navigation tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
              <button
                onClick={() => setActiveCursorTab('crosshair')}
                className={`px-3 py-2 text-xs rounded-t transition-colors ${
                  activeCursorTab === 'crosshair'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                Ρυθμίσεις Σταυρονήματος
              </button>
              <button
                onClick={() => setActiveCursorTab('cursor')}
                className={`px-3 py-2 text-xs rounded-t transition-colors ${
                  activeCursorTab === 'cursor'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                Ρυθμίσεις Κέρσορα
              </button>
            </div>
            
            {/* Tab content */}
            {activeCursorTab === 'crosshair' ? (
              <div className="space-y-4">
              {/* Crosshair Color */}
              <div className="p-2 bg-gray-700 rounded space-y-2">
                <div className="text-sm text-white">
                  <div className="font-medium">Χρώμα</div>
                  <div className="font-normal text-gray-400">Χρώμα γραμμών σταυρώνυματος</div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border border-gray-500"
                    style={{ backgroundColor: cursorColors.crosshairColor }}
                  />
                  <input
                    type="color"
                    value={cursorColors.crosshairColor}
                    onChange={(e) => handleCursorColorsChange({ ...cursorColors, crosshairColor: e.target.value })}
                    className="w-8 h-6 rounded border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={cursorColors.crosshairColor}
                    onChange={(e) => handleCursorColorsChange({ ...cursorColors, crosshairColor: e.target.value })}
                    className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                  />
                </div>
              </div>

              {/* Line Style */}
              <div className="p-2 bg-gray-700 rounded space-y-2">
                <div className="text-sm text-white">
                  <div className="font-medium">Τύπος Γραμμής</div>
                  <div className="font-normal text-gray-400">Στυλ απόδοσης γραμμών</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Setting line_style to solid');
                      updateSettings({ crosshair: { ...settings.crosshair, line_style: 'solid' } });
                    }}
                    className={`p-2 rounded text-xs border transition-colors ${
                      (settings.crosshair.line_style || 'solid') === 'solid' 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div 
                      className="w-full"
                      style={{ 
                        height: `${settings.crosshair.line_width}px`,
                        backgroundColor: cursorColors.crosshairColor
                      }}
                    ></div>
                    <span className="block mt-1">Συνεχόμενη</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dashed' } })}
                    className={`p-2 rounded text-xs border transition-colors ${
                      (settings.crosshair.line_style || 'solid') === 'dashed' 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div 
                      className="w-full" 
                      style={{ 
                        height: `${settings.crosshair.line_width}px`,
                        background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 6}px, transparent ${settings.crosshair.line_width * 6}px, transparent ${settings.crosshair.line_width * 12}px)`
                      }}
                    ></div>
                    <span className="block mt-1">Διακεκομμένη</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dotted' } })}
                    className={`p-2 rounded text-xs border transition-colors ${
                      (settings.crosshair.line_style || 'solid') === 'dotted' 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div 
                      className="w-full" 
                      style={{ 
                        height: `${settings.crosshair.line_width}px`,
                        background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${settings.crosshair.line_width}px, transparent ${settings.crosshair.line_width}px, transparent ${settings.crosshair.line_width * 8}px)`
                      }}
                    ></div>
                    <span className="block mt-1">Τελείες</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dash-dot' } })}
                    className={`p-2 rounded text-xs border transition-colors ${
                      (settings.crosshair.line_style || 'solid') === 'dash-dot' 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div 
                      className="w-full" 
                      style={{ 
                        height: `${settings.crosshair.line_width}px`,
                        background: `repeating-linear-gradient(to right, ${cursorColors.crosshairColor} 0, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 8}px, transparent ${settings.crosshair.line_width * 8}px, transparent ${settings.crosshair.line_width * 12}px, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 12}px, ${cursorColors.crosshairColor} ${settings.crosshair.line_width * 14}px, transparent ${settings.crosshair.line_width * 14}px, transparent ${settings.crosshair.line_width * 22}px)`
                      }}
                    ></div>
                    <span className="block mt-1">Παύλα-Τελεία</span>
                  </button>
                </div>
              </div>

              {/* Line Width */}
              <div className="p-2 bg-gray-700 rounded space-y-2">
                <div className="text-sm text-white">
                  <div className="font-medium">Πάχος Γραμμής</div>
                  <div className="font-normal text-gray-400">Πάχος σε pixels</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={settings.crosshair.line_width}
                    onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, line_width: parseFloat(e.target.value) } })}
                    className="flex-1"
                  />
                  <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">{settings.crosshair.line_width}px</div>
                </div>
                <div className="flex gap-1">
                  {[1, 1.5, 2, 3, 4, 5].map(width => (
                    <button 
                      key={width} 
                      onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_width: width } })}
                      className={`flex-1 p-1 rounded text-xs transition-colors ${
                        settings.crosshair.line_width === width
                          ? 'bg-blue-600 border border-blue-500'
                          : 'bg-gray-600 hover:bg-blue-600 border border-gray-500'
                      }`}
                    >
                      <div 
                        className="w-full mx-auto" 
                        style={{ 
                          height: `${width}px`,
                          backgroundColor: cursorColors.crosshairColor
                        }}
                      ></div>
                      <span className="block mt-1 text-xs">{width}px</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Size/Type */}
              <div className="p-2 bg-gray-700 rounded space-y-2">
                <div className="text-sm text-white">
                  <div className="font-medium">Μέγεθος Σταυρονήματος</div>
                  <div className="font-normal text-gray-400">Επέκταση από το κέντρο</div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <button 
                    onClick={() => {
                      if (DEBUG_COLOR_PALETTE_PANEL) console.log('🔧 Setting size_percent to 0 (center only)');
                      if (DEBUG_COLOR_PALETTE_PANEL) console.log('Current size_percent:', settings.crosshair.size_percent);
                      updateSettings({ crosshair: { ...settings.crosshair, size_percent: 0 } });
                    }}
                    className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                      (settings.crosshair.size_percent ?? 8) === 0
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div 
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: cursorColors.crosshairColor }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1">0%</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 5 } })}
                    className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                      (settings.crosshair.size_percent ?? 8) === 5
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center relative">
                      {/* Οριζόντια γραμμή */}
                      <div 
                        className="absolute top-1/2 left-1/2 w-3 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          height: '1px'
                        }}
                      ></div>
                      {/* Κάθετη γραμμή */}
                      <div 
                        className="absolute top-1/2 left-1/2 h-3 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          width: '1px'
                        }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1">5%</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 8 } })}
                    className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                      (settings.crosshair.size_percent ?? 8) === 8
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center relative">
                      {/* Οριζόντια γραμμή */}
                      <div 
                        className="absolute top-1/2 left-1/2 w-4 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          height: '1px'
                        }}
                      ></div>
                      {/* Κάθετη γραμμή */}
                      <div 
                        className="absolute top-1/2 left-1/2 h-4 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          width: '1px'
                        }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1">8%</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 15 } })}
                    className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                      (settings.crosshair.size_percent ?? 8) === 15
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center relative">
                      {/* Οριζόντια γραμμή */}
                      <div 
                        className="absolute top-1/2 left-1/2 w-5 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          height: '1px'
                        }}
                      ></div>
                      {/* Κάθετη γραμμή */}
                      <div 
                        className="absolute top-1/2 left-1/2 h-5 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          width: '1px'
                        }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1">15%</span>
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 100 } })}
                    className={`p-2 rounded text-xs border transition-colors relative flex flex-col items-center ${
                      (settings.crosshair.size_percent ?? 8) === 100
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center relative">
                      {/* Εξωτερικό πλαίσιο */}
                      <div 
                        className="absolute inset-0 border"
                        style={{ borderColor: cursorColors.crosshairColor }}
                      ></div>
                      {/* Οριζόντια γραμμή που φτάνει τα άκρα του πλαισίου */}
                      <div 
                        className="absolute top-1/2 left-0 w-full transform -translate-y-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          height: '1px'
                        }}
                      ></div>
                      {/* Κάθετη γραμμή που φτάνει τα άκρα του πλαισίου */}
                      <div 
                        className="absolute left-1/2 top-0 h-full transform -translate-x-1/2"
                        style={{ 
                          backgroundColor: cursorColors.crosshairColor,
                          width: '1px'
                        }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1">Full</span>
                  </button>
                </div>
              </div>

              {/* Crosshair Opacity */}
              <div className="p-2 bg-gray-700 rounded space-y-2">
                <div className="text-sm text-white">
                  <div className="font-medium">Διαφάνεια Σταυρονήματος</div>
                  <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του σταυρονήματος</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.crosshair.opacity || 0.9}
                    onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, opacity: parseFloat(e.target.value) } })}
                    className="flex-1"
                  />
                  <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                    {Math.round((settings.crosshair.opacity || 0.9) * 100)}%
                  </div>
                </div>
              </div>

              {/* Cursor Gap Toggle */}
              <div className="p-2 bg-gray-700 rounded space-y-2">
                <div className="text-sm text-white">
                  <div className="font-medium">Cursor Gap</div>
                  <div className="font-normal text-gray-400">Οι γραμμές ξεκινάνε έξω από τον κέρσορα</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, use_cursor_gap: false } })}
                    className={`flex-1 p-2 rounded text-xs border transition-colors ${
                      !settings.crosshair.use_cursor_gap 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    Ανενεργό
                  </button>
                  <button 
                    onClick={() => updateSettings({ crosshair: { ...settings.crosshair, use_cursor_gap: true } })}
                    className={`flex-1 p-2 rounded text-xs border transition-colors ${
                      settings.crosshair.use_cursor_gap 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    Ενεργό
                  </button>
                </div>
              </div>
              </div>
            ) : (
              // Cursor Settings Tab - Using CursorSettings component
              <CursorSettings />
            )}
          </div>
        );
      
      case 'selection':
        return <SelectionSettings />;

      case 'grid':
        return (
          <div className="p-4">
            {/* Sub-navigation tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
              <button
                onClick={() => setActiveGridTab('grid')}
                className={`px-3 py-2 text-xs rounded-t transition-colors ${
                  activeGridTab === 'grid'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                📋 Πλέγμα (Grid)
              </button>
              <button
                onClick={() => setActiveGridTab('rulers')}
                className={`px-3 py-2 text-xs rounded-t transition-colors ${
                  activeGridTab === 'rulers'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                📏 Χάρακες (Rulers)
              </button>
            </div>
            
            {/* Tab Content */}
            {activeGridTab === 'grid' ? (
              <div className="space-y-4">
                {/* Grid Visibility Toggle */}
                <div className="p-2 bg-gray-700 rounded space-y-2">
                  <div className="text-sm text-white">
                    <div className="font-medium">Εμφάνιση Πλέγματος</div>
                    <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη του πλέγματος</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleGridVisibilityChange(true)}
                      className={`flex-1 p-2 rounded text-xs border transition-colors ${
                        gridSettings.visual.enabled 
                          ? 'bg-blue-600 border-blue-500' 
                          : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                      }`}
                    >
                      Ενεργό
                    </button>
                    <button 
                      onClick={() => handleGridVisibilityChange(false)}
                      className={`flex-1 p-2 rounded text-xs border transition-colors ${
                        !gridSettings.visual.enabled 
                          ? 'bg-blue-600 border-blue-500' 
                          : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                      }`}
                    >
                      Ανενεργό
                    </button>
                  </div>
                </div>

                {/* Grid Size */}
                <div className="p-2 bg-gray-700 rounded space-y-2">
                  <div className="text-sm text-white">
                    <div className="font-medium">Μέγεθος Πλέγματος</div>
                    <div className="font-normal text-gray-400">Απόσταση μεταξύ γραμμών πλέγματος</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.5"
                      max="50"
                      step="0.5"
                      value={gridSettings.visual.step}
                      onChange={(e) => handleGridSizeChange(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                      {gridSettings.visual.step}
                    </div>
                  </div>
                </div>

                {/* Grid Color */}
                <div className="p-2 bg-gray-700 rounded space-y-2">
                  <div className="text-sm text-white">
                    <div className="font-medium">Χρώμα Πλέγματος</div>
                    <div className="font-normal text-gray-400">Χρώμα γραμμών πλέγματος</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border border-gray-500"
                      style={{ backgroundColor: gridSettings.visual.color }}
                    />
                    <input
                      type="color"
                      value={gridSettings.visual.color}
                      onChange={(e) => handleGridColorChange(e.target.value)}
                      className="w-8 h-6 rounded border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={gridSettings.visual.color}
                      onChange={(e) => handleGridColorChange(e.target.value)}
                      className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                      placeholder="#00FF80"
                    />
                  </div>
                </div>

                {/* Grid Opacity */}
                <div className="p-2 bg-gray-700 rounded space-y-2">
                  <div className="text-sm text-white">
                    <div className="font-medium">Διαφάνεια Πλέγματος</div>
                    <div className="font-normal text-gray-400">Επίπεδο διαφάνειας του πλέγματος</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={gridSettings.visual.opacity}
                      onChange={(e) => handleGridOpacityChange(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                      {Math.round(gridSettings.visual.opacity * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Rulers Settings Tab
              <div className="space-y-4">
                {/* Ruler Sub-tabs */}
                <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
                  <button
                    onClick={() => setActiveRulerTab('background')}
                    className={`px-3 py-2 text-xs rounded-t transition-colors ${
                      activeRulerTab === 'background'
                        ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    📦 Φόντο
                  </button>
                  <button
                    onClick={() => setActiveRulerTab('lines')}
                    className={`px-3 py-2 text-xs rounded-t transition-colors ${
                      activeRulerTab === 'lines'
                        ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    📏 Γραμμές
                  </button>
                  <button
                    onClick={() => setActiveRulerTab('text')}
                    className={`px-3 py-2 text-xs rounded-t transition-colors ${
                      activeRulerTab === 'text'
                        ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    📝 Κείμενα
                  </button>
                  <button
                    onClick={() => setActiveRulerTab('units')}
                    className={`px-3 py-2 text-xs rounded-t transition-colors ${
                      activeRulerTab === 'units'
                        ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    📐 Μονάδες
                  </button>
                </div>
                
                {/* Common Settings (always visible) */}
                <div className="space-y-4 mb-4">
                  {/* No common settings for now */}
                </div>

                {/* Tab Content */}
                {activeRulerTab === 'background' ? (
                  <div className="space-y-4">
                    {/* Background Visibility Toggle */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Εμφάνιση Φόντου</div>
                        <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη του φόντου των χαράκων</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleBackgroundVisibilityChange(true)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            backgroundVisible
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ενεργό
                        </button>
                        <button 
                          onClick={() => handleBackgroundVisibilityChange(false)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            !backgroundVisible
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ανενεργό
                        </button>
                      </div>
                    </div>

                    {/* Ruler Background Color */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Χρώμα Φόντου</div>
                        <div className="font-normal text-gray-400">Χρώμα φόντου του χάρακα</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border border-gray-500"
                          style={{ backgroundColor: rulerBackgroundColor }}
                        />
                        <input
                          type="color"
                          value={rulerBackgroundColor}
                          onChange={(e) => handleRulerBackgroundColorChange(e.target.value)}
                          className="w-8 h-6 rounded border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={rulerBackgroundColor}
                          onChange={(e) => handleRulerBackgroundColorChange(e.target.value)}
                          className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>

                    {/* Ruler Opacity */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Διαφάνεια</div>
                        <div className="font-normal text-gray-400">Επίπεδο διαφάνειας των χαράκων</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={(() => {
                            const bgColor = rulerSettings.horizontal.backgroundColor;
                            if (bgColor.includes('rgba')) {
                              const match = bgColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                              return match ? parseFloat(match[1]) : 0.8;
                            }
                            return 0.8;
                          })()}
                          onChange={(e) => handleRulerOpacityChange(parseFloat(e.target.value))}
                          className="flex-1"
                        />
                        <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                          {Math.round(((() => {
                            const bgColor = rulerSettings.horizontal.backgroundColor;
                            if (bgColor.includes('rgba')) {
                              const match = bgColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                              return match ? parseFloat(match[1]) : 0.8;
                            }
                            return 0.8;
                          })()) * 100)}%
                        </div>
                      </div>
                    </div>

                    {/* Ruler Width */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Πλάτος Χάρακα</div>
                        <div className="font-normal text-gray-400">Πλάτος του χάρακα σε pixels</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="20"
                          max="60"
                          step="5"
                          value={rulerSettings.horizontal.height}
                          onChange={(e) => handleRulerWidthChange(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                          {rulerSettings.horizontal.height}px
                        </div>
                      </div>
                    </div>

                    {/* Ruler Lines Visibility Toggle */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Εμφάνιση Γραμμών</div>
                        <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη γραμμών μέτρησης στους χάρακες</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRulerUnitsEnabledChange(true)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            rulerSettings.horizontal.showMinorTicks
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ενεργό
                        </button>
                        <button 
                          onClick={() => handleRulerUnitsEnabledChange(false)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            !rulerSettings.horizontal.showMinorTicks
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ανενεργό
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeRulerTab === 'lines' ? (
                  <div className="space-y-4">
                    {/* Lines Sub-tabs */}
                    <div className="flex gap-1 p-1 bg-gray-800 rounded">
                      <button
                        onClick={() => setActiveLinesTab('major')}
                        className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                          activeLinesTab === 'major'
                            ? 'bg-orange-600 text-white border-b-2 border-orange-400'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        }`}
                      >
                        📏 Κύριες Γραμμές
                      </button>
                      <button
                        onClick={() => setActiveLinesTab('minor')}
                        className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                          activeLinesTab === 'minor'
                            ? 'bg-orange-600 text-white border-b-2 border-orange-400'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        }`}
                      >
                        📐 Δευτερεύουσες Γραμμές
                      </button>
                    </div>

                    {/* Lines Content */}
                    {activeLinesTab === 'major' ? (
                      <div className="space-y-4">
                        {/* Major Lines Visibility Toggle */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Εμφάνιση Κύριων Γραμμών</div>
                            <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη των κύριων γραμμών χάρακα</div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleMajorTicksVisibilityChange(true)}
                              className={`flex-1 p-2 rounded text-xs border transition-colors ${
                                rulerSettings.horizontal.showMajorTicks
                                  ? 'bg-blue-600 border-blue-500' 
                                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                              }`}
                            >
                              Ενεργό
                            </button>
                            <button 
                              onClick={() => handleMajorTicksVisibilityChange(false)}
                              className={`flex-1 p-2 rounded text-xs border transition-colors ${
                                !rulerSettings.horizontal.showMajorTicks
                                  ? 'bg-blue-600 border-blue-500' 
                                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                              }`}
                            >
                              Ανενεργό
                            </button>
                          </div>
                        </div>

                        {/* Major Lines Opacity */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Διαφάνεια Κύριων Γραμμών</div>
                            <div className="font-normal text-gray-400">Επίπεδο διαφάνειας των κύριων γραμμών χάρακα</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.1"
                              value={(() => {
                                const tickColor = rulerSettings.horizontal.majorTickColor;
                                if (tickColor.includes('rgba')) {
                                  const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                                  return match ? parseFloat(match[1]) : 1.0;
                                }
                                return 1.0;
                              })()}
                              onChange={(e) => handleMajorTickOpacityChange(parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                              {Math.round(((() => {
                                const tickColor = rulerSettings.horizontal.majorTickColor;
                                if (tickColor.includes('rgba')) {
                                  const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                                  return match ? parseFloat(match[1]) : 1.0;
                                }
                                return 1.0;
                              })()) * 100)}%
                            </div>
                          </div>
                        </div>

                        {/* Major Lines Color */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Χρώμα Κύριων Γραμμών</div>
                            <div className="font-normal text-gray-400">Χρώμα κύριων γραμμών (ticks) χαράκων</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded border-2"
                              style={{ 
                                backgroundColor: getPreviewBackground(rulerSettings.horizontal.majorTickColor),
                                borderColor: getPreviewColor(rulerSettings.horizontal.majorTickColor)
                              }}
                            />
                            <input
                              type="color"
                              value={getPreviewColor(rulerSettings.horizontal.majorTickColor)}
                              onChange={(e) => handleMajorTickColorChange(e.target.value)}
                              className="w-8 h-6 rounded border-0 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={rulerSettings.horizontal.majorTickColor}
                              onChange={(e) => handleMajorTickColorChange(e.target.value)}
                              className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                              placeholder="#00FF80"
                            />
                          </div>
                        </div>

                        {/* Major Lines Thickness */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Πάχος Κύριων Γραμμών</div>
                            <div className="font-normal text-gray-400">Πάχος των κύριων γραμμών του χάρακα</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="3"
                              step="0.5"
                              value={rulerSettings.horizontal.majorTickLength / 10}
                              onChange={(e) => handleMajorTickThicknessChange(parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                              {rulerSettings.horizontal.majorTickLength / 10}px
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Minor Lines Visibility Toggle */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Εμφάνιση Δευτερευουσών Γραμμών</div>
                            <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη των δευτερευουσών γραμμών χάρακα</div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleMinorTicksVisibilityChange(true)}
                              className={`flex-1 p-2 rounded text-xs border transition-colors ${
                                rulerSettings.horizontal.showMinorTicks
                                  ? 'bg-blue-600 border-blue-500' 
                                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                              }`}
                            >
                              Ενεργό
                            </button>
                            <button 
                              onClick={() => handleMinorTicksVisibilityChange(false)}
                              className={`flex-1 p-2 rounded text-xs border transition-colors ${
                                !rulerSettings.horizontal.showMinorTicks
                                  ? 'bg-blue-600 border-blue-500' 
                                  : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                              }`}
                            >
                              Ανενεργό
                            </button>
                          </div>
                        </div>

                        {/* Minor Lines Opacity */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Διαφάνεια Δευτερευουσών Γραμμών</div>
                            <div className="font-normal text-gray-400">Επίπεδο διαφάνειας των δευτερευουσών γραμμών χάρακα</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.1"
                              value={(() => {
                                const tickColor = rulerSettings.horizontal.minorTickColor;
                                if (tickColor.includes('rgba')) {
                                  const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                                  return match ? parseFloat(match[1]) : 1.0;
                                }
                                return 1.0;
                              })()}
                              onChange={(e) => handleMinorTickOpacityChange(parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                              {Math.round(((() => {
                                const tickColor = rulerSettings.horizontal.minorTickColor;
                                if (tickColor.includes('rgba')) {
                                  const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                                  return match ? parseFloat(match[1]) : 1.0;
                                }
                                return 1.0;
                              })()) * 100)}%
                            </div>
                          </div>
                        </div>

                        {/* Minor Lines Color */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Χρώμα Δευτερευουσών Γραμμών</div>
                            <div className="font-normal text-gray-400">Χρώμα δευτερευουσών γραμμών (ticks) χαράκων</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded border-2"
                              style={{ 
                                backgroundColor: getPreviewBackground(rulerSettings.horizontal.minorTickColor),
                                borderColor: getPreviewColor(rulerSettings.horizontal.minorTickColor)
                              }}
                            />
                            <input
                              type="color"
                              value={getPreviewColor(rulerSettings.horizontal.minorTickColor)}
                              onChange={(e) => handleMinorTickColorChange(e.target.value)}
                              className="w-8 h-6 rounded border-0 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={rulerSettings.horizontal.minorTickColor}
                              onChange={(e) => handleMinorTickColorChange(e.target.value)}
                              className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                              placeholder="#00FF80"
                            />
                          </div>
                        </div>

                        {/* Minor Lines Thickness */}
                        <div className="p-2 bg-gray-700 rounded space-y-2">
                          <div className="text-sm text-white">
                            <div className="font-medium">Πάχος Δευτερευουσών Γραμμών</div>
                            <div className="font-normal text-gray-400">Πάχος των δευτερευουσών γραμμών του χάρακα</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="3"
                              step="0.5"
                              value={rulerSettings.horizontal.minorTickLength / 10}
                              onChange={(e) => handleMinorTickThicknessChange(parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                              {rulerSettings.horizontal.minorTickLength / 10}px
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeRulerTab === 'text' ? (
                  <div className="space-y-4">
                    {/* Ruler Text Color */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Χρώμα Κειμένων</div>
                        <div className="font-normal text-gray-400">Χρώμα αριθμών και κειμένων χαράκων</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border border-gray-500"
                          style={{ backgroundColor: rulerSettings.horizontal.textColor }}
                        />
                        <input
                          type="color"
                          value={rulerSettings.horizontal.textColor}
                          onChange={(e) => handleRulerTextColorChange(e.target.value)}
                          className="w-8 h-6 rounded border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={rulerSettings.horizontal.textColor}
                          onChange={(e) => handleRulerTextColorChange(e.target.value)}
                          className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="#00FF80"
                        />
                      </div>
                    </div>

                    {/* Font Size */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Μέγεθος Κειμένου</div>
                        <div className="font-normal text-gray-400">Μέγεθος των αριθμών στους χάρακες</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="8"
                          max="25"
                          step="1"
                          value={rulerSettings.horizontal.fontSize}
                          onChange={(e) => handleRulerFontSizeChange(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                          {rulerSettings.horizontal.fontSize}px
                        </div>
                      </div>
                    </div>

                    {/* Text Visibility Toggle */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Εμφάνιση Κειμένων</div>
                        <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη αριθμών και κειμένων στους χάρακες</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleTextVisibilityChange(true)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            textVisible
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ενεργό
                        </button>
                        <button 
                          onClick={() => handleTextVisibilityChange(false)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            !textVisible
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ανενεργό
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeRulerTab === 'units' ? (
                  <div className="space-y-4">
                    {/* Ruler Units */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Μονάδες Μέτρησης</div>
                        <div className="font-normal text-gray-400">Μονάδα μέτρησης στους χάρακες</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['mm', 'cm', 'm'] as const).map((unit) => (
                          <button 
                            key={unit}
                            onClick={() => handleRulerUnitsChange(unit)}
                            className={`p-2 rounded text-xs border transition-colors ${
                              rulerSettings.units === unit
                                ? 'bg-blue-600 border-blue-500' 
                                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                            }`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Units Visibility Toggle */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Εμφάνιση Μονάδων</div>
                        <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη μονάδων μέτρησης στους χάρακες</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleUnitsVisibilityChange(true)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            unitsVisible
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ενεργό
                        </button>
                        <button 
                          onClick={() => handleUnitsVisibilityChange(false)}
                          className={`flex-1 p-2 rounded text-xs border transition-colors ${
                            !unitsVisible
                              ? 'bg-blue-600 border-blue-500' 
                              : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                          }`}
                        >
                          Ανενεργό
                        </button>
                      </div>
                    </div>

                    {/* Units Font Size */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Μέγεθος Μονάδων</div>
                        <div className="font-normal text-gray-400">Μέγεθος των μονάδων μέτρησης στους χάρακες</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="8"
                          max="25"
                          step="1"
                          value={rulerSettings.horizontal.unitsFontSize || 10}
                          onChange={(e) => handleRulerUnitsFontSizeChange(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                          {rulerSettings.horizontal.unitsFontSize || 10}px
                        </div>
                      </div>
                    </div>

                    {/* Units Color */}
                    <div className="p-2 bg-gray-700 rounded space-y-2">
                      <div className="text-sm text-white">
                        <div className="font-medium">Χρώμα Μονάδων</div>
                        <div className="font-normal text-gray-400">Χρώμα των μονάδων μέτρησης στους χάρακες</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border-2"
                          style={{ 
                            backgroundColor: getPreviewBackground(rulerSettings.horizontal.unitsColor || rulerSettings.horizontal.textColor || '#00FF80'),
                            borderColor: getPreviewColor(rulerSettings.horizontal.unitsColor || rulerSettings.horizontal.textColor || '#00FF80')
                          }}
                        />
                        <input
                          type="color"
                          value={getPreviewColor(rulerSettings.horizontal.unitsColor || rulerSettings.horizontal.textColor || '#00FF80')}
                          onChange={(e) => handleUnitsColorChange(e.target.value)}
                          className="w-8 h-6 rounded border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={rulerSettings.horizontal.unitsColor || rulerSettings.horizontal.textColor || '#00FF80'}
                          onChange={(e) => handleUnitsColorChange(e.target.value)}
                          className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                          placeholder="#00FF80"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
        
      case 'entities':
        return <EntitiesSettings />;

      case 'layers':
        return <LayersSettings />;

      default:
        return <ComingSoonSettings />;
    }
  };

  return (
    <div className={`bg-gray-800 text-white ${className}`}>

      {/* Main Tabs - General/Specific */}
      <div className="border-b border-gray-600 mb-4">
        <nav className="flex gap-1 p-2">
          <button
            onClick={() => setActiveMainTab('general')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeMainTab === 'general'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Γενικές Ρυθμίσεις
          </button>
          <button
            onClick={() => setActiveMainTab('specific')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeMainTab === 'specific'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Ειδικές Ρυθμίσεις
          </button>
        </nav>
      </div>

      {/* Content based on active main tab */}
      {activeMainTab === 'general' && (
        <div className="min-h-[850px] max-h-[96vh] overflow-y-auto">
          {/* Preview and Current Settings Display */}
          <div className="px-4 mb-6 space-y-4">
            {/* Line Preview Canvas */}
            <LinePreview
              lineSettings={lineSettings.settings}
              textSettings={textSettings.settings}
              gripSettings={gripSettings}
            />

            {/* Current Settings Display */}
            <CurrentSettingsDisplay
              activeTab={activeGeneralTab}
              lineSettings={lineSettings.settings}
              textSettings={textSettings.settings}
              gripSettings={{
                showGrips: gripSettings.showGrips,
                gripSize: gripSettings.gripSize,
                gripShape: 'square' as const,
                showFill: true,
                colors: gripSettings.colors
              }}
            />
          </div>

          {/* General Settings Sub-tabs Navigation */}
          <div className="border-b border-gray-600 mb-4">
            <nav className="flex gap-1 px-2 pb-2">
              <button
                onClick={() => setActiveGeneralTab('lines')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeGeneralTab === 'lines'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Γραμμές
              </button>
              <button
                onClick={() => setActiveGeneralTab('text')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeGeneralTab === 'text'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Κείμενο
              </button>
              <button
                onClick={() => setActiveGeneralTab('grips')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeGeneralTab === 'grips'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Grips
              </button>
            </nav>
          </div>

          {/* General Settings Content based on active sub-tab */}
          <div className="px-4">
            {activeGeneralTab === 'lines' && (
              <LineSettings />
            )}

            {activeGeneralTab === 'text' && (
              <TextSettings />
            )}

            {activeGeneralTab === 'grips' && (
              <GripSettings />
            )}
          </div>
        </div>
      )}

      {activeMainTab === 'specific' && (
        <div>
          {/* Category Navigation - Icon Only */}
          <nav className="flex gap-1 mb-4 p-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                disabled={category.comingSoon}
                title={category.title}
                className={`h-8 w-8 p-0 rounded-md border transition-colors duration-150 flex items-center justify-center relative ${
                  activeCategory === category.id
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                    : category.comingSoon
                    ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500'
                }`}
              >
                {category.icon}
                {category.comingSoon && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full"></div>
                )}
              </button>
            ))}
          </nav>

          {/* Active Category Content */}
          <div className="min-h-[300px]">
            {renderCategoryContent()}
          </div>
        </div>
      )}

    </div>
  );
}