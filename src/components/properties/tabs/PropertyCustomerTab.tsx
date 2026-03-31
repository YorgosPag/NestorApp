'use client';

/**
 * 🏢 PROPERTY CUSTOMER TAB - ENTERPRISE IMPLEMENTATION
 *
 * Full-featured customer management tab for properties με real Firebase integration
 * Εμφανίζει complete customer profile για sold/rented/reserved properties
 */

import React from 'react';
import { User, Phone, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;
import { formatDate, formatCurrency } from '@/lib/intl-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { Property } from '@/types/property-viewer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: Extracted sub-component
import { CustomerProfileSection } from './CustomerProfileSection';

// Re-export for backward compatibility
export { CustomerProfileSection } from './CustomerProfileSection';
export type { CustomerProfileSectionProps } from './CustomerProfileSection';

const logger = createModuleLogger('PropertyCustomerTab');

interface AdditionalTabData {
  buildingId?: string;
  projectId?: string;
  [key: string]: unknown;
}

interface GlobalTabProps {
  isEditing?: boolean;
  canEdit?: boolean;
  [key: string]: unknown;
}

export interface PropertyCustomerTabProps {
  selectedUnit: Property;
  additionalData?: AdditionalTabData;
  globalProps?: GlobalTabProps;
}

export function PropertyCustomerTab({
  selectedUnit,
  additionalData: _additionalData,
  globalProps: _globalProps
}: PropertyCustomerTabProps) {
  const iconSizes = useIconSizes();
  useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('properties');

  const hasSoldStatus = selectedUnit?.status === 'sold' ||
                       selectedUnit?.status === 'reserved' ||
                       selectedUnit?.status === 'rented';

  const hasCustomerLink = Boolean(selectedUnit?.soldTo);

  if (!selectedUnit) {
    return (
      <div className="p-6 text-center">
        <User className={`${iconSizes.xl3} mx-auto ${colors.text.muted} mb-4`} />
        <p className={colors.text.muted}>
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
            <p className={cn("mb-4", colors.text.muted)}>
              {t('customerTab.statusLabel')}: <Badge variant="outline">{selectedUnit.status}</Badge>
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
            <p className={cn("text-sm", colors.text.muted)}>
              <strong>{t('customerTab.unitStatus')}:</strong> {selectedUnit.status}
            </p>
            <p className={cn("text-sm", colors.text.muted)}>
              <strong>{t('customerTab.transactionDate')}:</strong> {
                selectedUnit.saleDate
                  ? formatDate(selectedUnit.saleDate)
                  : t('customerTab.unknownDate')
              }
            </p>
            <p className={cn("text-sm", colors.text.muted)}>
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

  return (
    <div className="p-6 space-y-6">
      {/* Unit Sale Information Header */}
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
              <p className={cn("text-sm", colors.text.muted)}>{t('customerTab.unitStatusLabel')}</p>
              <Badge
                variant={selectedUnit.status === 'sold' ? 'destructive' : 'secondary'}
                className="mt-1"
              >
                {selectedUnit.status === 'sold' ? t('customerTab.statusSold') :
                 selectedUnit.status === 'reserved' ? t('customerTab.statusReserved') : t('customerTab.statusRented')}
              </Badge>
            </div>

            <div>
              <p className={cn("text-sm", colors.text.muted)}>{t('customerTab.transactionDateLabel')}</p>
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
              <p className={cn("text-sm", colors.text.muted)}>{t('customerTab.transactionValueLabel')}</p>
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

      {/* Full Customer Profile Display */}
      <CustomerProfileSection
        customerId={selectedUnit.soldTo!}
        unitPrice={selectedUnit.price}
      />

      {/* Property Relationship Management */}
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
                <div className={cn("text-sm", colors.text.muted)}>
                  {t('customerTab.transactionDocumentsDesc')}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Calendar className={`${iconSizes.md} mr-3 ${colors.text.success}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.transactionHistory')}</div>
                <div className={cn("text-sm", colors.text.muted)}>
                  {t('customerTab.transactionHistoryDesc')}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Phone className={`${iconSizes.md} mr-3 ${colors.text.accent}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.communication')}</div>
                <div className={cn("text-sm", colors.text.muted)}>
                  {t('customerTab.communicationDesc')}
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <UnitIcon className={`${iconSizes.md} mr-3 ${unitColor}`} />
              <div className="text-left">
                <div className="font-medium">{t('customerTab.otherProperties')}</div>
                <div className={cn("text-sm", colors.text.muted)}>
                  {t('customerTab.otherPropertiesDesc')}
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Panel */}
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
                logger.info('Schedule follow-up for customer', { soldTo: selectedUnit.soldTo });
              }}
            >
              <Calendar className={`${iconSizes.sm} mr-2`} />
              {t('customerTab.schedule')}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                logger.info('Generate customer report', { soldTo: selectedUnit.soldTo });
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

// Backward compatibility
export { PropertyCustomerTab as UnitCustomerTab };
export type { PropertyCustomerTabProps as UnitCustomerTabProps };
