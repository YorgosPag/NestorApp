/**
 * RTL (Right-to-Left) utilities for internationalization
 * Provides helpers for bidirectional text and layout support
 */

import { getCurrentLocale, isRTLLocale, getTextDirection } from './intl-utils';

/**
 * RTL-aware CSS class utilities
 */
export const rtlClasses = {
  // Margin utilities
  marginStart: (value: string) => `ms-${value}`,
  marginEnd: (value: string) => `me-${value}`,
  marginLeft: (value: string) => isRTLLocale() ? `mr-${value}` : `ml-${value}`,
  marginRight: (value: string) => isRTLLocale() ? `ml-${value}` : `mr-${value}`,
  
  // Padding utilities
  paddingStart: (value: string) => `ps-${value}`,
  paddingEnd: (value: string) => `pe-${value}`,
  paddingLeft: (value: string) => isRTLLocale() ? `pr-${value}` : `pl-${value}`,
  paddingRight: (value: string) => isRTLLocale() ? `pl-${value}` : `pr-${value}`,
  
  // Text alignment
  textStart: () => isRTLLocale() ? 'text-right' : 'text-left',
  textEnd: () => isRTLLocale() ? 'text-left' : 'text-right',
  
  // Float utilities
  floatStart: () => isRTLLocale() ? 'float-right' : 'float-left',
  floatEnd: () => isRTLLocale() ? 'float-left' : 'float-right',
  
  // Border utilities
  borderStart: (value: string) => isRTLLocale() ? `border-r-${value}` : `border-l-${value}`,
  borderEnd: (value: string) => isRTLLocale() ? `border-l-${value}` : `border-r-${value}`,
};

/**
 * Generate RTL-aware CSS styles
 */
export const rtlStyles = {
  marginStart: (value: string) => ({
    [isRTLLocale() ? 'marginRight' : 'marginLeft']: value
  }),
  
  marginEnd: (value: string) => ({
    [isRTLLocale() ? 'marginLeft' : 'marginRight']: value
  }),
  
  paddingStart: (value: string) => ({
    [isRTLLocale() ? 'paddingRight' : 'paddingLeft']: value
  }),
  
  paddingEnd: (value: string) => ({
    [isRTLLocale() ? 'paddingLeft' : 'paddingRight']: value
  }),
  
  textAlign: () => ({
    textAlign: isRTLLocale() ? 'right' as const : 'left' as const
  }),
  
  float: () => ({
    float: isRTLLocale() ? 'right' as const : 'left' as const
  }),
  
  borderStart: (value: string) => ({
    [isRTLLocale() ? 'borderRight' : 'borderLeft']: value
  }),
  
  borderEnd: (value: string) => ({
    [isRTLLocale() ? 'borderLeft' : 'borderRight']: value
  }),
  
  transform: (translateX: number) => ({
    transform: `translateX(${isRTLLocale() ? -translateX : translateX}px)`
  })
};

/**
 * RTL-aware icon rotation
 */
export const rtlIcon = {
  rotate: () => isRTLLocale() ? 'rotate-180' : '',
  flipHorizontal: () => isRTLLocale() ? 'scale-x-[-1]' : '',
};

/**
 * Direction-aware animation classes
 */
export const rtlAnimation = {
  slideInStart: () => isRTLLocale() ? 'animate-slide-in-right' : 'animate-slide-in-left',
  slideInEnd: () => isRTLLocale() ? 'animate-slide-in-left' : 'animate-slide-in-right',
  slideOutStart: () => isRTLLocale() ? 'animate-slide-out-right' : 'animate-slide-out-left',
  slideOutEnd: () => isRTLLocale() ? 'animate-slide-out-left' : 'animate-slide-out-right',
};

/**
 * CSS logical properties mapper for RTL support
 */
export const logicalProperties = {
  marginInlineStart: (value: string) => ({ marginInlineStart: value }),
  marginInlineEnd: (value: string) => ({ marginInlineEnd: value }),
  paddingInlineStart: (value: string) => ({ paddingInlineStart: value }),
  paddingInlineEnd: (value: string) => ({ paddingInlineEnd: value }),
  borderInlineStart: (value: string) => ({ borderInlineStart: value }),
  borderInlineEnd: (value: string) => ({ borderInlineEnd: value }),
  insetInlineStart: (value: string) => ({ insetInlineStart: value }),
  insetInlineEnd: (value: string) => ({ insetInlineEnd: value }),
};

/**
 * RTL-aware component props
 */
export interface RTLProps {
  /** Force RTL direction regardless of locale */
  forceRTL?: boolean;
  /** CSS classes to apply based on direction */
  rtlClasses?: string;
  ltrClasses?: string;
}

/**
 * Hook-like function for getting RTL-aware props
 */
export const useRTL = (props?: RTLProps) => {
  const isRTL = props?.forceRTL ?? isRTLLocale();
  const direction = isRTL ? 'rtl' : 'ltr';
  
  return {
    isRTL,
    direction,
    className: isRTL ? props?.rtlClasses : props?.ltrClasses,
    dir: direction,
  };
};

/**
 * Wrap text with bidirectional isolate for mixed content
 */
export const bidiIsolate = (text: string, isRTLContent?: boolean) => {
  const actualDirection = isRTLContent ?? containsRTLCharacters(text);
  return actualDirection ? `\u2067${text}\u2069` : text; // RLI + text + PDI
};

/**
 * Check if text contains RTL characters
 */
export const containsRTLCharacters = (text: string): boolean => {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  return rtlChars.test(text);
};

/**
 * Format currency with RTL considerations
 */
export const formatRTLCurrency = (amount: number, currency: string = 'EUR'): string => {
  const formatted = new Intl.NumberFormat(getCurrentLocale(), {
    style: 'currency',
    currency
  }).format(amount);
  
  // For RTL locales, ensure currency symbol is properly positioned
  return isRTLLocale() ? `\u202D${formatted}\u202C` : formatted; // LTR override for currency
};

/**
 * RTL-aware sorting for strings
 */
export const sortRTL = (strings: string[]): string[] => {
  const locale = getCurrentLocale();
  const collator = new Intl.Collator(locale, { 
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true
  });
  
  return [...strings].sort(collator.compare);
};

/**
 * Generate CSS variables for RTL support
 */
export const generateRTLCSSVars = () => {
  const isRTL = isRTLLocale();
  
  return {
    '--direction': isRTL ? 'rtl' : 'ltr',
    '--start': isRTL ? 'right' : 'left',
    '--end': isRTL ? 'left' : 'right',
    '--rotate': isRTL ? '180deg' : '0deg',
    '--scale-x': isRTL ? '-1' : '1',
  };
};

/**
 * RTL-aware keyboard navigation
 */
export const rtlKeyboard = {
  // Map keyboard events considering RTL
  isLeftKey: (key: string) => {
    const targetKey = isRTLLocale() ? 'ArrowRight' : 'ArrowLeft';
    return key === targetKey;
  },
  
  isRightKey: (key: string) => {
    const targetKey = isRTLLocale() ? 'ArrowLeft' : 'ArrowRight';
    return key === targetKey;
  },
  
  isStartKey: (key: string) => {
    return isRTLLocale() ? key === 'ArrowRight' : key === 'ArrowLeft';
  },
  
  isEndKey: (key: string) => {
    return isRTLLocale() ? key === 'ArrowLeft' : key === 'ArrowRight';
  }
};

/**
 * Export all utilities as default
 */
export default {
  rtlClasses,
  rtlStyles,
  rtlIcon,
  rtlAnimation,
  logicalProperties,
  useRTL,
  bidiIsolate,
  containsRTLCharacters,
  formatRTLCurrency,
  sortRTL,
  generateRTLCSSVars,
  rtlKeyboard
};
