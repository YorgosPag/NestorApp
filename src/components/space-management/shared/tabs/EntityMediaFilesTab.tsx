/**
 * EntityMediaFilesTab — generic presentational shell for space media/files tabs
 *
 * Collapses the previously copy-pasted Parking/Storage media tabs (Photos,
 * Videos, Documents, Floorplan) into a single shell. Per-entity differences
 * are supplied via an {@link EntityMediaBinding}; per-tab differences via a
 * {@link MediaTabConfig}. The heavy lifting (upload, gallery, CRUD) stays in
 * the centralized {@link EntityFilesManager} (ADR-031) — this shell only wires
 * auth/company context and the sign-in guard.
 *
 * @module components/space-management/shared/tabs/EntityMediaFilesTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useCompanyDisplayName } from '@/hooks/useCompanyDisplayName';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { EntityMediaBinding } from './entity-media-binding';
import type { MediaTabConfig } from './media-tab-configs';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface EntityMediaFilesTabProps {
  /** Per-entity binding (Parking spot or Storage unit). */
  binding: EntityMediaBinding;
  /** Per-tab presentational + storage config. */
  media: MediaTabConfig;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityMediaFilesTab({ binding, media }: EntityMediaFilesTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation(binding.i18nNamespace);
  const colors = useSemanticColors();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;
  const companyName = useCompanyDisplayName(
    media.needsCompanyName ? companyId : undefined,
  );

  if (!companyId || !currentUserId) {
    return (
      <p className={cn('p-4 text-center', colors.text.muted)}>
        {t(media.signInKey)}
      </p>
    );
  }

  return (
    <section className="p-2">
      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType={binding.entityType}
        entityId={binding.entityId}
        entityLabel={binding.entityLabel}
        projectId={binding.projectId}
        domain={media.domain}
        category={media.category}
        purpose={`${binding.purposePrefix}-${media.purposeKey}`}
        entryPointCategoryFilter={media.entryPointCategoryFilter}
        entryPointExcludeCategories={media.entryPointExcludeCategories}
        displayStyle={media.displayStyle}
        acceptedTypes={media.acceptedTypes}
        companyName={companyName}
      />
    </section>
  );
}

export default EntityMediaFilesTab;
