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
import { HeaderIcon } from './HeaderIcon';

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  subtitle,
  count,
  actions,
  className,
  variant = 'default'
}) => {
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
    "text-blue-600",
    variant === 'minimal' ? "h-3 w-3" : "h-4 w-4"
  );

  return (
    <div className={containerClasses}>
      {icon && (
        <icon className={iconClasses} />
      )}
      <div className="flex flex-col">
        <span className={titleClasses}>
          {displayTitle}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">
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