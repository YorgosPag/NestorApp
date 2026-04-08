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
 * @module features/properties-sidebar/components/DocumentsTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{propertyId}/domains/sales/categories/documents/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getCompanyById } from '@/services/companies.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('DocumentsTab');

// =============================================================================
// PROPS
// =============================================================================

// 🏢 ENTERPRISE: Centralized Property Icon & Color
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

interface DocumentsTabProps {
  selectedProperty: Property | null;
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
  selectedProperty,
}: DocumentsTabProps) {
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
        logger.error('[DocumentsTab] Failed to fetch company name:', { error: error });
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no unit selected, show placeholder
  if (!selectedProperty) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center p-8", colors.text.muted)}>
        <PropertyIcon className={`${iconSizes['2xl']} ${propertyColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t('documents.selectProperty')}</h3>
        <p className="text-sm max-w-sm">
          {t('documents.selectUnitDescription')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className={cn("p-6 text-center", colors.text.muted)}>
        <p>{t('documents.noAuth')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType={ENTITY_TYPES.PROPERTY}
      entityId={String(selectedProperty.id)}
      entityLabel={selectedProperty.name || t('unitFallbackLabel', { id: selectedProperty.id })}
      domain="sales"
      category="documents"
      purpose="document"
      entryPointExcludeCategories={['photos', 'videos', 'floorplans']}
      fetchAllDomains
      companyName={companyDisplayName}
    />
  );
}
