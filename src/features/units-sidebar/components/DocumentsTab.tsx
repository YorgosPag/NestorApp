/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Documents Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for document upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for document types
 * - EXCLUDES photos, videos, and floorplans (they have dedicated tabs)
 *
 * @module features/units-sidebar/components/DocumentsTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{unitId}/domains/sales/categories/documents/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getCompanyById } from '@/services/companies.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';

// =============================================================================
// PROPS
// =============================================================================

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

/** Viewer props structure */
interface ViewerProps {
  onSelectFloor?: (floorId: string) => void;
  properties?: Property[];
  [key: string]: unknown;
}

interface DocumentsTabProps {
  selectedUnit: Property | null;
  currentFloor: FloorData | null;
  safeFloors: FloorData[];
  safeViewerProps: ViewerProps;
  safeViewerPropsWithFloors: ViewerProps & { floors?: FloorData[] };
  setShowHistoryPanel: (show: boolean) => void;
  units: Property[];
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Unit Documents Tab
 *
 * Displays unit documents using centralized EntityFilesManager with:
 * - Domain: sales (default for unit documents)
 * - Category: documents
 * - Entry points: ALL except photos, videos, and floorplans
 *
 * This tab handles: contracts, permits, certificates, etc.
 * Photos, Videos, and Floorplans have their own dedicated tabs.
 */
export function DocumentsTab({
  selectedUnit,
}: DocumentsTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  // 🏢 ENTERPRISE: Fetch company name for Technical View display (ADR-031)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!companyId) {
        setCompanyDisplayName(undefined);
        return;
      }

      try {
        const company = await getCompanyById(companyId);
        if (company && company.type === 'company') {
          // 🏢 ENTERPRISE: Use companyName or tradeName as fallback
          const displayName = company.companyName || company.tradeName || companyId;
          setCompanyDisplayName(displayName);
        } else {
          setCompanyDisplayName(companyId); // Fallback to ID if company not found
        }
      } catch (error) {
        console.error('[DocumentsTab] Failed to fetch company name:', error);
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no unit selected, show placeholder
  if (!selectedUnit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
        <UnitIcon className={`${iconSizes['2xl']} ${unitColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t('documents.selectUnit', 'Επιλέξτε Μονάδα')}</h3>
        <p className="text-sm max-w-sm">
          {t('documents.selectUnitDescription', 'Επιλέξτε μια μονάδα από τη λίστα για να δείτε τα έγγραφά της.')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className="p-6 text-center text-muted-foreground">
        <p>{t('documents.noAuth', 'Απαιτείται σύνδεση για να δείτε τα έγγραφα.')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="unit"
      entityId={String(selectedUnit.id)}
      entityLabel={selectedUnit.name || `Μονάδα ${selectedUnit.id}`}
      domain="sales"
      category="documents"
      purpose="document"
      entryPointExcludeCategories={['photos', 'videos', 'floorplans']}
      companyName={companyDisplayName}
    />
  );
}
