'use client';

/**
 * @fileoverview Property Hierarchy Card — ADR-198
 * @description Εμφανίζει ιεραρχία: Εταιρεία → Έργο → Κτίριο → Μονάδα + Διεύθυνση
 * @pattern Enterprise card with semantic hierarchy display
 */

import React, { useEffect, useState } from 'react';
import {
  Building2,
  FolderKanban,
  Home,
  MapPin,
  Briefcase,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { formatFloorLabel } from '@/lib/intl-utils';
import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';
import type { PropertyHierarchyResponse } from '@/app/api/properties/[id]/hierarchy/route';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createStaleCache } from '@/lib/stale-cache';

const propertyHierarchyCache = createStaleCache<PropertyHierarchyResponse>('property-hierarchy');

// =============================================================================
// TYPES
// =============================================================================

interface PropertyHierarchyCardProps {
  propertyId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PropertyHierarchyCard({ propertyId }: PropertyHierarchyCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  const [hierarchy, setHierarchy] = useState<PropertyHierarchyResponse | null>(
    propertyHierarchyCache.get(propertyId) ?? null
  );
  const [loading, setLoading] = useState(!propertyHierarchyCache.hasLoaded(propertyId));

  useEffect(() => {
    let cancelled = false;

    async function fetchHierarchy() {
      try {
        if (!propertyHierarchyCache.hasLoaded(propertyId)) setLoading(true);
        const data = await apiClient.get<PropertyHierarchyResponse>(
          API_ROUTES.PROPERTIES.HIERARCHY(encodeURIComponent(propertyId))
        );
        if (!cancelled) {
          propertyHierarchyCache.set(data, propertyId);
          setHierarchy(data);
        }
      } catch {
        // Graceful — breadcrumb won't sync but page still works
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHierarchy();
    return () => { cancelled = true; };
  }, [propertyId]);

  useBreadcrumbSync(
    hierarchy
      ? {
          type: 'property-resolved',
          id: hierarchy.property.id,
          company: hierarchy.company,
          project: hierarchy.project,
          building: hierarchy.building,
          property: hierarchy.property,
        }
      : null
  );

  if (loading || !hierarchy) return null;

  // Αν δεν υπάρχει τίποτα εκτός από τη μονάδα, δεν εμφανίζουμε
  if (!hierarchy.company && !hierarchy.project && !hierarchy.building) return null;

  const address = hierarchy.project
    ? [hierarchy.project.address, hierarchy.project.city].filter(Boolean).join(', ')
    : null;

  // Επιπλέον στοιχεία διεύθυνσης: ΤΚ, Δήμος, Π.Ε.
  const postalCode = hierarchy.project?.postalCode || null;
  const municipality = hierarchy.project?.municipality || null;
  const regionalUnit = hierarchy.project?.regionalUnit || null;
  const hasExtraAddressInfo = postalCode || municipality || regionalUnit;

  return (
    <Card>
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Building2 className={`${iconSizes.sm} text-indigo-600`} />
          {t('sales.saleInfo.hierarchy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <ol className="relative border-l-2 border-muted ml-2 flex flex-col gap-0 pb-1">
          {/* Εταιρεία */}
          {hierarchy.company && (
            <HierarchyNode
              icon={Briefcase}
              iconColor="text-slate-600"
              label={t('sales.hierarchy.company')}
              value={hierarchy.company.name}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Έργο */}
          {hierarchy.project && (
            <HierarchyNode
              icon={FolderKanban}
              iconColor="text-blue-600"
              label={t('sales.hierarchy.project')}
              value={hierarchy.project.name}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Τίτλος Αδείας */}
          {hierarchy.project?.permitTitle && (
            <HierarchyNode
              icon={FileText}
              iconColor="text-amber-600"
              label={t('sales.hierarchy.permit')}
              value={hierarchy.project.permitTitle}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Κτίριο */}
          {hierarchy.building && (
            <HierarchyNode
              icon={Building2}
              iconColor="text-teal-600"
              label={t('sales.hierarchy.building')}
              value={hierarchy.building.name}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Μονάδα + Όροφος */}
          <HierarchyNode
            icon={Home}
            iconColor="text-green-600"
            label={t('sales.hierarchy.unit')}
            value={`${hierarchy.property.name} — ${formatFloorLabel(hierarchy.property.floor)}`}
            iconSizeClass={iconSizes.xs}
            isLast
          />
        </ol>

        {/* Διεύθυνση */}
        {address && (
          <footer className={cn("mt-3 pt-2 border-t text-sm space-y-1", colors.text.muted)}>
            <p className="flex items-center gap-2">
              <MapPin className={`${iconSizes.sm} text-red-500 flex-shrink-0`} />
              <span>{address}</span>
            </p>
            {hasExtraAddressInfo && (
              <p className="flex items-center gap-2 pl-6 text-xs">
                {[
                  postalCode ? `ΤΚ ${postalCode}` : null,
                  municipality,
                  regionalUnit ? `Π.Ε. ${regionalUnit}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </footer>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// HIERARCHY NODE
// =============================================================================

function HierarchyNode({
  icon: Icon,
  iconColor,
  label,
  value,
  iconSizeClass,
  isLast = false,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string;
  iconSizeClass: string;
  isLast?: boolean;
}) {
  const colors = useSemanticColors();
  return (
    <li className={`relative pl-5 ${isLast ? 'pb-0' : 'pb-2'}`}>
      {/* Bullet on the timeline */}
      <span className="absolute -left-[5px] top-1.5 flex items-center justify-center rounded-full bg-background border-2 border-muted">
        <Icon className={`${iconSizeClass} ${iconColor}`} />
      </span>
      <p className={cn("text-xs", colors.text.muted)}>{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </li>
  );
}
