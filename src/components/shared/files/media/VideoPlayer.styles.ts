import type { CSSProperties } from 'react';
import { layoutUtilities } from '@/styles/design-tokens';

const clampPercentage = (value: number): number => Math.max(0, Math.min(100, value));

const widthStyle = (percent: number): CSSProperties => ({
  width: layoutUtilities.percentage(clampPercentage(percent)),
});

export const VIDEO_PLAYER_THUMB_OFFSET = '6px';

export const videoPlayerProgressStyles = {
  buffered: (percent: number): CSSProperties => widthStyle(percent),
  played: (percent: number): CSSProperties => widthStyle(percent),
  thumb: (percent: number): CSSProperties => ({
    left: `calc(${layoutUtilities.percentage(clampPercentage(percent))} - ${VIDEO_PLAYER_THUMB_OFFSET})`,
  }),
} as const;
