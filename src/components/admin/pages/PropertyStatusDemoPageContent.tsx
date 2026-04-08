/**
 * 🏢 ENTERPRISE PROPERTY STATUS SYSTEM - DEMO PAGE
 *
 * @performance ADR-294 Batch 5 — lazy-loaded via LazyRoutes
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  getAllEnhancedStatuses,
  getEnhancedStatusLabel,
  getEnhancedStatusColor,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  isPropertyOffMarket,
  hasPropertyIssues,
  STATUS_CATEGORIES
} from '@/constants/property-statuses-enterprise';

import type { EnhancedPropertyStatus } from '@/constants/property-statuses-enterprise';
import type { PropertyStatus } from '@/core/types/BadgeTypes';

import { PropertyBadge } from '@/core/badges/UnifiedBadgeSystem';

import { Home, Building, Info, Zap, BarChart3, Settings, CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface DemoProperty {
  id: string;
  name: string;
  type: string;
  status: EnhancedPropertyStatus;
  price: number;
  area: number;
  location: string;
}

const DEMO_PROPERTY_DEFS = [
  { id: '1', nameKey: 'apartment', typeKey: 'apartmentType', status: 'for-sale' as const, price: 180000, area: 75, location: 'Thessaloniki' },
  { id: '2', nameKey: 'studio', typeKey: 'studioType', status: 'rental-only' as const, price: 450, area: 35, location: 'Athens' },
  { id: '3', nameKey: 'maisonette', typeKey: 'maisonetteType', status: 'reserved-pending' as const, price: 320000, area: 120, location: 'Patras' },
  { id: '4', nameKey: 'shop', typeKey: 'shopType', status: 'under-renovation' as const, price: 150000, area: 50, location: 'Larissa' },
  { id: '5', nameKey: 'office', typeKey: 'officeType', status: 'company-owned' as const, price: 0, area: 85, location: 'Thessaloniki' },
  { id: '6', nameKey: 'storage', typeKey: 'storageType', status: 'urgent-sale' as const, price: 75000, area: 200, location: 'Volos' },
] as const;

export function PropertyStatusDemoPageContent() {
  const { t } = useTranslation('admin');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();
  const [selectedStatus, setSelectedStatus] = useState<EnhancedPropertyStatus | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<DemoProperty | null>(null);

  const DEMO_PROPERTIES: DemoProperty[] = DEMO_PROPERTY_DEFS.map(def => ({
    id: def.id,
    name: t(`propertyStatusDemo.demoData.${def.nameKey}`),
    type: t(`propertyStatusDemo.demoData.${def.typeKey}`),
    status: def.status,
    price: def.price,
    area: def.area,
    location: def.location,
  }));

  const allStatuses = getAllEnhancedStatuses();
  const categorizedStatuses = {
    available: allStatuses.filter(status => isPropertyAvailable(status)),
    committed: allStatuses.filter(status => isPropertyCommitted(status)),
    offMarket: allStatuses.filter(status => isPropertyOffMarket(status)),
    issues: allStatuses.filter(status => hasPropertyIssues(status))
  };

  const StatusBadge = ({ status, interactive = false }: {
    status: EnhancedPropertyStatus;
    interactive?: boolean;
  }) => (
    <PropertyBadge
      status={status as PropertyStatus}
      variant="outline"
      size="default"
      className={cn(
        'transition-all duration-200',
        interactive ? 'cursor-pointer hover:scale-105' : 'cursor-default'
      )}
      onClick={interactive ? () => setSelectedStatus(status) : undefined}
    />
  );

  const PropertyCard = ({ property }: { property: DemoProperty }) => (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 border"
      onClick={() => setSelectedProperty(property)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{property.name}</CardTitle>
          <PropertyBadge
            status={property.status as PropertyStatus}
            variant="default"
            size="sm"
            className="text-xs"
          />
        </div>
        <p className={cn("text-sm", colors.text.muted)}>{property.type}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('propertyStatusDemo.propertyFields.price')}</span>
            <span className="font-medium">
              {property.price > 0 ? `€${property.price.toLocaleString()}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('propertyStatusDemo.propertyFields.area')}</span>
            <span className="font-medium">{property.area} m²</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('propertyStatusDemo.propertyFields.location')}</span>
            <span className="font-medium">{property.location}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('propertyStatusDemo.propertyFields.category')}</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">
              {getStatusCategory(property.status)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Building className={`${iconSizes.xl} text-blue-600`} />
          {t('propertyStatusDemo.title')}
        </h1>
        <p className={colors.text.muted}>{t('propertyStatusDemo.subtitle')}</p>
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <CheckCircle className={iconSizes.sm} />
          <span>{t('propertyStatusDemo.productionReady')}</span>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="text-center">
            <Zap className={`${iconSizes.xl} mx-auto text-green-500`} />
            <CardTitle className="text-sm">{t('propertyStatusDemo.cards.available')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{categorizedStatuses.available.length}</div>
            <p className={cn("text-xs", colors.text.muted)}>{t('propertyStatusDemo.cards.statusOptions')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-center">
            <Settings className={`${iconSizes.xl} mx-auto text-orange-500`} />
            <CardTitle className="text-sm">{t('propertyStatusDemo.cards.committed')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{categorizedStatuses.committed.length}</div>
            <p className={cn("text-xs", colors.text.muted)}>{t('propertyStatusDemo.cards.statusOptions')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-center">
            <Home className={`${iconSizes.xl} mx-auto text-gray-500`} />
            <CardTitle className="text-sm">{t('propertyStatusDemo.cards.offMarket')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{categorizedStatuses.offMarket.length}</div>
            <p className={cn("text-xs", colors.text.muted)}>{t('propertyStatusDemo.cards.statusOptions')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-center">
            <BarChart3 className={`${iconSizes.xl} mx-auto text-blue-500`} />
            <CardTitle className="text-sm">{t('propertyStatusDemo.cards.totalStatuses')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{allStatuses.length}</div>
            <p className={cn("text-xs", colors.text.muted)}>{t('propertyStatusDemo.cards.enhancedStatuses')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className={iconSizes.md} />
            {t('propertyStatusDemo.statusCategories')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(STATUS_CATEGORIES).map(([categoryKey, statuses]) => (
            <div key={categoryKey} className="space-y-2">
              <h4 className="font-medium text-sm">
                {categoryKey === 'AVAILABLE' && `🟢 ${t('propertyStatusDemo.categoryLabels.available')}`}
                {categoryKey === 'COMMITTED' && `🔒 ${t('propertyStatusDemo.categoryLabels.committed')}`}
                {categoryKey === 'OFF_MARKET' && `⚪ ${t('propertyStatusDemo.categoryLabels.offMarket')}`}
                {categoryKey === 'IN_PROCESS' && `🔧 ${t('propertyStatusDemo.categoryLabels.inProcess')}`}
                {' '}({statuses.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {statuses.map(status => (
                  <StatusBadge key={status} status={status} interactive />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className={iconSizes.md} />
            {t('propertyStatusDemo.demoProperties')}
          </CardTitle>
          <p className={cn("text-sm", colors.text.muted)}>
            {t('propertyStatusDemo.demoPropertiesDescription')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_PROPERTIES.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedStatus && (
        <Card className={getStatusBorder('info')}>
          <CardHeader>
            <CardTitle className="text-blue-800">
              {t('propertyStatusDemo.statusDetails')}: {getEnhancedStatusLabel(selectedStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.label')}</span>
                <p>{getEnhancedStatusLabel(selectedStatus)}</p>
              </div>
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.category')}</span>
                <p>{getStatusCategory(selectedStatus)}</p>
              </div>
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.available')}</span>
                <p>{isPropertyAvailable(selectedStatus) ? t('propertyStatusDemo.yes') : t('propertyStatusDemo.no')}</p>
              </div>
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.color')}</span>
                <PropertyBadge
                  status={selectedStatus as PropertyStatus}
                  variant="default"
                  size="sm"
                  className={`${iconSizes.lg} rounded border`}
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedStatus(null)}>
              {t('propertyStatusDemo.close')}
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedProperty && (
        <Card className={getStatusBorder('success')}>
          <CardHeader>
            <CardTitle className="text-green-800">
              {t('propertyStatusDemo.propertyDetails')}: {selectedProperty.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.type')}</span>
                <p>{selectedProperty.type}</p>
              </div>
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.status')}</span>
                <StatusBadge status={selectedProperty.status} />
              </div>
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.price')}</span>
                <p>{selectedProperty.price > 0 ? `€${selectedProperty.price.toLocaleString()}` : 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium">{t('propertyStatusDemo.fields.area')}</span>
                <p>{selectedProperty.area} m²</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedProperty(null)}>
              {t('propertyStatusDemo.close')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('propertyStatusDemo.usageInstructions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• <strong>{t('propertyStatusDemo.instruction1')}</strong></p>
          <p>• <strong>{t('propertyStatusDemo.instruction2')}</strong></p>
          <p>• <strong>{t('propertyStatusDemo.instruction3', { count: allStatuses.length })}</strong></p>
          <p>• <strong>{t('propertyStatusDemo.instruction4')}</strong></p>
          <p>• <strong>{t('propertyStatusDemo.instruction5')}</strong></p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PropertyStatusDemoPageContent;
