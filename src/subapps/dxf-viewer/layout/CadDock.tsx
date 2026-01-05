'use client';
import React, { useRef, memo } from 'react';
import { DockviewReact, DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';

// Import the ProSnapToolbar instead of deleted SnapButtonsPanel
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import { useProSnapIntegration } from '../hooks/common/useProSnapIntegration';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Checkbox } from '@/components/ui/checkbox';
import { PANEL_LAYOUT, PANEL_COLORS } from '../config/panel-tokens';

// 🔺 FIXED SNAPPING PANEL με ProSnapToolbar
const SnappingView = memo(() => {
  const {
    enabledModes,
    toggleMode,
    snapEnabled,
    toggleSnap
  } = useProSnapIntegration();
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary}`}>
      <header className={PANEL_LAYOUT.MARGIN.BOTTOM_SM}>
        <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.muted}`}>Object Snap</h3>
        <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted}`}>Click to toggle snap modes</p>
      </header>
      <ProSnapToolbar
        enabledModes={enabledModes}
        onToggleMode={toggleMode}
        snapEnabled={snapEnabled}
        onToggleSnap={toggleSnap}
        compact={false}
        className="w-full"
      />
    </section>
  );
});
SnappingView.displayName = 'SnappingView';

// 📋 LAYERS PANEL
const LayersView = memo(() => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_COLORS.TEXT_PRIMARY}`}>
      <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.muted}`}>Layers</h3>
      <nav className={PANEL_LAYOUT.SPACING.GAP_XS} aria-label="Layer list">
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <span className={`${iconSizes.xs} ${colors.bg.error} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`} aria-hidden="true" />
          <span>0 - Default</span>
        </label>
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <span className={`${iconSizes.xs} ${colors.bg.info} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`} aria-hidden="true" />
          <span>Geometry</span>
        </label>
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <span className={`${iconSizes.xs} ${colors.bg.success} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`} aria-hidden="true" />
          <span>Dimensions</span>
        </label>
      </nav>
    </section>
  );
});
LayersView.displayName = 'LayersView';

// 🔧 PROPERTIES PANEL
const PropertiesView = memo(() => {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_COLORS.TEXT_PRIMARY}`}>
      <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.muted}`}>Properties</h3>
      <form className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
        <fieldset>
          <label className={`block ${colors.text.muted}`} htmlFor="layer-select">Layer:</label>
          <select
            id="layer-select"
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${colors.bg.secondary} ${getStatusBorder('muted')} ${quick.input} ${PANEL_LAYOUT.SPACING.COMPACT}`}
          >
            <option>0 - Default</option>
            <option>Geometry</option>
          </select>
        </fieldset>
        <fieldset>
          <label className={`block ${colors.text.muted}`} htmlFor="color-input">Color:</label>
          <input
            type="color"
            id="color-input"
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${PANEL_LAYOUT.INPUT.HEIGHT} ${colors.bg.secondary} ${getStatusBorder('muted')} ${quick.input}`}
          />
        </fieldset>
      </form>
    </section>
  );
});
PropertiesView.displayName = 'PropertiesView';

// 📜 HISTORY PANEL
const HistoryView = memo(() => {
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_COLORS.TEXT_PRIMARY}`}>
      <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.muted}`}>Command History</h3>
      <output className={`${PANEL_LAYOUT.SPACING.GAP_XS} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} font-mono block`}>
        <p className={colors.text.muted}>Command: FIT</p>
        <p className={colors.text.muted}>Command: ZOOM Window</p>
        <p className={colors.text.muted}>Command: LINE</p>
        <p className={colors.text.success}>Ready for command...</p>
      </output>
    </section>
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
        component: 'snappingView', // ✅ ENTERPRISE FIX: Use 'component' instead of 'contentComponent'
        position: { direction: 'left' },
      });

      // 📋 LAYERS PANEL (κάτω από snapping)
      e.api.addPanel({
        id: 'layers',
        title: 'Layers',
        component: 'layersView', // ✅ ENTERPRISE FIX: Use 'component' instead of 'contentComponent'
        position: { referencePanel: 'snapping', direction: 'below' },
      });

      // 🔧 PROPERTIES PANEL (δεξιά)
      e.api.addPanel({
        id: 'properties',
        title: 'Properties',
        component: 'propertiesView', // ✅ ENTERPRISE FIX: Use 'component' instead of 'contentComponent'
        position: { direction: 'right' },
      });

      // 📜 HISTORY PANEL (κάτω από properties)
      e.api.addPanel({
        id: 'history',
        title: 'Commands',
        component: 'historyView', // ✅ ENTERPRISE FIX: Use 'component' instead of 'contentComponent'
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
