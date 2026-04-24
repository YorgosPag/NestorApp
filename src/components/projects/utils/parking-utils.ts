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
      available: `${hardcodedColorValues.background.gray[100]} text-slate-800 dark:bg-slate-900 dark:text-slate-300`,
      occupied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      reserved:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      sold: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      maintenance: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      deleted:
        "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-500",
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
  available:
    "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
  occupied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  reserved:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  sold: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  maintenance: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  deleted: "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-500",
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
      : `${hardcodedColorValues.background.gray[100]} text-slate-800`)
  );
};

