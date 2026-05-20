'use client';

/**
 * Floating3DPanel — left sidebar panel for 3D BIM viewport.
 * Tabs: Floors (B.3) | Lighting (Phase 5 stub) | Quality (Phase 5 stub).
 * ADR-366 Phase 4 Group B. Rendered inside BimViewport3D.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Floor3DPanelTab } from './Floor3DPanelTab';
import { Lighting3DPanelTab } from './Lighting3DPanelTab';
import { Quality3DPanelTab } from './Quality3DPanelTab';

type Tab = 'floors' | 'lighting' | 'quality';

const TABS: Tab[] = ['floors', 'lighting', 'quality'];

export function Floating3DPanel() {
  const { t } = useTranslation('bim3d');
  const [activeTab, setActiveTab] = useState<Tab>('floors');

  return (
    <aside
      className="absolute left-3 top-12 z-20 flex w-48 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/50 shadow-xl backdrop-blur-sm"
      aria-label={t('floatingPanel.tabs.floors')}
    >
      {/* Tab strip */}
      <div className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab}
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
      <div className="min-h-0 overflow-y-auto">
        {activeTab === 'floors' && <Floor3DPanelTab />}
        {activeTab === 'lighting' && <Lighting3DPanelTab />}
        {activeTab === 'quality' && <Quality3DPanelTab />}
      </div>
    </aside>
  );
}
