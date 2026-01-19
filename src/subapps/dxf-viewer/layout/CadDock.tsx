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
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

// 🔺 FIXED SNAPPING PANEL με ProSnapToolbar
const SnappingView = memo(() => {
  const { t } = useTranslation('dxf-viewer');
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
        <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.muted}`}>{t('cadDock.snapModes.title')}</h3>
        <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted}`}>{t('cadDock.snapModes.description')}</p>
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
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_COLORS.TEXT_PRIMARY}`}>
      <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.muted}`}>{t('cadDock.panels.layers')}</h3>
      <nav className={PANEL_LAYOUT.SPACING.GAP_XS} aria-label="Layer list">
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <span className={`${iconSizes.xs} ${colors.bg.error} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`} aria-hidden="true" />
          <span>{t('cadDock.layers.default')}</span>
        </label>
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <span className={`${iconSizes.xs} ${colors.bg.info} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`} aria-hidden="true" />
          <span>{t('cadDock.layers.geometry')}</span>
        </label>
        <label className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
          <Checkbox defaultChecked />
          <span className={`${iconSizes.xs} ${colors.bg.success} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`} aria-hidden="true" />
          <span>{t('cadDock.layers.dimensions')}</span>
        </label>
      </nav>
    </section>
  );
});
LayersView.displayName = 'LayersView';

// 🔧 PROPERTIES PANEL
const PropertiesView = memo(() => {
  const { t } = useTranslation('dxf-viewer');
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_COLORS.TEXT_PRIMARY}`}>
      <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.muted}`}>{t('cadDock.panels.properties')}</h3>
      <form className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`}>
        <fieldset>
          <label className={`block ${colors.text.muted}`} htmlFor="layer-select">{t('cadDock.properties.layer')}</label>
          <select
            id="layer-select"
            className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${colors.bg.secondary} ${getStatusBorder('muted')} ${quick.input} ${PANEL_LAYOUT.SPACING.COMPACT}`}
          >
            <option>{t('cadDock.layers.default')}</option>
            <option>{t('cadDock.layers.geometry')}</option>
          </select>
        </fieldset>
        <fieldset>
          <label className={`block ${colors.text.muted}`} htmlFor="color-input">{t('cadDock.properties.color')}</label>
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
  const { t } = useTranslation('dxf-viewer');
  const colors = useSemanticColors();

  return (
    <section className={`${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${PANEL_COLORS.TEXT_PRIMARY}`}>
      <h3 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.muted}`}>{t('cadDock.history.title')}</h3>
      <output className={`${PANEL_LAYOUT.SPACING.GAP_XS} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} font-mono block`}>
        <p className={colors.text.muted}>{t('cadDock.history.commands.fit')}</p>
        <p className={colors.text.muted}>{t('cadDock.history.commands.zoomWindow')}</p>
        <p className={colors.text.muted}>{t('cadDock.history.commands.line')}</p>
        <p className={colors.text.success}>{t('cadDock.history.ready')}</p>
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
    // 🏢 ENTERPRISE: Store API reference with proper typing
    // The Dockview API has more methods than our simplified ref type, so we extract what we need
    apiRef.current = { addPanel: e.api.addPanel.bind(e.api) };

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
      <div className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}>
        {children}
      </div>
    </div>
  );
});
CadDock.displayName = 'CadDock';

export default CadDock;
