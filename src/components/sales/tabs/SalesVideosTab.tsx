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
import { Video } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Unit } from '@/types/unit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SalesVideosTab');

// =============================================================================
// TYPES
// =============================================================================

interface SalesVideosTabProps {
  unit: Unit;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SalesVideosTab({ unit }: SalesVideosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('common');
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
      <section className="flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <Video className={`${iconSizes.xl} opacity-50`} />
        <p className="text-sm">
          {t('sales.tabs.videosNoAuth', { defaultValue: 'Απαιτείται σύνδεση για να δείτε τα βίντεο.' })}
        </p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="unit"
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
