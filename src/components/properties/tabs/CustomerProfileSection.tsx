'use client';

import '@/lib/design-system';
import React from 'react';
import { User, Phone, Mail, Calendar, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { formatDateTime, formatCurrency } from '@/lib/intl-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useOptimizedCustomerInfo } from './hooks/useOptimizedCustomerInfo';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface CustomerProfileSectionProps {
  customerId: string;
  unitPrice?: number;
}

// ============================================================================
// Component
// ============================================================================

export function CustomerProfileSection({ customerId, unitPrice }: CustomerProfileSectionProps) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, getElementBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    customerInfo,
    loading,
    error,
    refetch
  } = useOptimizedCustomerInfo(customerId, Boolean(customerId));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className={`${iconSizes.md} ${colors.text.info}`} />
            {t('customerTab.customerInfo')}
            <div className="ml-auto">
              <div className={cn("flex items-center gap-2 text-sm", colors.text.muted)}>
                <AnimatedSpinner size="small" className={colors.text.info} />
                <span>{t('customerTab.loading')}</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className={`${iconSizes.xl2} rounded-full`} />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`${iconSizes.md} text-destructive`} />
            {t('customerTab.loadingError')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>
              {t('customerTab.loadingErrorMessage')}: {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={refetch} className="flex-1">
              {t('customerTab.retryLoading')}
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()} className="flex-1">
              {t('customerTab.reloadPage')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className={`${iconSizes.md} ${colors.text.info}`} />
          {t('customerTab.customerInfo')}
          <Badge variant="outline" className="ml-auto">
            {t('customerTab.loaded')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Clickable Customer Profile Header */}
          <div
            className={`flex items-start gap-4 p-3 ${quick.card} border border-transparent ${getStatusBorder('info')} ${getElementBorder('card', 'hover')} hover:bg-primary/5 cursor-pointer transition-all duration-200 group`}
            onClick={() => {
              const contactsUrl = `/contacts?filter=customer&contactId=${customerId}&source=unit`;
              window.open(contactsUrl, '_blank');
            }}
            role="button"
            tabIndex={0}
            title={t('customerTab.viewInContacts')}
          >
            <div className={`${iconSizes.xl4} bg-primary/10 rounded-full flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors`}>
              <User className={`${iconSizes.xl} text-primary`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {customerInfo?.displayName || t('customerTab.unknownCustomer')}
                </h3>
                <ExternalLink className={`${iconSizes.sm} ${colors.text.muted} group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100`} />
              </div>
              {customerInfo?.primaryPhone && (
                <p className={cn("flex items-center gap-2 mb-1", colors.text.muted)}>
                  <Phone className={iconSizes.sm} />
                  {customerInfo.primaryPhone}
                </p>
              )}
              {customerInfo?.primaryEmail && (
                <p className={cn("flex items-center gap-2 mb-1", colors.text.muted)}>
                  <Mail className={iconSizes.sm} />
                  <span className="truncate">{customerInfo.primaryEmail}</span>
                </p>
              )}
              <div className={cn("text-xs flex items-center gap-2", colors.text.muted)}>
                <Calendar className={iconSizes.xs} />
                {t('customerTab.fetchedAt')}: {customerInfo ? formatDateTime(customerInfo.fetchedAt, { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
            <div className={cn("flex items-center group-hover:text-primary transition-colors", colors.text.muted)}>
              <ArrowRight className={iconSizes.md} />
            </div>
          </div>

          {/* Navigation Hint */}
          <div className={`${colors.bg.info} ${quick.info} p-3`}>
            <p className={`text-sm ${colors.text.info} flex items-center gap-2`}>
              <ExternalLink className={iconSizes.sm} />
              <strong>{t('customerTab.tip')}:</strong> {t('customerTab.tipMessage')}
            </p>
          </div>

          <Separator />

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={cn("text-sm", colors.text.muted)}>{t('customerTab.customerId')}</p>
              <p className={`font-mono text-xs bg-muted px-2 py-1 ${quick.input}`}>
                {customerId}
              </p>
            </div>
            {unitPrice && (
              <div>
                <p className={cn("text-sm", colors.text.muted)}>{t('customerTab.transactionValue')}</p>
                <p className={`font-semibold ${colors.text.success}`}>
                  {formatCurrency(unitPrice)}
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={`flex flex-wrap gap-2 pt-4 ${getDirectionalBorder('muted', 'top')}`}>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const contactsUrl = `/contacts?filter=customer&contactId=${customerId}&source=unit`;
                window.open(contactsUrl, '_blank');
              }}
            >
              <ExternalLink className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.contactsList')}
            </Button>

            {customerInfo?.primaryPhone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const cleanPhone = customerInfo.primaryPhone!.replace(/\s+/g, '');
                  window.open(`tel:${cleanPhone}`, '_self');
                }}
              >
                <Phone className={`${iconSizes.sm} mr-2`} />
                {t('customerTab.call')}
              </Button>
            )}

            {customerInfo?.primaryEmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`mailto:${customerInfo.primaryEmail}`, '_self')}
              >
                <Mail className={`${iconSizes.sm} mr-2`} />
                {t('common.labels.email')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
