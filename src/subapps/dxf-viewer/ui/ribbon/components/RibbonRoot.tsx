'use client';

/**
 * ADR-345 Fase 1 — Top-level ribbon scaffold.
 * Wires useRibbonState + useRibbonTabDrag to tab bar + body.
 * Panels are placeholder (Fase 3+ adds buttons).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { RibbonTab } from '../types/ribbon-types';

interface RibbonRootProps {
  /** ADR-345 Fase 3 — command bridge to the DXF viewer state. */
  commands: RibbonCommandsApi;
  /**
   * ADR-345 §5.4 Fase 5B — contextual tabs candidates (e.g. Text Editor).
   * Rendered in the tab bar only when their `contextualTrigger` matches
   * `activeContextualTrigger`. Caller owns the trigger state.
   */
  contextualTabs?: readonly RibbonTab[];
  /**
   * ADR-345 §5.4 Fase 5B — currently active contextual trigger token,
   * `null` when no contextual tab should appear.
   */
  activeContextualTrigger?: string | null;
  /** ADR-345 Fase 6.1 — content rendered in expanded area below settings ribbon panels. */
  settingsTabContent?: React.ReactNode;
}

const RibbonRootInner: React.FC<RibbonRootProps> = ({
  commands,
  contextualTabs,
  activeContextualTrigger = null,
  settingsTabContent,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useRibbonState();
  const drag = useRibbonTabDrag(state.tabOrder, state.setTabOrder);

  const [menuPos, setMenuPos] = useState<ContextMenuPosition | null>(null);

  const visibleContextualTabs = useMemo<readonly RibbonTab[]>(() => {
    if (!activeContextualTrigger || !contextualTabs?.length) return [];
    return contextualTabs.filter(
      (tab) => tab.contextualTrigger === activeContextualTrigger,
    );
  }, [contextualTabs, activeContextualTrigger]);

  const orderedTabs = useMemo(() => {
    const base = reorderTabs(DEFAULT_RIBBON_TABS, state.tabOrder);
    return visibleContextualTabs.length > 0
      ? [...base, ...visibleContextualTabs]
      : base;
  }, [state.tabOrder, visibleContextualTabs]);

  // ADR-345 §5.4 — auto-activate contextual tab when it appears; revert
  // to last persistent tab when it disappears.
  const prevContextualIdsRef = useRef<string>('');
  useEffect(() => {
    const ids = visibleContextualTabs.map((t) => t.id).join(',');
    const prev = prevContextualIdsRef.current;
    if (ids && !prev) {
      const firstId = visibleContextualTabs[0]?.id;
      if (firstId) state.setActiveTabId(firstId);
    } else if (!ids && prev) {
      const active = state.activeTabId;
      const stillExists = DEFAULT_RIBBON_TABS.some((tab) => tab.id === active);
      if (!stillExists) state.setActiveTabId('home');
    }
    prevContextualIdsRef.current = ids;
  }, [visibleContextualTabs, state]);

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
          settingsTabContent={settingsTabContent}
          pinnedPanelIds={state.pinnedPanelIds}
          onPinToggle={state.togglePinPanel}
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

// ADR-040 perf: memo blocks cascade re-renders from DxfViewerContent.
// RibbonRoot re-renders only when its props (commands, contextualTabs,
// activeContextualTrigger) actually change by reference.
export const RibbonRoot = React.memo(RibbonRootInner);

export default RibbonRoot;
