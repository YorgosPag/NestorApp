import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { LayerStatisticsProps } from './types';

export function LayerStatisticsDisplay({
  statistics,
  isConnected,
  lastSyncTime
}: LayerStatisticsProps) {
  const colors = useSemanticColors();
  return (
    <>
      {/* Layer Statistics */}
      <div className={`flex justify-between text-xs ${colors.text.muted}`}>
        <span>Σύνολο: {statistics.totalLayers}</span>
        <span>Ορατά: {statistics.visibleLayers}</span>
        <span>Στοιχεία: {statistics.totalElements}</span>
      </div>

      {/* Sync Status Info */}
      <div className={`text-xs ${colors.text.muted}`}>
        <div className="flex justify-between items-center">
          <span>Sync Status:</span>
          <span className={isConnected ? colors.text.success : colors.text.error}>
            {isConnected ? 'Συνδεδεμένο' : 'Αποσυνδεδεμένο'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Τελευταία Sync:</span>
          <span>{lastSyncTime.toLocaleTimeString('el-GR')}</span>
        </div>
      </div>

      <div className={`h-px ${colors.bg.muted}`}></div>
    </>
  );
}