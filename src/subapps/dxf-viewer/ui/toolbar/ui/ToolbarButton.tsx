/**
 * 🏢 ENTERPRISE TOOLBAR BUTTON
 *
 * @description
 * Centralized toolbar button component using BaseButton foundation.
 * Eliminates inline styles and ensures enterprise consistency.
 *
 * @features
 * - ✅ Zero inline styles (CLAUDE.md compliant)
 * - ✅ Centralized border tokens
 * - ✅ Enterprise button variants
 * - ✅ Proper TypeScript types
 * - ✅ Icon support with proper spacing
 *
 * @migration_from
 * Legacy ToolbarButton with 100+ lines of inline styles
 * → Modern enterprise component with centralized styling
 */

'use client';
import React from 'react';
import { BaseButton, type ButtonVariant } from '../../../components/shared/BaseButton'; // ✅ ENTERPRISE FIX: Correct path to BaseButton
import { withIconProps } from '../../icons/iconRegistry';
import { useBorderTokens } from '../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Legacy → Enterprise variant mapping
const VARIANT_MAP: Record<string, ButtonVariant> = {
  'default': 'secondary',
  'primary': 'primary',
  'success': 'secondary', // Map to secondary with success styling via className
  'danger': 'secondary'   // Map to secondary with danger styling via className
} as const;

// Legacy → Enterprise size mapping
const SIZE_MAP: Record<string, 'xs' | 'sm' | 'md' | 'lg'> = {
  'small': 'xs',
  'medium': 'sm',
  'large': 'md'
} as const;

interface ToolbarButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'danger';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function ToolbarButton({
  label,
  icon,
  onClick,
  active = false,
  variant = 'default',
  disabled = false,
  size = 'medium'
}: ToolbarButtonProps) {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Map legacy props to BaseButton props
  const buttonVariant = VARIANT_MAP[variant];
  const buttonSize = SIZE_MAP[size];

  // 🎨 ENTERPRISE: Custom styling for success/danger variants
  const customVariantClass = variant === 'success'
    ? `${colors.bg.success} ${getStatusBorder('success')} ${colors.text.success} hover:${colors.bg.successHover}`
    : variant === 'danger'
    ? `${colors.bg.danger} ${getStatusBorder('error')} ${colors.text.error} hover:${colors.bg.dangerHover}`
    : '';

  return (
    <BaseButton
      variant={buttonVariant}
      size={buttonSize}
      isActive={active}
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={customVariantClass}
    >
      {icon && withIconProps(icon)}
      {label}
    </BaseButton>
  );
}
