'use client';

/**
 * Floating3DPanel — left sidebar panel for 3D BIM viewport.
 * Tabs: Floors (B.3) | Lighting (Phase 5 stub) | Quality (Phase 5 stub) |
 *       Sections | Accessibility | Comments | Animation (ADR-366 §C.1.b).
 * ADR-366 Phase 4 Group B + Phase 9 §C.1.b. Rendered inside BimViewport3D.
 *
 * Width: w-48 default; widens to w-72 when animation tab active (timeline
 * fields need extra room — ADR-366 §C.1.b design risk resolution).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Floor3DPanelTab } from './Floor3DPanelTab';
import { Lighting3DPanelTab } from './Lighting3DPanelTab';
import { Quality3DPanelTab } from './Quality3DPanelTab';
import { Section3DPanelTab } from './Section3DPanelTab';
import { Accessibility3DPanelTab } from './Accessibility3DPanelTab';
import { CommentListPanel } from '../comments/CommentListPanel';
import { TimelineEditor } from '../animation/TimelineEditor';

type Tab = 'floors' | 'lighting' | 'quality' | 'sections' | 'accessibility' | 'comments' | 'animation';

const TABS: Tab[] = ['floors', 'lighting', 'quality', 'sections', 'accessibility', 'comments', 'animation'];

export function Floating3DPanel() {
  const { t } = useTranslation('bim3d');
  const [activeTab, setActiveTab] = useState<Tab>('floors');

  const panelId = 'floating-3d-panel';

  const widthClass = activeTab === 'animation' ? 'w-72' : 'w-48';

  return (
    <aside
      className={`absolute left-3 top-12 z-20 flex ${widthClass} flex-col overflow-hidden rounded-lg border border-white/10 bg-black/50 shadow-xl backdrop-blur-sm`}
      aria-label={t('floatingPanel.ariaLabel')}
    >
      {/* Tab strip */}
      <div role="tablist" aria-label={t('floatingPanel.ariaLabel')} className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab}
            id={`${panelId}-tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${panelId}-panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={[
              'flex-1 py-1 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-primary text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            {t(`floatingPanel.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        id={`${panelId}-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${activeTab}`}
        className="min-h-0 overflow-y-auto"
      >
        {activeTab === 'floors' && <Floor3DPanelTab />}
        {activeTab === 'lighting' && <Lighting3DPanelTab />}
        {activeTab === 'quality' && <Quality3DPanelTab />}
        {activeTab === 'sections' && <Section3DPanelTab />}
        {activeTab === 'accessibility' && <Accessibility3DPanelTab />}
        {activeTab === 'comments' && <CommentListPanel />}
        {activeTab === 'animation' && <TimelineEditor />}
      </div>
    </aside>
  );
}
