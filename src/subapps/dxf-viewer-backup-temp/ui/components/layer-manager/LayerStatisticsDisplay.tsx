import React from 'react';
import type { LayerStatisticsProps } from './types';

export function LayerStatisticsDisplay({ 
  statistics, 
  isConnected, 
  lastSyncTime 
}: LayerStatisticsProps) {
  return (
    <>
      {/* Layer Statistics */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>Σύνολο: {statistics.totalLayers}</span>
        <span>Ορατά: {statistics.visibleLayers}</span>
        <span>Στοιχεία: {statistics.totalElements}</span>
      </div>
      
      {/* Sync Status Info */}
      <div className="text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <span>Sync Status:</span>
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? 'Συνδεδεμένο' : 'Αποσυνδεδεμένο'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Τελευταία Sync:</span>
          <span>{lastSyncTime.toLocaleTimeString('el-GR')}</span>
        </div>
      </div>

      <div className="h-px bg-gray-600"></div>
    </>
  );
}