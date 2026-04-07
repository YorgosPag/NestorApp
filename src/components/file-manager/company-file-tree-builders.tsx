/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: CompanyFileTree - Builders & Types
 * =============================================================================
 *
 * Tree building functions, types, and icon helpers for the file tree.
 *
 * @module components/file-manager/company-file-tree-builders
 * @enterprise ADR-031 - Canonical File Storage System
 */

import '@/lib/design-system';
import React from 'react';
import {
  File,
  FileText,
  FileSignature,
  Camera,
  Film,
  Map as MapIcon,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { FileRecord } from '@/types/file-record';
import type { FileCategory } from '@/config/domain-constants';
import { getFileIconInfo } from '@/components/shared/files/utils/file-icons';
import {
  getGroupForPurpose,
  STUDY_GROUPS,
  type StudyGroupMeta,
} from '@/config/study-groups-config';

// ============================================================================
// TYPES
// ============================================================================

export type FileEntityType = 'project' | 'building' | 'property' | 'contact' | 'company';
export type GroupingMode = 'entity' | 'category';
export type ViewMode = 'business' | 'technical';

export interface CompanyFileTreeProps {
  files: FileRecord[];
  companyName?: string;
  groupingMode?: GroupingMode;
  viewMode?: ViewMode;
  onFileClick?: (file: FileRecord) => void;
  onFileDoubleClick?: (file: FileRecord) => void;
  onRename?: (fileId: string, newDisplayName: string) => void;
  className?: string;
}

export interface TreeNodeData {
  id: string;
  label: string;
  type: 'root' | 'folder' | 'file';
  icon: React.ReactNode;
  children?: TreeNodeData[];
  file?: FileRecord;
  path: string[];
  metadata?: Record<string, unknown>;
}

/** Translator function type from useFileDisplayName */
export type DisplayNameTranslator = (file: FileRecord) => string;

// ============================================================================
// ICON HELPERS
// ============================================================================

export const ENTITY_ICONS: Record<FileEntityType, React.ReactNode> = {
  project: React.createElement(NAVIGATION_ENTITIES.project.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.project.color}` }),
  building: React.createElement(NAVIGATION_ENTITIES.building.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.building.color}` }),
  property: React.createElement(NAVIGATION_ENTITIES.property.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.property.color}` }),
  contact: React.createElement(NAVIGATION_ENTITIES.contact.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.contact.color}` }),
  company: React.createElement(NAVIGATION_ENTITIES.company.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.company.color}` }),
};

const CATEGORY_ICONS: Partial<Record<FileCategory | 'other', React.ReactNode>> = {
  photos: <Camera className="h-4 w-4 text-pink-500" />,
  videos: <Film className="h-4 w-4 text-red-500" />,
  documents: <FileText className="h-4 w-4 text-blue-500" />,
  contracts: <FileSignature className="h-4 w-4 text-amber-500" />,
  floorplans: <MapIcon className="h-4 w-4 text-teal-500" />,
  other: <File className="h-4 w-4 text-gray-500" />,
};

export function getCategoryIcon(category: string): React.ReactNode {
  return CATEGORY_ICONS[category as FileCategory] || CATEGORY_ICONS.other || <File className="h-4 w-4 text-gray-500" />;
}

export function getFileIcon(file: FileRecord): React.ReactNode {
  const { icon: Icon, colorClass } = getFileIconInfo(file.ext, file.contentType);
  return <Icon className={`h-4 w-4 ${colorClass}`} />;
}

// ============================================================================
// ENTITY LABELS
// ============================================================================

export const ENTITY_LABELS: Record<FileEntityType, string> = {
  project: 'entities.projects',
  building: 'entities.buildings',
  property: 'entities.properties',
  contact: 'entities.contacts',
  company: 'entities.company',
};

export const ENTITY_SINGULAR_LABELS: Record<FileEntityType, string> = {
  project: 'entities.projectSingular',
  building: 'entities.buildingSingular',
  property: 'entities.propertySingular',
  contact: 'entities.contactSingular',
  company: 'entities.companySingular',
};

export const CATEGORY_LABELS: Partial<Record<FileCategory | 'other', string>> = {
  photos: 'files.categories.photos',
  videos: 'files.categories.videos',
  documents: 'files.categories.documents',
  contracts: 'files.categories.contracts',
  floorplans: 'files.categories.floorplans',
  other: 'files.categories.other',
};

// ============================================================================
// TREE BUILDING FUNCTIONS
// ============================================================================

const SUPPORTED_ENTITY_TYPES: FileEntityType[] = ['project', 'building', 'property', 'contact', 'company'];

function createEmptyEntityBuckets(): Record<FileEntityType, Record<string, FileRecord[]>> {
  return { project: {}, building: {}, property: {}, contact: {}, company: {} };
}

/** Translation function type (from useTranslation) */
export type TranslationFn = (key: string) => string;

export function buildTreeByEntity(
  files: FileRecord[],
  companyName: string,
  translateDisplayName?: DisplayNameTranslator,
  lang: string = 'el',
  t?: TranslationFn,
): TreeNodeData {
  const groupedByType = createEmptyEntityBuckets();

  for (const file of files) {
    const entityType = file.entityType as string;
    const entityId = file.entityId;

    if (!SUPPORTED_ENTITY_TYPES.includes(entityType as FileEntityType)) continue;

    const typedEntityType = entityType as FileEntityType;
    if (!groupedByType[typedEntityType][entityId]) {
      groupedByType[typedEntityType][entityId] = [];
    }
    groupedByType[typedEntityType][entityId].push(file);
  }

  const entityChildren: TreeNodeData[] = [];

  for (const entityType of SUPPORTED_ENTITY_TYPES) {
    const entitiesMap = groupedByType[entityType];
    const entityIds = Object.keys(entitiesMap);
    if (entityIds.length === 0) continue;

    const entityFolders: TreeNodeData[] = entityIds.map(entityId => {
      const entityFiles = entitiesMap[entityId];
      const firstFile = entityFiles[0];
      const storedLabel = (firstFile as { entityLabel?: string })?.entityLabel;
      const shortId = entityId.includes('_') ? entityId.substring(entityId.indexOf('_') + 1, entityId.indexOf('_') + 9) : entityId.substring(0, 8);
      const singularLabel = t ? t(ENTITY_SINGULAR_LABELS[entityType]) : entityType;
      const entityLabel = storedLabel || `${singularLabel} #${shortId}`;

      // Group by study group within entity (ADR-191)
      const studyGroupBuckets = new Map<string, { meta: StudyGroupMeta | null; files: FileRecord[] }>();

      for (const file of entityFiles) {
        const group = getGroupForPurpose(file.purpose);
        const key = group ?? '__general__';

        if (!studyGroupBuckets.has(key)) {
          const meta = group ? STUDY_GROUPS.find((sg) => sg.group === group) ?? null : null;
          studyGroupBuckets.set(key, { meta, files: [] });
        }
        studyGroupBuckets.get(key)!.files.push(file);
      }

      const sortedBuckets = [...studyGroupBuckets.entries()].sort((a, b) => {
        return (a[1].meta?.order ?? 999) - (b[1].meta?.order ?? 999);
      });

      const categoryFolders: TreeNodeData[] = sortedBuckets.map(([key, bucket]) => {
        const folderLabel = bucket.meta
          ? (lang === 'en' ? bucket.meta.label.en : bucket.meta.label.el)
          : (lang === 'en' ? 'General Documents' : 'Γενικά Έγγραφα');

        return {
          id: `${entityType}-${entityId}-${key}`,
          label: folderLabel,
          type: 'folder' as const,
          icon: bucket.meta ? getCategoryIcon(bucket.meta.group) : (CATEGORY_ICONS.other || <File className="h-4 w-4 text-gray-500" />),
          path: [companyName, entityType, entityId, key],
          children: bucket.files.map(file => ({
            id: file.id,
            label: translateDisplayName ? translateDisplayName(file) : (file.displayName || file.originalFilename),
            type: 'file' as const,
            icon: getFileIcon(file),
            path: [companyName, entityType, entityId, key, file.displayName],
            file,
          })),
        };
      });

      return {
        id: `${entityType}-${entityId}`,
        label: entityLabel,
        type: 'folder' as const,
        icon: ENTITY_ICONS[entityType],
        path: [companyName, entityType, entityId],
        children: categoryFolders,
      };
    });

    entityChildren.push({
      id: `entity-${entityType}`,
      label: t ? t(ENTITY_LABELS[entityType]) : entityType,
      type: 'folder' as const,
      icon: ENTITY_ICONS[entityType],
      path: [companyName, entityType],
      children: entityFolders,
      metadata: { count: entityIds.length },
    });
  }

  return {
    id: 'root',
    label: companyName,
    type: 'root' as const,
    icon: React.createElement(NAVIGATION_ENTITIES.company.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.company.color}` }),
    path: [companyName],
    children: entityChildren,
  };
}

export function buildTreeByCategory(
  files: FileRecord[],
  companyName: string,
  translateDisplayName?: DisplayNameTranslator,
  lang: string = 'el',
  t?: TranslationFn,
): TreeNodeData {
  const groupedByStudyGroup = new Map<
    string,
    { meta: StudyGroupMeta | null; entities: Record<FileEntityType, FileRecord[]> }
  >();

  for (const file of files) {
    const group = getGroupForPurpose(file.purpose);
    const key = group ?? '__general__';
    const entityType = file.entityType as string;

    if (!SUPPORTED_ENTITY_TYPES.includes(entityType as FileEntityType)) continue;

    if (!groupedByStudyGroup.has(key)) {
      const meta = group ? STUDY_GROUPS.find((sg) => sg.group === group) ?? null : null;
      groupedByStudyGroup.set(key, {
        meta,
        entities: { project: [], building: [], property: [], contact: [], company: [] },
      });
    }
    groupedByStudyGroup.get(key)!.entities[entityType as FileEntityType].push(file);
  }

  const sortedGroups = [...groupedByStudyGroup.entries()].sort((a, b) => {
    return (a[1].meta?.order ?? 999) - (b[1].meta?.order ?? 999);
  });

  const categoryChildren: TreeNodeData[] = [];

  for (const [key, { meta, entities }] of sortedGroups) {
    const entityFolders: TreeNodeData[] = [];

    for (const entityType of SUPPORTED_ENTITY_TYPES) {
      const entityFiles = entities[entityType];
      if (entityFiles.length === 0) continue;

      entityFolders.push({
        id: `${key}-${entityType}`,
        label: t ? t(ENTITY_LABELS[entityType]) : entityType,
        type: 'folder' as const,
        icon: ENTITY_ICONS[entityType],
        path: [companyName, key, entityType],
        children: entityFiles.map(file => ({
          id: file.id,
          label: translateDisplayName ? translateDisplayName(file) : (file.displayName || file.originalFilename),
          type: 'file' as const,
          icon: getFileIcon(file),
          path: [companyName, key, entityType, file.displayName],
          file,
        })),
      });
    }

    if (entityFolders.length > 0) {
      const folderLabel = meta
        ? (lang === 'en' ? meta.label.en : meta.label.el)
        : (lang === 'en' ? 'General Documents' : 'Γενικά Έγγραφα');

      categoryChildren.push({
        id: `category-${key}`,
        label: folderLabel,
        type: 'folder' as const,
        icon: meta ? getCategoryIcon(meta.group) : (CATEGORY_ICONS.other || <File className="h-4 w-4 text-gray-500" />),
        path: [companyName, key],
        children: entityFolders,
      });
    }
  }

  return {
    id: 'root',
    label: companyName,
    type: 'root' as const,
    icon: React.createElement(NAVIGATION_ENTITIES.company.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.company.color}` }),
    path: [companyName],
    children: categoryChildren,
  };
}
