'use client';

/**
 * ADR-345 Fase 1 — Top-level ribbon scaffold.
 * Wires useRibbonState + useRibbonTabDrag to tab bar + body.
 * Panels are placeholder (Fase 3+ adds buttons).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DEFAULT_RIBBON_TABS,
  findRibbonTabById,
  reorderTabs,
} from '../data/ribbon-default-tabs';
import { useRibbonState } from '../hooks/useRibbonState';
import { useRibbonTabDrag } from '../hooks/useRibbonTabDrag';
import { RibbonTabBar } from './RibbonTabBar';
import { RibbonBody } from './RibbonBody';
import {
  RibbonContextMenu,
  type ContextMenuPosition,
} from './RibbonContextMenu';
import {
  RibbonCommandProvider,
  type RibbonCommandsApi,
} from '../context/RibbonCommandContext';

interface RibbonRootProps {
  /** ADR-345 Fase 2 — slot for the Layers tab expanded workspace (LevelPanel). */
  layersTabContent?: React.ReactNode;
  /** ADR-345 Fase 3 — command bridge to the DXF viewer state. */
  commands: RibbonCommandsApi;
}

export const RibbonRoot: React.FC<RibbonRootProps> = ({
  layersTabContent,
  commands,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useRibbonState();
  const drag = useRibbonTabDrag(state.tabOrder, state.setTabOrder);

  const [menuPos, setMenuPos] = useState<ContextMenuPosition | null>(null);

  const orderedTabs = useMemo(
    () => reorderTabs(DEFAULT_RIBBON_TABS, state.tabOrder),
    [state.tabOrder],
  );
  const activeTab = findRibbonTabById(orderedTabs, state.activeTabId) ?? orderedTabs[0];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setMenuPos(null), []);

  const toggleMinimize = useCallback(() => {
    state.setMinimizeState(
      state.userMinimizeState === 'full' ? 'tab-names' : 'full',
    );
  }, [state]);

  return (
    <RibbonCommandProvider commands={commands}>
      <div
        className="dxf-ribbon-root"
        role="region"
        aria-label={t('ribbon.ariaLabels.ribbon')}
        onContextMenu={handleContextMenu}
      >
        <RibbonTabBar
          tabs={orderedTabs}
          activeTabId={activeTab?.id ?? ''}
          minimizeState={state.effectiveMinimizeState}
          onTabActivate={state.setActiveTabId}
          onTabDoubleClick={state.cycleMinimizeState}
          onTabContextMenu={handleContextMenu}
          onCycleMinimize={state.cycleMinimizeState}
          drag={drag}
        />
        <RibbonBody
          activeTab={activeTab}
          minimizeState={state.effectiveMinimizeState}
          layersTabContent={layersTabContent}
        />
        {menuPos && (
          <RibbonContextMenu
            position={menuPos}
            isMinimized={state.userMinimizeState !== 'full'}
            onClose={closeMenu}
            onToggleMinimize={toggleMinimize}
          />
        )}
      </div>
    </RibbonCommandProvider>
  );
};

export default RibbonRoot;
