/* eslint-disable design-system/enforce-semantic-colors -- Legacy hardcoded fallbacks kept for non-hook contexts */
"use client";

/**
 * Parking utility functions — ADR-191 updated to canonical types.
 * Label maps re-exported from @/types/parking for backward compatibility.
 */

import type { ParkingSpotType, ParkingSpotStatus } from "@/types/parking";
import { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS } from "@/types/parking";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { hardcodedColorValues } from "@/design-system/tokens/colors";

// Re-export canonical label maps
export { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS };

export const getParkingStatusColors = (
  colors?: ReturnType<typeof useSemanticColors>,
): Record<ParkingSpotStatus, string> => {
  if (!colors) {
    return {
      available: 'bg-muted text-muted-foreground',
      occupied: 'bg-[hsl(var(--bg-info))]/20 text-primary',
      reserved: 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
      sold: 'bg-[hsl(var(--bg-success))]/10 text-green-707',
      maintenance: 'bg-destructive/10 text-destructive',
      deleted: 'bg-muted text-muted-foreground',
    };
  }

  return {
    available: `${colors.bg.muted} ${colors.text.muted}`,
    occupied: `${colors.bg.infoSubtle} ${colors.text.info}`,
    reserved: `${colors.bg.warningSubtle} ${colors.text.warning}`,
    sold: `${colors.bg.successSubtle} ${colors.text.success}`,
    maintenance: `${colors.bg.errorSubtle} ${colors.text.error}`,
    deleted: `${colors.bg.muted} ${colors.text.muted}`,
  };
};

export const PARKING_STATUS_COLORS: Record<ParkingSpotStatus, string> = {
  available: 'bg-muted text-muted-foreground',
  occupied: 'bg-[hsl(var(--bg-info))]/20 text-primary',
  reserved: 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
  sold: 'bg-[hsl(var(--bg-success))]/10 text-green-707',
  maintenance: 'bg-destructive/10 text-destructive',
  deleted: 'bg-muted text-muted-foreground',
};

export const getParkingStatusLabel = (status: ParkingSpotStatus | undefined) =>
  PARKING_STATUS_LABELS[status || "available"] || status;

export const getParkingStatusColor = (
  status: ParkingSpotStatus,
  colors?: ReturnType<typeof useSemanticColors>,
) => {
  const colorMap = getParkingStatusColors(colors);
  return (
    colorMap[status] ||
    (colors
      ? `${colors.bg.muted} ${colors.text.muted}`
      : 'bg-muted text-muted-foreground')
  );
};

