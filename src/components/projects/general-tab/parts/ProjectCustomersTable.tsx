'use client';

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerInfoCompact } from '@/components/shared/customer-info';
import { Users, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useProjectCustomers } from '../../customers-tab/hooks/useProjectCustomers';
import type { ProjectCustomersTableProps } from "../types";
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// 🏢 ENTERPRISE: Extended Props Type
// ============================================================================

interface ExtendedProjectCustomersTableProps extends ProjectCustomersTableProps {
  /** Whether to start expanded (load immediately) @default false for lazy loading */
  defaultExpanded?: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Component
// ============================================================================

/**
 * 🏢 ENTERPRISE: ProjectCustomersTable Component
 *
 * Εμφανίζει τους πελάτες που έχουν αγοράσει μονάδες σε ένα έργο.
 *
 * LAZY LOADING PATTERN:
 * - Starts collapsed by default (no API call)
 * - User clicks to expand → triggers data fetch
 * - Data is cached after first fetch
 */
export function ProjectCustomersTable({ projectId, defaultExpanded = false }: ExtendedProjectCustomersTableProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Lazy loading state
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 🏢 ENTERPRISE: Only fetch when expanded (enabled flag)
  const { customers, loading, error, refetch } = useProjectCustomers(projectId, {
    enabled: isExpanded
  });

  // 🏢 ENTERPRISE: Toggle expand/collapse
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 🏢 ENTERPRISE: Collapsed state (no data fetch yet)
  if (!isExpanded) {
    return (
      <Card className="mt-6">
        <CardHeader
          className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
          onClick={handleToggleExpand}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className={iconSizes.md} />
              {t('customers.title')}
            </span>
            <ChevronRight className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
          <CardDescription>
            {t('customers.clickToLoad')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Loading state
  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader
          className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
          onClick={handleToggleExpand}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className={iconSizes.md} />
              {t('customers.title')}
            </span>
            <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <section className="flex items-center justify-center gap-2 py-8" aria-busy="true">
            <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} />
            <span className={colors.text.muted}>{t('customers.loading')}</span>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Error state with retry
  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader
          className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
          onClick={handleToggleExpand}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className={iconSizes.md} />
              {t('customers.title')}
            </span>
            <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <section className="flex flex-col items-center justify-center gap-3 py-8" aria-live="polite">
            <AlertCircle className={cn(iconSizes.lg, 'text-destructive')} />
            <span className="text-destructive text-sm">{t('customers.errorPrefix')} {error}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('customers.retry')}
            </Button>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Empty state
  if (customers.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader
          className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
          onClick={handleToggleExpand}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className={iconSizes.md} />
              {t('customers.title')}
            </span>
            <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <section className="text-center py-8" aria-label={t('customers.emptyListAriaLabel')}>
            <Users className={cn(iconSizes.xl3, 'mx-auto mb-4', colors.text.muted)} />
            <p className={cn('text-sm font-medium', colors.text.foreground)}>
              {t('customers.emptyTitle')}
            </p>
            <p className={cn('text-sm mt-1', colors.text.muted)}>
              {t('customers.emptyDescription')}
            </p>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Customers list (expanded)
  return (
    <Card className="mt-6">
      <CardHeader
        className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
        onClick={handleToggleExpand}
      >
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            {t('customers.title')}
          </span>
          <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
        </CardTitle>
        <CardDescription>
          {t('customers.descriptionWithCount', { count: customers.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table Headers */}
        <header className="grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 pb-2 mb-4 border-b border-border text-sm font-medium text-muted-foreground">
          <span>{t('customers.table.name')}</span>
          <span>{t('customers.table.phone')}</span>
          <span>{t('customers.table.email')}</span>
          <span className="text-right pr-3">{t('customers.table.units')}</span>
          <span className="text-right">{t('customers.table.actions')}</span>
        </header>

        {/* Table Content */}
        <section className="space-y-1" aria-label={t('customers.listAriaLabel')}>
          {customers.map((customer) => (
            <CustomerInfoCompact
              key={customer.contactId}
              contactId={customer.contactId}
              context="building"
              variant="table"
              size="md"
              showPhone={true}
              showActions={true}
              showUnitsCount={true}
              unitsCount={customer.unitsCount}
              className="hover:bg-accent/30 transition-colors rounded-md"
            />
          ))}
        </section>
      </CardContent>
    </Card>
  );
}
