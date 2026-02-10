
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CustomerInfoCompact } from '@/components/shared/customer-info';
import { useProjectCustomers } from './hooks/useProjectCustomers';
import { LoadingCard } from './parts/LoadingCard';
import { ErrorCard } from './parts/ErrorCard';
import { EmptyState } from './parts/EmptyState';
import type { ProjectCustomersTabProps } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized typography tokens
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';

export function ProjectCustomersTab({ projectId }: ProjectCustomersTabProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  // 🏢 ENTERPRISE: Centralized typography tokens
  const typography = useTypography();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const { customers, loading, error } = useProjectCustomers(projectId);

  if (loading) {
    return <LoadingCard />;
  }

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (customers.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className={typography.card.titleCompact}>{t('customers.titleWithCount', { count: customers.length })}</CardTitle>
        <CardDescription>{t('customers.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table Headers */}
        <header className={cn("grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 border-b border-border text-sm font-medium text-muted-foreground", spacing.padding.bottom.sm, spacing.margin.bottom.md)}>
          <span>{t('customers.table.name')}</span>
          <span>{t('customers.table.phone')}</span>
          <span>{t('customers.table.email')}</span>
          <span className="text-right pr-3">{t('customers.table.units')}</span>
          <span className="text-right">{t('customers.table.actions')}</span>
        </header>

        {/* Table Content */}
        <section className={spacing.spaceBetween.xs} aria-label={t('customers.listAriaLabel')}>
          {customers.map((customer) => (
            <CustomerInfoCompact
              key={customer.contactId}
              contactId={customer.contactId}
              context="project"
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
