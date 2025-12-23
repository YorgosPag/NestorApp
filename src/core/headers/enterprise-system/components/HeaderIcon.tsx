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
import { useIconSizes } from '@/hooks/useIconSizes';

export const HeaderIcon: React.FC<HeaderIconProps> = ({
  icon: Icon,
  className,
  variant = 'gradient'
}) => {
  const iconSizes = useIconSizes();
  const config = ICON_VARIANTS[variant];

  return (
    <div className={cn(config.base, config.styles, className)}>
      <Icon className={iconSizes.md} />
    </div>
  );
};

export default HeaderIcon;