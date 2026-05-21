'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Floor3DPanelTab } from '../../../bim-3d/panels/Floor3DPanelTab';
import { Lighting3DPanelTab } from '../../../bim-3d/panels/Lighting3DPanelTab';
import { Quality3DPanelTab } from '../../../bim-3d/panels/Quality3DPanelTab';
import { Section3DPanelTab } from '../../../bim-3d/panels/Section3DPanelTab';

type Bim3DSubTab = 'floors' | 'lighting' | 'quality' | 'sections';

const SUB_TABS: readonly Bim3DSubTab[] = ['floors', 'lighting', 'quality', 'sections'] as const;

const PANEL_ID = 'bim3d-floating-tab';

export function Bim3DFloatingTab() {
  const { t } = useTranslation('bim3d');
  const [activeSubTab, setActiveSubTab] = useState<Bim3DSubTab>('floors');

  return (
    <div className="overflow-hidden rounded-lg bg-black/50">
      <div role="tablist" aria-label={t('floatingPanel.ariaLabel')} className="flex border-b border-white/10">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            id={`${PANEL_ID}-tab-${tab}`}
            role="tab"
            aria-selected={activeSubTab === tab}
            aria-controls={`${PANEL_ID}-panel-${tab}`}
            onClick={() => setActiveSubTab(tab)}
            className={[
              'flex-1 py-1.5 text-xs font-medium transition-colors',
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
      </div>
    </div>
  );
}
