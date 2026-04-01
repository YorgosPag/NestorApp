import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle, Building2 } from 'lucide-react';
import { ContactsService } from '@/services/contacts.service';
import { UNIT_SALE_STATUS } from '@/constants/property-statuses-enterprise';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('SoldPropertiesPreview');

// 🏢 ENTERPRISE: Centralized Property Icon
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

interface Unit {
  id: string;
  name?: string;
  status: string;
  soldTo?: string;
  buildingId?: string;
  project?: string;
  area?: number;
  price?: number;
}

interface UnitsData {
  success: boolean;
  units: Unit[];
  count: number;
}

interface ContactLookup {
  [contactId: string]: string; // contactId -> contact name
}

export function SoldPropertiesPreview() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('admin');
  const [properties, setProperties] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [contactLookup, setContactLookup] = useState<ContactLookup>({});

  const loadProperties = async () => {
    setLoading(true);
    setError(null);

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const data = await apiClient.get<UnitsData>(API_ROUTES.PROPERTIES.LIST);

      if (data?.success) {
        setProperties(data.units);

        // 🔍 Load contact names για sold properties
        await loadContactNames(data.units);
      } else {
        throw new Error('Failed to load properties');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadContactNames = async (props: Unit[]) => {
    try {
      // Get unique contact IDs from sold properties
      const contactIds = props
        .filter(prop => prop.status === 'sold' && prop.soldTo && prop.soldTo !== UNIT_SALE_STATUS.NOT_SOLD)
        .map(prop => prop.soldTo!)
        .filter((id, index, arr) => arr.indexOf(id) === index); // unique IDs

      if (contactIds.length === 0) return;

      logger.info('Loading contact names for IDs', { contactIds });

      // Create lookup map
      const lookup: ContactLookup = {};

      // Load contact details για κάθε ID
      for (const contactId of contactIds) {
        try {
          const contact = await ContactsService.getContact(contactId);
          if (contact) {
            let displayName = '';
            if (contact.type === 'individual') {
              displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            } else if (contact.type === 'company') {
              displayName = contact.companyName || 'Unknown Company';
            } else if (contact.type === 'service') {
              displayName = contact.serviceName || 'Unknown Service';
            }

            lookup[contactId] = displayName || 'Unknown Contact';
            logger.info('Contact loaded', { contactId, displayName });
          } else {
            lookup[contactId] = 'Contact Not Found';
            logger.warn('Contact not found', { contactId });
          }
        } catch (error) {
          lookup[contactId] = 'Error Loading';
          logger.error('Error loading contact', { contactId, error });
        }
      }

      setContactLookup(lookup);
      logger.info('Contact lookup completed', { count: Object.keys(lookup).length });

    } catch (error) {
      logger.error('Error loading contact names', { error });
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  // Filter sold properties without soldTo
  const soldPropertiesWithoutCustomer = properties.filter(prop =>
    prop.status === 'sold' && (!prop.soldTo || prop.soldTo === UNIT_SALE_STATUS.NOT_SOLD)
  );

  // Filter sold properties with soldTo
  const soldPropertiesWithCustomer = properties.filter(prop =>
    prop.status === 'sold' && prop.soldTo && prop.soldTo !== UNIT_SALE_STATUS.NOT_SOLD
  );

  // 🏢 ENTERPRISE: All properties for configured main project
  const palaiologouProperties = properties.filter(prop =>
    prop.buildingId?.includes('palaiologou') ||
    prop.project?.includes(process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project') ||
    prop.project?.includes('Κέντρο') // Based on the API response
  );

  const displayProperties = showAll ? properties : palaiologouProperties;

  return (
    <div className="space-y-6">

      {/* Summary Cards — 🏢 ENTERPRISE: Centralized UnifiedDashboard */}
      <UnifiedDashboard
        stats={[
          {
            title: t('units.total'),
            value: properties.length,
            icon: PropertyIcon,
            color: 'blue',
          },
          {
            title: t('units.mainProjectProperties', { project: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project' }),
            value: palaiologouProperties.length,
            icon: Building2,
            color: 'cyan',
          },
          {
            title: t('units.soldNoCustomer'),
            value: soldPropertiesWithoutCustomer.length,
            icon: AlertCircle,
            color: 'red',
          },
          {
            title: t('units.soldWithCustomer'),
            value: soldPropertiesWithCustomer.length,
            icon: CheckCircle,
            color: 'green',
          },
        ] satisfies DashboardStat[]}
        columns={4}
        className=""
      />

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {t('units.overview')} {showAll ? t('units.allLabel') : t('units.projectLabel', { project: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project' })}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? <EyeOff className={`${iconSizes.sm} mr-2`} /> : <Eye className={`${iconSizes.sm} mr-2`} />}
                {showAll ? t('units.onlyProject', { project: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project' }) : t('units.allUnits')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadProperties}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className={`${iconSizes.sm} mr-2 animate-spin`} />
                ) : (
                  <RefreshCw className={`${iconSizes.sm} mr-2`} />
                )}
                {t('units.refresh')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                <strong>{t('units.error')}</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8">{t('units.loading')}</div>
          ) : (
            <div className={`${quick.table} border max-h-96 overflow-auto`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>{t('units.table.name')}</TableHead>
                    <TableHead>{t('units.table.status')}</TableHead>
                    <TableHead>{t('units.table.customer')}</TableHead>
                    <TableHead>{t('units.table.building')}</TableHead>
                    <TableHead>{t('units.table.project')}</TableHead>
                    <TableHead className="text-right">{t('units.table.price')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayProperties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className={cn("text-center py-8", colors.text.muted)}>
                        {t('units.notFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayProperties.map((prop) => (
                      <TableRow key={prop.id}>
                        <TableCell className="font-mono text-xs">
                          {prop.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {prop.name || t('units.unnamed')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              prop.status === 'sold' ? 'destructive' :
                              prop.status === 'reserved' ? 'secondary' :
                              prop.status === 'rented' ? 'default' :
                              'outline'
                            }
                          >
                            {prop.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {prop.soldTo && prop.soldTo !== UNIT_SALE_STATUS.NOT_SOLD ? (
                            <div className="space-y-1">
                              <Badge variant="default" className="text-xs">
                                {contactLookup[prop.soldTo] || t('units.contactLoading')}
                              </Badge>
                              <div className={cn("text-xs font-mono", colors.text.muted)}>
                                {t('units.table.idLabel')}: {prop.soldTo.substring(0, 8)}...
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-red-600" /* eslint-disable-line design-system/enforce-semantic-colors */>
                              {t('units.noCustomer')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-sm", colors.text.muted)}>
                          {prop.buildingId?.substring(0, 15)}...
                        </TableCell>
                        <TableCell className={cn("text-sm", colors.text.muted)}>
                          {prop.project?.substring(0, 20)}...
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyWhole(prop.price)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Statistics */}
          <div className={cn("mt-4 text-sm", colors.text.muted)}>
            {t('units.displaying', { displayed: displayProperties.length, total: properties.length })}
            {!showAll && ` ${t('units.filteredFor', { project: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project' })}`}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export default SoldPropertiesPreview;