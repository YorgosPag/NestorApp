'use client';

/**
 * 🏢 UNIT CUSTOMER DISPLAY COMPONENT
 *
 * Enterprise-class component για εμφάνιση customer information σε unit contexts
 * Βασισμένο στη real Firebase database - zero mock data
 *
 * ENTERPRISE FEATURES:
 * - Real database-driven (Firebase soldTo relationships)
 * - Progressive disclosure pattern (Google/Microsoft standard)
 * - Performance optimized (conditional fetching)
 * - Accessible (ARIA compliant)
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise AutoCAD/Microsoft/Google standards
 */

import React from 'react';
import { User, Phone, Mail, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { formatDate } from '@/lib/intl-utils'; // ✅ Using centralized function
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { useCustomerInfo } from '../hooks/useCustomerInfo';
import type { Property } from '@/types/property-viewer';

export interface UnitCustomerDisplayProps {
  /** The unit/property object from real Firebase database */
  unit: Property;
  /** Display variant for different contexts */
  variant?: 'compact' | 'inline' | 'card';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show quick action buttons */
  showActions?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Enterprise component για εμφάνιση customer info σε unit contexts
 *
 * DATABASE DESIGN:
 * - unit.soldTo → contacts.id (Firebase foreign key)
 * - unit.status → 'sold' | 'reserved' | 'rented' (real statuses)
 * - Real-time data fetching μόνο όταν χρειάζεται
 */
export function UnitCustomerDisplay({
  unit,
  variant = 'inline',
  size = 'md',
  showActions = true,
  className = ''
}: UnitCustomerDisplayProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');

  // ========================================================================
  // ENTERPRISE LOGIC: Real Database Checks
  // ========================================================================

  const hasSoldStatus = unit.status === 'sold' || unit.status === 'reserved' || unit.status === 'rented';
  const hasCustomerLink = Boolean(unit.soldTo);

  // Early return for units without customer info (performance optimization)
  if (!hasSoldStatus || !hasCustomerLink) {
    return null;
  }

  // ========================================================================
  // HOOKS: Real Database Fetching
  // ========================================================================

  const {
    customerInfo,
    loading,
    error
  } = useCustomerInfo(unit.soldTo!, {
    fetchExtended: false,
    enabled: Boolean(unit.soldTo) // Only fetch if soldTo exists
  });

  // ========================================================================
  // SIZE VARIANTS (Enterprise Design System)
  // ========================================================================

  const sizeClasses = {
    sm: {
      text: 'text-xs',
      gap: 'gap-2',
      padding: 'p-2',
      iconSize: iconSizes.xs,
      buttonSize: iconSizes.md
    },
    md: {
      text: 'text-sm',
      gap: 'gap-3',
      padding: 'p-3',
      iconSize: iconSizes.sm,
      buttonSize: iconSizes.md
    },
    lg: {
      text: 'text-base',
      gap: 'gap-4',
      padding: 'p-4',
      iconSize: iconSizes.md,
      buttonSize: iconSizes.lg
    }
  };

  const styles = sizeClasses[size];

  // ========================================================================
  // LOADING STATE (Enterprise UX)
  // ========================================================================

  if (loading) {
    return (
      <div className={`flex items-center ${styles.gap} ${className}`}>
        <User className={`${styles.iconSize} text-muted-foreground`} />
        <div className="space-y-1">
          <Skeleton className={`${iconSizes.xs} w-20`} />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
    );
  }

  // ========================================================================
  // ERROR STATE (Enterprise Error Handling)
  // ========================================================================

  if (error) {
    return (
      <div className={`flex items-center ${styles.gap} text-destructive ${className}`}>
        <User className={`${styles.iconSize}`} />
        <span className={styles.text}>
          {t('customerActions.states.loadingError')}
        </span>
      </div>
    );
  }

  // ========================================================================
  // NO CUSTOMER DATA (Database Integrity Check)
  // ========================================================================

  if (!customerInfo) {
    return (
      <div className={`flex items-center ${styles.gap} text-muted-foreground ${className}`}>
        <User className={`${styles.iconSize}`} />
        <span className={styles.text}>
          {t('customerActions.states.customerNotFound', { id: unit.soldTo })}
        </span>
      </div>
    );
  }

  // ========================================================================
  // RENDER VARIANTS
  // ========================================================================

  const customerName = customerInfo.displayName || t('customerActions.states.unknownCustomer');
  const statusText = unit.status === 'sold' ? t('unitStatus.sold') :
                    unit.status === 'reserved' ? t('unitStatus.reserved') : t('unitStatus.rented');

  // COMPACT VARIANT (για inline display)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center ${styles.gap} ${className}`}>
        <User className={`${styles.iconSize} text-green-600`} />
        <span className={`${styles.text} font-medium text-foreground truncate`}>
          {customerName}
        </span>
        <Badge variant="secondary" className="text-xs">
          {statusText}
        </Badge>
      </div>
    );
  }

  // INLINE VARIANT (για UnitListItem footer)
  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between ${styles.gap} ${className}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className={`${styles.iconSize} text-green-600 shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className={`${styles.text} font-medium text-foreground truncate`}>
              {customerName}
            </div>
            <div className="text-xs text-muted-foreground">
              {statusText} • {unit.saleDate ? formatDate(new Date(unit.saleDate)) : t('customerActions.states.unknownDate')}
            </div>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 shrink-0">
            {/* View Customer Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${styles.buttonSize} p-0`}
                  onClick={() => window.open(`/contacts?contactId=${unit.soldTo}`, '_blank')}
                >
                  <Eye className={styles.iconSize} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('customerActions.tooltips.viewDetails', { name: customerName })}</TooltipContent>
            </Tooltip>

            {/* Call Customer Button */}
            {customerInfo.primaryPhone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${styles.buttonSize} p-0`}
                    onClick={() => {
                      const cleanPhone = customerInfo.primaryPhone!.replace(/\s+/g, '');
                      window.open(`tel:${cleanPhone}`, '_self');
                    }}
                  >
                    <Phone className={styles.iconSize} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('customerActions.tooltips.callTo', { phone: customerInfo.primaryPhone })}</TooltipContent>
              </Tooltip>
            )}

            {/* Email Customer Button */}
            {customerInfo.primaryEmail && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${styles.buttonSize} p-0`}
                    onClick={() => window.open(`mailto:${customerInfo.primaryEmail}`, '_self')}
                  >
                    <Mail className={styles.iconSize} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('customerActions.tooltips.emailTo', { email: customerInfo.primaryEmail })}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );
  }

  // CARD VARIANT (για expanded display)
  if (variant === 'card') {
    return (
      <Card className={`${styles.padding} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${className}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className={`${styles.iconSize} text-green-600`} />
              <span className={`${styles.text} font-semibold`}>{t('customerActions.labels.customer')}</span>
              <Badge variant="outline">{statusText}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className={`font-medium ${styles.text}`}>
              {customerName}
            </div>

            {(customerInfo.primaryPhone || customerInfo.primaryEmail) && (
              <div className="space-y-1">
                {customerInfo.primaryPhone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className={iconSizes.xs} />
                    <span>{customerInfo.primaryPhone}</span>
                  </div>
                )}
                {customerInfo.primaryEmail && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className={iconSizes.xs} />
                    <span className="truncate">{customerInfo.primaryEmail}</span>
                  </div>
                )}
              </div>
            )}

            {showActions && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/contacts?contactId=${unit.soldTo}`, '_blank')}
                >
                  <Eye className={`${iconSizes.xs} mr-1`} />
                  {t('customerActions.view')}
                </Button>

                {customerInfo.primaryPhone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const cleanPhone = customerInfo.primaryPhone!.replace(/\s+/g, '');
                      window.open(`tel:${cleanPhone}`, '_self');
                    }}
                  >
                    <Phone className={`${iconSizes.xs} mr-1`} />
                    {t('customerActions.call')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}