'use client';

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CustomerInfoCompact } from '@/components/shared/customer-info';
import { Users } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ProjectCustomer } from "@/types/project";
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BuildingCustomersTabProps {
  buildingId: string;
}

export function BuildingCustomersTab({ buildingId }: BuildingCustomersTabProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
        interface BuildingCustomersApiResponse {
          customers: ProjectCustomer[];
        }

        const data = await apiClient.get<BuildingCustomersApiResponse>(`/api/buildings/${buildingId}/customers`);

        if (mounted) {
          setCustomers(data?.customers || []);
        }
      } catch (e) {
        console.error("Failed to fetch building customers:", e);
        if (mounted) {
          setError(e instanceof Error ? e.message : t('customers.error.unknown'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [buildingId, t]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            {t('customers.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">{t('customers.loading')}</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            {t('customers.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            {t('customers.error.loadingPrefix')} {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            {t('customers.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className={`${iconSizes.xl3} mx-auto text-muted-foreground mb-4`} />
            <p className="text-sm text-muted-foreground">
              {t('customers.empty.message')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className={iconSizes.md} />
          {t('customers.title')}
        </CardTitle>
        <CardDescription>
          {t('customers.description', { count: customers.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table Headers */}
        <div className="grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 pb-2 mb-4 border-b border-border text-sm font-medium text-muted-foreground">
          <div>{t('customers.table.name')}</div>
          <div>{t('customers.table.phone')}</div>
          <div>{t('customers.table.email')}</div>
          <div className="text-right pr-3">{t('customers.table.units')}</div>
          <div className="text-right">{t('customers.table.actions')}</div>
        </div>

        {/* Table Content */}
        <section className="space-y-1" aria-label={t('customers.ariaLabel')}>
          {customers.map((customer) => (
            <CustomerInfoCompact
              key={customer.contactId}
              contactId={customer.contactId}
              context="building"
              variant="table"
              size="md"
              showPhone
              showActions
              showUnitsCount
              unitsCount={customer.unitsCount}
              className="hover:bg-accent/30 transition-colors rounded-md"
              customerData={{
                name: customer.name,
                phone: customer.phone,
                email: customer.email
              }}
            />
          ))}
        </section>
      </CardContent>
    </Card>
  );
}