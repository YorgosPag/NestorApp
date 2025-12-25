'use client';
import React from 'react';
import { useStorageMonitor } from './StorageErrorBoundary';
import { StorageManager } from '../utils/storage-utils';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { HardDrive, Trash2, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../../../providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { layoutUtilities } from '@/styles/design-tokens';

interface StorageStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function StorageStatus({ showDetails = false, className }: StorageStatusProps) {
  const iconSizes = useIconSizes();
  const { radius, getStatusBorder } = useBorderTokens();
  const { storageInfo, checkStorage } = useStorageMonitor();
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
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className={`${iconSizes.sm} ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-gray-500'}`} />
            <div className="text-sm">
              <div className="font-medium">Storage</div>
              {showDetails && (
                <div className="text-xs text-gray-500">
                  {StorageManager.formatBytes(storageInfo.usage)} / {StorageManager.formatBytes(storageInfo.quota)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(isWarning || isCritical) && (
              <AlertTriangle className={`${iconSizes.sm} ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
            )}
            
            {showDetails && (
              <Button
                onClick={handleClearStorage}
                disabled={isClearing}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                <Trash2 className={`${iconSizes.xs} mr-1`} />
                {isClearing ? 'Clearing...' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
        
        {showDetails && (
          <>
            {/* Progress bar */}
            <div className="mt-2">
              <div className={`w-full bg-gray-200 ${radius.full} h-2`}>
                <div
                  className={`h-2 ${radius.full} transition-all duration-300 ${
                    isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
                  } w-[${Math.min(usagePercentage, 100)}%]`}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {usagePercentage.toFixed(1)}% used • {StorageManager.formatBytes(storageInfo.available)} available
              </div>
            </div>
            
            {/* Warnings */}
            {isCritical && (
              <div className={`mt-2 text-xs text-red-600 bg-red-50 p-2 ${radius.md}`}>
                ⚠️ Storage σχεδόν γεμάτο! Καθαρίστε το για να αποφύγετε errors.
              </div>
            )}
            {isWarning && !isCritical && (
              <div className={`mt-2 text-xs text-amber-600 bg-amber-50 p-2 ${radius.md}`}>
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
  
  if (!storageInfo) return null;
  
  const usagePercentage = storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0;
  const isWarning = usagePercentage > 80;
  
  if (!isWarning) return null;
  
  return (
    <div className="flex items-center gap-1 text-xs text-amber-600">
      <HardDrive className={iconSizes.xs} />
      <span>{usagePercentage.toFixed(0)}%</span>
    </div>
  );
}