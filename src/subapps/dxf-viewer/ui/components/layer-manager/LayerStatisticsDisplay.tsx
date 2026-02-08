// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import type { LayerStatisticsProps } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

export function LayerStatisticsDisplay({
  statistics,
  isConnected,
  lastSyncTime
}: LayerStatisticsProps) {
  const { t } = useTranslation('dxf-viewer');
  const colors = useSemanticColors();
  return (
    <>
      {/* Layer Statistics */}
      <div className={`flex justify-between ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
        <span>{t('layerManager.stats.total')} {statistics.totalLayers}</span>
        <span>{t('layerManager.stats.visible')} {statistics.visibleLayers}</span>
        <span>{t('layerManager.stats.elements')} {statistics.totalElements}</span>
      </div>

      {/* Sync Status Info */}
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
        <div className="flex justify-between items-center">
          <span>{t('layerManager.sync.status')}</span>
          <span className={isConnected ? colors.text.success : colors.text.error}>
            {isConnected ? t('layerManager.sync.connected') : t('layerManager.sync.disconnected')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t('layerManager.sync.lastSync')}</span>
          <span>{lastSyncTime.toLocaleTimeString('el-GR')}</span>
        </div>
      </div>

      <div className={`h-px ${colors.bg.muted}`}></div>
    </>
  );
}
