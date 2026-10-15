
'use client';

import { useState } from 'react';
import type { Suggestion } from '@/types/suggestions';
import type { Connection, PropertyGroup } from '@/types/connections';
import type { Property } from '@/types/property-viewer';

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
  const [showDashboard, setShowDashboard] = useState(false);
  // ⛔ ADR-840 Σ3 — ΟΧΙ `filters` / `viewMode` εδώ. Ήταν η **τρίτη** κατάσταση φίλτρων της εφαρμογής (`useState`
  //    ⇒ χανόταν σε refresh / «πίσω» / σύνδεσμο). Ζουν πλέον στη διεύθυνση: `usePropertyFiltersUrlState` ·
  //    `usePropertiesView`. Μην τα ξαναβάλεις — δεύτερο αντίγραφο είναι ακριβώς η βλάβη του §7.7.

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
    showDashboard, 
    setShowDashboard,
  };
}
