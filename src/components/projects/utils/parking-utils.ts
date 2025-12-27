'use client';

import type { ParkingSpotType, ParkingSpotStatus } from '@/types/parking';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const PARKING_TYPE_LABELS: Record<ParkingSpotType, string> = {
  underground: 'Υπόγεια',
  covered: 'Σκεπαστή',
  open: 'Υπαίθρια'
};

export const PARKING_STATUS_LABELS: Record<ParkingSpotStatus, string> = {
  sold: 'Πουλημένο',
  owner: 'Οικοπεδούχου',
  available: 'Διαθέσιμο',
  reserved: 'Κρατημένο'
};

// Enterprise function for parking status colors
export const getParkingStatusColors = (colors?: ReturnType<typeof useSemanticColors>): Record<ParkingSpotStatus, string> => {
  if (!colors) {
    // Enterprise fallback
    return {
      sold: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      available: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
      reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    };
  }

  return {
    sold: `${colors.bg.successSubtle} ${colors.text.success}`,
    owner: `${colors.bg.infoSubtle} ${colors.text.info}`,
    available: `${colors.bg.muted} ${colors.text.muted}`,
    reserved: `${colors.bg.warningSubtle} ${colors.text.warning}`
  };
};

// Legacy export for backward compatibility
export const PARKING_STATUS_COLORS: Record<ParkingSpotStatus, string> = {
  sold: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  available: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
  reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
};

export const getParkingTypeLabel = (type: ParkingSpotType) => PARKING_TYPE_LABELS[type] || type;
export const getParkingStatusLabel = (status: ParkingSpotStatus) => PARKING_STATUS_LABELS[status] || status;

// Enhanced function with semantic colors support
export const getParkingStatusColor = (status: ParkingSpotStatus, colors?: ReturnType<typeof useSemanticColors>) => {
  const colorMap = getParkingStatusColors(colors);
  return colorMap[status] || (colors ? `${colors.bg.muted} ${colors.text.muted}` : 'bg-slate-100 text-slate-800');
};

// Legacy function for backward compatibility
export const getLegacyParkingStatusColor = (status: ParkingSpotStatus) => PARKING_STATUS_COLORS[status] || '';


