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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { AnimatedSpinner } from '../modal/ModalLoadingStates';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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

// ✅ ENTERPRISE: Dynamic variant style mappings με CSS variables
const getVariantStyles = (
  borderTokens: ReturnType<typeof useBorderTokens>,
  colors: ReturnType<typeof useSemanticColors>
): Record<ButtonVariant, string> => ({
  primary: `${colors.bg.info} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.inverted} ${borderTokens.getStatusBorder('info')}`,
  secondary: `${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.secondary} ${borderTokens.quick.card}`,
  ghost: `bg-transparent ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} border-transparent`,
  outline: `bg-transparent ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.muted} ${borderTokens.quick.card}`,
  tool: `${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.secondary} ${borderTokens.quick.card}`,
  tab: `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.muted} ${borderTokens.quick.card}`,
  action: `${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.secondary} ${borderTokens.quick.card}`
});

// ✅ ENTERPRISE: Dynamic active variant styles με CSS variables
const getActiveVariantStyles = (
  borderTokens: ReturnType<typeof useBorderTokens>,
  colors: ReturnType<typeof useSemanticColors>
): Record<ButtonVariant, string> => ({
  primary: `${colors.bg.info} ${colors.text.inverted} ${borderTokens.getStatusBorder('info')}`,
  secondary: `${colors.bg.active} ${colors.text.inverted} ${borderTokens.quick.card}`,
  ghost: `${colors.bg.hover} ${colors.text.inverted} ${borderTokens.quick.card}`,
  outline: `${colors.bg.hover} ${colors.text.inverted} ${borderTokens.quick.card}`,
  tool: `${colors.bg.info} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.inverted} ${borderTokens.getStatusBorder('info')}`,
  tab: `${colors.bg.info} ${colors.text.inverted} ${borderTokens.getStatusBorder('info')}`,
  action: `${colors.bg.info} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.inverted} ${borderTokens.getStatusBorder('info')}`
});

// ✅ ENTERPRISE: Button sizes via PANEL_LAYOUT tokens - ZERO HARDCODED VALUES
const sizeStyles: Record<ButtonSize, string> = {
  xs: `${PANEL_LAYOUT.BUTTON.HEIGHT_SM} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`,        // h-6 24px height, px-2 py-1
  sm: `${PANEL_LAYOUT.BUTTON.HEIGHT} ${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE}`, // h-8, px-3 py-2, text-sm
  md: `${PANEL_LAYOUT.BUTTON.HEIGHT_MD} ${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.TYPOGRAPHY.BASE}`,   // h-10, px-4 py-2
  lg: `${PANEL_LAYOUT.BUTTON.HEIGHT_LG} ${PANEL_LAYOUT.BUTTON.PADDING_XL} ${PANEL_LAYOUT.TYPOGRAPHY.LG}`,     // h-12, px-6 - largest buttons
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
    const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
    const baseClasses = `inline-flex items-center justify-center ${borderTokens.radius.md} border ${PANEL_LAYOUT.TRANSITION.COLORS} duration-150 ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} focus:outline-none focus:ring-2 focus:${borderTokens.getStatusBorder('info')} focus:ring-offset-2`;

    const variantStyles = getVariantStyles(borderTokens, colors);
    const activeVariantStyles = getActiveVariantStyles(borderTokens, colors);
    const variantClass = isActive ? activeVariantStyles[variant] : variantStyles[variant];
    const sizeClass = sizeStyles[size];
    const iconSizeClass = getIconSizeStyles(iconSizes)[size];
    
    const disabledClass = disabled ? `opacity-50 ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}` : '';
    const widthClass = fullWidth ? 'w-full' : '';
    const loadingClass = isLoading ? `opacity-75 ${PANEL_LAYOUT.CURSOR.WAIT}` : '';
    
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
          <Icon className={`${iconSizeClass} ${children ? PANEL_LAYOUT.MARGIN.RIGHT_SM : ''}`} />
        )}
        {isLoading && (
          <AnimatedSpinner
            size={size === 'xs' ? 'small' : size === 'sm' ? 'small' : 'medium'}
            className={children ? PANEL_LAYOUT.MARGIN.RIGHT_SM : ''}
          />
        )}
        {children}
        {Icon && iconPosition === 'right' && (
          <Icon className={`${iconSizeClass} ${children ? PANEL_LAYOUT.MARGIN.LEFT_SM : ''}`} />
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