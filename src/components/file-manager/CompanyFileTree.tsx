/**
 * =============================================================================
 * 🏢 ENTERPRISE: CompanyFileTree Component
 * =============================================================================
 *
 * Tree view component για εμφάνιση ΟΛΩΝ των αρχείων εταιρείας
 * με δυνατότητα ομαδοποίησης by Entity ή by Category.
 *
 * @module components/file-manager/CompanyFileTree
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Enterprise Patterns: Google Drive, Dropbox Business, Procore Documents
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Image,
  Video,
  FileText,
  FileSignature,
  Building,
  Briefcase,
  Users,
  Home,
  Camera,
  Film,
  Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';
import type { FileCategory } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported entity types for file tree grouping
 * Subset of EntityType that makes sense for file management
 */
type FileEntityType = 'project' | 'building' | 'unit' | 'contact';

export type GroupingMode = 'entity' | 'category';
export type ViewMode = 'business' | 'technical';

interface CompanyFileTreeProps {
  /** All files to display */
  files: FileRecord[];
  /** Company name for display */
  companyName?: string;
  /** Grouping mode */
  groupingMode?: GroupingMode;
  /** View mode */
  viewMode?: ViewMode;
  /** On file click */
  onFileClick?: (file: FileRecord) => void;
  /** On file double click */
  onFileDoubleClick?: (file: FileRecord) => void;
  /** Additional class names */
  className?: string;
}

interface TreeNodeData {
  id: string;
  label: string;
  type: 'root' | 'folder' | 'file';
  icon: React.ReactNode;
  children?: TreeNodeData[];
  file?: FileRecord;
  path: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ICON HELPERS
// ============================================================================

const ENTITY_ICONS: Record<FileEntityType, React.ReactNode> = {
  project: <Briefcase className="h-4 w-4 text-blue-500" />,
  building: <Building className="h-4 w-4 text-orange-500" />,
  unit: <Home className="h-4 w-4 text-green-500" />,
  contact: <Users className="h-4 w-4 text-purple-500" />,
};

/**
 * Icons for file categories
 * Only includes categories commonly used in file management
 */
const CATEGORY_ICONS: Partial<Record<FileCategory | 'other', React.ReactNode>> = {
  photos: <Camera className="h-4 w-4 text-pink-500" />,
  videos: <Film className="h-4 w-4 text-red-500" />,
  documents: <FileText className="h-4 w-4 text-blue-500" />,
  contracts: <FileSignature className="h-4 w-4 text-amber-500" />,
  floorplans: <Map className="h-4 w-4 text-teal-500" />,
  other: <File className="h-4 w-4 text-gray-500" />,
};

/**
 * Get icon for category with fallback
 */
function getCategoryIcon(category: string): React.ReactNode {
  return CATEGORY_ICONS[category as FileCategory] || CATEGORY_ICONS.other || <File className="h-4 w-4 text-gray-500" />;
}

function getFileIcon(file: FileRecord): React.ReactNode {
  const contentType = file.contentType || '';

  if (contentType.startsWith('image/')) {
    return <Image className="h-4 w-4 text-pink-500" />;
  }
  if (contentType.startsWith('video/')) {
    return <Video className="h-4 w-4 text-red-500" />;
  }
  if (contentType === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-600" />;
  }

  return <File className="h-4 w-4 text-gray-500" />;
}

// ============================================================================
// ENTITY LABELS
// ============================================================================

const ENTITY_LABELS: Record<FileEntityType, string> = {
  project: 'files.entities.projects',
  building: 'files.entities.buildings',
  unit: 'files.entities.units',
  contact: 'files.entities.contacts',
};

const CATEGORY_LABELS: Partial<Record<FileCategory | 'other', string>> = {
  photos: 'files.categories.photos',
  videos: 'files.categories.videos',
  documents: 'files.categories.documents',
  contracts: 'files.categories.contracts',
  floorplans: 'files.categories.floorplans',
  other: 'files.categories.other',
};

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
  onFileClick?: (file: FileRecord) => void;
  onFileDoubleClick?: (file: FileRecord) => void;
  viewMode: ViewMode;
}

function TreeNode({
  node,
  depth,
  expandedNodes,
  toggleNode,
  onFileClick,
  onFileDoubleClick,
  viewMode,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = depth * 16 + 8;

  const handleClick = useCallback(() => {
    if (node.type === 'file' && node.file && onFileClick) {
      onFileClick(node.file);
    } else if (hasChildren) {
      toggleNode(node.id);
    }
  }, [node, hasChildren, toggleNode, onFileClick]);

  const handleDoubleClick = useCallback(() => {
    if (node.type === 'file' && node.file && onFileDoubleClick) {
      onFileDoubleClick(node.file);
    }
  }, [node, onFileDoubleClick]);

  return (
    <li role="treeitem" aria-expanded={node.type !== 'file' ? isExpanded : undefined}>
      <button
        type="button"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm',
          'hover:bg-muted/50 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          node.type === 'file' && 'cursor-pointer',
          node.type !== 'file' && 'cursor-pointer'
        )}
        style={{ paddingLeft }}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          <span className="flex-shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Node Icon */}
        <span className="flex-shrink-0">
          {node.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500" />
            )
          ) : (
            node.icon
          )}
        </span>

        {/* Node Label */}
        <span className="truncate flex-1 text-left">
          {node.label}
        </span>

        {/* Technical Mode: Show path */}
        {viewMode === 'technical' && node.type === 'file' && node.file && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {node.file.storagePath}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-md">
              <p className="font-mono text-xs break-all">{node.file.storagePath}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* File Count for folders */}
        {node.type === 'folder' && hasChildren && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {node.children?.length}
          </span>
        )}
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <ul role="group" className="ml-0">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              onFileClick={onFileClick}
              onFileDoubleClick={onFileDoubleClick}
              viewMode={viewMode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ============================================================================
// TREE BUILDING FUNCTIONS
// ============================================================================

function buildTreeByEntity(files: FileRecord[], companyName: string): TreeNodeData {
  // Group files by entity type -> entity ID
  const groupedByType: Record<FileEntityType, Record<string, FileRecord[]>> = {
    project: {},
    building: {},
    unit: {},
    contact: {},
  };

  const supportedEntityTypes: FileEntityType[] = ['project', 'building', 'unit', 'contact'];

  for (const file of files) {
    const entityType = file.entityType as string;
    const entityId = file.entityId;

    // Skip unsupported entity types
    if (!supportedEntityTypes.includes(entityType as FileEntityType)) {
      continue;
    }

    const typedEntityType = entityType as FileEntityType;
    if (!groupedByType[typedEntityType]) {
      groupedByType[typedEntityType] = {};
    }
    if (!groupedByType[typedEntityType][entityId]) {
      groupedByType[typedEntityType][entityId] = [];
    }
    groupedByType[typedEntityType][entityId].push(file);
  }

  // Build tree
  const entityTypes: FileEntityType[] = ['project', 'building', 'unit', 'contact'];
  const entityChildren: TreeNodeData[] = [];

  for (const entityType of entityTypes) {
    const entitiesMap = groupedByType[entityType];
    const entityIds = Object.keys(entitiesMap);

    if (entityIds.length === 0) continue;

    const entityFolders: TreeNodeData[] = entityIds.map(entityId => {
      const entityFiles = entitiesMap[entityId];

      // Get entity label from first file's entityLabel or use ID
      // Note: entityLabel is an optional property that may not exist on all files
      const firstFile = entityFiles[0];
      const entityLabel = (firstFile as { entityLabel?: string })?.entityLabel || entityId;

      // Group by category within entity
      const categoryGroups: Record<string, FileRecord[]> = {};
      for (const file of entityFiles) {
        const category = file.category || 'other';
        if (!categoryGroups[category]) {
          categoryGroups[category] = [];
        }
        categoryGroups[category].push(file);
      }

      const categoryFolders: TreeNodeData[] = Object.entries(categoryGroups).map(([category, catFiles]) => ({
        id: `${entityType}-${entityId}-${category}`,
        label: category,
        type: 'folder' as const,
        icon: CATEGORY_ICONS[category as FileCategory] || CATEGORY_ICONS.other,
        path: [companyName, entityType, entityId, category],
        children: catFiles.map(file => ({
          id: file.id,
          label: file.displayName || file.originalFilename,
          type: 'file' as const,
          icon: getFileIcon(file),
          path: [companyName, entityType, entityId, category, file.displayName],
          file,
        })),
      }));

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
      label: entityType,
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
    icon: <Building className="h-4 w-4 text-blue-600" />,
    path: [companyName],
    children: entityChildren,
  };
}

function buildTreeByCategory(files: FileRecord[], companyName: string): TreeNodeData {
  // Group files by category -> entity type
  const groupedByCategory: Record<string, Record<FileEntityType, FileRecord[]>> = {};

  const supportedEntityTypes: FileEntityType[] = ['project', 'building', 'unit', 'contact'];

  for (const file of files) {
    const category = file.category || 'other';
    const entityType = file.entityType as string;

    // Skip unsupported entity types
    if (!supportedEntityTypes.includes(entityType as FileEntityType)) {
      continue;
    }

    if (!groupedByCategory[category]) {
      groupedByCategory[category] = {
        project: [],
        building: [],
        unit: [],
        contact: [],
      };
    }
    groupedByCategory[category][entityType as FileEntityType].push(file);
  }

  // Build tree
  const categories = Object.keys(groupedByCategory);
  const categoryChildren: TreeNodeData[] = [];

  for (const category of categories) {
    const entityGroups = groupedByCategory[category];
    const entityTypes: FileEntityType[] = ['project', 'building', 'unit', 'contact'];

    const entityFolders: TreeNodeData[] = [];

    for (const entityType of entityTypes) {
      const entityFiles = entityGroups[entityType];
      if (entityFiles.length === 0) continue;

      entityFolders.push({
        id: `${category}-${entityType}`,
        label: entityType,
        type: 'folder' as const,
        icon: ENTITY_ICONS[entityType],
        path: [companyName, category, entityType],
        children: entityFiles.map(file => ({
          id: file.id,
          label: file.displayName || file.originalFilename,
          type: 'file' as const,
          icon: getFileIcon(file),
          path: [companyName, category, entityType, file.displayName],
          file,
        })),
      });
    }

    if (entityFolders.length > 0) {
      categoryChildren.push({
        id: `category-${category}`,
        label: category,
        type: 'folder' as const,
        icon: CATEGORY_ICONS[category as FileCategory] || CATEGORY_ICONS.other,
        path: [companyName, category],
        children: entityFolders,
      });
    }
  }

  return {
    id: 'root',
    label: companyName,
    type: 'root' as const,
    icon: <Building className="h-4 w-4 text-blue-600" />,
    path: [companyName],
    children: categoryChildren,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CompanyFileTree({
  files,
  companyName = 'Company',
  groupingMode = 'entity',
  viewMode = 'business',
  onFileClick,
  onFileDoubleClick,
  className,
}: CompanyFileTreeProps) {
  const { t } = useTranslation('files');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

  // Build tree based on grouping mode
  const treeData = useMemo(() => {
    if (groupingMode === 'entity') {
      return buildTreeByEntity(files, companyName);
    }
    return buildTreeByCategory(files, companyName);
  }, [files, companyName, groupingMode]);

  // Toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allNodeIds = new Set<string>();

    function collectIds(node: TreeNodeData) {
      allNodeIds.add(node.id);
      if (node.children) {
        node.children.forEach(collectIds);
      }
    }

    collectIds(treeData);
    setExpandedNodes(allNodeIds);
  }, [treeData]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(['root']));
  }, []);

  if (files.length === 0) {
    return (
      <section className={cn('p-8 text-center text-muted-foreground', className)}>
        <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('tree.empty', 'No files found')}</p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm text-muted-foreground">
          {t('tree.fileCount', '{{count}} files', { count: files.length })}
        </span>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-7 px-2"
          >
            {t('tree.expandAll', 'Expand All')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-7 px-2"
          >
            {t('tree.collapseAll', 'Collapse All')}
          </Button>
        </nav>
      </header>

      {/* Tree */}
      <nav
        className="flex-1 overflow-auto p-2"
        role="tree"
        aria-label={t('tree.ariaLabel', 'File tree')}
      >
        <ul role="group" className="space-y-0.5">
          <TreeNode
            node={treeData}
            depth={0}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            onFileClick={onFileClick}
            onFileDoubleClick={onFileDoubleClick}
            viewMode={viewMode}
          />
        </ul>
      </nav>
    </section>
  );
}
