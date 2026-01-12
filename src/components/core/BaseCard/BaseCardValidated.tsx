// Enhanced BaseCard with built-in validation
// Demonstrates how to integrate design system validation

'use client';

import React from 'react';
import { BaseCard, BaseCardProps } from './BaseCard';
import { useAdvancedDesignSystemValidation } from '@/lib/validation/component-validation-hooks';
import { cn } from '@/lib/design-system';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface ValidatedBaseCardProps extends BaseCardProps {
  // Additional validation options
  validationOptions?: {
    enabled?: boolean;
    strict?: boolean;
    showSuggestions?: boolean;
    trackAnalytics?: boolean;
  };
}

export function BaseCardValidated({
  className,
  validationOptions = {},
  ...props
}: ValidatedBaseCardProps) {
  const { quick, getStatusBorder } = useBorderTokens();

  // Apply validation hooks
  const validation = useAdvancedDesignSystemValidation(
    { className, ...props },
    'BaseCard',
    {
      enabled: process.env.NODE_ENV === 'development',
      showSuggestions: true,
      trackAnalytics: true,
      ...validationOptions
    }
  );

  // Enhanced className with validation feedback (development only)
  const enhancedClassName = React.useMemo(() => {
    if (process.env.NODE_ENV !== 'development') {
      return className;
    }

    // Add visual indicators for validation status in development
    const validationClasses = validation.analytics && validation.analytics.validationErrors > 0
      ? `ring-2 ring-hsl(var(--border-warning)) dark:ring-hsl(var(--border-warning))` // ✅ ENTERPRISE: Centralized warning ring
      : '';

    return cn(className, validationClasses);
  }, [className, validation.analytics]);

  // Add development-only validation overlay
  const ValidationOverlay = React.useMemo(() => {
    if (process.env.NODE_ENV !== 'development' || !validationOptions.enabled) {
      return null;
    }

    const hasIssues = validation.analytics && validation.analytics.validationErrors > 0;
    
    if (!hasIssues) return null;

    return (
      <div className="absolute top-2 right-2 z-50">
        <div className={`bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 rounded-md ${quick.warning}`}>
          <span className="font-medium">⚠️ Design System Issues</span>
          <div className="text-xs mt-1">
            {validation.analytics?.validationErrors} validation warnings
          </div>
        </div>
      </div>
    );
  }, [validation.analytics, validationOptions.enabled]);

  return (
    <div className="relative">
      <BaseCard
        {...props}
        className={enhancedClassName}
      />
      {ValidationOverlay}
    </div>
  );
}

// Export validation-enhanced versions of common compositions
export function ValidatedBuildingCard(props: Omit<ValidatedBaseCardProps, 'validationOptions'>) {
  return (
    <BaseCardValidated
      {...props}
      validationOptions={{
        enabled: true,
        showSuggestions: true,
        trackAnalytics: true
      }}
    />
  );
}

export function ValidatedProjectCard(props: Omit<ValidatedBaseCardProps, 'validationOptions'>) {
  return (
    <BaseCardValidated
      {...props}
      validationOptions={{
        enabled: true,
        showSuggestions: true,
        trackAnalytics: true
      }}
    />
  );
}

/** Validation options for HOC */
interface ValidationHOCOptions {
  enabled?: boolean;
  strict?: boolean;
  showSuggestions?: boolean;
  trackAnalytics?: boolean;
}

// HOC for adding validation to any component
export function withDesignSystemValidation<T extends object>(
  Component: React.ComponentType<T>,
  componentName: string,
  validationOptions: ValidationHOCOptions = {}
) {
  const ValidatedComponent = React.forwardRef<HTMLElement, T>((props, ref) => {
    useAdvancedDesignSystemValidation(
      props,
      componentName,
      {
        enabled: process.env.NODE_ENV === 'development',
        showSuggestions: true,
        ...validationOptions
      }
    );

    return <Component {...props} ref={ref as React.Ref<never>} />;
  });

  ValidatedComponent.displayName = `Validated${componentName}`;
  return ValidatedComponent;
}