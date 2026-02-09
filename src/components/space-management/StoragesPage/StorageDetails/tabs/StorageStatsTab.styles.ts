import type { CSSProperties } from 'react';
import { layoutUtilities } from '@/styles/design-tokens';

const clampPercentage = (value: number): number => Math.max(0, Math.min(100, value));

export const getEfficiencyColorClass = (score: number): string => {
  if (score > 70) return 'bg-green-500';
  if (score > 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const efficiencyProgressStyle = (score: number): CSSProperties => ({
  width: layoutUtilities.percentage(clampPercentage(score)),
});
