/**
 * 🏢 HEADER ACTIONS COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο actions component για headers
 * Enterprise implementation με dashboard toggle, view modes, custom actions
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Eye,
  EyeOff,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { HeaderActionsProps } from '../types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// Local interface για compatibility με UnifiedHeaderSystem
interface UnifiedHeaderActionsProps {
  showDashboard?: boolean;
  onDashboardToggle?: () => void;
  viewMode?: 'list' | 'grid' | 'byType' | 'byStatus';
  onViewModeChange?: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  viewModes?: ('list' | 'grid' | 'byType' | 'byStatus')[];
  addButton?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<any>;
  };
  customActions?: React.ReactNode[];
  className?: string;
}
import { HEADER_THEME } from '../constants';
import { HeaderViewToggle } from './HeaderViewToggle';
import { MobileHeaderViewToggle } from './MobileHeaderViewToggle';

export const HeaderActions: React.FC<UnifiedHeaderActionsProps> = ({
  showDashboard,
  onDashboardToggle,
  viewMode,
  onViewModeChange,
  viewModes,
  addButton,
  customActions = [],
  className
}) => {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');
  const actionsClasses = cn(
    HEADER_THEME.components.actions.default,
    className
  );

  return (
    <div className={actionsClasses}>
      {/* Dashboard Toggle */}
      {onDashboardToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showDashboard ? "default" : "outline"}
              size="icon"
              onClick={onDashboardToggle}
            >
              {showDashboard ? <EyeOff className={iconSizes.sm} /> : <Eye className={iconSizes.sm} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showDashboard ? t('headerActions.hideDashboard') : t('headerActions.showDashboard')}
          </TooltipContent>
        </Tooltip>
      )}

      {/* View Mode Toggle */}
      {viewMode && onViewModeChange && (
        <>
          {/* Desktop: Multiple buttons */}
          <div className="hidden md:block">
            <HeaderViewToggle
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              viewModes={viewModes}
            />
          </div>

          {/* Mobile: Single toggle button */}
          <div className="md:hidden">
            <MobileHeaderViewToggle
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              viewModes={viewModes}
            />
          </div>
        </>
      )}

      {/* Custom Actions */}
      {customActions.map((action, index) => (
        <React.Fragment key={index}>{action}</React.Fragment>
      ))}

      {/* Add Button */}
      {addButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" onClick={addButton.onClick} variant="outline">
              {addButton.icon ? (
                <addButton.icon className={iconSizes.sm} />
              ) : (
                <Plus className={iconSizes.sm} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{addButton.label}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default HeaderActions;
