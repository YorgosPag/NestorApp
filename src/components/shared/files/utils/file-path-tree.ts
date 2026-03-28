/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Path Tree Builder
 * =============================================================================
 *
 * Builds a hierarchical tree structure from FileRecord storage paths.
 * Used for "Windows Explorer style" file tree visualization.
 *
 * @module components/shared/files/utils/file-path-tree
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Tree Structure:
 * - Folder nodes: Represent path segments (companies, entities, domains, etc.)
 * - File nodes: Represent actual files (leaf nodes)
 * - Each node has a type, label, and optional children
 *
 * @example
 * ```typescript
 * const tree = buildFilePathTree(fileRecords);
 * // tree = {
 * //   type: 'root',
 * //   label: 'Root',
 * //   children: [
 * //     {
 * //       type: 'folder',
 * //       segment: 'companies',
 * //       label: 'Companies',
 * //       children: [...]
 * //     }
 * //   ]
 * // }
 * ```
 */

import type { FileRecord } from '@/types/file-record';
import { parseStoragePath } from '@/services/upload/utils/storage-path';
import { STORAGE_PATH_SEGMENTS } from '@/config/domain-constants';
import { getGroupForPurpose, STUDY_GROUPS } from '@/config/study-groups-config';
import type { StudyGroup } from '@/config/study-groups-config';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Base tree node interface
 */
interface BaseTreeNode {
  /** Unique identifier for this node */
  id: string;
  /** Display label for this node */
  label: string;
  /** Path from root to this node */
  path: string[];
}

/**
 * Folder node (non-leaf)
 */
export interface FolderNode extends BaseTreeNode {
  type: 'folder';
  /** Path segment type (companies, entities, domains, etc.) */
  segment: string;
  /** Segment value (company ID, entity type, etc.) */
  value?: string;
  /** Child nodes */
  children: TreeNode[];
  /** Whether this folder is expanded in UI */
  isExpanded?: boolean;
}

/**
 * File node (leaf)
 */
export interface FileNode extends BaseTreeNode {
  type: 'file';
  /** FileRecord reference */
  fileRecord: FileRecord;
}

/**
 * Root node
 */
export interface RootNode extends BaseTreeNode {
  type: 'root';
  /** Child nodes */
  children: TreeNode[];
}

/**
 * Union type for all tree nodes
 */
export type TreeNode = FolderNode | FileNode | RootNode;

// ============================================================================
// TREE BUILDER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Builds a hierarchical tree structure from FileRecords
 *
 * Parses each FileRecord.storagePath and constructs a trie-like tree.
 * Groups files under common folder paths.
 *
 * Path Structure:
 * /companies/{companyId}/entities/{entityType}/{entityId}/
 *   domains/{domain}/categories/{category}/files/{fileId}.{ext}
 *
 * @param fileRecords - Array of FileRecords to build tree from
 * @returns Root node of the tree
 */
export function buildFilePathTree(fileRecords: FileRecord[]): RootNode {
  const root: RootNode = {
    id: 'root',
    type: 'root',
    label: 'Root',
    path: [],
    children: [],
  };

  // Build tree for each file
  for (const fileRecord of fileRecords) {
    if (!fileRecord.storagePath) continue;

    // Parse storage path
    const parsed = parseStoragePath(fileRecord.storagePath);
    if (!parsed) continue;

    // Build path segments array
    // 🏢 ENTERPRISE: value can be undefined for segment-only folders (like "files")
    const segments: Array<{ segment: string; value: string | undefined }> = [];

    // companies/{companyId}
    segments.push({
      segment: STORAGE_PATH_SEGMENTS.COMPANIES,
      value: parsed.companyId,
    });

    // projects/{projectId} (optional)
    if (parsed.projectId) {
      segments.push({
        segment: STORAGE_PATH_SEGMENTS.PROJECTS,
        value: parsed.projectId,
      });
    }

    // entities/{entityType}/{entityId}
    // 🏢 ENTERPRISE: entityType and entityId are combined into one level
    // entityId is technical detail - only entityType is shown in tree
    segments.push({
      segment: STORAGE_PATH_SEGMENTS.ENTITIES,
      value: parsed.entityType,
    });

    // domains/{domain}
    segments.push({
      segment: STORAGE_PATH_SEGMENTS.DOMAINS,
      value: parsed.domain,
    });

    // categories/{category}
    segments.push({
      segment: STORAGE_PATH_SEGMENTS.CATEGORIES,
      value: parsed.category,
    });

    // 🏢 ENTERPRISE: Skip "files" folder - it's technical redundancy
    // Files will be added directly under categories for cleaner UX
    // segments.push({
    //   segment: STORAGE_PATH_SEGMENTS.FILES,
    //   value: undefined,
    // });

    // Navigate/create folder structure
    let currentNode: FolderNode | RootNode = root;
    const currentPath: string[] = [];

    for (const { segment, value } of segments) {
      currentPath.push(segment);
      if (value) {
        currentPath.push(value);
      }

      // Find or create child folder
      // 🏢 ENTERPRISE: Normalize undefined/empty values for comparison
      const normalizedValue = value || undefined;
      let childFolder = currentNode.children.find(
        (child) =>
          child.type === 'folder' &&
          child.segment === segment &&
          (child.value || undefined) === normalizedValue
      ) as FolderNode | undefined;

      if (!childFolder) {
        // Create new folder node
        const folderId = currentPath.join('/');
        childFolder = {
          id: folderId,
          type: 'folder',
          segment,
          value: value || undefined,
          label: value || segment, // Will be replaced by i18n label in UI
          path: [...currentPath],
          children: [],
          isExpanded: true, // 🏢 ENTERPRISE: Start expanded για να φαίνεται το hierarchy
        };

        currentNode.children.push(childFolder);
      }

      currentNode = childFolder;
    }

    // Add file node as leaf
    const fileNode: FileNode = {
      id: fileRecord.id,
      type: 'file',
      label: fileRecord.displayName,
      path: [...currentPath, fileRecord.id],
      fileRecord,
    };

    currentNode.children.push(fileNode);
  }

  return root;
}

// ============================================================================
// TREE UTILITIES
// ============================================================================

/**
 * Finds a node in the tree by ID
 */
export function findNodeById(
  root: TreeNode,
  nodeId: string
): TreeNode | null {
  if (root.id === nodeId) {
    return root;
  }

  if (root.type === 'folder' || root.type === 'root') {
    for (const child of root.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Toggles the expanded state of a folder node
 */
export function toggleFolderExpansion(
  root: TreeNode,
  folderId: string
): TreeNode {
  if (root.id === folderId && root.type === 'folder') {
    return {
      ...root,
      isExpanded: !root.isExpanded,
    };
  }

  if (root.type === 'folder' || root.type === 'root') {
    return {
      ...root,
      children: root.children.map((child) =>
        toggleFolderExpansion(child, folderId)
      ),
    };
  }

  return root;
}

/**
 * Gets all file nodes from the tree (flattened)
 */
export function getAllFiles(root: TreeNode): FileNode[] {
  const files: FileNode[] = [];

  if (root.type === 'file') {
    files.push(root);
  }

  if (root.type === 'folder' || root.type === 'root') {
    for (const child of root.children) {
      files.push(...getAllFiles(child));
    }
  }

  return files;
}

/**
 * Counts total files in the tree
 */
export function countFiles(root: TreeNode): number {
  if (root.type === 'file') {
    return 1;
  }

  if (root.type === 'folder' || root.type === 'root') {
    return root.children.reduce((sum, child) => sum + countFiles(child), 0);
  }

  return 0;
}

// ============================================================================
// STUDY GROUP TREE BUILDER (ADR-191)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Builds a tree grouped by study categories (ADR-191)
 *
 * Instead of domain/category hierarchy from storagePath, groups files
 * by their study group (Διοικητικά/Νομικά, Αρχιτεκτονικά, Στατικά, etc.)
 * using the FileRecord.purpose field → StudyGroup mapping.
 *
 * Tree Structure:
 * Root
 * ├── Διοικητικά / Νομικά (study group folder)
 * │   ├── Αίτηση Οικοδομικής Άδειας.pdf
 * │   └── Τίτλος Ιδιοκτησίας.pdf
 * ├── Αρχιτεκτονικά / Πολεοδομικά
 * │   └── Διάγραμμα Κάλυψης.pdf
 * └── Γενικά Έγγραφα (ungrouped files)
 *     └── some_file.pdf
 */
export function buildStudyGroupTree(fileRecords: FileRecord[]): RootNode {
  const root: RootNode = {
    id: 'root',
    type: 'root',
    label: 'Root',
    path: [],
    children: [],
  };

  if (fileRecords.length === 0) return root;

  // Bucket files by study group
  const buckets = new Map<StudyGroup | '__general__', FileRecord[]>();

  for (const file of fileRecords) {
    const group = getGroupForPurpose(file.purpose);
    const key: StudyGroup | '__general__' = group ?? '__general__';

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(file);
    } else {
      buckets.set(key, [file]);
    }
  }

  // Build folders: study groups sorted by order first, then general
  const sortedGroups = STUDY_GROUPS
    .filter((g) => buckets.has(g.group))
    .sort((a, b) => a.order - b.order);

  for (const meta of sortedGroups) {
    const files = buckets.get(meta.group);
    if (!files || files.length === 0) continue;

    const folder: FolderNode = {
      id: `study-group-${meta.group}`,
      type: 'folder',
      segment: 'study-group',
      value: meta.group,
      label: meta.label.el, // Greek label from config (runtime translation in UI)
      path: [meta.group],
      children: files.map((f) => ({
        id: f.id,
        type: 'file' as const,
        label: f.displayName,
        path: [meta.group, f.id],
        fileRecord: f,
      })),
      isExpanded: true,
    };

    root.children.push(folder);
  }

  // Fallback group for files without a study group
  const generalFiles = buckets.get('__general__');
  if (generalFiles && generalFiles.length > 0) {
    const folder: FolderNode = {
      id: 'study-group-general',
      type: 'folder',
      segment: 'study-group',
      value: '__general__',
      label: 'General Documents',
      path: ['__general__'],
      children: generalFiles.map((f) => ({
        id: f.id,
        type: 'file' as const,
        label: f.displayName,
        path: ['__general__', f.id],
        fileRecord: f,
      })),
      isExpanded: true,
    };

    root.children.push(folder);
  }

  return root;
}
