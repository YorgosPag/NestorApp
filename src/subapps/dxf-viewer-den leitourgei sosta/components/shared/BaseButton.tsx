/**
 * BASE BUTTON COMPONENT
 * Unified button component to eliminate duplicate button patterns across the application
 */

'use client';

import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

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

// Variant style mappings
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500',
  ghost: 'bg-transparent hover:bg-gray-700 text-gray-200 border-transparent',
  outline: 'bg-transparent hover:bg-gray-700 text-gray-300 border-gray-500',
  tool: 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500',
  tab: 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-500',
  action: 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500'
};

const activeVariantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-700 text-white border-blue-400',
  secondary: 'bg-gray-600 text-white border-gray-400',
  ghost: 'bg-gray-700 text-white border-gray-600',
  outline: 'bg-gray-700 text-white border-gray-400',
  tool: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500',
  tab: 'bg-blue-600 text-white border-blue-400',
  action: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg'
};

const iconSizeStyles: Record<ButtonSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

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
    const baseClasses = 'inline-flex items-center justify-center rounded-md border transition-colors duration-150 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    
    const variantClass = isActive ? activeVariantStyles[variant] : variantStyles[variant];
    const sizeClass = sizeStyles[size];
    const iconSizeClass = iconSizeStyles[size];
    
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
          <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${iconSizeClass} ${children ? 'mr-2' : ''}`} />
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