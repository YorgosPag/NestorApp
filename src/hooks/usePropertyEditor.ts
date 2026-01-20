
'use client';

import { useState } from 'react';
import type { Suggestion } from '@/types/suggestions';
import type { Connection, PropertyGroup } from '@/types/connections';
import type { FilterState, Property } from '@/types/property-viewer';
import { DEFAULT_FILTERS } from './usePropertyViewer';

// 🏢 ENTERPRISE: Tool type for property editor
type EditorTool = string | null;

export function usePropertyEditor() {
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [scale, setScale] = useState(0.05);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [suggestionToDisplay, setSuggestionToDisplay] = useState<Suggestion | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [firstConnectionPoint, setFirstConnectionPoint] = useState<Property | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  return {
    activeTool, 
    setActiveTool,
    showGrid, 
    setShowGrid,
    snapToGrid, 
    setSnapToGrid,
    gridSize, 
    setGridSize,
    showMeasurements, 
    setShowMeasurements,
    scale, 
    setScale,
    showHistoryPanel, 
    setShowHistoryPanel,
    suggestionToDisplay, 
    setSuggestionToDisplay,
    connections, 
    setConnections,
    groups, 
    setGroups,
    isConnecting, 
    setIsConnecting,
    firstConnectionPoint, 
    setFirstConnectionPoint,
    viewMode, 
    setViewMode,
    showDashboard, 
    setShowDashboard,
    filters, 
    setFilters,
  };
}
