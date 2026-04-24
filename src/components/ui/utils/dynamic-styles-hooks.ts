import { useMemo } from 'react';

import {
  getDynamicBackgroundClass,
  getDynamicBorderClass,
} from './dynamic-styles-generators';

export const useDynamicBackgroundClass = (color?: string, opacity?: number): string => {
  return useMemo(() => {
    return getDynamicBackgroundClass(color, opacity);
  }, [color, opacity]);
};

export const useDynamicBorderClass = (color?: string, width?: string): string => {
  return useMemo(() => {
    return getDynamicBorderClass(color, width);
  }, [color, width]);
};
