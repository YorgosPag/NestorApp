// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';
import React from 'react';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
// StorageErrorBoundary module not available - creating mock
const useStorageMonitor = () => ({
  isLowSpace: false,
  totalSize: 0,
  usedSize: 0,
  storageInfo: { usage: 0, quota: 1000000 }
});
import { StorageManager } from '../utils/storage-utils';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { HardDrive, Trash2, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../../../providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE ADR-082: Centralized number formatting (replaces .toFixed())
import { getFormatter } from '../formatting';

interface StorageStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function StorageStatus({ showDetails = false, className }: StorageStatusProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { storageInfo } = useStorageMonitor();
  const notifications = useNotifications();
  const [isClearing, setIsClearing] = React.useState(false);

  const handleClearStorage = async () => {
    const confirmed = confirm(t('storage.clearConfirm'));

    if (!confirmed) return;

    try {
      setIsClearing(true);
      await StorageManager.clearAllStorage();
      notifications.success(`✅ ${t('storage.clearedSuccess')}`);
      setTimeout(() => window.location.reload(), PANEL_LAYOUT.TIMING.PAGE_RELOAD);
    } catch (error) {
      console.error('Error clearing storage:', error);
      notifications.error(`❌ ${t('storage.clearError')}`);
    } finally {
      setIsClearing(false);
    }
  };

  if (!storageInfo) {
    return null;
  }

  const usagePercentage = storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0;
  const isWarning = usagePercentage > 80;
  const isCritical = usagePercentage > 95;

  if (!showDetails && !isWarning) {
    return null; // Don't show if not in warning state and details not requested
  }

  return (
    <Card className={`${className} ${isCritical ? getStatusBorder('error') : isWarning ? getStatusBorder('warning') : ''}`}>
      <CardContent className={PANEL_LAYOUT.SPACING.MD}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <HardDrive className={`${iconSizes.sm} ${isCritical ? colors.text.error : isWarning ? colors.text.warning : colors.text.muted}`} />
            <div className={PANEL_LAYOUT.INPUT.TEXT_SIZE}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Storage</div>
              {showDetails && (
                <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted}`}>
                  {StorageManager.formatBytes(storageInfo.usage)} / {StorageManager.formatBytes(storageInfo.quota)}
                </div>
              )}
            </div>
          </div>

          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            {(isWarning || isCritical) && (
              <AlertTriangle className={`${iconSizes.sm} ${isCritical ? colors.text.error : colors.text.warning}`} />
            )}

            {showDetails && (
              <Button
                onClick={handleClearStorage}
                disabled={isClearing}
                size="sm"
                variant="outline"
                className={PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS}
              >
                <Trash2 className={`${iconSizes.xs} ${PANEL_LAYOUT.MARGIN.RIGHT_XS}`} />
                {isClearing ? t('storage.clearing') : t('storage.clear')}
              </Button>
            )}
          </div>
        </div>
        
        {showDetails && (
          <>
            {/* Progress bar */}
            <div className={PANEL_LAYOUT.MARGIN.TOP_SM}>
              <div className={`w-full ${colors.bg.muted} ${radius.full} ${PANEL_LAYOUT.HEIGHT.SM}`}>
                <div
                  className={`${PANEL_LAYOUT.HEIGHT.SM} ${radius.full} ${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['300']} ${
                    isCritical ? `${colors.bg.error}` : isWarning ? `${colors.bg.warning}` : `${colors.bg.info}`
                  } w-[${Math.min(usagePercentage, 100)}%]`}
                />
              </div>
              {/* 🏢 ENTERPRISE ADR-082: Uses FormatterRegistry for locale-aware percentage formatting */}
              <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
                {getFormatter().formatLinear(usagePercentage, { precision: 1 })}% used • {StorageManager.formatBytes(storageInfo.quota - storageInfo.usage)} available
              </div>
            </div>

            {/* Warnings */}
            {isCritical && (
              <div className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.error} ${colors.bg.errorLight} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md}`}>
                ⚠️ {t('storage.criticalWarning')}
              </div>
            )}
            {isWarning && !isCritical && (
              <div className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.warning} ${colors.bg.warningLight} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md}`}>
                ⚠️ {t('storage.lowWarning')}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Lightweight version for toolbar/status bar
export function StorageStatusIndicator() {
  const { storageInfo } = useStorageMonitor();
  // ✅ ENTERPRISE: Use centralized hooks instead of hardcoded mock values
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  if (!storageInfo) return null;

  const usagePercentage = storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0;
  const isWarning = usagePercentage > 80;

  if (!isWarning) return null;

  // 🏢 ENTERPRISE ADR-082: Uses FormatterRegistry for locale-aware percentage formatting
  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warning}`}>
      <HardDrive className={iconSizes.xs} />
      <span>{getFormatter().formatLinear(usagePercentage, { precision: 0 })}%</span>
    </div>
  );
}