'use client';

/**
 * Bim3DFloatingTab — THE 3D BIM control panel (left sidebar, "BIM 3D" tab).
 *
 * Tabs: Floors | Lighting | Quality | Sections | Accessibility | Comments |
 *       Animation | Renders (conditional — only while the render queue has jobs).
 *
 * SSoT (ADR-366): this is the ONLY host for the 3D panel tabs. The canvas-floating
 * twin (`bim-3d/panels/Floating3DPanel.tsx`) was unmounted from `BimViewport3D` on
 * 2026-05-21 (commit ce1e791b) when the controls moved here, and was DELETED on
 * 2026-07-26 once its three surviving tabs were carried over.
 *
 * Why that deletion mattered: between 2026-05-24 and 2026-05-25 the Comments,
 * Animation and Renders tabs were built into the already-unmounted twin, so all
 * three shipped unreachable while their unit tests stayed green — the tests render
 * the components directly and never ask whether anything mounts them. Keeping a
 * second, plausible-looking host is what let that happen; there is now exactly one.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Floor3DPanelTab } from '../../../bim-3d/panels/Floor3DPanelTab';
import { Lighting3DPanelTab } from '../../../bim-3d/panels/Lighting3DPanelTab';
import { Quality3DPanelTab } from '../../../bim-3d/panels/Quality3DPanelTab';
import { Section3DPanelTab } from '../../../bim-3d/panels/Section3DPanelTab';
import { Accessibility3DPanelTab } from '../../../bim-3d/panels/Accessibility3DPanelTab';
import { CommentListPanel } from '../../../bim-3d/comments/CommentListPanel';
import { TimelineEditor } from '../../../bim-3d/animation/TimelineEditor';
import { RenderQueuePanel } from '../../../bim-3d/animation/RenderQueuePanel';
import { selectAnyJobs, useRenderQueueStore } from '../../../bim-3d/animation/RenderQueueStore';

type Bim3DSubTab =
  | 'floors' | 'lighting' | 'quality' | 'sections' | 'accessibility'
  | 'comments' | 'animation' | 'renders';

const BASE_SUB_TABS: readonly Bim3DSubTab[] = [
  'floors', 'lighting', 'quality', 'sections', 'accessibility', 'comments', 'animation',
] as const;

const PANEL_ID = 'bim3d-floating-tab';

export function Bim3DFloatingTab() {
  const { t } = useTranslation('bim3d');
  const [activeSubTab, setActiveSubTab] = useState<Bim3DSubTab>('floors');

  // ADR-366 §C.1.c — the Renders tab exists only while the queue has jobs. Low-frequency
  // store (one notification per job transition), so an orchestrator subscription here does
  // not violate the ADR-040 micro-leaf rule, which governs per-frame stores.
  const showRenders = useSyncExternalStore(
    useRenderQueueStore.subscribe,
    () => selectAnyJobs(useRenderQueueStore.getState()),
    () => false,
  );

  const subTabs: readonly Bim3DSubTab[] = showRenders ? [...BASE_SUB_TABS, 'renders'] : BASE_SUB_TABS;

  // The active tab must never outlive its trigger: when the last job drains, fall back
  // to Animation instead of leaving an unreachable tabpanel selected.
  useEffect(() => {
    if (!showRenders && activeSubTab === 'renders') setActiveSubTab('animation');
  }, [showRenders, activeSubTab]);

  return (
    <div className="overflow-hidden rounded-lg bg-black/50">
      {/* Eight labels do not fit the sidebar width in a single row. They WRAP onto as many
          rows as needed (Giorgio 2026-07-26): every tab stays visible at its full label.
          Horizontal scrolling was rejected — a docked CAD palette must never hide a tab
          behind a scroll edge, because a tab the user cannot see is a tab they will not use. */}
      <div
        role="tablist"
        aria-label={t('floatingPanel.ariaLabel')}
        className="flex flex-wrap border-b border-white/10"
      >
        {subTabs.map((tab) => (
          <button
            key={tab}
            id={`${PANEL_ID}-tab-${tab}`}
            role="tab"
            aria-selected={activeSubTab === tab}
            aria-controls={`${PANEL_ID}-panel-${tab}`}
            onClick={() => setActiveSubTab(tab)}
            className={[
              'shrink-0 whitespace-nowrap px-2 py-1.5 text-xs font-medium transition-colors',
              activeSubTab === tab
                ? 'border-b-2 border-primary text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            {t(`floatingPanel.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div
        id={`${PANEL_ID}-panel-${activeSubTab}`}
        role="tabpanel"
        aria-labelledby={`${PANEL_ID}-tab-${activeSubTab}`}
        className="max-h-[32rem] min-h-0 overflow-y-auto"
      >
        {activeSubTab === 'floors' && <Floor3DPanelTab />}
        {activeSubTab === 'lighting' && <Lighting3DPanelTab />}
        {activeSubTab === 'quality' && <Quality3DPanelTab />}
        {activeSubTab === 'sections' && <Section3DPanelTab />}
        {activeSubTab === 'accessibility' && <Accessibility3DPanelTab />}
        {activeSubTab === 'comments' && <CommentListPanel />}
        {activeSubTab === 'animation' && <TimelineEditor />}
        {activeSubTab === 'renders' && <RenderQueuePanel />}
      </div>
    </div>
  );
}
