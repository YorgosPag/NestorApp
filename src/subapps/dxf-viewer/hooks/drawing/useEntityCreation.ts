'use client';

import { useState, useCallback, useRef } from 'react';
import type { Point, DXFEntity, ToolType } from '../../types';
import { UI_COLORS } from '../../config/color-config';
// import { layerManager } from '../../tools/LayerManager';

export type DrawingTool = 'line' | 'rectangle' | 'circle' | 'polyline';

export interface DrawingState {
  isDrawing: boolean;
  currentTool: DrawingTool | null;
  currentPoints: Point[];
  previewEntity: DXFEntity | null;
  snapPoint: Point | null;
  snapType: string | null;
}

export const useEntityCreation = () => {
    const [state, setState] = useState<DrawingState>({
        isDrawing: false,
        currentTool: null,
        currentPoints: [],
        previewEntity: null,
        snapPoint: null,
        snapType: null
    });
    const entityIdCounter = useRef(1000);

    const createEntityFromTool = useCallback((tool: DrawingTool, points: Point[], layer: string): DXFEntity | null => {
        if (points.length < 2 && tool !== 'circle') return null;

        const baseEntity = {
            id: `${tool}_${entityIdCounter.current++}`,
            layer: layer,
            color: UI_COLORS.WHITE,
            visible: true,
            selected: false,
            points: [] as Point[],
        };

        switch (tool) {
            case 'line':
                return { ...baseEntity, type: 'LINE', points: [points[0], points[points.length - 1]] };
            case 'rectangle':
                const p1 = points[0];
                const p2 = points[points.length - 1];
                return { 
                    ...baseEntity, 
                    type: 'POLYLINE', 
                    points: [p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }, p1],
                    closed: true
                };
            case 'circle':
                if (points.length < 2) return null;
                const radius = Math.sqrt(
                    Math.pow(points[1].x - points[0].x, 2) + 
                    Math.pow(points[1].y - points[0].y, 2)
                );
                return { ...baseEntity, type: 'CIRCLE', points: [points[0]], radius };
            case 'polyline':
                return { ...baseEntity, type: 'POLYLINE', points: [...points] };
            default:
                return null;
        }
    }, []);

    const getPreviewEntity = useCallback((toolType: DrawingTool, points: Point[]): DXFEntity | null => {
        if (points.length === 0) return null;
        return createEntityFromTool(toolType, points, layerManager.getCurrentLayer());
    }, [createEntityFromTool]);
    
    const startDrawing = (point: Point) => {
        setState(prev => ({
            ...prev,
            isDrawing: true,
            currentPoints: [point]
        }));
    };
    
    const addPoint = (point: Point) => {
        setState(prev => ({
            ...prev,
            currentPoints: [...prev.currentPoints, point]
        }));
    };

    const finishDrawing = () => {
        setState(prev => ({
            ...prev,
            isDrawing: false,
            currentPoints: [],
            previewEntity: null
        }));
    };
    
    const setPreviewEntity = (entity: DXFEntity | null) => {
        setState(prev => ({ ...prev, previewEntity: entity }));
    };

    const setSnapPoint = (point: Point | null, type: string | null) => {
        setState(prev => ({ ...prev, snapPoint: point, snapType: type }));
    };

    return {
        drawingState: state,
        setDrawingState: setState,
        startDrawing,
        addPoint,
        finishDrawing,
        setPreviewEntity,
        setSnapPoint,
        createEntityFromTool,
        getPreviewEntity,
    };
};
