'use client';

/**
 * @fileoverview Sales Videos Tab — ADR-197
 * @description Video gallery for units in sales context
 * @pattern Reuses EntityFilesManager (ADR-031) — same as units VideosTab
 */

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service';
import { DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { Video } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Property } from '@/types/property';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const logger = createModuleLogger('SalesVideosTab');

// =============================================================================
// TYPES
// =============================================================================

interface SalesVideosTabProps {
  unit: Property;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SalesVideosTab({ unit }: SalesVideosTabProps) {
  const colors = useSemanticColors();
  const { user } = useAuth();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  // Fetch company display name for Technical View (ADR-031)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!companyId) {
      setCompanyDisplayName(undefined);
      return;
    }

    const fetchCompanyName = async () => {
      try {
        const company = await getCompanyById(companyId);
        if (company && company.type === 'company') {
          setCompanyDisplayName(company.companyName || company.tradeName || companyId);
        } else {
          setCompanyDisplayName(companyId);
        }
      } catch (error) {
        logger.error('[SalesVideosTab] Failed to fetch company name:', { error });
        setCompanyDisplayName(companyId);
      }
    };

    fetchCompanyName();
  }, [companyId]);

  if (!companyId || !currentUserId) {
    return (
      <section className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center", colors.text.muted)}>
        <Video className={`${iconSizes.xl} opacity-50`} />
        <p className="text-sm">
          {t('sales.tabs.videosNoAuth')}
        </p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType={ENTITY_TYPES.PROPERTY}
      entityId={unit.id}
      entityLabel={unit.name || `Μονάδα ${unit.id}`}
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
