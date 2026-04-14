/**
 * Polygon system reducer — action types, initial state, reducer function.
 * Extracted from PolygonSystemProvider for SRP (Google N.7.1).
 */

import type { PolygonType, UniversalPolygon } from '@geo-alert/core';
import type { UserRole, PolygonSystemState, MapRef } from '../types/polygon-system.types';
import React from 'react';

export interface DrawingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  [key: string]: unknown;
}

type CompletedPolygonPoint = [number, number];

export type PolygonSystemAction =
  | { type: 'SET_ROLE'; payload: UserRole }
  | { type: 'SET_POLYGONS'; payload: UniversalPolygon[] }
  | { type: 'START_DRAWING'; payload: { type: PolygonType; config?: DrawingConfig } }
  | { type: 'FINISH_DRAWING'; payload?: UniversalPolygon }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_POLYGON_COMPLETE'; payload: boolean }
  | { type: 'SET_COMPLETED_POLYGON'; payload: CompletedPolygonPoint[] | null }
  | { type: 'SET_MAP_REF'; payload: React.RefObject<MapRef> | null }
  | { type: 'SET_MAP_LOADED'; payload: boolean }
  | { type: 'SET_COORDINATE_PICKING'; payload: boolean }
  | { type: 'BLOCK_COORDINATE_PICKING'; payload: boolean }
  | { type: 'UPDATE_POLYGON_CONFIG'; payload: { polygonId: string; configUpdates: Partial<{ fillColor: string; strokeColor: string; strokeWidth: number; pointMode: boolean; radius: number; [key: string]: unknown }> } }
  | { type: 'DELETE_POLYGON'; payload: string }
  | { type: 'MOVE_POLYGON_POINT'; payload: { polygonId: string; pointIndex: number; longitude: number; latitude: number } };

export const initialState: PolygonSystemState = {
  currentRole: 'citizen',
  polygons: [],
  isDrawing: false,
  currentTool: null,
  currentDrawing: null,
  isPolygonComplete: false,
  completedPolygon: null,
  mapRef: null,
  mapLoaded: false,
  isPickingCoordinates: false,
  coordinatePickingBlocked: false
};

export function polygonSystemReducer(
  state: PolygonSystemState,
  action: PolygonSystemAction
): PolygonSystemState {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, currentRole: action.payload };
    case 'SET_POLYGONS':
      return { ...state, polygons: action.payload };
    case 'START_DRAWING':
      return {
        ...state,
        isDrawing: true,
        currentTool: action.payload.type,
        coordinatePickingBlocked: false,
        currentDrawing: { type: action.payload.type, config: action.payload.config }
      };
    case 'FINISH_DRAWING':
      return {
        ...state,
        isDrawing: false,
        currentTool: null,
        currentDrawing: null,
        polygons: action.payload ? [...state.polygons, action.payload] : state.polygons
      };
    case 'CANCEL_DRAWING':
      return { ...state, isDrawing: false, currentTool: null, currentDrawing: null };
    case 'CLEAR_ALL':
      return { ...state, polygons: [], isDrawing: false, currentTool: null, isPolygonComplete: false, completedPolygon: null };
    case 'SET_POLYGON_COMPLETE':
      return { ...state, isPolygonComplete: action.payload, coordinatePickingBlocked: action.payload };
    case 'SET_COMPLETED_POLYGON':
      return { ...state, completedPolygon: action.payload };
    case 'SET_MAP_REF':
      return { ...state, mapRef: action.payload };
    case 'SET_MAP_LOADED':
      return { ...state, mapLoaded: action.payload };
    case 'SET_COORDINATE_PICKING':
      return { ...state, isPickingCoordinates: action.payload };
    case 'BLOCK_COORDINATE_PICKING':
      return { ...state, coordinatePickingBlocked: action.payload };
    case 'UPDATE_POLYGON_CONFIG': {
      const idx = state.polygons.findIndex(p => p.id === action.payload.polygonId);
      if (idx === -1) return state;
      const updated = [...state.polygons];
      updated[idx] = { ...updated[idx], config: { ...updated[idx].config, ...action.payload.configUpdates } };
      return { ...state, polygons: updated };
    }
    case 'DELETE_POLYGON':
      return { ...state, polygons: state.polygons.filter(p => p.id !== action.payload) };
    case 'MOVE_POLYGON_POINT': {
      const { polygonId, pointIndex, longitude, latitude } = action.payload;
      const idx = state.polygons.findIndex(p => p.id === polygonId);
      if (idx === -1) return state;
      const updated = [...state.polygons];
      const points = [...updated[idx].points];
      points[pointIndex] = { ...points[pointIndex], x: longitude, y: latitude };
      updated[idx] = { ...updated[idx], points };
      return { ...state, polygons: updated };
    }
    default:
      return state;
  }
}
