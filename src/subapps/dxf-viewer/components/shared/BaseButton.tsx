/**
 * BASE BUTTON COMPONENT
 * Unified button component to eliminate duplicate button patterns across the application
 */

'use client';

import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { AnimatedSpinner } from '../modal/ModalLoadingStates';

// Button variants for consistent styling
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'tool' | 'tab' | 'action';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface BaseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
  isActive?: boolean;
  isLoading?: boolean;
  hotkey?: string;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

// 🏢 ENTERPRISE: Dynamic variant style mappings με centralized border tokens
const getVariantStyles = (borderTokens: ReturnType<typeof useBorderTokens>): Record<ButtonVariant, string> => ({
  primary: `bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white ${borderTokens.getStatusBorder('info')}`,
  secondary: `bg-gray-700 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-gray-200 ${borderTokens.quick.card}`,
  ghost: `bg-transparent ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} text-gray-200 border-transparent`,
  outline: `bg-transparent ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} text-gray-300 ${borderTokens.quick.card}`,
  tool: `bg-gray-700 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-gray-200 ${borderTokens.quick.card}`,
  tab: `bg-gray-800 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} text-gray-300 ${borderTokens.quick.card}`,
  action: `bg-gray-700 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-gray-200 ${borderTokens.quick.card}`
});

// 🏢 ENTERPRISE: Dynamic active variant styles με centralized border tokens
const getActiveVariantStyles = (borderTokens: ReturnType<typeof useBorderTokens>): Record<ButtonVariant, string> => ({
  primary: `bg-blue-700 text-white ${borderTokens.getStatusBorder('info')}`,
  secondary: `bg-gray-600 text-white ${borderTokens.quick.card}`,
  ghost: `bg-gray-700 text-white ${borderTokens.quick.card}`,
  outline: `bg-gray-700 text-white ${borderTokens.quick.card}`,
  tool: `bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white ${borderTokens.getStatusBorder('info')}`,
  tab: `bg-blue-600 text-white ${borderTokens.getStatusBorder('info')}`,
  action: `bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white ${borderTokens.getStatusBorder('info')}`
});

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg'
};

const getIconSizeStyles = (iconSizes: ReturnType<typeof useIconSizes>): Record<ButtonSize, string> => ({
  xs: iconSizes.xs,
  sm: iconSizes.sm,
  md: iconSizes.md,
  lg: iconSizes.lg
});

export const BaseButton = forwardRef<HTMLButtonElement, BaseButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      isActive = false,
      isLoading = false,
      hotkey,
      children,
      fullWidth = false,
      className = '',
      disabled,
      title,
      ...props
    },
    ref
  ) => {
    const iconSizes = useIconSizes();
    const borderTokens = useBorderTokens();
    const baseClasses = `inline-flex items-center justify-center ${borderTokens.radius.md} border transition-colors duration-150 font-medium focus:outline-none focus:ring-2 focus:${borderTokens.getStatusBorder('info')} focus:ring-offset-2`;

    const variantStyles = getVariantStyles(borderTokens);
    const activeVariantStyles = getActiveVariantStyles(borderTokens);
    const variantClass = isActive ? activeVariantStyles[variant] : variantStyles[variant];
    const sizeClass = sizeStyles[size];
    const iconSizeClass = getIconSizeStyles(iconSizes)[size];
    
    const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
    const widthClass = fullWidth ? 'w-full' : '';
    const loadingClass = isLoading ? 'opacity-75 cursor-wait' : '';
    
    const finalTitle = title || (hotkey ? `${children} (${hotkey})` : undefined);
    
    return (
      <button
        ref={ref}
        className={`
          ${baseClasses}
          ${variantClass}
          ${sizeClass}
          ${disabledClass}
          ${widthClass}
          ${loadingClass}
          ${className}
        `.trim()}
        disabled={disabled || isLoading}
        title={finalTitle}
        {...props}
      >
        {Icon && iconPosition === 'left' && (
          <Icon className={`${iconSizeClass} ${children ? 'mr-2' : ''}`} />
        )}
        {isLoading && (
          <AnimatedSpinner
            size={size === 'xs' ? 'small' : size === 'sm' ? 'small' : 'medium'}
            className={children ? 'mr-2' : ''}
          />
        )}
        {children}
        {Icon && iconPosition === 'right' && (
          <Icon className={`${iconSizeClass} ${children ? 'ml-2' : ''}`} />
        )}
      </button>
    );
  }
);

BaseButton.displayName = 'BaseButton';

// Convenience components for common patterns
export const ToolButton = forwardRef<HTMLButtonElement, BaseButtonProps>(
  ({ size = 'sm', variant = 'tool', ...props }, ref) => (
    <BaseButton ref={ref} size={size} variant={variant} {...props} />
  )
);

export const TabButton = forwardRef<HTMLButtonElement, BaseButtonProps>(
  ({ size = 'sm', variant = 'tab', ...props }, ref) => (
    <BaseButton ref={ref} size={size} variant={variant} {...props} />
  )
);

export const ActionButton = forwardRef<HTMLButtonElement, BaseButtonProps>(
  ({ size = 'sm', variant = 'action', ...props }, ref) => (
    <BaseButton ref={ref} size={size} variant={variant} {...props} />
  )
);

ToolButton.displayName = 'ToolButton';
TabButton.displayName = 'TabButton';
ActionButton.displayName = 'ActionButton';