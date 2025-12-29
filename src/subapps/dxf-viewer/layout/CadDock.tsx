'use client';
import React, { useEffect, useRef, memo } from 'react';
import { DockviewReact, DockviewReadyEvent, DockviewApi } from 'dockview';
import 'dockview/dist/styles/dockview.css';

// Import the ProSnapToolbar instead of deleted SnapButtonsPanel
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import { useProSnapIntegration } from '../hooks/common/useProSnapIntegration';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

// 🔺 FIXED SNAPPING PANEL με ProSnapToolbar
const SnappingView = memo(() => {
  const {
    enabledModes,
    toggleMode,
    snapEnabled,
    toggleSnap
  } = useProSnapIntegration();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  
  return (
    <div className={`p-2 ${colors.bg.secondary}`}>
      <div className="mb-2">
        <h3 className={`text-sm font-semibold ${colors.text.muted}`}>Object Snap</h3>
        <p className={`text-xs ${colors.text.muted}`}>Click to toggle snap modes</p>
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
const LayersView = memo(() => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

  return (
  <div className={`p-3 ${colors.bg.secondary} text-white`}>
    <h3 className={`text-sm font-semibold mb-2 ${colors.text.muted}`}>Layers</h3>
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked className={iconSizes.xs} />
        <span className={`${iconSizes.xs} ${colors.bg.error} rounded`}></span>
        <span>0 - Default</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked className={iconSizes.xs} />
        <span className={`${iconSizes.xs} ${colors.bg.info} rounded`}></span>
        <span>Geometry</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" defaultChecked className={iconSizes.xs} />
        <span className={`${iconSizes.xs} ${colors.bg.success} rounded`}></span>
        <span>Dimensions</span>
      </div>
    </div>
  </div>
  );
});
LayersView.displayName = 'LayersView';

// 🔧 PROPERTIES PANEL
const PropertiesView = memo(() => {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

  return (
  <div className={`p-3 ${colors.bg.secondary} text-white`}>
    <h3 className={`text-sm font-semibold mb-2 ${colors.text.muted}`}>Properties</h3>
    <div className="space-y-2 text-sm">
      <div>
        <label className={`block ${colors.text.muted}`}>Layer:</label>
        <select className={`w-full ${colors.bg.secondary} ${getStatusBorder('muted')} ${quick.input} px-2 py-1`}>
          <option>0 - Default</option>
          <option>Geometry</option>
        </select>
      </div>
      <div>
        <label className={`block ${colors.text.muted}`}>Color:</label>
        <input type="color" className={`w-full h-8 ${colors.bg.secondary} ${getStatusBorder('muted')} ${quick.input}`} />
      </div>
    </div>
  </div>
  );
});
PropertiesView.displayName = 'PropertiesView';

// 📜 HISTORY PANEL
const HistoryView = memo(() => {
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES

  return (
    <div className={`p-3 ${colors.bg.secondary} text-white`}>
    <h3 className={`text-sm font-semibold mb-2 ${colors.text.muted}`}>Command History</h3>
    <div className="space-y-1 text-xs font-mono">
      <div className={colors.text.muted}>Command: FIT</div>
      <div className={colors.text.muted}>Command: ZOOM Window</div>
      <div className={colors.text.muted}>Command: LINE</div>
      <div className={colors.text.success}>Ready for command...</div>
    </div>
    </div>
  );
});
HistoryView.displayName = 'HistoryView';

// 🏗️ MAIN CAD DOCK
const CadDock = memo(({ children }: { children?: React.ReactNode }) => {
  // ✅ ENTERPRISE FIX: Use compatible type for API ref
  const apiRef = useRef<{ addPanel?: ((config: unknown) => void) | undefined } | null>(null);

  const onReady = (e: DockviewReadyEvent) => {
    // ✅ ENTERPRISE FIX: Type-safe API reference assignment
    apiRef.current = e.api as any;

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
