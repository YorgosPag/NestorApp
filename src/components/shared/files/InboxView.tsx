/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 📥 ENTERPRISE: Inbox View Component - ADR-055 Attachment Ingestion
 * =============================================================================
 *
 * @module components/shared/files/InboxView
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
 */

'use client';

import React, { useCallback, useState, useMemo } from 'react';
import {
  Inbox, Clock, RefreshCw, HardDrive, Calendar, MessageSquare,
  User, ExternalLink, Eye, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { formatFileSize } from '@/utils/file-validation';
import { formatDateTime } from '@/lib/intl-utils';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted helpers + fetch hook
import {
  getCategoryIcon,
  groupFilesByChatId,
  useInboxFiles,
  type InboxFileRecord,
} from './inbox-view-helpers';

// Re-exports
export { type InboxFileRecord, type ChatGroup } from './inbox-view-helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface InboxViewProps {
  companyId: string;
  currentUserId: string;
  onRefresh?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InboxView({
  companyId,
  currentUserId: _currentUserId,
  onRefresh: _onRefresh,
}: InboxViewProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const translateDisplayName = useFileDisplayName();

  const { inboxFiles, loading, error, fetchInboxFiles } = useInboxFiles(companyId);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());

  const chatGroups = useMemo(() => groupFilesByChatId(inboxFiles), [inboxFiles]);

  const toggleChatExpanded = useCallback((chatId: string) => {
    setExpandedChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId); else next.add(chatId);
      return next;
    });
  }, []);

  const handlePreview = useCallback((file: InboxFileRecord) => {
    if (file.downloadUrl) window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
  }, []);

  if (loading) {
    return (
      <section className="space-y-4 p-4" role="status" aria-label={t('list.loadingFiles')}>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className={cn(iconSizes.md, colors.text.muted)} />
            <h2 className="text-lg font-semibold">{t('domains.ingestion')}</h2>
          </div>
        </header>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`p-4 bg-card ${quick.card} border animate-pulse`} aria-hidden="true">
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

  if (error) throw error;

  if (inboxFiles.length === 0) {
    return (
      <section className="space-y-4 p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className={cn(iconSizes.md, colors.text.muted)} />
            <h2 className="text-lg font-semibold">{t('domains.ingestion')}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchInboxFiles} aria-label={t('manager.refresh')}>
            <RefreshCw className={iconSizes.sm} />
          </Button>
        </header>
        <div className={`p-8 text-center ${colors.bg.muted} ${quick.card}`} role="status">
          <Inbox className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
          <p className="text-sm font-medium">{t('inbox.empty')}</p>
          <p className={cn("text-xs mt-1", colors.text.muted)}>{t('inbox.emptyDescription')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className={`${iconSizes.md} text-blue-500`} />
          <div>
            <h2 className="text-lg font-semibold">{t('domains.ingestion')}</h2>
            <p className={cn("text-xs", colors.text.muted)}>{t('inbox.description')}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchInboxFiles} aria-label={t('manager.refresh')}>
          <RefreshCw className={iconSizes.sm} />
        </Button>
      </header>

      <div className="flex gap-4 text-sm">
        <span className={cn("flex items-center gap-1", colors.text.muted)}>
          <HardDrive className={iconSizes.xs} />{t('inbox.totalFiles')}: {inboxFiles.length}
        </span>
        <span className={cn("flex items-center gap-1", colors.text.muted)}>
          <MessageSquare className={iconSizes.xs} />{t('inbox.chats')}: {chatGroups.length}
        </span>
        <span className={cn("flex items-center gap-1", colors.text.muted)}>
          <HardDrive className={iconSizes.xs} />{t('inbox.totalSize')}: {formatFileSize(inboxFiles.reduce((total, f) => total + (f.sizeBytes || 0), 0))}
        </span>
      </div>

      <div className="space-y-4" role="list" aria-label={t('domains.ingestion')}>
        {chatGroups.map((group) => {
          const isExpanded = expandedChats.has(group.chatId);
          const firstFile = group.files[0];
          const senderName = firstFile?.source?.senderName || group.chatId;

          return (
            <article key={group.chatId} className={`bg-card ${quick.card} border overflow-hidden`}>
              <button
                type="button" onClick={() => toggleChatExpanded(group.chatId)}
                className={`w-full flex items-center justify-between p-3 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                aria-expanded={isExpanded} aria-controls={`chat-files-${group.chatId}`}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className={iconSizes.sm} /> : <ChevronRight className={iconSizes.sm} />}
                  <MessageSquare className={`${iconSizes.md} text-blue-500`} />
                  <div className="text-left">
                    <p className="text-sm font-medium flex items-center gap-2"><User className={iconSizes.xs} />{senderName}</p>
                    <p className={cn("text-xs", colors.text.muted)}>Chat ID: {group.chatId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{group.files.length} {t('manager.files')}</Badge>
                  <span className={cn("text-xs flex items-center gap-1", colors.text.muted)}>
                    <Clock className={iconSizes.xs} />{formatDateTime(group.latestTimestamp)}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div id={`chat-files-${group.chatId}`} className="border-t" role="list">
                  {group.files.map((file) => (
                    <div key={file.id} className={`flex items-center justify-between p-3 border-b last:border-b-0 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`} role="listitem">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`flex-shrink-0 w-10 h-10 bg-muted ${quick.card} flex items-center justify-center`} aria-hidden="true">
                          {getCategoryIcon(file.category, iconSizes)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{translateDisplayName(file) || file.originalFilename}</p>
                          <div className={cn("flex flex-wrap items-center gap-3 text-xs mt-1", colors.text.muted)}>
                            <span className="flex items-center gap-1"><HardDrive className={iconSizes.xs} />{formatFileSize(file.sizeBytes ?? 0)}</span>
                            {file.category && <Badge variant="outline" className="text-xs">{t(`categories.${file.category}`)}</Badge>}
                            {file.source?.messageId && <span className="flex items-center gap-1"><MessageSquare className={iconSizes.xs} />Msg: {file.source.messageId}</span>}
                            <span className="flex items-center gap-1"><Calendar className={iconSizes.xs} />{formatDateTime(file.source?.receivedAt || file.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <nav className="flex items-center gap-1" role="toolbar">
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(file)} disabled={!file.downloadUrl} aria-label={t('list.viewFile')}>
                            <Eye className={iconSizes.sm} />
                          </Button>
                        </TooltipTrigger><TooltipContent>{t('list.viewFile')}</TooltipContent></Tooltip>
                        {file.downloadUrl && (
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handlePreview(file)} aria-label={t('list.download')}>
                              <ExternalLink className={iconSizes.sm} />
                            </Button>
                          </TooltipTrigger><TooltipContent>{t('list.download')}</TooltipContent></Tooltip>
                        )}
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
