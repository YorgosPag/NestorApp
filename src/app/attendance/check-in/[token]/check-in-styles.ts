/**
 * =============================================================================
 * Check-In Semantic Color Tokens + Helpers
 * =============================================================================
 *
 * Extracted from CheckInClient for SRP compliance (<500 lines).
 * Maps design-system semantic API to attendance-specific UI states.
 *
 * @module app/attendance/check-in/[token]/check-in-styles
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { getStatusColor } from '@/lib/design-system';
import { formatDate } from '@/lib/intl-utils';

// =============================================================================
// SEMANTIC COLOR TOKENS (design-system bridge)
// =============================================================================

export const STATUS_CLASSES = {
  error: {
    containerBg: 'bg-destructive/10',
    containerBorder: `border ${getStatusColor('error', 'border')}/30`,
    icon: getStatusColor('error', 'text'),
    title: getStatusColor('error', 'text'),
    body: `${getStatusColor('error', 'text')}/80`,
    buttonBg: getStatusColor('error', 'bg'),
    buttonHover: `${getStatusColor('error', 'bg')}/90`,
  },
  success: {
    containerBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    containerBorder: `border ${getStatusColor('active', 'border')}/30`,
    icon: getStatusColor('active', 'text'),
    title: getStatusColor('active', 'text'),
    body: `${getStatusColor('active', 'text')}/80`,
  },
  info: {
    spinnerText: getStatusColor('pending', 'text'),
    link: getStatusColor('pending', 'text'),
    containerBg: 'bg-sky-50 dark:bg-sky-950/30',
    containerBorder: `border ${getStatusColor('pending', 'border')}/30`,
    body: `${getStatusColor('pending', 'text')}/80`,
    buttonBg: getStatusColor('pending', 'bg'),
    buttonBgHover: `${getStatusColor('pending', 'bg')}/90`,
    buttonBgActive: `${getStatusColor('pending', 'bg')}/80`,
  },
  warning: {
    containerBg: 'bg-amber-50 dark:bg-amber-950/30',
    containerBorder: 'border border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500 dark:text-amber-400',
    body: 'text-amber-700 dark:text-amber-300',
  },
  gpsGranted: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: getStatusColor('active', 'text'),
  },
} as const;

// =============================================================================
// HELPERS
// =============================================================================

export function formatDateGreek(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return formatDate(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
