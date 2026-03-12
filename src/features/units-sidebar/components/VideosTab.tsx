/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Videos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for video upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for video types
 * - Media gallery display style
 *
 * @module features/units-sidebar/components/VideosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{unitId}/domains/sales/categories/videos/files/
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
import { DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('VideosTab');

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

interface VideosTabProps {
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
 * 🏢 ENTERPRISE: Unit Videos Tab
 *
 * Displays unit videos using centralized EntityFilesManager with:
 * - Domain: sales
 * - Category: videos
 * - DisplayStyle: media-gallery
 * - Entry points: walkthrough, tour, etc.
 */
export function VideosTab({
  selectedUnit,
}: VideosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();

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
        logger.error('[VideosTab] Failed to fetch company name:', { error: error });
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
        <h3 className="text-xl font-semibold mb-2">{t('videos.selectUnit', 'Επιλέξτε Μονάδα')}</h3>
        <p className="text-sm max-w-sm">
          {t('videos.selectUnitDescription', 'Επιλέξτε μια μονάδα από τη λίστα για να δείτε τα βίντεο της.')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className="p-6 text-center text-muted-foreground">
        <p>{t('videos.noAuth', 'Απαιτείται σύνδεση για να δείτε τα βίντεο.')}</p>
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
      category="videos"
      purpose="video"
      entryPointCategoryFilter="videos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_VIDEO_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}
