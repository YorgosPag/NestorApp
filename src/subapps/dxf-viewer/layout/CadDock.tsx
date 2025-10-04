'use client';
import React, { useEffect, useRef, memo } from 'react';
import { DockviewReact, DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';

// Import the ProSnapToolbar instead of deleted SnapButtonsPanel
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import { useProSnapIntegration } from '../hooks/common/useProSnapIntegration';

// 🔺 FIXED SNAPPING PANEL με ProSnapToolbar
const SnappingView = memo(() => {

  const { 
    enabledModes, 
    toggleMode, 
    snapEnabled, 
    toggleSnap 
  } = useProSnapIntegration();
  
  return (
    <div className="p-2 bg-gray-900">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-300">Object Snap</h3>
        <p className="text-xs text-gray-500">Click to toggle snap modes</p>
      </div>
      <ProSnapToolbar
        enabledModes={enabledModes}
        onToggleMode={toggleMode}
        snapEnabled={snapEnabled}
        onToggleSnap={toggleSnap}
        compact={false}
        className="w-full"
      />
    </div>
  );
});
SnappingView.displayName = 'SnappingView';

// 📋 LAYERS PANEL
const LayersView = memo(() => (
  <div className="p-3 bg-gray-900 text-white">
    <h3 className="text-sm font-semibold mb-2 text-gray-300">Layers</h3>
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked className="w-3 h-3" />
        <span className="w-3 h-3 bg-red-500 rounded"></span>
        <span>0 - Default</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked className="w-3 h-3" />
        <span className="w-3 h-3 bg-blue-500 rounded"></span>
        <span>Geometry</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked className="w-3 h-3" />
        <span className="w-3 h-3 bg-green-500 rounded"></span>
        <span>Dimensions</span>
      </div>
    </div>
  </div>
));
LayersView.displayName = 'LayersView';

// 🔧 PROPERTIES PANEL
const PropertiesView = memo(() => (
  <div className="p-3 bg-gray-900 text-white">
    <h3 className="text-sm font-semibold mb-2 text-gray-300">Properties</h3>
    <div className="space-y-2 text-sm">
      <div>
        <label className="block text-gray-400">Layer:</label>
        <select className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1">
          <option>0 - Default</option>
          <option>Geometry</option>
        </select>
      </div>
      <div>
        <label className="block text-gray-400">Color:</label>
        <input type="color" className="w-full h-8 bg-gray-800 border border-gray-600 rounded" />
      </div>
    </div>
  </div>
));
PropertiesView.displayName = 'PropertiesView';

// 📜 HISTORY PANEL
const HistoryView = memo(() => (
  <div className="p-3 bg-gray-900 text-white">
    <h3 className="text-sm font-semibold mb-2 text-gray-300">Command History</h3>
    <div className="space-y-1 text-xs font-mono">
      <div className="text-gray-400">Command: FIT</div>
      <div className="text-gray-400">Command: ZOOM Window</div>
      <div className="text-gray-400">Command: LINE</div>
      <div className="text-green-400">Ready for command...</div>
    </div>
  </div>
));
HistoryView.displayName = 'HistoryView';

// 🏗️ MAIN CAD DOCK
const CadDock = memo(({ children }: { children?: React.ReactNode }) => {
  const apiRef = useRef<{ addPanel?: (config: unknown) => void } | null>(null);

  const onReady = (e: DockviewReadyEvent) => {
    apiRef.current = e.api;

    try {

      // 🔺 SNAPPING PANEL (αριστερά, πάνω)
      e.api.addPanel({
        id: 'snapping',
        title: 'Object Snap',
        contentComponent: 'snappingView',
        position: { direction: 'left' },
      });

      // 📋 LAYERS PANEL (κάτω από snapping)
      e.api.addPanel({
        id: 'layers',
        title: 'Layers', 
        contentComponent: 'layersView',
        position: { referencePanel: 'snapping', direction: 'below' },
      });

      // 🔧 PROPERTIES PANEL (δεξιά)
      e.api.addPanel({
        id: 'properties',
        title: 'Properties',
        contentComponent: 'propertiesView', 
        position: { direction: 'right' },
      });

      // 📜 HISTORY PANEL (κάτω από properties)
      e.api.addPanel({
        id: 'history',
        title: 'Commands',
        contentComponent: 'historyView',
        position: { referencePanel: 'properties', direction: 'below' },
      });

    } catch (error) {
      console.error('❌ Error initializing CadDock panels:', error);
    }
  };

  return (
    <div className="dockview-theme-dark h-full">
      <DockviewReact
        className="h-full"
        components={{
          snappingView: SnappingView,
          layersView: LayersView,
          propertiesView: PropertiesView,
          historyView: HistoryView,
        }}
        onReady={onReady}
      />
      
      {/* Main content area */}
      <div className="absolute inset-0 pointer-events-none">
        {children}
      </div>
    </div>
  );
});
CadDock.displayName = 'CadDock';

export default CadDock;
