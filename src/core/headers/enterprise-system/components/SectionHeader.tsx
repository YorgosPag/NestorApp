/**
 * 🏢 SECTION HEADER COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο section header component με icon, title, count support
 * Enterprise implementation για list headers και section titles
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { SectionHeaderProps } from '../types';
import { useIconSizes } from '@/hooks/useIconSizes';
import '@/lib/design-system';


export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  subtitle,
  count,
  actions,
  className,
  variant = 'default',
  headingLevel = 'span'
}) => {
  const iconSizes = useIconSizes();

  // Combine title with count if provided
  const displayTitle = count !== undefined ? `${title} (${count})` : title;

  // Variant-specific styling
  const containerClasses = cn(
    "flex items-center gap-2",
    variant === 'compact' && "flex-shrink-0",
    variant === 'minimal' && "gap-1",
    className
  );

  const titleClasses = cn(
    "font-medium whitespace-nowrap",
    variant === 'minimal' ? "text-xs" : "text-sm"
  );

  const iconClasses = cn(
    "text-[hsl(var(--text-info))]",
    variant === 'minimal' ? iconSizes.xs : iconSizes.sm
  );

  // 🏢 ENTERPRISE A11Y: Proper heading level for semantic document outline
  const TitleTag = headingLevel;

  return (
    <div className={containerClasses}>
      {icon && React.createElement(icon, { className: iconClasses })}
      <div className="flex flex-col">
        <TitleTag className={titleClasses}>
          {displayTitle}
        </TitleTag>
        {subtitle && (
          <span className={cn("text-xs", colors.text.muted)}>
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div className="ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default SectionHeader;