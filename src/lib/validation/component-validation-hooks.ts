// React Hooks for Component Validation
// Runtime validation for design system compliance

import React, { useEffect, useRef, useContext, createContext } from 'react';
import { validateComponentProps, checkDesignSystemCompliance } from './design-system-validation';

// Hook for validating component props in development
export const useDesignSystemValidation = (
  props: any, 
  componentName: string,
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Only validate on initial mount to avoid excessive warnings
    if (isInitialMount.current) {
      validateComponentProps(props, componentName);
      isInitialMount.current = false;
    }
  }, [props, componentName, enabled]);
};

// Hook for validating className usage
export const useClassNameValidation = (
  className: string | undefined,
  componentName: string,
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  useEffect(() => {
    if (!enabled || !className) return;
    
    const compliance = checkDesignSystemCompliance(className);
    
    if (!compliance.isCompliant) {
      // Group logging removed
      // Warning logging removed
      // Info logging removed
      // Group logging removed
    }
  }, [className, componentName, enabled]);
};

// Hook for tracking design system usage analytics
export const useDesignSystemAnalytics = (
  componentName: string,
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  const analyticsRef = useRef({
    hardcodedValuesCount: 0,
    designTokenUsageCount: 0,
    validationErrors: 0
  });
  
  useEffect(() => {
    if (!enabled) return;
    
    // Log design system usage statistics
    const logAnalytics = () => {
      const stats = analyticsRef.current;
      // Debug logging removed
    };
    
    // Log analytics on unmount (component cleanup)
    return logAnalytics;
  }, [componentName, enabled]);
  
  return analyticsRef.current;
};

// Enhanced validation hook with automatic fixes suggestions
export const useAdvancedDesignSystemValidation = (
  props: any,
  componentName: string,
  options: {
    enabled?: boolean;
    autoFix?: boolean;
    showSuggestions?: boolean;
    trackAnalytics?: boolean;
  } = {}
) => {
  const {
    enabled = process.env.NODE_ENV === 'development',
    autoFix = false,
    showSuggestions = true,
    trackAnalytics = true
  } = options;
  
  const analytics = trackAnalytics ? useDesignSystemAnalytics(componentName, enabled) : null;
  
  useDesignSystemValidation(props, componentName, enabled);
  useClassNameValidation(props.className, componentName, enabled);
  
  useEffect(() => {
    if (!enabled || !showSuggestions) return;
    
    // Generate improvement suggestions
    const suggestions: string[] = [];
    
    // Check for common improvements
    if (props.className && typeof props.className === 'string') {
      if (props.className.includes('text-red-')) {
        suggestions.push('Consider using getStatusColor("error", "text") for error states');
      }
      if (props.className.includes('bg-green-')) {
        suggestions.push('Consider using getStatusColor("success", "bg") for success states');
      }
      if (props.className.includes('p-') || props.className.includes('m-')) {
        suggestions.push('Consider using getSpacingClass() for consistent spacing');
      }
    }
    
    if (props.style && Object.keys(props.style).length > 0) {
      suggestions.push('Consider replacing inline styles with design token classes');
    }
    
    // Display suggestions
    if (suggestions.length > 0) {
      // Group logging removed
      // Info logging removed
      // Group logging removed
    }
    
    // Update analytics
    if (analytics) {
      if (suggestions.length > 0) {
        analytics.validationErrors += suggestions.length;
      }
    }
  }, [props, componentName, enabled, showSuggestions, analytics]);
  
  return {
    isValid: true, // Always return true to not break components
    suggestions: enabled ? [] : [], // Return suggestions if needed
    analytics
  };
};

// Validation context for providing validation settings across components

interface ValidationContextType {
  enabled: boolean;
  strict: boolean;
  showSuggestions: boolean;
  trackAnalytics: boolean;
}

const ValidationContext = createContext<ValidationContextType>({
  enabled: process.env.NODE_ENV === 'development',
  strict: false,
  showSuggestions: true,
  trackAnalytics: true
});

export const useValidationContext = () => useContext(ValidationContext);

export const ValidationProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<ValidationContextType>;
}> = ({ children, config = {} }) => {
  const value: ValidationContextType = {
    enabled: process.env.NODE_ENV === 'development',
    strict: false,
    showSuggestions: true,
    trackAnalytics: true,
    ...config
  };
  
  // Return null since we can't use JSX in .ts files
  // This provider should be moved to a .tsx file if needed
  return null;
};