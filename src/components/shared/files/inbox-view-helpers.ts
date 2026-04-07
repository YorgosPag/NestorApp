/* eslint-disable custom/no-hardcoded-strings */
/**
 * InboxView helpers — types, utilities, fetch hook
 * Extracted from InboxView for file-size compliance.
 *
 * @module components/shared/files/inbox-view-helpers
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FileImage, FileVideo, FileText, File } from 'lucide-react';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import { FILE_DOMAINS, FILE_STATUS } from '@/config/domain-constants';
import { useAuth } from '@/auth/hooks/useAuth';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';

const logger = createModuleLogger('INBOX_VIEW');

// ============================================================================
// TYPES
// ============================================================================

export type InboxFileRecord = FileRecord & {
  ingestion?: {
    rawType: string;
    autoCategory: string;
    confidence: number;
  };
};

export interface ChatGroup {
  chatId: string;
  files: InboxFileRecord[];
  latestTimestamp: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

export function getCategoryIcon(category: string | undefined, iconSizes: ReturnType<typeof useIconSizes>) {
  switch (category) {
    case 'photos':
      return React.createElement(FileImage, { className: `${iconSizes.md} text-blue-500` });
    case 'videos':
      return React.createElement(FileVideo, { className: `${iconSizes.md} text-purple-500` });
    case 'documents':
    case 'contracts':
    case 'reports':
      return React.createElement(FileText, { className: `${iconSizes.md} text-orange-500` });
    case 'floorplans':
    case 'drawings':
      return React.createElement(FileText, { className: `${iconSizes.md} text-green-500` });
    default:
      return React.createElement(File, { className: `${iconSizes.md} text-gray-500` });
  }
}

export function groupFilesByChatId(files: InboxFileRecord[]): ChatGroup[] {
  const grouped = new Map<string, InboxFileRecord[]>();

  for (const file of files) {
    const chatId = file.source?.chatId || 'unknown';
    if (!grouped.has(chatId)) grouped.set(chatId, []);
    grouped.get(chatId)!.push(file);
  }

  const toISOString = (value: Date | string | undefined): string =>
    normalizeToISO(value) ?? '';

  const groups: ChatGroup[] = [];
  for (const [chatId, chatFiles] of grouped) {
    chatFiles.sort((a, b) => {
      const dateA = toISOString(a.source?.receivedAt) || toISOString(a.createdAt) || '';
      const dateB = toISOString(b.source?.receivedAt) || toISOString(b.createdAt) || '';
      return dateB.localeCompare(dateA);
    });
    const latestTimestamp = toISOString(chatFiles[0]?.source?.receivedAt) || toISOString(chatFiles[0]?.createdAt) || '';
    groups.push({ chatId, files: chatFiles, latestTimestamp });
  }

  groups.sort((a, b) => b.latestTimestamp.localeCompare(a.latestTimestamp));
  return groups;
}

// ============================================================================
// FETCH HOOK
// ============================================================================

export function useInboxFiles(companyId: string) {
  const { user } = useAuth();
  const [inboxFiles, setInboxFiles] = useState<InboxFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInboxFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info('Fetching inbox files', { companyId });
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
      logger.error('Failed to fetch inbox files', {
        error: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name,
        code: (err as { code?: string })?.code,
        fullError: String(err),
      });
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId && user) fetchInboxFiles();
  }, [companyId, user, fetchInboxFiles]);

  return { inboxFiles, loading, error, fetchInboxFiles };
}
