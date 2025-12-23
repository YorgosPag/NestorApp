'use client';

/**
 * 🎴 UNIFIED CUSTOMER CARD COMPONENT
 *
 * Κεντρικοποιημένο component για customer information display
 * Enterprise-class component που χρησιμοποιείται σε όλη την εφαρμογή
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import React from 'react';
import { Users, Phone, Mail, MapPin, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

import { useCustomerInfo } from '../hooks/useCustomerInfo';
import { CustomerActionButtons } from './CustomerActionButtons';
import type { UnifiedCustomerCardProps } from '../types/CustomerInfoTypes';

/**
 * Κεντρικό component για εμφάνιση customer information
 * Χρησιμοποιεί existing centralized systems: badges, hover effects, UI components
 */
export function UnifiedCustomerCard({
  contactId,
  context,
  variant = 'card',
  size = 'md',
  className = '',
  loading: externalLoading = false,
  error: externalError = null,
  showUnitsCount = true,
  showTotalValue = false,
  customActions,
  disabledActions,
  compact = false,
  onClick,
  selected = false,
  onUpdate
}: UnifiedCustomerCardProps) {
  // ========================================================================
  // HOOKS & STATE
  // ========================================================================

  const iconSizes = useIconSizes();

  const {
    customerInfo,
    extendedInfo,
    loading,
    loadingExtended,
    error,
    extendedError
  } = useCustomerInfo(contactId, {
    fetchExtended: showUnitsCount || showTotalValue,
    enabled: Boolean(contactId)
  });

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const isLoading = externalLoading || loading || loadingExtended;
  const hasError = externalError || error || extendedError;
  const displayInfo = extendedInfo || customerInfo;

  // Size-based styling
  const sizeClasses = {
    sm: {
      card: 'p-3',
      avatar: iconSizes.xl,
      title: 'text-sm font-medium',
      subtitle: 'text-xs',
      spacing: 'space-y-2'
    },
    md: {
      card: 'p-4',
      avatar: iconSizes.xl2,
      title: 'text-base font-semibold',
      subtitle: 'text-sm',
      spacing: 'space-y-3'
    },
    lg: {
      card: 'p-6',
      avatar: iconSizes.xl3,
      title: 'text-lg font-semibold',
      subtitle: 'text-base',
      spacing: 'space-y-4'
    }
  };

  const styles = sizeClasses[size];

  // Variant-based layout
  const isCardVariant = variant === 'card';
  const isInlineVariant = variant === 'inline';
  const isMinimalVariant = variant === 'minimal';

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleCardClick = () => {
    if (onClick && !isLoading) {
      onClick();
    }
  };

  const handleInfoUpdate = (updatedInfo: typeof extendedInfo) => {
    if (onUpdate && updatedInfo) {
      onUpdate(updatedInfo);
    }
  };

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const renderAvatar = () => {
    if (isMinimalVariant) return null;

    const initials = displayInfo?.displayName
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';

    return (
      <Avatar className={styles.avatar}>
        <AvatarImage
          src={displayInfo?.avatarUrl || undefined}
          alt={displayInfo?.displayName}
        />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  };

  const renderContactInfo = () => {
    if (!displayInfo) return null;

    return (
      <article className="flex-1 min-w-0">
        <header>
          <h3 className={`${styles.title} text-foreground truncate`}>
            {displayInfo.displayName}
          </h3>
        </header>

        {!isMinimalVariant && (
          <section className="mt-1 space-y-1">
            {displayInfo.primaryPhone && (
              <p className={`${styles.subtitle} text-muted-foreground flex items-center gap-1`}>
                <Phone className={`${iconSizes.xs} shrink-0`} />
                <span className="truncate">{displayInfo.primaryPhone}</span>
              </p>
            )}

            {displayInfo.primaryEmail && !compact && (
              <p className={`${styles.subtitle} text-muted-foreground flex items-center gap-1`}>
                <Mail className={`${iconSizes.xs} shrink-0`} />
                <span className="truncate">{displayInfo.primaryEmail}</span>
              </p>
            )}

            {extendedInfo?.city && !compact && (
              <p className={`${styles.subtitle} text-muted-foreground flex items-center gap-1`}>
                <MapPin className={`${iconSizes.xs} shrink-0`} />
                <span className="truncate">{extendedInfo.city}</span>
              </p>
            )}
          </section>
        )}
      </article>
    );
  };

  const renderBadges = () => {
    if (isMinimalVariant || !extendedInfo) return null;

    return (
      <aside className="flex flex-wrap gap-2 mt-2">
        {showUnitsCount && extendedInfo.unitsCount > 0 && (
          <CommonBadge
            status="units"
            customLabel={`${extendedInfo.unitsCount} μονάδα${extendedInfo.unitsCount !== 1 ? 'ες' : ''}`}
            variant="secondary"
          />
        )}

        {showTotalValue && extendedInfo.totalValue && (
          <CommonBadge
            status="value"
            customLabel={`€${extendedInfo.totalValue.toLocaleString()}`}
            variant="outline"
          />
        )}

        {displayInfo?.status && displayInfo.status !== 'active' && (
          <CommonBadge
            status={displayInfo.status as Parameters<typeof CommonBadge>[0]['status']}
            variant="secondary"
          />
        )}
      </aside>
    );
  };

  const renderActions = () => {
    if (isMinimalVariant || !displayInfo) return null;

    return (
      <aside className="flex shrink-0">
        <CustomerActionButtons
          customerInfo={displayInfo}
          context={context}
          actions={customActions}
          disabledActions={disabledActions}
          size={size === 'lg' ? 'md' : 'sm'}
          direction={isInlineVariant ? 'horizontal' : 'vertical'}
          iconsOnly={compact}
        />
      </aside>
    );
  };

  // ========================================================================
  // LOADING STATE
  // ========================================================================

  if (isLoading) {
    return (
      <Card className={`${className} animate-pulse`}>
        <CardContent className={styles.card}>
          <div className="flex items-center gap-3">
            <div className={`${styles.avatar} bg-muted rounded-full shrink-0`} />
            <div className="flex-1 space-y-2">
              <div className={`${iconSizes.sm} bg-muted rounded w-3/4`} />
              <div className={`${iconSizes.xs} bg-muted rounded w-1/2`} />
            </div>
            <Loader2 className={`${iconSizes.sm} animate-spin text-muted-foreground`} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ========================================================================
  // ERROR STATE
  // ========================================================================

  if (hasError) {
    return (
      <Card className={`${className} border-destructive/50`}>
        <CardContent className={styles.card}>
          <div className="flex items-center gap-3 text-destructive">
            <div className={`${styles.avatar} bg-destructive/10 rounded-full shrink-0 flex items-center justify-center`}>
              <Users className={iconSizes.sm} />
            </div>
            <div className="flex-1">
              <p className={styles.title}>Σφάλμα φόρτωσης</p>
              <p className={`${styles.subtitle} text-destructive/70`}>
                {hasError}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ========================================================================
  // EMPTY STATE
  // ========================================================================

  if (!displayInfo) {
    return null;
  }

  // ========================================================================
  // MAIN RENDER - INLINE VARIANT
  // ========================================================================

  if (isInlineVariant) {
    return (
      <div
        className={`
          flex items-center gap-3 py-2 px-3 rounded-md
          ${onClick ? `cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}` : ''}
          ${selected ? 'bg-accent' : ''}
          ${className}
        `}
        onClick={handleCardClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        } : undefined}
      >
        {renderAvatar()}
        {renderContactInfo()}
        {renderActions()}
      </div>
    );
  }

  // ========================================================================
  // MAIN RENDER - CARD VARIANT
  // ========================================================================

  return (
    <Card
      className={`
        ${isCardVariant ? INTERACTIVE_PATTERNS.CARD_STANDARD : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
        ${className}
      `}
      onClick={handleCardClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      } : undefined}
    >
      {!isMinimalVariant && (
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {renderAvatar()}
              <div>
                <h3 className={`${styles.title} text-foreground`}>
                  {displayInfo.displayName}
                </h3>
                {displayInfo.profession && (
                  <p className={`${styles.subtitle} text-muted-foreground`}>
                    {displayInfo.profession}
                  </p>
                )}
              </div>
            </div>

            {context === 'unit' && (
              <Button variant="ghost" size="sm" className="shrink-0">
                <ArrowRight className={iconSizes.sm} />
              </Button>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={isMinimalVariant ? styles.card : 'px-6 pb-4'}>
        {isMinimalVariant && (
          <div className="flex items-center gap-3">
            {renderAvatar()}
            {renderContactInfo()}
            {renderActions()}
          </div>
        )}

        {!isMinimalVariant && (
          <div className={styles.spacing}>
            {(displayInfo.primaryPhone || displayInfo.primaryEmail) && (
              <section className="space-y-2">
                {displayInfo.primaryPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className={`${iconSizes.sm} text-muted-foreground`} />
                    <span>{displayInfo.primaryPhone}</span>
                  </div>
                )}

                {displayInfo.primaryEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className={`${iconSizes.sm} text-muted-foreground`} />
                    <span className="truncate">{displayInfo.primaryEmail}</span>
                  </div>
                )}
              </section>
            )}

            {renderBadges()}

            <footer className="pt-2 border-t">
              {renderActions()}
            </footer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}