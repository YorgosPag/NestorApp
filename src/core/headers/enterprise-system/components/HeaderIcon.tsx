/**
 * 🏢 HEADER ICON COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο icon component για headers
 * Enterprise implementation με theme integration
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { HeaderIconProps } from '../types';
import { ICON_VARIANTS } from '../constants';

export const HeaderIcon: React.FC<HeaderIconProps> = ({
  icon: Icon,
  className,
  variant = 'gradient'
}) => {
  const config = ICON_VARIANTS[variant];

  return (
    <div className={cn(config.base, config.styles, className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
};

export default HeaderIcon;