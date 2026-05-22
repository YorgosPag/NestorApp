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
    containerBg: 'bg-[hsl(var(--bg-success))]/10',
    containerBorder: `border ${getStatusColor('active', 'border')}/30`,
    icon: getStatusColor('active', 'text'),
    title: getStatusColor('active', 'text'),
    body: `${getStatusColor('active', 'text')}/80`,
  },
  info: {
    spinnerText: getStatusColor('pending', 'text'),
    link: getStatusColor('pending', 'text'),
    containerBg: 'bg-[hsl(var(--bg-info))]/20',
    containerBorder: `border ${getStatusColor('pending', 'border')}/30`,
    body: `${getStatusColor('pending', 'text')}/80`,
    buttonBg: getStatusColor('pending', 'bg'),
    buttonBgHover: `${getStatusColor('pending', 'bg')}/90`,
    buttonBgActive: `${getStatusColor('pending', 'bg')}/80`,
  },
  warning: {
    containerBg: 'bg-[hsl(var(--bg-warning))]/40',
    containerBorder: 'border border-border',
    icon: 'text-[hsl(var(--text-warning))]',
    body: 'text-[hsl(var(--text-warning))]',
  },
  gpsGranted: {
    bg: 'bg-[hsl(var(--bg-success))]/10',
    text: getStatusColor('active', 'text'),
  },
} as const;

// =============================================================================
// HELPERS
// =============================================================================

export function formatCheckInDateGreek(dateStr: string): string {
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
