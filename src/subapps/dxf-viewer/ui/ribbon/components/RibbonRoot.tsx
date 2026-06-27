'use client';

/**
 * ADR-345 Fase 1 — Top-level ribbon scaffold.
 * Wires useRibbonState + useRibbonTabDrag to tab bar + body.
 * Panels are placeholder (Fase 3+ adds buttons).
 *
 * ADR-532 Stage 2 (perf) — the contextual-tab trigger no longer arrives as a
 * prop. The shell (`RibbonRootInner`) takes only reference-stable props
 * (`commands` from the stable selection facade, the constant `contextualTabs`),
 * so a click-select keeps `React.memo` intact → the shell + `RibbonCommandProvider`
 * do NOT re-render. The single in-shell leaf `RibbonTabsRegion` subscribes to the
 * trigger via `useRibbonContextualTrigger()` (fed by the app-layer
 * `RibbonContextualTabScope`) and is the ONLY thing that reacts to selection —
 * and only when the trigger string actually changes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DEFAULT_RIBBON_TABS,
  findRibbonTabById,
  reorderTabs,
} from '../data/ribbon-default-tabs';
import { useRibbonState, type UseRibbonStateReturn } from '../hooks/useRibbonState';
import { useRibbonTabDrag, type TabDragHandlers } from '../hooks/useRibbonTabDrag';
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
import { useRibbonContextualTrigger } from '../context/RibbonContextualTabContext';
import type { RibbonTab } from '../types/ribbon-types';

interface RibbonRootProps {
  /** ADR-345 Fase 3 — command bridge to the DXF viewer state. */
  commands: RibbonCommandsApi;
  /**
   * ADR-345 §5.4 Fase 5B — contextual tabs candidates (e.g. Text Editor).
   * Rendered in the tab bar only when their `contextualTrigger` matches the
   * active trigger (provided via `RibbonContextualTabScope`, ADR-532 Stage 2).
   * A constant list — stable by reference.
   */
  contextualTabs?: readonly RibbonTab[];
  /** ADR-345 Fase 6.1 — content rendered in expanded area below settings ribbon panels. */
  settingsTabContent?: React.ReactNode;
}

interface RibbonTabsRegionProps {
  state: UseRibbonStateReturn;
  drag: TabDragHandlers;
  contextualTabs?: readonly RibbonTab[];
  settingsTabContent?: React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * ADR-532 Stage 2 — the ONLY subscriber to the contextual trigger. Lives inside
 * the (memoized) ribbon shell so a click-select re-renders just this region (tab
 * bar + active-tab body), NOT the whole RibbonRoot/RibbonCommandProvider tree.
 * `state`/`drag` arrive from the shell (stable across selection, since the shell
 * does not re-render then); the trigger arrives via context.
 */
const RibbonTabsRegion: React.FC<RibbonTabsRegionProps> = ({
  state,
  drag,
  contextualTabs,
  settingsTabContent,
  onContextMenu,
}) => {
  const activeContextualTrigger = useRibbonContextualTrigger();

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
    if (ids === prev) return; // contextual set unchanged → respect manual tab choice
    prevContextualIdsRef.current = ids;

    if (ids) {
      // The visible contextual set changed and is non-empty → follow the
      // selection: activate the first visible contextual tab unless it is
      // already active. Covers persistent→contextual (e.g. select a fixture)
      // AND contextual→different-contextual (e.g. the fixture tab's "Edit
      // Circuit" jump selects the source panel → the circuit tab replaces the
      // now-gone fixture tab; ADR-408 Φ7). Without this, `activeTabId` would
      // point at the vanished tab and the body would fall back to Home.
      const firstId = visibleContextualTabs[0]?.id;
      if (firstId && !visibleContextualTabs.some((tab) => tab.id === state.activeTabId)) {
        state.setActiveTabId(firstId);
      }
    } else if (prev) {
      // contextual → none: revert to home only if the active tab no longer exists.
      const stillExists = DEFAULT_RIBBON_TABS.some((tab) => tab.id === state.activeTabId);
      if (!stillExists) state.setActiveTabId('home');
    }
  }, [visibleContextualTabs, state]);

  const activeTab = findRibbonTabById(orderedTabs, state.activeTabId) ?? orderedTabs[0];

  return (
    <>
      <RibbonTabBar
        tabs={orderedTabs}
        activeTabId={activeTab?.id ?? ''}
        minimizeState={state.effectiveMinimizeState}
        onTabActivate={state.setActiveTabId}
        onTabDoubleClick={state.cycleMinimizeState}
        onTabContextMenu={onContextMenu}
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
    </>
  );
};

const RibbonRootInner: React.FC<RibbonRootProps> = ({
  commands,
  contextualTabs,
  settingsTabContent,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useRibbonState();
  const drag = useRibbonTabDrag(state.tabOrder, state.setTabOrder);

  const [menuPos, setMenuPos] = useState<ContextMenuPosition | null>(null);

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
        <RibbonTabsRegion
          state={state}
          drag={drag}
          contextualTabs={contextualTabs}
          settingsTabContent={settingsTabContent}
          onContextMenu={handleContextMenu}
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
// ADR-532 Stage 2: with the contextual trigger moved to context, a click-select
// leaves every prop reference-stable → RibbonRootInner does NOT re-render; only
// the in-shell RibbonTabsRegion leaf reacts (and only on a real trigger change).
export const RibbonRoot = React.memo(RibbonRootInner);

export default RibbonRoot;
