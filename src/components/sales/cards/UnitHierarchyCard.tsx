'use client';

/**
 * @fileoverview Unit Hierarchy Card — ADR-198
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
import { formatFloorLabel } from '@/lib/intl-utils';
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import type { UnitHierarchyResponse } from '@/app/api/units/[id]/hierarchy/route';

// =============================================================================
// TYPES
// =============================================================================

interface UnitHierarchyCardProps {
  unitId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function UnitHierarchyCard({ unitId }: UnitHierarchyCardProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { syncBreadcrumb } = useNavigation();
  const [hierarchy, setHierarchy] = useState<UnitHierarchyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHierarchy() {
      try {
        const data = await apiClient.get<UnitHierarchyResponse>(
          `/api/units/${encodeURIComponent(unitId)}/hierarchy`
        );
        if (!cancelled) {
          setHierarchy(data);

          // 🏢 ENTERPRISE: Sync breadcrumb with actual unit hierarchy data
          if (data.company && data.project) {
            syncBreadcrumb({
              company: { id: data.company.id, name: data.company.name },
              project: { id: data.project.id, name: data.project.name },
              building: data.building
                ? { id: data.building.id, name: data.building.name }
                : undefined,
              unit: { id: data.unit.id, name: data.unit.name },
              currentLevel: 'units',
            });
          }
        }
      } catch {
        // Graceful — δεν εμφανίζουμε τίποτα αν αποτύχει
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHierarchy();
    return () => { cancelled = true; };
  }, [unitId, syncBreadcrumb]);

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
          {t('sales.saleInfo.hierarchy', { defaultValue: 'Ιεραρχία Ακινήτου' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <ol className="relative border-l-2 border-muted ml-2 flex flex-col gap-0 pb-1">
          {/* Εταιρεία */}
          {hierarchy.company && (
            <HierarchyNode
              icon={Briefcase}
              iconColor="text-slate-600"
              label={t('sales.hierarchy.company', { defaultValue: 'Εταιρεία' })}
              value={hierarchy.company.name}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Έργο */}
          {hierarchy.project && (
            <HierarchyNode
              icon={FolderKanban}
              iconColor="text-blue-600"
              label={t('sales.hierarchy.project', { defaultValue: 'Έργο' })}
              value={hierarchy.project.name}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Τίτλος Αδείας */}
          {hierarchy.project?.permitTitle && (
            <HierarchyNode
              icon={FileText}
              iconColor="text-amber-600"
              label={t('sales.hierarchy.permit', { defaultValue: 'Τίτλος Αδείας' })}
              value={hierarchy.project.permitTitle}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Κτίριο */}
          {hierarchy.building && (
            <HierarchyNode
              icon={Building2}
              iconColor="text-teal-600"
              label={t('sales.hierarchy.building', { defaultValue: 'Κτίριο' })}
              value={hierarchy.building.name}
              iconSizeClass={iconSizes.xs}
            />
          )}

          {/* Μονάδα + Όροφος */}
          <HierarchyNode
            icon={Home}
            iconColor="text-green-600"
            label={t('sales.hierarchy.unit', { defaultValue: 'Μονάδα' })}
            value={`${hierarchy.unit.name} — ${formatFloorLabel(hierarchy.unit.floor)}`}
            iconSizeClass={iconSizes.xs}
            isLast
          />
        </ol>

        {/* Διεύθυνση */}
        {address && (
          <footer className="mt-3 pt-2 border-t text-sm text-muted-foreground space-y-1">
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
  return (
    <li className={`relative pl-5 ${isLast ? 'pb-0' : 'pb-2'}`}>
      {/* Bullet on the timeline */}
      <span className="absolute -left-[5px] top-1.5 flex items-center justify-center rounded-full bg-background border-2 border-muted">
        <Icon className={`${iconSizeClass} ${iconColor}`} />
      </span>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </li>
  );
}
