/**
 * =============================================================================
 * 🏢 ENTERPRISE: useMediaGallery Hook
 * =============================================================================
 *
 * State management hook για MediaGallery component.
 * Handles selection, filtering, sorting, and view mode.
 *
 * @module components/shared/files/media/hooks/useMediaGallery
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Features:
 * - Multi-select για bulk operations
 * - View mode toggle (grid/list)
 * - Sort by date/name/size
 * - Filter by type (photo/video)
 * - Lazy loading support
 */

import { useState, useMemo, useCallback } from 'react';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

/** View mode for gallery display */
export type MediaViewMode = 'grid' | 'list';

/** Sort field options */
export type MediaSortField = 'date' | 'name' | 'size';

/** Sort direction */
export type MediaSortDirection = 'asc' | 'desc';

/** Filter by media type */
export type MediaTypeFilter = 'all' | 'photos' | 'videos';

/** Media gallery state */
export interface MediaGalleryState {
  /** Current view mode */
  viewMode: MediaViewMode;
  /** Selected file IDs */
  selectedIds: Set<string>;
  /** Sort configuration */
  sortField: MediaSortField;
  sortDirection: MediaSortDirection;
  /** Type filter */
  typeFilter: MediaTypeFilter;
  /** Currently previewing file index (for lightbox) */
  previewIndex: number | null;
}

/** Hook return type */
export interface UseMediaGalleryReturn {
  // State
  state: MediaGalleryState;

  // Computed
  filteredFiles: FileRecord[];
  sortedFiles: FileRecord[];
  selectedFiles: FileRecord[];
  hasSelection: boolean;
  selectionCount: number;

  // Actions
  setViewMode: (mode: MediaViewMode) => void;
  toggleSelect: (fileId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isSelected: (fileId: string) => boolean;
  setSortField: (field: MediaSortField) => void;
  toggleSortDirection: () => void;
  setTypeFilter: (filter: MediaTypeFilter) => void;
  openPreview: (index: number) => void;
  closePreview: () => void;
  navigatePreview: (direction: 'prev' | 'next') => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if a file is an image based on contentType
 */
function isImageFile(file: FileRecord): boolean {
  return file.contentType?.startsWith('image/') ?? false;
}

/**
 * Check if a file is a video based on contentType
 */
function isVideoFile(file: FileRecord): boolean {
  return file.contentType?.startsWith('video/') ?? false;
}

/**
 * Sort files by specified field and direction
 */
function sortFiles(
  files: FileRecord[],
  field: MediaSortField,
  direction: MediaSortDirection
): FileRecord[] {
  const sorted = [...files].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'date': {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
        break;
      }
      case 'name': {
        comparison = a.displayName.localeCompare(b.displayName, 'el');
        break;
      }
      case 'size': {
        comparison = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
        break;
      }
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Media Gallery State Management Hook
 *
 * Provides complete state management for media gallery including:
 * - Multi-select support
 * - View mode toggle
 * - Sorting and filtering
 * - Lightbox preview navigation
 *
 * @param files - Array of FileRecord to manage
 * @param initialViewMode - Initial view mode (default: 'grid')
 */
export function useMediaGallery(
  files: FileRecord[],
  initialViewMode: MediaViewMode = 'grid'
): UseMediaGalleryReturn {
  // =========================================================================
  // STATE
  // =========================================================================

  const [viewMode, setViewMode] = useState<MediaViewMode>(initialViewMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<MediaSortField>('date');
  const [sortDirection, setSortDirection] = useState<MediaSortDirection>('desc');
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('all');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  /**
   * Filter files by media type
   */
  const filteredFiles = useMemo(() => {
    if (typeFilter === 'all') {
      return files.filter(f => isImageFile(f) || isVideoFile(f));
    }
    if (typeFilter === 'photos') {
      return files.filter(isImageFile);
    }
    if (typeFilter === 'videos') {
      return files.filter(isVideoFile);
    }
    return files;
  }, [files, typeFilter]);

  /**
   * Sort filtered files
   */
  const sortedFiles = useMemo(() => {
    return sortFiles(filteredFiles, sortField, sortDirection);
  }, [filteredFiles, sortField, sortDirection]);

  /**
   * Get selected files
   */
  const selectedFiles = useMemo(() => {
    return sortedFiles.filter(f => selectedIds.has(f.id));
  }, [sortedFiles, selectedIds]);

  const hasSelection = selectedIds.size > 0;
  const selectionCount = selectedIds.size;

  // =========================================================================
  // ACTIONS
  // =========================================================================

  /**
   * Toggle selection of a single file
   */
  const toggleSelect = useCallback((fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  /**
   * Select all visible files
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sortedFiles.map(f => f.id)));
  }, [sortedFiles]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if a file is selected
   */
  const isSelected = useCallback((fileId: string) => {
    return selectedIds.has(fileId);
  }, [selectedIds]);

  /**
   * Toggle sort direction
   */
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  /**
   * Open preview at specific index
   */
  const openPreview = useCallback((index: number) => {
    if (index >= 0 && index < sortedFiles.length) {
      setPreviewIndex(index);
    }
  }, [sortedFiles.length]);

  /**
   * Close preview
   */
  const closePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  /**
   * Navigate preview (prev/next)
   */
  const navigatePreview = useCallback((direction: 'prev' | 'next') => {
    setPreviewIndex(current => {
      if (current === null) return null;

      if (direction === 'prev') {
        return current > 0 ? current - 1 : sortedFiles.length - 1;
      } else {
        return current < sortedFiles.length - 1 ? current + 1 : 0;
      }
    });
  }, [sortedFiles.length]);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    state: {
      viewMode,
      selectedIds,
      sortField,
      sortDirection,
      typeFilter,
      previewIndex,
    },
    filteredFiles,
    sortedFiles,
    selectedFiles,
    hasSelection,
    selectionCount,
    setViewMode,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    setSortField,
    toggleSortDirection,
    setTypeFilter,
    openPreview,
    closePreview,
    navigatePreview,
  };
}
