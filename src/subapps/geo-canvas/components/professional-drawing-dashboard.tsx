'use client';

/**
 * @module geo-canvas/components/professional-drawing-dashboard
 * @description Real Estate Monitoring Dashboard sub-component.
 * Extracted from ProfessionalDrawingInterface.tsx for SRP compliance (ADR-065).
 */

import React, { useCallback } from 'react';
import { formatDateShort } from '@/lib/intl-utils';
import { X, BarChart, Settings, Bell, FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

// ============================================================================
// TYPES
// ============================================================================

interface RealEstateStats {
  totalPolygons: number;
  totalAlerts: number;
  activeAlerts: number;
  totalMatches: number;
  averageConfidence: number;
  lastCheck: string;
}

interface MonitoringDashboardProps {
  t: (key: string, options?: Record<string, unknown>) => string;
  realEstateStats: RealEstateStats;
  polygonCount: number;
  batchMonitoringMode: boolean;
  onBatchModeToggle: () => void;
  onMonitorAll: () => void;
  onExport: () => void;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Real Estate Monitoring Dashboard — Phase 2.5.3
 * Shows quick stats, professional actions, and tips.
 */
export function MonitoringDashboard({
  t,
  realEstateStats,
  polygonCount,
  batchMonitoringMode,
  onBatchModeToggle,
  onMonitorAll,
  onExport,
  onClose,
}: MonitoringDashboardProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div className={`mt-4 ${colors.bg.primary} rounded-lg shadow-lg ${quick.card} p-4`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${colors.text.foreground} flex items-center gap-2`}>
          <BarChart className={`${iconSizes.md} ${colors.text.info}`} />
          {t('realEstateMonitoring.title')}
        </h3>
        <button onClick={onClose} className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}>
          <X className={iconSizes.md} />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className={`${colors.bg.info} p-3 rounded-md`}>
          <p className={`text-sm font-medium ${colors.text.info}`}>{t('realEstateMonitoring.stats.monitoringZones')}</p>
          <p className={`text-2xl font-bold ${colors.text.info}`}>{realEstateStats.totalAlerts}</p>
        </div>
        <div className={`${colors.bg.success} p-3 rounded-md`}>
          <p className={`text-sm font-medium ${colors.text.success}`}>{t('realEstateMonitoring.stats.propertiesFound')}</p>
          <p className={`text-2xl font-bold ${colors.text.success}`}>{realEstateStats.totalMatches}</p>
        </div>
        <div className={`${colors.bg.warning} p-3 rounded-md`}>
          <p className={`text-sm font-medium ${colors.text.warning}`}>{t('realEstateMonitoring.stats.avgConfidence')}</p>
          <p className={`text-2xl font-bold ${colors.text.warning}`}>
            {realEstateStats.averageConfidence ? `${Math.round(realEstateStats.averageConfidence * 100)}%` : '-'}
          </p>
        </div>
        <div className={`${colors.bg.accent} p-3 rounded-md`}>
          <p className={`text-sm font-medium ${colors.text.accent}`}>{t('realEstateMonitoring.stats.lastScan')}</p>
          <p className={`text-sm font-bold ${colors.text.accent}`}>
            {realEstateStats.lastCheck ? formatDateShort(new Date(realEstateStats.lastCheck)) : '-'}
          </p>
        </div>
      </div>

      {/* Professional Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <button
          onClick={onBatchModeToggle}
          className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border transition-colors ${
            batchMonitoringMode
              ? `${colors.bg.info} ${getStatusBorder('info')} ${colors.text.info}`
              : `${colors.bg.secondary} border-border ${colors.text.muted} \${HOVER_BACKGROUND_EFFECTS.LIGHT}`
          }`}
        >
          <Settings className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('realEstateMonitoring.actions.batchMode')}</span>
        </button>

        <button
          onClick={onMonitorAll}
          disabled={polygonCount === 0}
          className={`flex items-center justify-center gap-2 ${colors.bg.success} ${colors.text.foreground} py-2 px-4 rounded-lg ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors disabled:opacity-50`}
        >
          <Bell className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('realEstateMonitoring.actions.monitorAll', { count: polygonCount })}</span>
        </button>

        <button
          onClick={onExport}
          disabled={realEstateStats.totalMatches === 0}
          className={`flex items-center justify-center gap-2 ${colors.bg.muted} ${colors.text.foreground} py-2 px-4 rounded-lg ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors disabled:opacity-50`}
        >
          <FileText className={iconSizes.sm} />
          <span className="text-sm font-medium">{t('realEstateMonitoring.actions.exportCsv')}</span>
        </button>
      </div>

      {/* Professional Tips */}
      <div className={`${colors.bg.info} ${quick.info} p-3`}>
        <h4 className={`text-sm font-semibold ${colors.text.info} mb-2`}>{t('realEstateMonitoring.tips.title')}</h4>
        <ul className={`text-xs ${colors.text.info} space-y-1`}>
          <li>{t('realEstateMonitoring.tips.batchMode')}</li>
          <li>{t('realEstateMonitoring.tips.export')}</li>
          <li>{t('realEstateMonitoring.tips.realtime')}</li>
        </ul>
      </div>
    </div>
  );
}
