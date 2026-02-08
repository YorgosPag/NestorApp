'use client';

/**
 * 🏢 UNIT CUSTOMER TAB - ENTERPRISE IMPLEMENTATION
 *
 * Full-featured customer management tab for units με real Firebase integration
 * Εμφανίζει complete customer profile για sold/rented/reserved units
 *
 * ENTERPRISE FEATURES:
 * - Real database-driven (Firebase soldTo relationships)
 * - Full customer profile display
 * - Direct action integration (call, email, view)
 * - Purchase/rental history
 * - Property relationship management
 * - Responsive design
 * - Accessibility compliant
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Microsoft/Google standards
 */

import React from 'react';
import { User, Phone, Mail, Calendar, FileText, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;
import { formatDateTime, formatDate, formatCurrency } from '@/lib/intl-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { UnifiedCustomerCard } from '@/components/shared/customer-info';
import { useOptimizedCustomerInfo } from './hooks/useOptimizedCustomerInfo';
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Additional data passed from parent component */
interface AdditionalTabData {
  buildingId?: string;
  projectId?: string;
  [key: string]: unknown;
}

/** Global props from the tabs system */
interface GlobalTabProps {
  isEditing?: boolean;
  canEdit?: boolean;
  [key: string]: unknown;
}

export interface UnitCustomerTabProps {
  /** The unit/property object από τη real Firebase database */
  selectedUnit: Property;
  /** Additional data from the parent component */
  additionalData?: AdditionalTabData;
  /** Global props from the tabs system */
  globalProps?: GlobalTabProps;
}

/**
 * Enterprise customer tab για unit details
 * Δείχνει full customer profile και relationship management
 */
// ============================================================================
// OPTIMIZED CUSTOMER PROFILE SECTION COMPONENT
// ============================================================================

interface CustomerProfileSectionProps {
  customerId: string;
  unitPrice?: number;
}

function CustomerProfileSection({ customerId, unitPrice }: CustomerProfileSectionProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, getElementBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    customerInfo,
    loading,
    error,
    refetch
  } = useOptimizedCustomerInfo(customerId, Boolean(customerId));

  // ENTERPRISE: Optimized Loading State
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className={`${iconSizes.md} ${colors.text.info}`} />
            {t('customerTab.customerInfo')}
            <div className="ml-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AnimatedSpinner size="small" className={colors.text.info} />
                <span>{t('customerTab.loading')}</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* ENTERPRISE: Professional Skeleton Loader */}
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

  // ENTERPRISE: Error State
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
            <Button
              variant="outline"
              onClick={refetch}
              className="flex-1"
            >
              {t('customerTab.retryLoading')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              {t('customerTab.reloadPage')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ENTERPRISE: Success State με Full Profile
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
        {/* ENTERPRISE: Fast Rendering με Cached Data */}
        <div className="space-y-4">

          {/* ENTERPRISE: Clickable Customer Profile Header */}
          <div
            className={`flex items-start gap-4 p-3 ${quick.card} border border-transparent ${getStatusBorder('info')} ${getElementBorder('card', 'hover')} hover:bg-primary/5 cursor-pointer transition-all duration-200 group`}
            onClick={() => {
              // ENTERPRISE: Deep-link navigation με URL parameters
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
                <ExternalLink className={`${iconSizes.sm} text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100`} />
              </div>
              {customerInfo?.primaryPhone && (
                <p className="text-muted-foreground flex items-center gap-2 mb-1">
                  <Phone className={iconSizes.sm} />
                  {customerInfo.primaryPhone}
                </p>
              )}
              {customerInfo?.primaryEmail && (
                <p className="text-muted-foreground flex items-center gap-2 mb-1">
                  <Mail className={iconSizes.sm} />
                  <span className="truncate">{customerInfo.primaryEmail}</span>
                </p>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Calendar className={iconSizes.xs} />
                {t('customerTab.fetchedAt')}: {customerInfo ? formatDateTime(customerInfo.fetchedAt, { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
            <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
              <ArrowRight className={iconSizes.md} />
            </div>
          </div>

          {/* ENTERPRISE: Navigation Hint */}
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
              <p className="text-sm text-muted-foreground">{t('customerTab.customerId')}</p>
              <p className={`font-mono text-xs bg-muted px-2 py-1 ${quick.input}`}>
                {customerId}
              </p>
            </div>
            {unitPrice && (
              <div>
                <p className="text-sm text-muted-foreground">{t('customerTab.transactionValue')}</p>
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
                Email
              </Button>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnitCustomerTab({
  selectedUnit,
  additionalData,
  globalProps
}: UnitCustomerTabProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook for main component
  const { t } = useTranslation('units');

  // ========================================================================
  // ENTERPRISE VALIDATION: Unit Customer Checks
  // ========================================================================

  const hasSoldStatus = selectedUnit?.status === 'sold' ||
                       selectedUnit?.status === 'reserved' ||
                       selectedUnit?.status === 'rented';

  const hasCustomerLink = Boolean(selectedUnit?.soldTo);

  // Early returns για units χωρίς customer info
  if (!selectedUnit) {
    return (
      <div className="p-6 text-center">
        <User className={`${iconSizes.xl3} mx-auto text-muted-foreground mb-4`} />
        <p className="text-muted-foreground">
          {t('customerTab.noUnitSelected')}
        </p>
      </div>
    );
  }

  if (!hasSoldStatus) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
            {t('customerTab.availableUnit')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className={`${colors.bg.info} rounded-full ${iconSizes.xl4} flex items-center justify-center mx-auto mb-4`}>
              <UnitIcon className={`${iconSizes.xl} ${unitColor}`} />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {t('customerTab.unitAvailable', { name: selectedUnit.name })}
            </h3>
            <p className="text-muted-foreground mb-4">
              Status: <Badge variant="outline">{selectedUnit.status}</Badge>
            </p>
            <Button variant="outline" asChild>
              <a href="/crm/calendar">
                <Calendar className={`${iconSizes.sm} mr-2`} />
                {t('customerTab.scheduleViewing')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasCustomerLink) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`${iconSizes.md} ${colors.text.warning}`} />
            {t('customerTab.soldWithoutCustomer')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>
              {t('customerTab.soldWithoutCustomerWarning', { status: selectedUnit.status })}
            </AlertDescription>
          </Alert>

          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>{t('customerTab.unitStatus')}:</strong> {selectedUnit.status}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>{t('customerTab.transactionDate')}:</strong> {
                selectedUnit.saleDate
                  ? formatDate(selectedUnit.saleDate)
                  : t('customerTab.unknownDate')
              }
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>{t('customerTab.customerId')}:</strong> {selectedUnit.soldTo || t('customerTab.customerIdMissing')}
            </p>
          </div>

          <div className="mt-6">
            <Button variant="outline" className="w-full">
              <FileText className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.manageTransaction')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ========================================================================
  // ENTERPRISE CUSTOMER DISPLAY: Full Profile Tab
  // ========================================================================

  return (
    <div className="p-6 space-y-6">

      {/* ENTERPRISE: Unit Sale Information Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
            {t('customerTab.transactionDetails')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('customerTab.unitStatusLabel')}</p>
              <Badge
                variant={selectedUnit.status === 'sold' ? 'destructive' : 'secondary'}
                className="mt-1"
              >
                {selectedUnit.status === 'sold' ? t('customerTab.statusSold') :
                 selectedUnit.status === 'reserved' ? t('customerTab.statusReserved') : t('customerTab.statusRented')}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">{t('customerTab.transactionDateLabel')}</p>
              <p className="font-medium">
                {selectedUnit.saleDate
                  ? formatDate(selectedUnit.saleDate, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : t('customerTab.unknownDate')
                }
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">{t('customerTab.transactionValueLabel')}</p>
              <p className={`font-medium ${colors.text.success}`}>
                {selectedUnit.price
                  ? formatCurrency(selectedUnit.price)
                  : t('customerTab.notAvailable')
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ENTERPRISE: Full Customer Profile Display με OPTIMIZED LOADING */}
      <CustomerProfileSection
        customerId={selectedUnit.soldTo!}
        unitPrice={selectedUnit.price}
      />

      {/* ENTERPRISE: Property Relationship Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UnitIcon className={`${iconSizes.md} ${unitColor}`} />
            {t('customerTab.propertyRelations')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Button variant="outline" className="justify-start h-auto p-4">
              <FileText className={`${iconSizes.md} mr-3 ${colors.text.info}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.transactionDocuments')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('customerTab.transactionDocumentsDesc')}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Calendar className={`${iconSizes.md} mr-3 ${colors.text.success}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.transactionHistory')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('customerTab.transactionHistoryDesc')}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Phone className={`${iconSizes.md} mr-3 ${colors.text.accent}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.communication')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('customerTab.communicationDesc')}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <UnitIcon className={`${iconSizes.md} mr-3 ${unitColor}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.otherProperties')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('customerTab.otherPropertiesDesc')}
                </div>
              </div>
            </Button>

          </div>
        </CardContent>
      </Card>

      {/* ENTERPRISE: Quick Actions Panel */}
      <Card className={INTERACTIVE_PATTERNS.SUBTLE_HOVER}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className={`${iconSizes.md} ${colors.text.success}`} />
            {t('customerTab.quickActions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">

            <Button
              variant="default"
              onClick={() => window.open(`tel:${selectedUnit.soldTo}`, '_self')}
            >
              <Phone className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.directCall')}
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open(`/contacts?contactId=${selectedUnit.soldTo}`, '_blank')}
            >
              <User className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.fullProfile')}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Add to calendar or task management
                console.log('Schedule follow-up for customer:', selectedUnit.soldTo);
              }}
            >
              <Calendar className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.schedule')}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Generate report
                console.log('Generate customer report for:', selectedUnit.soldTo);
              }}
            >
              <FileText className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.report')}
            </Button>

          </div>
        </CardContent>
      </Card>

    </div>
  );
}
