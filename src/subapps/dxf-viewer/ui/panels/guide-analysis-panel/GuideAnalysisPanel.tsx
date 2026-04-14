'use client';

/**
 * @module GuideAnalysisPanel
 * @description Unified floating panel with 4 tabs for guide analysis services.
 *
 * Tabs:
 *  1. Diagnostics — B58 Anomaly Detection + B89 Grid Analytics
 *  2. Compliance  — B93 Building Code + B95 Seismic
 *  3. Sustainability — B74 Material + B75 Carbon + B100 Green Deal + B72 Eco Presets
 *  4. Export — B88 IFC Export + B96 Quantity Takeoff + B60 NLP Command
 *
 * Pattern: GuidePanel (FloatingPanel ADR-084 compound component).
 * Position: Top-right offset, 400×520px, draggable.
 *
 * @see ADR-189
 * @since 2026-03-06
 */

import React from 'react';
import { Activity, ShieldCheck, Leaf, FileOutput, BarChart3 } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n';
import { PanelPositionCalculator } from '../../../config/panel-tokens';
import { DiagnosticsTab } from './DiagnosticsTab';
import { ComplianceTab } from './ComplianceTab';
import { SustainabilityTab } from './SustainabilityTab';
import { ExportTab } from './ExportTab';

const PANEL_DIMENSIONS = { width: 400, height: 520 } as const;

const getDefaultPosition = () =>
  PanelPositionCalculator.getTopRightPosition(PANEL_DIMENSIONS.width + 340);

interface GuideAnalysisPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const GuideAnalysisPanel: React.FC<GuideAnalysisPanelProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  return (
    <FloatingPanel
      defaultPosition={typeof window !== 'undefined' ? getDefaultPosition() : { x: 60, y: 100 }}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      isVisible={isVisible}
      className="z-50"
    >
      <FloatingPanel.Header
        title={t('guideAnalysis.title')}
        icon={<BarChart3 />}
      />

      <FloatingPanel.Content className="!p-0">
        <Tabs defaultValue="diagnostics" className="flex h-full flex-col">
          <TabsList className="mx-2 mt-2 grid w-auto grid-cols-4 h-9">
            <TabsTrigger value="diagnostics" className="gap-1 text-xs px-1.5">
              <Activity className="h-3.5 w-3.5" />
              {t('guideAnalysis.tabs.diagnostics')}
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-1 text-xs px-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('guideAnalysis.tabs.compliance')}
            </TabsTrigger>
            <TabsTrigger value="sustainability" className="gap-1 text-xs px-1.5">
              <Leaf className="h-3.5 w-3.5" />
              {t('guideAnalysis.tabs.sustainability')}
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1 text-xs px-1.5">
              <FileOutput className="h-3.5 w-3.5" />
              {t('guideAnalysis.tabs.export')}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <TabsContent value="diagnostics" className="mt-0">
              <DiagnosticsTab />
            </TabsContent>
            <TabsContent value="compliance" className="mt-0">
              <ComplianceTab />
            </TabsContent>
            <TabsContent value="sustainability" className="mt-0">
              <SustainabilityTab />
            </TabsContent>
            <TabsContent value="export" className="mt-0">
              <ExportTab />
            </TabsContent>
          </div>
        </Tabs>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};

GuideAnalysisPanel.displayName = 'GuideAnalysisPanel';
