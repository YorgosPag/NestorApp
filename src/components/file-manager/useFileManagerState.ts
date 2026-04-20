/**
 * =============================================================================
 * 🏢 ENTERPRISE: useFileManagerState
 * =============================================================================
 *
 * Custom hook encapsulating all state and computed values for FileManagerPageContent.
 * Follows Google SRP: one hook = one responsibility (state management).
 *
 * @module components/file-manager/useFileManagerState
 * @enterprise ADR-031 - Canonical File Storage System
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { normalizeForSearch } from '@/utils/greek-text';
import { Files, Trash2, FolderTree, HardDrive, Layers } from 'lucide-react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { defaultFileFilters, type FileFilterState } from '@/components/core/AdvancedFilters';
import { useAllCompanyFiles } from './hooks/useAllCompanyFiles';
import { formatFileSize } from '@/utils/file-validation';
import { useFileClassification } from '@/components/shared/files/hooks/useFileClassification';
import { useNotifications } from '@/providers/NotificationProvider';
import type { FileRecord } from '@/types/file-record';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { ViewMode as TreeViewMode } from './CompanyFileTree';

// ============================================================================
// TYPES
// ============================================================================

export type ViewMode = 'list' | 'tree' | 'gallery';
export type ActiveTab = 'files' | 'trash' | 'inbox';

// ============================================================================
// FILTER LOGIC
// ============================================================================

function applyFilters(files: FileRecord[], searchTerm: string, filters: FileFilterState): FileRecord[] {
  let result = files;

  // Search term filter — accent & case insensitive (Greek support)
  if (searchTerm.trim()) {
    const raw = searchTerm.trim();
    // Glob extension pattern: *.ext — match files ending with .ext
    const extMatch = raw.match(/^\*\.(\w+)$/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      result = result.filter(file =>
        (file.originalFilename ?? '').toLowerCase().endsWith(`.${ext}`) ||
        (file.displayName ?? '').toLowerCase().endsWith(`.${ext}`)
      );
    } else {
      const query = normalizeForSearch(raw);
      const norm = (s?: string | null) => s ? normalizeForSearch(s) : '';
      result = result.filter(file =>
        norm(file.displayName).includes(query) ||
        norm(file.originalFilename).includes(query) ||
        norm((file as { entityLabel?: string }).entityLabel).includes(query) ||
        norm(file.category).includes(query) ||
        norm(file.description).includes(query)
      );
    }
  }

  // Advanced filters - search term
  if (filters.searchTerm?.trim()) {
    const query = filters.searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const norm = (s?: string | null) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
    result = result.filter(file =>
      norm(file.displayName).includes(query) ||
      norm(file.originalFilename).includes(query)
    );
  }

  // Category filter
  if (filters.category && filters.category !== 'all') {
    result = result.filter(file => file.category === filters.category);
  }

  // Entity type filter
  if (filters.entityType && filters.entityType !== 'all') {
    result = result.filter(file => file.entityType === filters.entityType);
  }

  // Classification filter (ADR-191 Phase 4)
  if (filters.classification && filters.classification !== 'all') {
    result = result.filter(file => file.classification === filters.classification);
  }

  // File type filter (ADR-191 Phase 4)
  if (filters.fileType && filters.fileType !== 'all') {
    const typeMap: Record<string, (ct: string) => boolean> = {
      image: (ct) => ct.startsWith('image/'),
      pdf: (ct) => ct === 'application/pdf',
      video: (ct) => ct.startsWith('video/'),
      spreadsheet: (ct) => ct.includes('spreadsheet') || ct.includes('excel') || ct === 'text/csv',
      document: (ct) => ct.includes('word') || ct.includes('document') || ct === 'text/plain',
    };
    const matcher = typeMap[filters.fileType];
    if (matcher) {
      result = result.filter(file => file.contentType && matcher(file.contentType));
    }
  }

  // Size range filter (ADR-191 Phase 4)
  const sizeRange = filters.sizeRange as { min?: number; max?: number } | undefined;
  if (sizeRange?.min !== undefined && sizeRange.min > 0) {
    const minBytes = sizeRange.min * 1024 * 1024;
    result = result.filter(file => (file.sizeBytes ?? 0) >= minBytes);
  }
  if (sizeRange?.max !== undefined && sizeRange.max > 0) {
    const maxBytes = sizeRange.max * 1024 * 1024;
    result = result.filter(file => (file.sizeBytes ?? 0) <= maxBytes);
  }

  // Date range filter (ADR-191 Phase 4)
  const dateRange = filters.dateRange as { from?: Date; to?: Date } | undefined;
  if (dateRange?.from) {
    const fromDate = new Date(dateRange.from);
    result = result.filter(file => {
      const fileDate = file.createdAt ? new Date(file.createdAt as string) : null;
      return fileDate ? fileDate >= fromDate : true;
    });
  }
  if (dateRange?.to) {
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);
    result = result.filter(file => {
      const fileDate = file.createdAt ? new Date(file.createdAt as string) : null;
      return fileDate ? fileDate <= toDate : true;
    });
  }

  return result;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileManagerState() {
  const { t } = useTranslation(['files', 'files-media']);
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { success: showSuccess, error: showError, warning: showWarning } = useNotifications();

  // Debug state
  const [triggerError, setTriggerError] = useState(false);

  // View states
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [treeViewMode, setTreeViewMode] = useState<TreeViewMode>('business');
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // AI classification
  const { classifyBatch, classifyingIds } = useFileClassification();

  // Dashboard & filters
  const [showDashboard, setShowDashboard] = useState(true);
  const [filters, setFilters] = useState<FileFilterState>(defaultFileFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Company resolution (ADR-201)
  const companyId = useCompanyId({ selectedCompanyId: activeWorkspace?.companyId })?.companyId ?? '';

  // Data fetching
  const {
    files,
    trashedFiles,
    loading,
    error,
    refetch,
    stats,
  } = useAllCompanyFiles({
    companyId,
    autoFetch: !!companyId,
  });

  // Toggle file selection
  const toggleSelect = useCallback((fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  // Filtered files
  const filteredFiles = useMemo(
    () => applyFilters(files, searchTerm, filters),
    [files, searchTerm, filters]
  );

  // Dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => [
    { title: t('dashboard.totalFiles'), value: stats.totalFiles, icon: Files, color: 'blue' },
    { title: t('dashboard.totalSize'), value: formatFileSize(stats.totalSizeBytes), icon: HardDrive, color: 'green' },
    { title: t('dashboard.inTrash'), value: trashedFiles.length, icon: Trash2, color: 'orange' },
    { title: t('dashboard.categories'), value: Object.values(stats.byCategory).filter(v => v > 0).length, icon: Layers, color: 'purple' },
    { title: t('dashboard.projects'), value: stats.byEntityType.project || 0, icon: FolderTree, color: 'cyan' },
  ], [t, stats, trashedFiles.length]);

  return {
    // Context
    t,
    user,
    activeWorkspace,
    companyId,
    // View state
    viewMode, setViewMode,
    treeViewMode, setTreeViewMode,
    activeTab, setActiveTab,
    selectedFile, setSelectedFile,
    searchTerm, setSearchTerm,
    // Batch selection
    selectedIds, setSelectedIds,
    toggleSelect,
    // Upload
    fileInputRef, uploading, setUploading,
    // AI classification
    classifyBatch, classifyingIds,
    // Dashboard & filters
    showDashboard, setShowDashboard,
    filters, setFilters,
    showFilters, setShowFilters,
    // Data
    files, trashedFiles, filteredFiles,
    loading, error, refetch, stats,
    dashboardStats,
    // Notifications
    showSuccess, showError, showWarning,
    // Debug
    triggerError, setTriggerError,
  };
}
