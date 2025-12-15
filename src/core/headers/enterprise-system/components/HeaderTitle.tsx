/**
 * 🏢 HEADER TITLE COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο title component για headers
 * Enterprise implementation με responsive design
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { HeaderTitleProps } from '../types';
import { HEADER_THEME } from '../constants';
import { HeaderIcon } from './HeaderIcon';

export const HeaderTitle: React.FC<HeaderTitleProps> = ({
  icon,
  title,
  subtitle,
  variant = 'large',
  className,
  hideSubtitle = false
}) => {
  const titleClasses = HEADER_THEME.components.title[variant] || HEADER_THEME.components.title.large;
  const subtitleClasses = HEADER_THEME.components.title.subtitle;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && <HeaderIcon icon={icon} />}
      <div className="sm:flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className={cn(titleClasses, "sm:whitespace-nowrap")}>{title}</h1>
        </div>
        {subtitle && !hideSubtitle && (
          <p className={subtitleClasses}>{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default HeaderTitle;