/**
 * =============================================================================
 * 🏢 Building files tabs — κοινό σώμα (Photos · Videos · Contracts · Floorplan)
 * =============================================================================
 *
 * Οι τέσσερις καρτέλες αρχείων κτιρίου ήταν δίδυμα: ίδια επίλυση κτιρίου/συνεδρίας,
 * ίδιο placeholder, ίδιο μπλοκ ταυτότητας στον `EntityFilesManager`, και οι Photos/Videos
 * **ταυτόσημες** πλην κατηγορίας. Εδώ ζει ό,τι μοιράζονται· κάθε καρτέλα κρατά μόνο
 * ό,τι τη διαφοροποιεί.
 *
 * Storage Path:
 * companies/{companyId}/entities/building/{buildingId}/domains/construction/categories/{category}/files/
 *
 * @module components/building-management/tabs/building-files-tab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager, type EntityFilesManagerProps } from '@/components/shared/files/EntityFilesManager';
import { EntityFilesTabPlaceholder } from '@/components/shared/files/EntityFilesTabPlaceholder';
import {
  useEntityFilesTabSession,
  type EntityFilesTabSessionOptions,
} from '@/components/shared/files/useEntityFilesTabSession';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { Building } from '@/types/building/contracts';
import '@/lib/design-system';

const BUILDING_TAB_NAMESPACES = [
  'building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline',
] as const;

export interface BuildingFilesTabProps {
  /** Building data (passed automatically by UniversalTabsRenderer) */
  building?: Building;
  /** Alternative data prop */
  data?: Building;
  /** Title for the tab */
  title?: string;
}

type BuildingFilesIdentity = Pick<
  EntityFilesManagerProps,
  'custody' | 'currentUserId' | 'entityType' | 'entityId' | 'entityLabel' | 'projectId' | 'domain'
>;

/** Κτίριο + συνεδρία + ταυτότητα αρχείων — `identity` είναι `null` όσο κάτι λείπει. */
export function useBuildingFilesTab(
  { building, data }: BuildingFilesTabProps,
  options?: EntityFilesTabSessionOptions,
) {
  const { t } = useTranslation(BUILDING_TAB_NAMESPACES);
  const resolvedBuilding = building || data;
  const { companyId, currentUserId, companyName } = useEntityFilesTabSession(options);

  const identity: BuildingFilesIdentity | null =
    resolvedBuilding?.id && companyId && currentUserId
      ? {
          custody: { companyId },
          currentUserId,
          entityType: ENTITY_TYPES.BUILDING,
          entityId: String(resolvedBuilding.id),
          entityLabel: resolvedBuilding.name || t('entityLabel', { id: resolvedBuilding.id }),
          projectId: resolvedBuilding.projectId,
          domain: 'construction',
        }
      : null;

  return { t, identity, companyName };
}

// =============================================================================
// MEDIA (Photos · Videos)
// =============================================================================

const BUILDING_MEDIA = {
  photos: {
    purpose: 'building-photo',
    acceptedTypes: 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif',
    emptyKey: 'tabs.photos.noBuilding',
  },
  videos: {
    purpose: 'building-video',
    acceptedTypes: 'video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi',
    emptyKey: 'tabs.videos.noBuilding',
  },
} as const;

interface BuildingMediaTabProps extends BuildingFilesTabProps {
  kind: keyof typeof BUILDING_MEDIA;
}

export function BuildingMediaTab({ kind, ...props }: BuildingMediaTabProps) {
  const { t, identity, companyName } = useBuildingFilesTab(props, { withCompanyName: true });
  const media = BUILDING_MEDIA[kind];

  if (!identity) {
    return <EntityFilesTabPlaceholder message={t(media.emptyKey)} />;
  }

  return (
    <EntityFilesManager
      {...identity}
      category={kind}
      purpose={media.purpose}
      entryPointCategoryFilter={kind}
      displayStyle="media-gallery"
      acceptedTypes={media.acceptedTypes}
      companyName={companyName}
    />
  );
}
