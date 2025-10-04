# Layering System - Πλήρης Κώδικας

Αυτό το αρχείο περιέχει όλους τους κώδικες που συμμετέχουν στη δημιουργία και διαχείριση των layers στο DXF Viewer.

## 1. OverlayToolbar.tsx - Κεντρική UI Εργαλειοθήκη

```typescript
/**
 * Overlay Toolbar Component
 * Εργαλειοθήκη για τη διαχείριση overlay layers με mode selection και status colors
 */

import React, { useState, useCallback } from 'react';
import { Palette, Edit3, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toolStyleStore } from '../stores/ToolStyleStore';
import type { PropertyStatus } from '../overlays/types';

export type OverlayMode = 'select' | 'draw';

interface OverlayToolbarProps {
  mode: OverlayMode;
  onModeChange: (mode: OverlayMode) => void;
  currentStatus?: PropertyStatus;
  onStatusChange?: (status: PropertyStatus) => void;
  onToolChange?: (tool: string) => void;
}

// Χρώματα για κάθε κατάσταση ακινήτου
export const BUTTON_STATUS_COLORS: Record<PropertyStatus, string> = {
  'for-sale': '#22c55e',      // Πράσινο - Προς Πώληση
  'sold': '#ef4444',          // Κόκκινο - Πωλήθηκε
  'reserved': '#f59e0b',      // Πορτοκαλί - Δεσμεύθηκε
  'available': '#3b82f6',     // Μπλε - Διαθέσιμο
  'unavailable': '#6b7280',   // Γκρι - Μη Διαθέσιμο
};

export function OverlayToolbar({ 
  mode, 
  onModeChange, 
  currentStatus = 'for-sale',
  onStatusChange,
  onToolChange 
}: OverlayToolbarProps) {
  const [selectedStatus, setSelectedStatus] = useState<PropertyStatus>(currentStatus);

  const handleModeChange = useCallback((newMode: OverlayMode) => {
    console.log('🎯 [OverlayToolbar] Mode change:', mode, '->', newMode);
    
    if (newMode === 'draw') {
      // ΔΙΟΡΘΩΣΗ: Κλήση onModeChange πρώτη για να διατηρηθεί η εργαλειοθήκη ορατή
      onModeChange(newMode);
      
      // Ενεργοποιούμε το polyline tool
      onToolChange?.('polyline');
      
      // Επικυρώνουμε το status και φτιάχνουμε το style
      const validStatus = Object.keys(BUTTON_STATUS_COLORS).includes(currentStatus as string) 
        ? currentStatus as PropertyStatus 
        : 'for-sale';
      
      const statusColor = BUTTON_STATUS_COLORS[validStatus];
      console.log('🎯 [OverlayToolbar] Setting tool style with status:', validStatus, 'color:', statusColor);
      
      // Φτιάχνουμε το style για overlay drawing
      const toolStyle = {
        strokeColor: '#22c55e',        // Πράσινη περιμετρική γραμμή
        fillColor: statusColor + '80',  // Χρώμα status με διαφάνεια
        lineWidth: 2,
        opacity: 1
      };
      
      // Αποθηκεύουμε το style στο ToolStyleStore
      toolStyleStore.set(toolStyle);
    } else {
      onModeChange(newMode);
    }
  }, [mode, onModeChange, onToolChange, currentStatus]);

  const handleStatusClick = useCallback((status: PropertyStatus) => {
    console.log('🎯 [OverlayToolbar] Status clicked:', status);
    setSelectedStatus(status);
    onStatusChange?.(status);
    
    // Αν είμαστε σε draw mode, ενημερώνουμε αμέσως το style
    if (mode === 'draw') {
      const statusColor = BUTTON_STATUS_COLORS[status];
      const toolStyle = {
        strokeColor: '#22c55e',
        fillColor: statusColor + '80',
        lineWidth: 2,
        opacity: 1
      };
      toolStyleStore.set(toolStyle);
    }
  }, [mode, onStatusChange]);

  return (
    <div className="flex flex-col gap-2 p-2 bg-white border rounded-lg shadow-sm">
      {/* Mode Selection */}
      <div className="flex gap-1">
        <Button
          variant={mode === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleModeChange('select')}
          className="flex items-center gap-1 px-2 py-1 h-7"
        >
          <Hand size={14} />
          <span className="text-xs">Επιλογή</span>
        </Button>
        <Button
          variant={mode === 'draw' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleModeChange('draw')}
          className="flex items-center gap-1 px-2 py-1 h-7"
        >
          <Edit3 size={14} />
          <span className="text-xs">Σχεδίαση</span>
        </Button>
      </div>

      {/* Status Colors */}
      <div className="grid grid-cols-3 gap-1">
        {(Object.entries(BUTTON_STATUS_COLORS) as [PropertyStatus, string][]).map(([status, color]) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            onClick={() => handleStatusClick(status)}
            className={cn(
              "h-6 px-1 text-xs border-2 hover:scale-105 transition-transform",
              selectedStatus === status && "ring-2 ring-blue-400"
            )}
            style={{ 
              backgroundColor: color + '40',
              borderColor: color,
              color: '#000'
            }}
          >
            {getStatusLabel(status)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function getStatusLabel(status: PropertyStatus): string {
  const labels: Record<PropertyStatus, string> = {
    'for-sale': 'Πώληση',
    'sold': 'Πωλήθηκε',
    'reserved': 'Δεσμεύθηκε',
    'available': 'Διαθέσιμο',
    'unavailable': 'Μη Διαθ.'
  };
  return labels[status];
}
```

## 2. useUnifiedDrawing.ts - Κεντρικό Hook Σχεδίασης

```typescript
/**
 * useUnifiedDrawing Hook - ΜΕ SNAP INTEGRATION (FIXED)
 * Unified system που συνδυάζει entity creation με measurement-style interaction
 * FIXED: Χρήση σωστής level manager function και διαδοχική σχεδίαση
 */

import { useState, useCallback, useRef } from 'react';
import type { AnySceneEntity, Point2D, LineEntity, CircleEntity, PolylineEntity, RectangleEntity, AngleMeasurementEntity } from '../../types/scene';
import { useLevels } from '../../systems/levels';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { calculateDistance } from '../../utils/renderers/shared/geometry-rendering-utils';

export type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'circle-diameter' | 'circle-2p-diameter' | 'polyline' | 'polygon' | 'measure-distance' | 'measure-area' | 'measure-angle';

export interface DrawingState {
  currentTool: DrawingTool;
  isDrawing: boolean;
  previewEntity: AnySceneEntity | null;
  tempPoints: Point2D[];
  measurementId?: string;
  isOverlayMode?: boolean; // 🎯 ΝΕΟ: Flag για overlay mode
}

export function useUnifiedDrawing() {
  const snapContext = useSnapContext();
  
  const [state, setState] = useState<DrawingState>({
    currentTool: 'select',
    isDrawing: false,
    previewEntity: null,
    tempPoints: []
  });

  const { 
    currentLevelId, 
    getLevelScene, 
    setLevelScene 
  } = useLevels();

  const nextEntityIdRef = useRef(1);

  const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]): AnySceneEntity | null => {
    const id = `entity_${nextEntityIdRef.current++}`;
    
    switch (tool) {
      case 'polygon':
        if (points.length >= 2) {
          return {
            id,
            type: 'polyline',
            vertices: [...points],
            closed: true,
            visible: true,
            layer: '0',
          } as PolylineEntity;
        }
        break;
      case 'polyline':
        if (points.length >= 2) {
          return {
            id,
            type: 'polyline',
            vertices: [...points],
            closed: false,
            visible: true,
            layer: '0',
          } as PolylineEntity;
        }
        break;
      // Άλλα εργαλεία...
    }
    return null;
  }, []);

  const addPoint = useCallback((worldPoint: Point2D, transform: any) => {
    console.log('🔴 [useUnifiedDrawing] addPoint called with:', worldPoint, 'isDrawing:', state.isDrawing);
    if (!state.isDrawing) {
      console.log('🚫 [useUnifiedDrawing] Not in drawing mode, ignoring point');
      return;
    }

    const snappedPoint = worldPoint;
    const newTempPoints = [...state.tempPoints, snappedPoint];

    const isComplete = (tool: DrawingTool, points: Point2D[]) => {
      switch (tool) {
        case 'polyline':
        case 'polygon':
          return false; // Αυτά τα εργαλεία συνεχίζουν μέχρι να τελειώσουν χειροκίνητα
        default:
          return false;
      }
    };

    if (isComplete(state.currentTool, newTempPoints)) {
      const newEntity = createEntityFromTool(state.currentTool, newTempPoints);
      if (newEntity && currentLevelId) {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
          setLevelScene(currentLevelId, updatedScene);
        }
      }
      setState(prev => ({
        ...prev,
        tempPoints: [],
        previewEntity: null
      }));
    } else {
      setState(prev => ({
        ...prev,
        tempPoints: newTempPoints,
        previewEntity: null
      }));
    }
  }, [state, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene]);

  const updatePreview = useCallback((mousePoint: Point2D, transform: any) => {
    if (!state.isDrawing) return;
    console.log('🎯 [useUnifiedDrawing] updatePreview called for tool:', state.currentTool, 'with points:', state.tempPoints.length);

    const snappedPoint = mousePoint;
    const worldPoints = [...state.tempPoints, snappedPoint];
    const previewEntity = createEntityFromTool(state.currentTool, worldPoints);
    
    // Σημάνουμε το preview entity για ειδική απεικόνιση
    if (previewEntity) {
      (previewEntity as any).preview = true;
      (previewEntity as any).showEdgeDistances = true;
      
      // 🎯 ΚΛΕΙΔΙ: Σημαία για overlay detection στο PhaseManager
      (previewEntity as any).isOverlayPreview = state.isOverlayMode === true;
    }

    setState(prev => ({ ...prev, previewEntity }));
  }, [state, createEntityFromTool]);

  const startDrawing = useCallback((tool: DrawingTool) => {
    console.log('🎨 [useUnifiedDrawing] startDrawing called with:', tool);
    setState(prev => ({
      ...prev,
      currentTool: tool,
      isDrawing: true,
      tempPoints: [],
      previewEntity: null
    }));
  }, []);

  const cancelDrawing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDrawing: false,
      tempPoints: [],
      previewEntity: null
    }));
  }, []);

  const finishPolyline = useCallback(() => {
    if ((state.currentTool === 'polyline' || state.currentTool === 'polygon') && state.tempPoints.length >= 2) {
      let cleanedPoints = [...state.tempPoints];
      
      // Αφαίρεση διπλότυπων σημείων από double-click
      if (cleanedPoints.length >= 2) {
        const lastPoint = cleanedPoints[cleanedPoints.length - 1];
        const secondLastPoint = cleanedPoints[cleanedPoints.length - 2];
        
        const distance = Math.sqrt(
          Math.pow(lastPoint.x - secondLastPoint.x, 2) + 
          Math.pow(lastPoint.y - secondLastPoint.y, 2)
        );
        
        if (distance < 1.0) {
          cleanedPoints = cleanedPoints.slice(0, -1);
        }
      }
      
      const newEntity = createEntityFromTool(state.currentTool, cleanedPoints);
      
      if (newEntity && currentLevelId) {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
            const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
            setLevelScene(currentLevelId, updatedScene);
        }
      }
      
      cancelDrawing();
      return newEntity;
    }
    return null;
  }, [state, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, cancelDrawing]);

  // 🎯 ΝΕΟ: Start Polygon method για overlay creation
  const startPolygon = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void; isOverlay?: boolean } = {}) => {
    // Ορίζουμε overlay mode πριν ξεκινήσουμε τη σχεδίαση
    setState(prev => ({ ...prev, isOverlayMode: options.isOverlay || false }));
    startDrawing('polygon');
    
    return {
      stop: () => {
        const points = state.tempPoints;
        // Καθαρίζουμε overlay mode
        setState(prev => ({ ...prev, isOverlayMode: false }));
        cancelDrawing();
        if (options.onComplete && points.length >= 3) {
          options.onComplete(points);
        } else if (options.onCancel) {
          options.onCancel();
        }
      }
    };
  }, [startDrawing, cancelDrawing, state.tempPoints]);

  return {
    state,
    addPoint,
    updatePreview,
    startDrawing,
    cancelDrawing,
    finishEntity: finishPolyline,
    finishPolyline,
    startPolygon,
  };
}
```

## 3. useUnifiedOverlayCreation.ts - Hook Δημιουργίας Overlays

```typescript
/**
 * Unified Overlay Creation Hook
 * Χρησιμοποιεί το DXF polyline tool για τη δημιουργία overlay polygon,
 * ώστε η εμπειρία να είναι 1:1 με τα DXF tools (rubber-band, snaps, dynamic input).
 */
import { useCallback } from 'react';
import { isFeatureEnabled } from '../../config/feature-flags';
import { toolStyleStore } from '../../stores/ToolStyleStore';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useUnifiedDrawing } from '../drawing/useUnifiedDrawing';
import type { Status, OverlayKind } from '../../overlays/types';

type StartOpts = {
  status?: Status;
  kind?: OverlayKind;
  onComplete?: (overlayId: string) => void;
  onCancel?: () => void;
};

export function useUnifiedOverlayCreation() {
  const { add } = useOverlayStore();
  const { startPolygon } = useUnifiedDrawing();

  const startOverlayCreation = useCallback(async (opts: StartOpts) => {
    console.log('🎯 [useUnifiedOverlayCreation] startOverlayCreation called with opts:', opts);
    
    if (!isFeatureEnabled('USE_UNIFIED_DRAWING_ENGINE')) {
      console.warn('[useUnifiedOverlayCreation] USE_UNIFIED_DRAWING_ENGINE is disabled - skipping overlay creation');
      return;
    }

    console.log('🎯 [useUnifiedOverlayCreation] Feature flag enabled, starting polygon...');
    const stop = startPolygon({
      isOverlay: true, // 🎯 ΚΛΕΙΔΙ: Σημαία για overlay styling
      onComplete: async (points) => {
        console.log('🎯 [useUnifiedOverlayCreation] onComplete called with points:', points.length);
        const style = toolStyleStore.get();
        console.log('🎯 [useUnifiedOverlayCreation] toolStyle:', style);
        
        // 🎯 ΝΕΑ ΛΟΓΙΚΗ: Χρήση επιλεγμένου status και kind από το OverlayToolbar
        const overlayId = await add({
          levelId: '', // will be set by overlay store based on currentLevelId
          kind: opts.kind || 'unit', // Χρήση επιλεγμένου kind ή default
          polygon: points.map(p => [p.x, p.y] as [number, number]),
          status: opts.status || 'for-sale', // Χρήση επιλεγμένου status ή default
          style: {
            stroke: style.strokeColor,
            fill: style.fillColor,
            lineWidth: style.lineWidth,
            opacity: style.opacity,
          }
        });
        
        opts.onComplete?.(overlayId);
      },
      onCancel: () => {
        opts.onCancel?.();
      }
    });

    // 🎯 ΔΙΟΡΘΩΣΗ: Επιστροφή του stop callback για double-click handling
    return { stop };
  }, [add, startPolygon]);

  return { startOverlayCreation, isUsingUnifiedEngine: isFeatureEnabled('USE_UNIFIED_DRAWING_ENGINE') };
}
```

## 4. PhaseManager.ts - Διαχειριστής Φάσεων Απεικόνισης

```typescript
// Κρίσιμο μέρος από το PhaseManager που αφορά overlays

export class PhaseManager {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // Εφαρμόζει στυλ ανάλογα με τη φάση και τον τύπο entity
  public applyPhaseStyle(entity: any, phase: RenderPhase): void {
    const isPreview = (entity as any).preview === true;
    
    if (isPreview) {
      // 🎯 ΚΛΕΙΔΙ: Έλεγχος για overlay entity
      const isOverlayEntity = (entity as any).isOverlayPreview === true;
      
      if (isOverlayEntity) {
        // Για overlay preview, χρησιμοποιούμε τα χρώματα από το ToolStyleStore
        const toolStyle = toolStyleStore.get();
        this.ctx.strokeStyle = toolStyle.strokeColor || '#22c55e';
        this.ctx.fillStyle = toolStyle.fillColor || '#ff000080';
        this.ctx.lineWidth = toolStyle.lineWidth || 2;
        this.ctx.globalAlpha = toolStyle.opacity || 1;
      } else {
        // Για κανονικά DXF preview, χρησιμοποιούμε μπλε
        this.ctx.strokeStyle = '#0080ff';
        this.ctx.fillStyle = 'rgba(0, 128, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.8;
      }
    } else {
      // Κανονικά entities - χρησιμοποιούμε τα δικά τους χρώματα
      this.applyEntityStyle(entity);
    }
  }

  // Άλλες μέθοδοι...
}
```

## 5. PolylineRenderer.ts - Απεικονιστής Polylines

```typescript
// Κρίσιμο μέρος από το PolylineRenderer που αφορά overlays

export class PolylineRenderer extends BaseEntityRenderer {

  private renderPolylineGeometry(vertices: Point2D[], closed: boolean, entity: EntityModel, options: RenderOptions): void {
    const screenVertices = vertices.map(v => this.worldToScreen(v));
    
    if (this.shouldRenderSplitLine(entity, options)) {
      // Split line rendering...
    } else {
      // Κανονικό polyline (solid lines)
      this.drawPath(screenVertices, closed);
      
      // 🎯 ΔΙΟΡΘΩΣΗ: Fill για overlay polylines μόνο
      const isOverlayEntity = (entity as any).isOverlayPreview === true;
      if (isOverlayEntity && closed && this.ctx.fillStyle !== 'rgba(0,0,0,0)') {
        this.ctx.fill();
      }
      
      this.ctx.stroke();
    }
  }

  // Άλλες μέθοδοι...
}
```

## 6. ToolStyleStore.ts - Αποθήκη Στυλ

```typescript
/**
 * ToolStyleStore - External Store για centralized style management
 * Διαχειρίζεται styles που χρησιμοποιούνται από overlay και DXF tools
 */

import { create } from 'zustand';

export interface ToolStyle {
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  opacity: number;
}

interface ToolStyleState {
  style: ToolStyle;
  set: (style: ToolStyle) => void;
  get: () => ToolStyle;
}

// Default style
const defaultStyle: ToolStyle = {
  strokeColor: '#0080ff',
  fillColor: 'rgba(0, 128, 255, 0.1)',
  lineWidth: 1,
  opacity: 1
};

export const toolStyleStore = create<ToolStyleState>((set, get) => ({
  style: defaultStyle,
  set: (style: ToolStyle) => {
    console.log('🎨 [ToolStyleStore] Setting style:', style);
    set({ style });
  },
  get: () => get().style
}));
```

## 7. DxfViewerContent.tsx - Κεντρικό Component

```typescript
// Κρίσιμο μέρος που αφορά overlay mode management

export function DxfViewerContent() {
  // ΔΙΟΡΘΩΣΗ: Αλλαγή default mode από 'draw' σε 'select'
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('select');
  const [overlayStatus, setOverlayStatus] = useState<PropertyStatus>('for-sale');

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {showOverlayToolbar && (
        <div className="absolute top-4 right-4 z-50">
          <OverlayToolbar
            mode={overlayMode}
            onModeChange={setOverlayMode}
            currentStatus={overlayStatus}
            onStatusChange={setOverlayStatus}
            onToolChange={setCurrentTool}
          />
        </div>
      )}
      
      {/* Canvas */}
      <DxfCanvas />
    </div>
  );
}
```

## 8. Overlay Types - Τύποι Δεδομένων

```typescript
// Τύποι για overlay system

export type PropertyStatus = 'for-sale' | 'sold' | 'reserved' | 'available' | 'unavailable';
export type OverlayKind = 'unit' | 'common-area' | 'parking' | 'storage';

export interface OverlayEntity {
  id: string;
  levelId: string;
  kind: OverlayKind;
  polygon: [number, number][];
  status: PropertyStatus;
  style: {
    stroke: string;
    fill: string;
    lineWidth: number;
    opacity: number;
  };
}
```

## Συνοπτική Περιγραφή Συστήματος

### Βασική Ροή:
1. **OverlayToolbar**: Ο χρήστης επιλέγει "Σχεδίαση" → ενεργοποιείται draw mode
2. **ToolStyleStore**: Ορίζονται τα χρώματα ανάλογα με το επιλεγμένο status
3. **useUnifiedDrawing**: Χρησιμοποιεί `startPolygon()` για κλειστά polygons
4. **useUnifiedOverlayCreation**: Συνδυάζει drawing με overlay creation
5. **PhaseManager**: Εφαρμόζει τα σωστά χρώματα κατά την απεικόνιση
6. **PolylineRenderer**: Απεικονίζει το polygon με fill για overlays

### Κλειδιά Διόρθωσης:
- **isOverlayPreview flag**: Διακρίνει overlay από DXF entities
- **startPolygon vs startPolyline**: Δημιουργεί κλειστά vs ανοιχτά shapes
- **ToolStyleStore integration**: Κεντρική διαχείριση στυλ
- **onModeChange timing**: Διατήρηση toolbar visibility

Όλες οι βασικές διορθώσεις που έγιναν αφορούσαν τη σωστή επικοινωνία μεταξύ των components και την ακριβή διάκριση μεταξύ overlay και DXF drawing modes.