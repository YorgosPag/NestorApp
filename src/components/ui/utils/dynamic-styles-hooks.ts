/**
 * 🪝 DYNAMIC STYLING HOOKS — SRP MODULE
 *
 * React hooks that memoize the results of the dynamic class generators.
 * Split from `dynamic-styles.ts` for SRP + size compliance (ADR-314 Phase C.5.6).
 * Imports directly from `./dynamic-styles-generators` to avoid barrel cycles.
 */

import { useMemo } from 'react';

import {
  getDynamicBackgroundClass,
  getDynamicBackgroundImageClass,
  getDynamicBorderClass,
  getDynamicElementClasses,
  getDynamicHeightClass,
  getDynamicOpacityClass,
  getDynamicTextClass,
  getDynamicTopClass,
  getDynamicTransformClass,
  getDynamicWidthClass,
  type DynamicStyleConfig,
} from './dynamic-styles-generators';

/**
 * React hook for memoized dynamic background class
 */
export const useDynamicBackgroundClass = (color?: string, opacity?: number): string => {
  return useMemo(() => {
    return getDynamicBackgroundClass(color, opacity);
  }, [color, opacity]);
};

/**
 * React hook for memoized dynamic text class
 */
export const useDynamicTextClass = (color?: string): string => {
  return useMemo(() => {
    return getDynamicTextClass(color);
  }, [color]);
};

/**
 * React hook for memoized dynamic border class
 */
export const useDynamicBorderClass = (color?: string, width?: string): string => {
  return useMemo(() => {
    return getDynamicBorderClass(color, width);
  }, [color, width]);
};

/**
 * React hook for memoized dynamic width class
 */
export const useDynamicWidthClass = (width?: string): string => {
  return useMemo(() => {
    return getDynamicWidthClass(width);
  }, [width]);
};

/**
 * React hook for memoized dynamic transform class
 */
export const useDynamicTransformClass = (transform?: string): string => {
  return useMemo(() => {
    return getDynamicTransformClass(transform);
  }, [transform]);
};

/**
 * React hook for memoized dynamic height class
 */
export const useDynamicHeightClass = (height?: string): string => {
  return useMemo(() => {
    return getDynamicHeightClass(height);
  }, [height]);
};

/**
 * React hook for memoized dynamic top class
 */
export const useDynamicTopClass = (top?: string): string => {
  return useMemo(() => {
    return getDynamicTopClass(top);
  }, [top]);
};

/**
 * React hook for memoized dynamic opacity class
 */
export const useDynamicOpacityClass = (opacity?: number): string => {
  return useMemo(() => {
    return getDynamicOpacityClass(opacity);
  }, [opacity]);
};

/**
 * React hook for memoized dynamic background image class
 */
export const useDynamicBackgroundImageClass = (backgroundImage?: string): string => {
  return useMemo(() => {
    return getDynamicBackgroundImageClass(backgroundImage);
  }, [backgroundImage]);
};

/**
 * React hook for complete dynamic element styling
 */
export const useDynamicElementClasses = (config: DynamicStyleConfig): string => {
  return useMemo(() => {
    return getDynamicElementClasses(config);
  }, [
    config.backgroundColor,
    config.backgroundOpacity,
    config.textColor,
    config.borderColor,
    config.borderWidth,
  ]);
};
