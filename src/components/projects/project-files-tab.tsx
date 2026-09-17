/**
 * =============================================================================
 * 🏢 Project files tabs — κοινό σώμα (Photos · Videos · Documents · Floorplan)
 * =============================================================================
 *
 * Οι καρτέλες αρχείων έργου ήταν δίδυμα: ίδια επίλυση έργου/συνεδρίας, ίδιο placeholder,
 * ίδιο μπλοκ ταυτότητας στον `EntityFilesManager`, και οι Photos/Videos **ταυτόσημες**
 * πλην κατηγορίας. Εδώ ζει ό,τι μοιράζονται.
 *
 * Storage Path:
 * companies/{companyId}/entities/project/{projectId}/domains/construction/categories/{category}/files/
 *
 * @module components/projects/project-files-tab
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
import { DEFAULT_PHOTO_ACCEPT, DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';
import '@/lib/design-system';

type ProjectLike = Pick<Project, 'name'> & { id: string | number };

export interface ProjectFilesTabProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: ProjectLike;
  /** Alternative data prop */
  data?: Project;
}

type ProjectFilesIdentity = Pick<
  EntityFilesManagerProps,
  'custody' | 'currentUserId' | 'entityType' | 'entityId' | 'entityLabel' | 'domain'
>;

/** Έργο + συνεδρία + ταυτότητα αρχείων — `identity` είναι `null` όσο κάτι λείπει. */
export function useProjectFilesTab(
  { project, data }: ProjectFilesTabProps,
  options?: EntityFilesTabSessionOptions,
) {
  const resolvedProject: ProjectLike | undefined = project || data;
  const { companyId, currentUserId, companyName } = useEntityFilesTabSession(options);

  const identity: ProjectFilesIdentity | null =
    resolvedProject?.id && companyId && currentUserId
      ? {
          custody: { companyId },
          currentUserId,
          entityType: ENTITY_TYPES.PROJECT,
          entityId: String(resolvedProject.id),
          entityLabel: resolvedProject.name || `Έργο ${resolvedProject.id}`,
          domain: 'construction',
        }
      : null;

  return { identity, companyName, projectId: resolvedProject?.id };
}

/** Placeholder των καρτελών έργου — ίδια απόσταση (`spacing.padding.lg`) σε όλες. */
export function ProjectFilesTabPlaceholder({ message }: { message: string }) {
  const spacing = useSpacingTokens();
  return <EntityFilesTabPlaceholder message={message} paddingClassName={spacing.padding.lg} />;
}

// =============================================================================
// MEDIA (Photos · Videos)
// =============================================================================

const PROJECT_MEDIA = {
  photos: { purpose: 'photo', acceptedTypes: DEFAULT_PHOTO_ACCEPT, emptyKey: 'projects:photos.selectProject' },
  videos: { purpose: 'video', acceptedTypes: DEFAULT_VIDEO_ACCEPT, emptyKey: 'projects:videos.selectProject' },
} as const;

interface ProjectMediaTabProps extends ProjectFilesTabProps {
  kind: keyof typeof PROJECT_MEDIA;
}

export function ProjectMediaTab({ kind, ...props }: ProjectMediaTabProps) {
  const { t } = useTranslation(['projects']);
  const { identity } = useProjectFilesTab(props);
  const media = PROJECT_MEDIA[kind];

  if (!identity) {
    return <ProjectFilesTabPlaceholder message={t(media.emptyKey)} />;
  }

  return (
    <EntityFilesManager
      {...identity}
      category={kind}
      purpose={media.purpose}
      entryPointCategoryFilter={kind}
      displayStyle="media-gallery"
      acceptedTypes={media.acceptedTypes}
    />
  );
}
