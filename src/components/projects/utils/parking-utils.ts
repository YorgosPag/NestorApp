'use client';

import type { ParkingSpotType, ParkingSpotStatus } from '@/types/parking';

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

export const PARKING_STATUS_COLORS: Record<ParkingSpotStatus, string> = {
  sold: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  available: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
};

export const getParkingTypeLabel = (type: ParkingSpotType) => PARKING_TYPE_LABELS[type] || type;
export const getParkingStatusLabel = (status: ParkingSpotStatus) => PARKING_STATUS_LABELS[status] || status;
export const getParkingStatusColor = (status: ParkingSpotStatus) => PARKING_STATUS_COLORS[status] || '';

export const formatNumber = (value: any): string => {
  const num = Number(value);
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
};
