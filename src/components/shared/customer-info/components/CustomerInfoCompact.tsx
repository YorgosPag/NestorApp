'use client';

/**
 * 📝 CUSTOMER INFO COMPACT COMPONENT
 *
 * Συμπαγής εμφάνιση customer information για tables, lists και compact spaces
 * Enterprise-class component για minimal footprint με maximum information
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import React from 'react';
import { Phone, Mail, Eye, User } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { useCustomerInfo } from '../hooks/useCustomerInfo';
import { CustomerActionButtons } from './CustomerActionButtons';
import type { CustomerInfoCompactProps, CustomerActionType } from '../types/CustomerInfoTypes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

/**
 * Compact customer info component για χρήση σε tables, lists και tight spaces
 * Optimized για performance με minimal DOM footprint
 */
export function CustomerInfoCompact({
  contactId,
  context,
  variant = 'compact',
  size = 'sm',
  className = '',
  loading: externalLoading = false,
  error: externalError = null,
  nameOnly = false,
  showPhone = true,
  showActions = true,
  showUnitsCount: _showUnitsCount = false,
  propertiesCount,
  maxWidth,
  onUpdate: _onUpdate,
  customerData
}: CustomerInfoCompactProps) {
  // ========================================================================
  // HOOKS & STATE
  // ========================================================================

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');
  const {
    customerInfo,
    loading,
    error
  } = useCustomerInfo(contactId, {
    fetchExtended: false, // Compact mode μόνο basic info
    enabled: Boolean(contactId && !customerData) // Skip fetch αν έχουμε customerData
  });

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const isLoading = externalLoading || loading;
  const hasError = externalError || error;

  // Χρησιμοποίησε customerData αν υπάρχουν, αλλιώς fetched data
  const displayInfo = customerData ? {
    contactId,
    displayName: customerData.displayName || customerData.name || t('customerActions.states.unknownCustomer'),
    primaryPhone: customerData.primaryPhone || customerData.phone || null,
    primaryEmail: customerData.primaryEmail || customerData.email || null,
    avatarUrl: customerData.avatarUrl,
    status: undefined
  } : customerInfo;

  // Size-based styling
  const sizeClasses = {
    sm: {
      avatar: iconSizes.lg,
      text: 'text-xs',
      subtext: 'text-xs',
      spacing: 'gap-2'
    },
    md: {
      avatar: iconSizes.xl,
      text: 'text-sm',
      subtext: 'text-xs',
      spacing: 'gap-3'
    },
    lg: {
      avatar: iconSizes['2xl'],
      text: 'text-base',
      subtext: 'text-sm',
      spacing: 'gap-3'
    }
  };

  const styles = sizeClasses[size];

  // Container styling με maxWidth support
  const containerStyle = maxWidth ? { maxWidth: `${maxWidth}px` } : {};

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const renderAvatar = () => {
    const initials = displayInfo?.displayName
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';

    return (
      <Avatar className={`${styles.avatar} shrink-0`}>
        <AvatarImage
          src={displayInfo?.avatarUrl || undefined}
          alt={displayInfo?.displayName}
        />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  };

  const renderContactDetails = () => {
    if (!displayInfo || nameOnly) {
      return (
        <div className="min-w-0 flex-1">
          <p className={`${styles.text} font-medium text-foreground truncate`}>
            {displayInfo?.displayName || t('customerActions.states.unknownCustomer')}
          </p>
        </div>
      );
    }

    return (
      <div className="min-w-0 flex-1">
        <p className={`${styles.text} font-medium text-foreground truncate`}>
          {displayInfo.displayName}
        </p>

        {showPhone && displayInfo.primaryPhone && (
          <p className={cn(styles.subtext, colors.text.muted, "truncate flex items-center gap-1")}>
            <Phone className={`${iconSizes.xs} shrink-0`} />
            <span>{displayInfo.primaryPhone}</span>
          </p>
        )}

        {!showPhone && displayInfo.primaryEmail && (
          <p className={cn(styles.subtext, colors.text.muted, "truncate flex items-center gap-1")}>
            <Mail className={`${iconSizes.xs} shrink-0`} />
            <span>{displayInfo.primaryEmail}</span>
          </p>
        )}
      </div>
    );
  };

  const renderQuickActions = () => {
    if (!showActions || !displayInfo || nameOnly) return null;

    // Voor compact mode, toon alleen de meest belangrijke acties
    const quickActions: CustomerActionType[] = context === 'property'
      ? ['view']
      : ['view', 'call'];

    return (
      <div className="shrink-0">
        <CustomerActionButtons
          customerInfo={displayInfo}
          context={context}
          actions={quickActions.map(type => ({
            type,
            label: type === 'view' ? t('customerActions.view') : t('customerActions.call'),
            icon: type === 'view' ? Eye : Phone,
            variant: 'ghost' as const,
            onClick: () => {
              if (type === 'view') {
                window.open(`/contacts?contactId=${contactId}`, '_blank');
              } else if (type === 'call' && displayInfo.primaryPhone) {
                const cleanPhone = displayInfo.primaryPhone.replace(/\s+/g, '');
                window.open(`tel:${cleanPhone}`, '_self');
              }
            },
            disabled: type === 'call' && !displayInfo.primaryPhone
          }))}
          size="sm"
          direction="horizontal"
          iconsOnly
        />
      </div>
    );
  };

  // ========================================================================
  // LOADING STATE
  // ========================================================================

  if (isLoading) {
    if (variant === 'table') {
      return (
        <div
          className={`grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 items-center py-3 px-1 ${className}`}
          style={containerStyle}
        >
          {/* Column 1: Avatar + Name */}
          <div className="flex items-center gap-3">
            <div className={`${styles.avatar} bg-muted rounded-full shrink-0 animate-pulse`} />
            <div className="h-3 bg-muted rounded w-24 animate-pulse" />
          </div>
          {/* Column 2: Phone */}
          <div className="h-3 bg-muted rounded w-16 animate-pulse" />
          {/* Column 3: Email */}
          <div className="h-3 bg-muted rounded w-20 animate-pulse" />
          {/* Column 4: Units */}
          <div className="flex justify-end pr-3">
            <div className="h-3 bg-muted rounded w-8 animate-pulse" />
          </div>
          {/* Column 5: Actions */}
          <div className="flex items-center gap-1">
            <Spinner size="small" />
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center ${styles.spacing} ${className}`}
        style={containerStyle}
      >
        <div className={`${styles.avatar} bg-muted rounded-full shrink-0 animate-pulse`} />
        <div className="flex-1 space-y-1">
          <div className="h-3 bg-muted rounded w-24 animate-pulse" />
          {!nameOnly && (
            <div className="h-2 bg-muted rounded w-16 animate-pulse" />
          )}
        </div>
        <Spinner size="small" />
      </div>
    );
  }

  // ========================================================================
  // ERROR STATE
  // ========================================================================

  if (hasError) {
    if (variant === 'table') {
      return (
        <div
          className={`grid grid-cols-[2fr_1.2fr_1.5fr_auto_auto] gap-3 items-center py-3 px-1 ${className} text-destructive`}
          style={containerStyle}
        >
          <div className="flex items-center gap-3">
            <div className={`${styles.avatar} bg-destructive/10 rounded-full shrink-0 flex items-center justify-center`}>
              <User className={iconSizes.xs} />
            </div>
            <span className={`${styles.text} font-medium truncate`}>{t('customerActions.states.loadingError')}</span>
          </div>
          <span className={`${styles.subtext} text-destructive/70 truncate`}>—</span>
          <span className={`${styles.subtext} text-destructive/70 truncate`}>—</span>
          <div className="flex justify-end pr-3">
            <span>—</span>
          </div>
          <span>—</span>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center ${styles.spacing} ${className} text-destructive`}
        style={containerStyle}
      >
        <div className={`${styles.avatar} bg-destructive/10 rounded-full shrink-0 flex items-center justify-center`}>
          <User className={iconSizes.xs} />
        </div>
        <div className="flex-1">
          <p className={`${styles.text} font-medium truncate`}>
            {t('customerActions.states.loadingError')}
          </p>
          <p className={`${styles.subtext} text-destructive/70 truncate`}>
            {hasError}
          </p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // EMPTY STATE
  // ========================================================================

  if (!displayInfo) {
    if (variant === 'table') {
      return (
        <div
          className={cn("grid grid-cols-[2fr_1.2fr_1.5fr_auto_auto] gap-3 items-center py-3 px-1", className, colors.text.muted)}
          style={containerStyle}
        >
          <div className="flex items-center gap-3">
            <div className={`${styles.avatar} bg-muted rounded-full shrink-0 flex items-center justify-center`}>
              <User className={iconSizes.xs} />
            </div>
            <span className={`${styles.text} truncate`}>{t('customerActions.states.noCustomer')}</span>
          </div>
          <span>—</span>
          <span>—</span>
          <div className="flex justify-end pr-3">
            <span>—</span>
          </div>
          <span>—</span>
        </div>
      );
    }

    return (
      <div
        className={cn("flex items-center", styles.spacing, className, colors.text.muted)}
        style={containerStyle}
      >
        <div className={`${styles.avatar} bg-muted rounded-full shrink-0 flex items-center justify-center`}>
          <User className={iconSizes.xs} />
        </div>
        <div className="flex-1">
          <p className={`${styles.text} truncate`}>
            {t('customerActions.states.noCustomer')}
          </p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // TABLE LAYOUT RENDER (NEW)
  // ========================================================================

  if (variant === 'table') {
    return (
      <div
        className={`grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 items-center py-3 px-1 ${className}`}
        style={containerStyle}
        role="article"
        aria-label={t('customerActions.aria.customerDetails', { name: displayInfo.displayName })}
      >
        {/* Column 1: Avatar + Name (2fr - wider for names) */}
        <div className="flex items-center gap-3 min-w-0">
          {renderAvatar()}
          <span className={`${styles.text} font-medium text-foreground truncate`}>
            {displayInfo?.displayName || t('customerActions.states.unknownCustomer')}
          </span>
        </div>

        {/* Column 2: Phone (1.2fr - medium width) */}
        <div className="flex items-center gap-2 min-w-0">
          {displayInfo?.primaryPhone ? (
            <>
              <Phone className={cn(iconSizes.sm, colors.text.muted, "shrink-0")} />
              <span className={`${styles.text} text-foreground truncate`}>
                {displayInfo.primaryPhone}
              </span>
            </>
          ) : (
            <span className={cn(styles.text, colors.text.muted)}>—</span>
          )}
        </div>

        {/* Column 3: Email (1.5fr - medium-wide for emails) */}
        <div className="flex items-center gap-2 min-w-0">
          {displayInfo?.primaryEmail ? (
            <>
              <Mail className={cn(iconSizes.sm, colors.text.muted, "shrink-0")} />
              <span className={`${styles.text} text-foreground truncate`}>
                {displayInfo.primaryEmail}
              </span>
            </>
          ) : (
            <span className={cn(styles.text, colors.text.muted)}>—</span>
          )}
        </div>

        {/* Column 4: Units Count (auto - narrow for numbers) */}
        <div className="flex items-center justify-end gap-1 pr-3">
          <span className={`${styles.text} text-foreground font-medium`}>
            #{propertiesCount || 1}
          </span>
        </div>

        {/* Column 5: Actions (auto - narrow for icons) */}
        <div className="flex items-center gap-1">
          {showActions && displayInfo && (
            <>
              {/* View Action (Ματάκι) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="${iconSizes.xl} p-0"
                    onClick={() => window.open(`/contacts?contactId=${contactId}`, '_blank')}
                  >
                    <Eye className={iconSizes.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('customerActions.viewCustomer')}</TooltipContent>
              </Tooltip>

              {/* Phone Action (Τηλέφωνο) */}
              {displayInfo.primaryPhone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="${iconSizes.xl} p-0"
                      onClick={() => {
                        const cleanPhone = displayInfo.primaryPhone!.replace(/\s+/g, '');
                        window.open(`tel:${cleanPhone}`, '_self');
                      }}
                    >
                      <Phone className={iconSizes.sm} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('customerActions.call')}</TooltipContent>
                </Tooltip>
              )}

              {/* Email Action (Email) */}
              {displayInfo.primaryEmail && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="${iconSizes.xl} p-0"
                      onClick={() => {
                        window.open(`mailto:${displayInfo.primaryEmail}`, '_self');
                      }}
                    >
                      <Mail className={iconSizes.sm} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('customerActions.sendEmail')}</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ========================================================================
  // MAIN RENDER (ORIGINAL COMPACT LAYOUT)
  // ========================================================================

  return (
    <div
      className={`
        flex items-center ${styles.spacing}
        ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}
        ${className}
      `}
      style={containerStyle}
      role="article"
      aria-label={t('customerActions.aria.customerDetails', { name: displayInfo.displayName })}
    >
      {renderAvatar()}
      {renderContactDetails()}
      {renderQuickActions()}
    </div>
  );
}
