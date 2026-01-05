'use client';
import React from 'react';
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

interface StorageStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function StorageStatus({ showDetails = false, className }: StorageStatusProps) {
  const iconSizes = useIconSizes();
  const { radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { storageInfo } = useStorageMonitor();
  const notifications = useNotifications();
  const [isClearing, setIsClearing] = React.useState(false);

  const handleClearStorage = async () => {
    const confirmed = confirm(
      'Θέλετε να καθαρίσετε το cached storage data?\n\n' +
      'Αυτό θα διαγράψει:\n' +
      '• Cached DXF files\n' +
      '• Temporary data\n' +
      '• Browser cache\n\n' +
      'Τα αποθηκευμένα projects δεν θα επηρεαστούν.'
    );
    
    if (!confirmed) return;

    try {
      setIsClearing(true);
      await StorageManager.clearAllStorage();
      notifications.success('✅ Storage καθαρίστηκε! Ανανεώνω τη σελίδα...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error clearing storage:', error);
      notifications.error('❌ Σφάλμα κατά τον καθαρισμό storage.');
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
              <div className="font-medium">Storage</div>
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
                {isClearing ? 'Clearing...' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
        
        {showDetails && (
          <>
            {/* Progress bar */}
            <div className={PANEL_LAYOUT.MARGIN.TOP_SM}>
              <div className={`w-full ${colors.bg.muted} ${radius.full} h-2`}>
                <div
                  className={`h-2 ${radius.full} transition-all duration-300 ${
                    isCritical ? `${colors.bg.error}` : isWarning ? `${colors.bg.warning}` : `${colors.bg.info}`
                  } w-[${Math.min(usagePercentage, 100)}%]`}
                />
              </div>
              <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
                {usagePercentage.toFixed(1)}% used • {StorageManager.formatBytes(storageInfo.quota - storageInfo.usage)} available
              </div>
            </div>

            {/* Warnings */}
            {isCritical && (
              <div className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.error} ${colors.bg.errorLight} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md}`}>
                ⚠️ Storage σχεδόν γεμάτο! Καθαρίστε το για να αποφύγετε errors.
              </div>
            )}
            {isWarning && !isCritical && (
              <div className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.warning} ${colors.bg.warningLight} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md}`}>
                ⚠️ Storage σε χαμηλά επίπεδα. Σκεφτείτε καθαρισμό.
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
  const colors = { text: { warning: 'text-yellow-500' } }; // Mock colors
  const iconSizes = { xs: 'w-3 h-3' }; // Mock icon sizes

  if (!storageInfo) return null;

  const usagePercentage = storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0;
  const isWarning = usagePercentage > 80;

  if (!isWarning) return null;

  return (
    <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS} text-xs ${colors.text.warning}`}>
      <HardDrive className={iconSizes.xs} />
      <span>{usagePercentage.toFixed(0)}%</span>
    </div>
  );
}