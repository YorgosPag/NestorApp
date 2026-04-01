/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Photos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for photo upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Smart compression for images
 * - Multi-tenant Storage Rules
 * - Entry point selection for photo types
 * - Media gallery display style
 *
 * @module features/properties-sidebar/components/PhotosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{propertyId}/domains/sales/categories/photos/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from 'react-i18next';
import { getCompanyById } from '@/services/companies.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('PhotosTab');

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

interface PhotosTabProps {
  selectedProperty: Property | null;
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
 * 🏢 ENTERPRISE: Unit Photos Tab
 *
 * Displays unit photos using centralized EntityFilesManager with:
 * - Domain: sales
 * - Category: photos
 * - DisplayStyle: media-gallery
 * - Entry points: interior photos, exterior photos, etc.
 */
export function PhotosTab({
  selectedProperty,
}: PhotosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Get companyId and userId from auth context
  const companyId = useCompanyId()?.companyId;
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
        logger.error('[PhotosTab] Failed to fetch company name:', { error: error });
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no unit selected, show placeholder
  if (!selectedProperty) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center p-8", colors.text.muted)}>
        <UnitIcon className={`${iconSizes['2xl']} ${unitColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t('photos.selectProperty', 'Επιλέξτε Μονάδα')}</h3>
        <p className="text-sm max-w-sm">
          {t('photos.selectUnitDescription', 'Επιλέξτε μια μονάδα από τη λίστα για να δείτε τις φωτογραφίες της.')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className={cn("p-6 text-center", colors.text.muted)}>
        <p>{t('photos.noAuth', 'Απαιτείται σύνδεση για να δείτε τις φωτογραφίες.')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="property"
      entityId={String(selectedProperty.id)}
      entityLabel={selectedProperty.name || `Μονάδα ${selectedProperty.id}`}
      domain="sales"
      category="photos"
      purpose="photo"
      entryPointCategoryFilter="photos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_PHOTO_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}
