/**
 * =============================================================================
 * 📥 ENTERPRISE: Inbox View Component - ADR-055 Attachment Ingestion
 * =============================================================================
 *
 * Enterprise-grade inbox view for quarantined attachments from Telegram.
 * Files in this view have:
 * - domain = FILE_DOMAINS.INGESTION ('ingestion')
 * - status = FILE_STATUS.PENDING (quarantine gate)
 * - entityType = ENTITY_TYPES.COMPANY (linked to company, not business entity)
 *
 * These files remain PENDING until classified/promoted to a business entity
 * via the promotion endpoint.
 *
 * @module components/shared/files/InboxView
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
 *
 * Pattern: Gmail Inbox / Slack Files / Microsoft Teams Files
 * - Grouped by source.chatId (Telegram chat origin)
 * - Shows audit metadata (sender, timestamp, messageId)
 * - Actions: Classify (promote), Delete, Preview
 */

'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  Clock,
  RefreshCw,
  HardDrive,
  Calendar,
  MessageSquare,
  User,
  FileImage,
  FileVideo,
  FileText,
  File,
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { formatFileSize as formatFileSizeUtil } from '@/utils/file-validation';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import { FILE_DOMAINS, FILE_STATUS } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { formatDateTime } from '@/lib/intl-utils'; // 🏢 ENTERPRISE: Centralized date/time formatting

// 🏢 ENTERPRISE: Error handling delegated to ComponentErrorBoundary wrapper
// See FileManagerPageContent.tsx where InboxView is wrapped with ComponentErrorBoundary
// This provides full enterprise error handling: email providers, admin notification, etc.

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('INBOX_VIEW');

// ============================================================================
// TYPES
// ============================================================================

export interface InboxViewProps {
  /** Company ID for fetching inbox files */
  companyId: string;
  /** Current user ID */
  currentUserId: string;
  /** Callback when file list changes */
  onRefresh?: () => void;
}

/**
 * 🏢 ENTERPRISE: Extended FileRecord type with additional typed fields
 * Uses type intersection to add Telegram-specific source fields without
 * conflicting with the base FileRecord.source type.
 */
type InboxFileRecord = FileRecord & {
  /**
   * Ingestion metadata added during Telegram attachment download
   * @enterprise ADR-055 - Enterprise Attachment Ingestion System
   */
  ingestion?: {
    rawType: string;
    autoCategory: string;
    confidence: number;
  };
};

/**
 * Files grouped by source.chatId
 */
interface ChatGroup {
  chatId: string;
  files: InboxFileRecord[];
  latestTimestamp: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format file size
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return formatFileSizeUtil(0);
  return formatFileSizeUtil(bytes);
}

/**
 * Get icon for file category
 */
function getCategoryIcon(category: string | undefined, iconSizes: ReturnType<typeof useIconSizes>) {
  switch (category) {
    case 'photos':
      return <FileImage className={`${iconSizes.md} text-blue-500`} />;
    case 'videos':
      return <FileVideo className={`${iconSizes.md} text-purple-500`} />;
    case 'documents':
    case 'contracts':
    case 'reports':
      return <FileText className={`${iconSizes.md} text-orange-500`} />;
    case 'floorplans':
    case 'drawings':
      return <FileText className={`${iconSizes.md} text-green-500`} />;
    default:
      return <File className={`${iconSizes.md} text-gray-500`} />;
  }
}

/**
 * Group files by source.chatId
 */
function groupFilesByChatId(files: InboxFileRecord[]): ChatGroup[] {
  const grouped = new Map<string, InboxFileRecord[]>();

  for (const file of files) {
    const chatId = file.source?.chatId || 'unknown';
    if (!grouped.has(chatId)) {
      grouped.set(chatId, []);
    }
    grouped.get(chatId)!.push(file);
  }

  // Helper to convert Date or string to ISO string
  const toISOString = (value: Date | string | undefined): string => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString();
    return value;
  };

  // Convert to array and sort by latest timestamp
  const groups: ChatGroup[] = [];
  for (const [chatId, chatFiles] of grouped) {
    // Sort files within group by receivedAt descending
    chatFiles.sort((a, b) => {
      const dateA = toISOString(a.source?.receivedAt) || toISOString(a.createdAt) || '';
      const dateB = toISOString(b.source?.receivedAt) || toISOString(b.createdAt) || '';
      return dateB.localeCompare(dateA);
    });

    const latestTimestamp = toISOString(chatFiles[0]?.source?.receivedAt) || toISOString(chatFiles[0]?.createdAt) || '';
    groups.push({ chatId, files: chatFiles, latestTimestamp });
  }

  // Sort groups by latest timestamp descending
  groups.sort((a, b) => b.latestTimestamp.localeCompare(a.latestTimestamp));

  return groups;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 📥 ENTERPRISE: Inbox View Component
 *
 * Displays quarantined files from Telegram with:
 * - Grouped by source.chatId
 * - Source audit metadata display
 * - Preview functionality
 * - Future: Classify/Promote action
 */
export function InboxView({
  companyId,
  currentUserId,
  onRefresh,
}: InboxViewProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const translateDisplayName = useFileDisplayName();

  // State
  const [inboxFiles, setInboxFiles] = useState<InboxFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());

  // =========================================================================
  // FETCH INBOX FILES
  // =========================================================================

  const fetchInboxFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching inbox files', { companyId });

      // 🏢 ENTERPRISE: Query for ingestion domain + pending status
      const files = await FileRecordService.queryFileRecords({
        companyId,
        domain: FILE_DOMAINS.INGESTION,
        status: FILE_STATUS.PENDING,
        includeDeleted: false,
      });

      logger.info('Inbox files fetched', { count: files.length });
      setInboxFiles(files as InboxFileRecord[]);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch inbox files');
      // 🐛 DEBUG: Log full error details for troubleshooting
      logger.error('Failed to fetch inbox files', {
        error: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name,
        // If it's a Firestore error, it may have a code
        code: (err as { code?: string })?.code,
        fullError: String(err),
      });
      console.error('📥 INBOX_VIEW Full Error:', err);
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Fetch on mount
  useEffect(() => {
    if (companyId) {
      fetchInboxFiles();
    }
  }, [companyId, fetchInboxFiles]);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  const chatGroups = useMemo(() => groupFilesByChatId(inboxFiles), [inboxFiles]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const toggleChatExpanded = useCallback((chatId: string) => {
    setExpandedChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const handlePreview = useCallback((file: InboxFileRecord) => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // =========================================================================
  // RENDER
  // =========================================================================

  // Loading state
  if (loading) {
    return (
      <section className="space-y-4 p-4" role="status" aria-label={t('list.loadingFiles')}>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className={`${iconSizes.md} text-muted-foreground`} />
            <h2 className="text-lg font-semibold">{t('domains.ingestion')}</h2>
          </div>
        </header>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`p-4 bg-card ${quick.card} border animate-pulse`}
              aria-hidden="true"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 bg-muted ${quick.card}`} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 🏢 ENTERPRISE: Throw error to be caught by ComponentErrorBoundary
  // This enables the centralized error handling system with:
  // - Email provider selection (Gmail, Outlook, Yahoo, Default)
  // - Copy error details to clipboard
  // - Notify administrator
  // - Anonymous error reporting
  if (error) {
    throw error;
  }

  // Empty state
  if (inboxFiles.length === 0) {
    return (
      <section className="space-y-4 p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className={`${iconSizes.md} text-muted-foreground`} />
            <h2 className="text-lg font-semibold">{t('domains.ingestion')}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchInboxFiles}
            aria-label={t('manager.refresh')}
          >
            <RefreshCw className={iconSizes.sm} />
          </Button>
        </header>
        <div
          className={`p-8 text-center ${colors.bg.muted} ${quick.card}`}
          role="status"
        >
          <Inbox className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
          <p className="text-sm font-medium">{t('inbox.empty') || 'Δεν υπάρχουν αρχεία στα εισερχόμενα'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('inbox.emptyDescription') || 'Τα αρχεία από το Telegram θα εμφανιστούν εδώ'}
          </p>
        </div>
      </section>
    );
  }

  // Main inbox view with grouped files
  return (
    <section className="space-y-4 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className={`${iconSizes.md} text-blue-500`} />
          <div>
            <h2 className="text-lg font-semibold">{t('domains.ingestion')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('inbox.description') || 'Αρχεία που αναμένουν ταξινόμηση'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchInboxFiles}
          aria-label={t('manager.refresh')}
        >
          <RefreshCw className={iconSizes.sm} />
        </Button>
      </header>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1 text-muted-foreground">
          <HardDrive className={iconSizes.xs} />
          {t('inbox.totalFiles') || 'Αρχεία'}: {inboxFiles.length}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MessageSquare className={iconSizes.xs} />
          {t('inbox.chats') || 'Συνομιλίες'}: {chatGroups.length}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <HardDrive className={iconSizes.xs} />
          {t('inbox.totalSize') || 'Μέγεθος'}: {formatFileSize(
            inboxFiles.reduce((total, f) => total + (f.sizeBytes || 0), 0)
          )}
        </span>
      </div>

      {/* Grouped files by chatId */}
      <div className="space-y-4" role="list" aria-label={t('domains.ingestion')}>
        {chatGroups.map((group) => {
          const isExpanded = expandedChats.has(group.chatId);
          const firstFile = group.files[0];
          const senderName = firstFile?.source?.senderName || group.chatId;

          return (
            <article
              key={group.chatId}
              className={`bg-card ${quick.card} border overflow-hidden`}
            >
              {/* Chat Header - Clickable to expand/collapse */}
              <button
                type="button"
                onClick={() => toggleChatExpanded(group.chatId)}
                className={`w-full flex items-center justify-between p-3 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                aria-expanded={isExpanded}
                aria-controls={`chat-files-${group.chatId}`}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className={iconSizes.sm} />
                  ) : (
                    <ChevronRight className={iconSizes.sm} />
                  )}
                  <MessageSquare className={`${iconSizes.md} text-blue-500`} />
                  <div className="text-left">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <User className={iconSizes.xs} />
                      {senderName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chat ID: {group.chatId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {group.files.length} {t('manager.files') || 'αρχεία'}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className={iconSizes.xs} />
                    {formatDateTime(group.latestTimestamp)}
                  </span>
                </div>
              </button>

              {/* Expanded Files List */}
              {isExpanded && (
                <div
                  id={`chat-files-${group.chatId}`}
                  className="border-t"
                  role="list"
                >
                  {group.files.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center justify-between p-3 border-b last:border-b-0 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                      role="listitem"
                    >
                      {/* File Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Type Icon */}
                        <div
                          className={`flex-shrink-0 w-10 h-10 bg-muted ${quick.card} flex items-center justify-center`}
                          aria-hidden="true"
                        >
                          {getCategoryIcon(file.category, iconSizes)}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {translateDisplayName(file) || file.originalFilename}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                            {/* File size */}
                            <span className="flex items-center gap-1">
                              <HardDrive className={iconSizes.xs} />
                              {formatFileSize(file.sizeBytes)}
                            </span>
                            {/* Category */}
                            {file.category && (
                              <Badge variant="outline" className="text-xs">
                                {t(`categories.${file.category}`) || file.category}
                              </Badge>
                            )}
                            {/* Message ID */}
                            {file.source?.messageId && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className={iconSizes.xs} />
                                Msg: {file.source.messageId}
                              </span>
                            )}
                            {/* Received at */}
                            <span className="flex items-center gap-1">
                              <Calendar className={iconSizes.xs} />
                              {formatDateTime(file.source?.receivedAt || file.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <nav className="flex items-center gap-1" role="toolbar">
                        {/* Preview */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(file)}
                              disabled={!file.downloadUrl}
                              aria-label={t('list.viewFile') || 'Προβολή'}
                            >
                              <Eye className={iconSizes.sm} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('list.viewFile') || 'Προβολή'}</TooltipContent>
                        </Tooltip>

                        {/* Open in new tab */}
                        {file.downloadUrl && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreview(file)}
                                aria-label={t('list.download') || 'Άνοιγμα'}
                              >
                                <ExternalLink className={iconSizes.sm} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('list.download') || 'Άνοιγμα σε νέο tab'}</TooltipContent>
                          </Tooltip>
                        )}

                        {/* TODO: Classify/Promote button - Phase 2 */}
                      </nav>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
