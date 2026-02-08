// Design System Validation Utilities
// Ensures proper usage of design tokens and prevents hardcoded values

import type { CSSProperties } from 'react';
import { designTokens } from '@/styles/design-tokens';

// Type guards for design system compliance
export type ValidatedColor = string & { __brand: 'ValidatedColor' };
export type ValidatedSpacing = string & { __brand: 'ValidatedSpacing' };
export type ValidatedTypography = string & { __brand: 'ValidatedTypography' };

// Validation patterns
const HARDCODED_COLOR_PATTERN = /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\(|rgba\(/;
const HARDCODED_SPACING_PATTERN = /\d+px|\d+rem|\d+em/;
const CSS_VARIABLE_PATTERN = /hsl\(var\(--[\w-]+\)\)/;
const DESIGN_TOKEN_PATTERN = /^(text|bg|border)-\[(hsl\(var\(--[\w-]+\)\))\]$/;

// Validation functions
export const validateColor = (color: string): ValidatedColor | null => {
  // Allow CSS variables (our semantic colors)
  if (CSS_VARIABLE_PATTERN.test(color)) {
    return color as ValidatedColor;
  }
  
  // Allow Tailwind design token classes
  if (DESIGN_TOKEN_PATTERN.test(color)) {
    return color as ValidatedColor;
  }
  
  // Allow predefined theme colors
  const allowedColors = [
    'primary', 'secondary', 'accent', 'muted', 'destructive',
    'background', 'foreground', 'card', 'border', 'input'
  ];
  
  if (allowedColors.some(allowed => color.includes(allowed))) {
    return color as ValidatedColor;
  }
  
  // Reject hardcoded colors
  if (HARDCODED_COLOR_PATTERN.test(color)) {
    // Warning logging removed
    return null;
  }
  
  return color as ValidatedColor;
};

export const validateSpacing = (spacing: string): ValidatedSpacing | null => {
  // Allow design token spacing
  const validSpacingTokens = Object.keys(designTokens.spacing.component.padding);
  if (validSpacingTokens.some(token => spacing.includes(token))) {
    return spacing as ValidatedSpacing;
  }
  
  // Allow Tailwind spacing classes
  if (/^(p|m|gap|space)-\d+$/.test(spacing)) {
    return spacing as ValidatedSpacing;
  }
  
  // Reject hardcoded spacing
  if (HARDCODED_SPACING_PATTERN.test(spacing)) {
    // Warning logging removed
    return null;
  }
  
  return spacing as ValidatedSpacing;
};

export const validateTypography = (typography: string): ValidatedTypography | null => {
  // Allow design token typography
  const validTypographyTokens = Object.keys(designTokens.typography.fontSize);
  if (validTypographyTokens.some(token => typography.includes(token))) {
    return typography as ValidatedTypography;
  }
  
  // Allow Tailwind typography classes
  if (/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/.test(typography)) {
    return typography as ValidatedTypography;
  }
  
  return typography as ValidatedTypography;
};

// Component props validation
export interface ValidatedComponentProps {
  className?: ValidatedColor | ValidatedSpacing | ValidatedTypography;
  style?: Record<string, never>; // Discourage inline styles
}

// Component props interface for validation
interface ComponentPropsToValidate {
  className?: string;
  style?: Record<string, unknown> | CSSProperties;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  [key: string]: unknown;
}

// Validation helper for component development
export const validateComponentProps = (props: ComponentPropsToValidate, componentName: string): boolean => {
  let isValid = true;

  // Check for hardcoded colors in className
  if (props.className && typeof props.className === 'string') {
    const classNames = props.className.split(' ');
    
    classNames.forEach(className => {
      // Check for potential hardcoded values
      if (className.includes('#') || className.includes('rgb')) {
        // Warning logging removed
        isValid = false;
      }
    });
  }
  
  // Discourage inline styles
  if (props.style && Object.keys(props.style).length > 0) {
    // Warning logging removed
  }
  
  // Check for deprecated color props
  const deprecatedColorProps = ['color', 'backgroundColor', 'borderColor'];
  deprecatedColorProps.forEach(prop => {
    if (props[prop] && typeof props[prop] === 'string') {
      if (HARDCODED_COLOR_PATTERN.test(props[prop])) {
        // Warning logging removed
        isValid = false;
      }
    }
  });
  
  return isValid;
};

// Runtime validation for development
export const enableDesignSystemValidation = (isDevelopment: boolean = process.env.NODE_ENV === 'development') => {
  if (!isDevelopment) return;
  
  // Debug logging removed

  // Runtime validation logic can be added here in the future
};

// Design system compliance checker
export const checkDesignSystemCompliance = (codeString: string): {
  isCompliant: boolean;
  violations: string[];
  suggestions: string[];
} => {
  const violations: string[] = [];
  const suggestions: string[] = [];
  
  // Check for hardcoded colors
  const colorMatches = codeString.match(HARDCODED_COLOR_PATTERN);
  if (colorMatches) {
    violations.push(`Hardcoded colors found: ${colorMatches.join(', ')}`);
    suggestions.push('Use semantic colors: getStatusColor() or CSS variables like hsl(var(--status-success))');
  }
  
  // Check for hardcoded spacing
  const spacingMatches = codeString.match(HARDCODED_SPACING_PATTERN);
  if (spacingMatches) {
    violations.push(`Hardcoded spacing found: ${spacingMatches.join(', ')}`);
    suggestions.push('Use design tokens: getSpacingClass() or Tailwind classes like p-4, m-2');
  }
  
  // Check for missing design system imports
  if (!codeString.includes('@/lib/design-system') && !codeString.includes('@/styles/design-tokens')) {
    if (codeString.includes('className') || codeString.includes('style')) {
      suggestions.push('Consider importing design system utilities for consistent styling');
    }
  }
  
  return {
    isCompliant: violations.length === 0,
    violations,
    suggestions
  };
};

// Export validation utilities
export const designSystemValidation = {
  validateColor,
  validateSpacing,
  validateTypography,
  validateComponentProps,
  enableDesignSystemValidation,
  checkDesignSystemCompliance
};
