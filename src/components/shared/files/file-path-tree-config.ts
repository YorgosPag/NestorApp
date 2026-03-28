/**
 * =============================================================================
 * File Path Tree — Configuration, Types & Utilities
 * =============================================================================
 *
 * Constants, types, and utility functions for FilePathTree.
 *
 * @module components/shared/files/file-path-tree-config
 * @enterprise ADR-031 - Canonical File Storage System
 */

import type { TreeNode } from './utils/file-path-tree';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Centralized indentation classes for tree levels.
 * Uses ONLY valid Tailwind classes (NOT arbitrary values).
 */
export const TREE_FOLDER_INDENTATION = [
  'pl-0',    // depth 0
  'pl-4',    // depth 1
  'pl-8',    // depth 2
  'pl-12',   // depth 3
  'pl-16',   // depth 4
  'pl-20',   // depth 5
  'pl-24',   // depth 6
] as const;

/**
 * File indentation (extra indent for visual hierarchy).
 */
export const TREE_FILE_INDENTATION = [
  'pl-6',    // depth 0 + extra
  'pl-10',   // depth 1 + extra
  'pl-14',   // depth 2 + extra
  'pl-16',   // depth 3 + extra
  'pl-20',   // depth 4 + extra
  'pl-24',   // depth 5 + extra
  'pl-28',   // depth 6 + extra
] as const;

/** Get indentation class for folder node */
export function getFolderIndentClass(depth: number): string {
  return TREE_FOLDER_INDENTATION[Math.min(depth, TREE_FOLDER_INDENTATION.length - 1)];
}

/** Get indentation class for file node (extra indent) */
export function getFileIndentClass(depth: number): string {
  return TREE_FILE_INDENTATION[Math.min(depth, TREE_FILE_INDENTATION.length - 1)];
}

// ============================================================================
// TYPES
// ============================================================================

export interface FilePathTreeProps {
  files: FileRecord[];
  onFileSelect?: (file: FileRecord) => void;
  className?: string;
  /**
   * Contextual root level for Business View
   * - 'full': Show full technical hierarchy
   * - 'domains': Start from domains level
   * - 'categories': Start from categories level
   * @default 'full'
   */
  contextLevel?: 'full' | 'domains' | 'categories';
  /** Company name for user-friendly display */
  companyName?: string;
  /**
   * View mode
   * - 'business': Default - user-friendly grouping
   * - 'technical': Admin/Debug - full tree with IDs
   * @default 'business'
   */
  viewMode?: 'business' | 'technical';
  /**
   * Group files by study category (ADR-191)
   * @default false
   */
  groupByStudyGroup?: boolean;
}

// ============================================================================
// FILTER UTILITIES
// ============================================================================

/**
 * Filter tree to contextual root level.
 * Extracts a subtree starting from the specified segment level.
 */
export function filterTreeToContextLevel(
  root: TreeNode,
  contextLevel: 'full' | 'domains' | 'categories'
): TreeNode {
  if (contextLevel === 'full') {
    return root;
  }

  const targetSegment = contextLevel === 'domains' ? 'domains' : 'categories';

  function findFirstNodeWithSegment(node: TreeNode): TreeNode | null {
    if (node.type === 'folder' && node.segment === targetSegment) {
      return node;
    }

    if (node.type === 'folder' || node.type === 'root') {
      for (const child of node.children) {
        const found = findFirstNodeWithSegment(child);
        if (found) return found;
      }
    }

    return null;
  }

  const contextRoot = findFirstNodeWithSegment(root);

  if (contextRoot) {
    return {
      id: 'contextual-root',
      type: 'root',
      label: 'Root',
      path: [],
      children: [contextRoot],
    } as TreeNode;
  }

  return root;
}
