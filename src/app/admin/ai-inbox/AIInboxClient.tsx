'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: AI INBOX CLIENT - UI Component
 * =============================================================================
 *
 * Client component για AI Inbox UI rendering και interactions.
 * Receives admin context from Server Component parent.
 *
 * @component AIInboxClient
 * @enterprise Client-side UI, server-side auth
 * @created 2026-02-03
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inbox, CheckCircle, XCircle, Eye, AlertTriangle, Paperclip, FileText, FileImage, Download, File } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { sanitizeEmailHTML, detectEmailSignature } from '@/lib/message-utils';
import toast from 'react-hot-toast';
import { useWebSocket } from '@/contexts/WebSocketContext';
import type { Communication, FirestoreishTimestamp, TriageStatus } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import type { AdminContext } from '@/server/admin/admin-guards';
import { PageContainer, ListContainer } from '@/core/containers';
import AIInboxHeader from '@/components/admin/ai-inbox/AIInboxHeader';
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel, aiInboxFiltersConfig, defaultAIInboxFilters, type AIInboxFilterState } from '@/components/core/AdvancedFilters';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  getTriageCommunications,
  getTriageStats,
  approveCommunication,
  rejectCommunication
} from '@/services/communications.service';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('AI_INBOX_CLIENT');

// ============================================================================
// DESIGN SYSTEM - Badge Variants
// ============================================================================

type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const getIntentBadgeVariant = (intentType?: string): IntentBadgeVariant => {
  switch (intentType) {
    case 'delivery':
    case 'appointment':
      return 'default';
    case 'issue':
      return 'destructive';
    case 'payment':
    case 'info_update':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getConfidenceBadgeVariant = (confidence?: number): IntentBadgeVariant => {
  if (!confidence) return 'outline';
  return confidence >= 0.8 ? 'default' : confidence >= 0.6 ? 'secondary' : 'destructive';
};

// ============================================================================
// PROPS
// ============================================================================

interface AIInboxClientProps {
  adminContext: AdminContext;
}

// ============================================================================
// TYPES
// ============================================================================

interface TriageStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reviewed: number;
}

const TRIAGE_STATUS_SET = new Set<TriageStatus>(Object.values(TRIAGE_STATUSES));

const resolveFirestoreTimestamp = (value?: FirestoreishTimestamp | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  return null;
};

/**
 * 🏢 ENTERPRISE: Safe content extractor
 * Handles both string content AND object content { text, attachments }
 * from different message sources (email = string, telegram = object)
 */
const getDisplayContent = (content: unknown): string => {
  // Case 1: Already a string
  if (typeof content === 'string') {
    return content;
  }

  // Case 2: Object with text property (Telegram/WhatsApp format)
  if (content && typeof content === 'object') {
    const contentObj = content as Record<string, unknown>;

    // Extract text if present
    if (typeof contentObj.text === 'string') {
      return contentObj.text;
    }

    // Has attachments but no text
    if (Array.isArray(contentObj.attachments) && contentObj.attachments.length > 0) {
      return `[${contentObj.attachments.length} attachment(s)]`;
    }
  }

  // Fallback
  return '';
};

/**
 * 🏢 ENTERPRISE: URL Detection & Linkification
 * Converts URLs in text to clickable links while preserving text formatting
 *
 * Supports formats:
 * 1. `Text <URL>` - Email/HTML style (shows "Text" as link)
 * 2. `[Text](URL)` - Markdown style (shows "Text" as link)
 * 3. Plain URLs - http://, https://, www. (shows shortened URL)
 */

interface TextPart {
  type: 'text' | 'link';
  content: string;
  href?: string;
  displayText?: string;
}

// Pattern 1: Text <URL> format (email style) - e.g., "Google Maps <https://...>"
// Allows newlines between text and URL (common in email signatures)
const EMAIL_LINK_REGEX = /([^<>\n\r]+?)[\s\r\n]*<(https?:\/\/[^>]+)>/gi;

// Pattern 2: [Text](URL) format (markdown style)
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi;

// Pattern 3: Plain URLs
const PLAIN_URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"\]\)]+/gi;

const parseTextWithLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = [];

  // Normalize line endings for consistent regex matching
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // First, find all link patterns and their positions
  interface LinkMatch {
    start: number;
    end: number;
    displayText: string;
    href: string;
  }

  const links: LinkMatch[] = [];

  // Find email-style links: Text <URL>
  EMAIL_LINK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMAIL_LINK_REGEX.exec(normalizedText)) !== null) {
    const displayText = match[1].trim();
    // Skip if displayText looks like it's part of a URL or is empty
    if (displayText && !displayText.startsWith('http') && !displayText.startsWith('www.')) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        displayText,
        href: match[2]
      });
    }
  }

  // Find markdown-style links: [Text](URL)
  MARKDOWN_LINK_REGEX.lastIndex = 0;
  while ((match = MARKDOWN_LINK_REGEX.exec(normalizedText)) !== null) {
    // Check if this position overlaps with existing links
    const overlaps = links.some(l =>
      (match!.index >= l.start && match!.index < l.end) ||
      (match!.index + match![0].length > l.start && match!.index + match![0].length <= l.end)
    );
    if (!overlaps) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        displayText: match[1],
        href: match[2]
      });
    }
  }

  // Find plain URLs (only those not already captured)
  PLAIN_URL_REGEX.lastIndex = 0;
  while ((match = PLAIN_URL_REGEX.exec(normalizedText)) !== null) {
    // Check if this position overlaps with existing links
    const overlaps = links.some(l =>
      (match!.index >= l.start && match!.index < l.end) ||
      (match!.index + match![0].length > l.start && match!.index + match![0].length <= l.end)
    );
    if (!overlaps) {
      let url = match[0];
      // Clean trailing punctuation
      const trailingPunctuation = url.match(/[.,;:!?)>\]\\]+$/);
      if (trailingPunctuation) {
        url = url.slice(0, -trailingPunctuation[0].length);
      }

      // Create shortened display text for plain URLs
      let displayText: string;
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        displayText = urlObj.hostname.replace('www.', '');
      } catch {
        displayText = url.length > 40 ? url.slice(0, 40) + '...' : url;
      }

      links.push({
        start: match.index,
        end: match.index + url.length,
        displayText,
        href: url
      });
    }
  }

  // Sort links by position
  links.sort((a, b) => a.start - b.start);

  // Build parts array
  let lastIndex = 0;
  for (const link of links) {
    // Add text before the link
    if (link.start > lastIndex) {
      const textContent = normalizedText.slice(lastIndex, link.start);
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // Add the link
    parts.push({
      type: 'link',
      content: link.displayText,
      href: link.href,
      displayText: link.displayText
    });

    lastIndex = link.end;
  }

  // Add remaining text
  if (lastIndex < normalizedText.length) {
    parts.push({ type: 'text', content: normalizedText.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: normalizedText }];
};

/**
 * 🏢 ENTERPRISE: Render text content with line breaks preserved
 * Handles both Unix (\n) and Windows (\r\n) line endings
 */
const renderTextWithLineBreaks = (text: string, baseKey: string) => {
  // Normalize line endings: \r\n → \n, then split
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  return lines.map((line, lineIndex) => (
    <span key={`${baseKey}-line-${lineIndex}`}>
      {line}
      {lineIndex < lines.length - 1 && <br />}
    </span>
  ));
};

/**
 * 🏢 ENTERPRISE: Render text with clickable links
 * Returns React elements with proper link handling and line break preservation
 */
const RenderContentWithLinks = ({ content }: { content: string }) => {
  const parts = parseTextWithLinks(content);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'link' && part.href) {
          // Ensure URL has protocol
          const href = part.href.startsWith('http')
            ? part.href
            : `https://${part.href}`;

          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--link-color))] underline hover:text-[hsl(var(--link-color-hover))] transition-colors"
              onClick={(e) => e.stopPropagation()}
              title={part.href} // Show full URL on hover
            >
              {part.displayText || part.content}
            </a>
          );
        }
        // Render text with preserved line breaks
        return (
          <span key={index}>
            {renderTextWithLineBreaks(part.content, `part-${index}`)}
          </span>
        );
      })}
    </>
  );
};

/**
 * 🏢 ENTERPRISE: Safe HTML Content Renderer (ADR-072)
 *
 * Renders email content with:
 * - Line breaks preserved (handles \r\n and \n)
 * - Clickable links (email-style, markdown, plain URLs)
 * - XSS protection via DOMPurify for HTML content
 *
 * @security Uses sanitizeEmailHTML() for HTML content
 */
const SafeHTMLContent = ({ html }: { html: string }) => {
  // Normalize line endings first
  const normalizedContent = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if content appears to be HTML (has actual HTML tags, not just angle brackets in URLs)
  const hasHTMLContent = /<(?!https?:)[a-z][^>]*>/i.test(normalizedContent);

  if (!hasHTMLContent) {
    // Plain text: Convert to HTML with links and line breaks
    let processedContent = normalizedContent;

    // 1. Escape HTML entities first
    processedContent = processedContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Convert email-style links: Text <URL> or just <URL>
    // Handle "Google Maps\n<URL>" pattern - restore the < and > for this pattern
    processedContent = processedContent.replace(
      /([^\n&]*?)\s*&lt;(https?:\/\/[^&]+)&gt;/gi,
      (match, text, url) => {
        const displayText = text.trim() || new URL(url).hostname.replace('www.', '');
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[hsl(var(--link-color))] underline hover:text-[hsl(var(--link-color-hover))] transition-colors">${displayText}</a>`;
      }
    );

    // 3. Convert plain URLs (not already in links)
    processedContent = processedContent.replace(
      /(?<!href=")(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi,
      (url) => {
        const href = url.startsWith('http') ? url : `https://${url}`;
        const displayText = (() => {
          try {
            return new URL(href).hostname.replace('www.', '');
          } catch {
            return url.length > 40 ? url.substring(0, 40) + '...' : url;
          }
        })();
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-[hsl(var(--link-color))] underline hover:text-[hsl(var(--link-color-hover))] transition-colors">${displayText}</a>`;
      }
    );

    // 4. Convert newlines to <br>
    processedContent = processedContent.replace(/\n/g, '<br />');

    return (
      <div
        className="email-content text-foreground"
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === 'A') {
            e.stopPropagation();
          }
        }}
      />
    );
  }

  // HTML content: sanitize and render
  const sanitizedHTML = sanitizeEmailHTML(normalizedContent);

  return (
    <div
      className="email-content prose prose-sm max-w-none dark:prose-invert
        [&_a]:text-[hsl(var(--link-color))] [&_a]:underline [&_a]:hover:text-[hsl(var(--link-color-hover))] [&_a]:transition-colors
        [&_table]:border-collapse [&_td]:p-1 [&_th]:p-1
        [&_img]:max-w-full [&_img]:h-auto
        [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4"
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === 'A') {
          e.stopPropagation();
        }
      }}
    />
  );
};

/**
 * 🏢 ENTERPRISE: Email Content with Signature Detection (ADR-073)
 *
 * Renders email content with separated signature display.
 * - Detects and extracts email signature automatically
 * - Displays body content normally
 * - Shows signature in muted, bordered section
 */
const EmailContentWithSignature = ({ content }: { content: string }) => {
  const signatureDetection = detectEmailSignature(content);

  return (
    <div className="space-y-3">
      {/* Email Body */}
      <div>
        <SafeHTMLContent html={signatureDetection.body} />
      </div>

      {/* Email Signature (if detected) */}
      {signatureDetection.hasSignature && signatureDetection.signature && (
        <div className="border-t border-muted pt-3 mt-3">
          <div className="text-xs text-muted-foreground italic mb-1">
            Email Signature:
          </div>
          <div className="text-sm text-muted-foreground opacity-75">
            <SafeHTMLContent html={signatureDetection.signature} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 🏢 ENTERPRISE: ATTACHMENT DISPLAY SYSTEM (Gmail/Outlook/Salesforce Pattern)
// ============================================================================

/**
 * 🏢 ENTERPRISE: File Type Detection & Icon Mapping
 *
 * Maps file URL/extension to appropriate icon and styling.
 * Pattern: Gmail, Outlook, Salesforce attachment display
 */
const getFileTypeInfo = (url: string) => {
  const filename = url.split('/').pop() || url;
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
    return {
      icon: FileImage,
      type: 'image',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    };
  }

  // PDF
  if (extension === 'pdf') {
    return {
      icon: FileText,
      type: 'pdf',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
    };
  }

  // Documents (Word, Text)
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return {
      icon: FileText,
      type: 'document',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    };
  }

  // Spreadsheets (Excel, CSV)
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) {
    return {
      icon: FileText,
      type: 'spreadsheet',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
    };
  }

  // Generic file
  return {
    icon: File,
    type: 'file',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
  };
};

/**
 * 🏢 ENTERPRISE: Attachment Display Component
 *
 * Features (Gmail/Outlook/Salesforce standard):
 * - File type icons with semantic color coding
 * - Filename with intelligent truncation
 * - Download button with hover effects
 * - Responsive grid layout (1 col mobile, 2 col desktop)
 * - Accessibility (keyboard navigation, ARIA labels, focus states)
 * - Firebase Storage URL support
 *
 * @param attachments - Array of attachment URLs from Firebase Storage
 */
const AttachmentDisplay = ({ attachments }: { attachments: string[] }) => {
  const layout = useLayoutClasses();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  if (!attachments || attachments.length === 0) return null;

  const handleDownload = (url: string) => {
    // 🏢 ENTERPRISE: Open in new tab with security attributes
    // Firebase Storage URLs are signed and secure
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className={`${layout.flexGap2} items-center`}>
        <Paperclip className={iconSizes.sm} />
        <span className={`${typography.label.sm} text-muted-foreground`}>
          {attachments.length} {attachments.length === 1 ? 'Attachment' : 'Attachments'}
        </span>
      </div>

      {/* Attachments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attachments.map((url, index) => {
          const filename = url.split('/').pop() || `attachment-${index + 1}`;
          const fileInfo = getFileTypeInfo(url);
          const FileIcon = fileInfo.icon;

          return (
            <div
              key={index}
              className={`${fileInfo.bgColor} rounded-lg p-3 ${layout.flexGap3} items-center group hover:shadow-sm transition-all border border-transparent hover:border-border`}
            >
              {/* File Icon */}
              <div className={`flex-shrink-0 ${fileInfo.color}`}>
                <FileIcon className={iconSizes.md} />
              </div>

              {/* Filename & Type */}
              <div className="flex-1 min-w-0">
                <p
                  className={`${typography.body.sm} truncate font-medium`}
                  title={filename}
                >
                  {filename}
                </p>
                <p className={`${typography.label.xs} text-muted-foreground`}>
                  {fileInfo.type.toUpperCase()}
                </p>
              </div>

              {/* Download Button */}
              <button
                onClick={() => handleDownload(url)}
                className="flex-shrink-0 p-2 rounded-md hover:bg-background/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Download ${filename}`}
                type="button"
              >
                <Download
                  className={`${iconSizes.sm} text-muted-foreground group-hover:text-foreground transition-colors`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIInboxClient({ adminContext }: AIInboxClientProps) {
  const router = useRouter();
  const { t } = useTranslation('admin');
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const [isMounted, setIsMounted] = useState(false);

  // 🏢 ENTERPRISE: Type refinement - Firestore docs always have id
  const [communications, setCommunications] = useState<Array<Communication & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState<AIInboxFilterState>(defaultAIInboxFilters);
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // 🔄 ENTERPRISE: WebSocket real-time updates (ADR-074)
  const ws = useWebSocket();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🔄 WebSocket: Real-time email notifications
  useEffect(() => {
    if (!ws || !isMounted) return;

    // Subscribe to email queue events
    const emailReceivedId = ws.addEventListener('email_received', (message) => {
      logger.info('📧 New email received via WebSocket', { payload: message.payload });

      // Show toast notification
      toast.success('📧 New email received! Refreshing inbox...', {
        duration: 3000,
      });

      // Auto-refresh communications list
      loadCommunications();
    });

    const emailProcessedId = ws.addEventListener('email_processed', (message) => {
      logger.info('✅ Email processed via WebSocket', { payload: message.payload });

      // Refresh to show processed email
      loadCommunications();
    });

    // Cleanup on unmount
    return () => {
      if (emailReceivedId) ws.removeEventListener(emailReceivedId);
      if (emailProcessedId) ws.removeEventListener(emailProcessedId);
    };
  }, [ws, isMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTriageStatus = useCallback((value: string): value is TriageStatus => {
    return TRIAGE_STATUS_SET.has(value as TriageStatus);
  }, []);

  const resolveStatusFilter = useCallback((): TriageStatus | undefined => {
    if (filters.status === 'all') return undefined;
    return isTriageStatus(filters.status) ? filters.status : undefined;
  }, [filters.status, isTriageStatus]);

  const requireCompanyId = useCallback((): string => {
    const companyId = adminContext.companyId;
    if (!companyId) {
      throw new Error('Admin user has no companyId - tenant isolation violated');
    }
    return companyId;
  }, [adminContext.companyId]);

  // =========================================================================
  // LOAD PENDING COMMUNICATIONS
  // =========================================================================

  const loadTriageCommunications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 🏢 ENTERPRISE: Super admin sees ALL messages, tenant admin sees only their company
      // Check role first - super_admin bypasses company filter
      const isSuperAdmin = adminContext.role === 'super_admin';
      const companyId = isSuperAdmin ? undefined : adminContext.companyId;

      const result = await getTriageCommunications(companyId, adminContext.operationId, resolveStatusFilter());
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }
      const data = result.data;

      // 🏢 ENTERPRISE: Type assertion - all Firestore documents have id
      setCommunications(data as Array<Communication & { id: string }>);

      logger.info('Loaded pending communications', {
        count: data.length,
        source: 'firestore',
        adminUid: adminContext.uid,
        isGlobalAdmin: !companyId,
      });
    } catch (err) {
      logger.error('Failed to load communications', { error: err });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [adminContext.companyId, adminContext.operationId, adminContext.uid, adminContext.role, resolveStatusFilter, t]);

  const loadTriageStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // 🏢 ENTERPRISE: Use dedicated getTriageStats service function (ADR-073)
      // Super admin sees ALL stats (companyId = undefined), tenant admin sees only their company
      const isSuperAdmin = adminContext.role === 'super_admin';
      const companyId = isSuperAdmin ? undefined : adminContext.companyId;

      const result = await getTriageStats(companyId, adminContext.operationId);
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }

      // 🐛 DEBUG: Log received stats
      logger.info('📊 Received stats from API', result.data);

      // 🏢 ENTERPRISE: Service returns properly calculated stats
      setStats(result.data);
    } catch (err) {
      logger.error('Failed to load triage stats', { error: err });
    } finally {
      setStatsLoading(false);
    }
  }, [adminContext.companyId, adminContext.operationId, adminContext.role, t]);

  useEffect(() => {
    loadTriageCommunications();
  }, [loadTriageCommunications]);

  useEffect(() => {
    loadTriageStats();
  }, [loadTriageStats]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadTriageCommunications(), loadTriageStats()]);
  }, [loadTriageCommunications, loadTriageStats]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleApprove = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Get companyId from the communication (supports global admin)
      const comm = communications.find(c => c.id === commId);
      const commCompanyId = comm?.companyId || adminContext.companyId;

      if (!commCompanyId) {
        toast.error('Cannot approve: missing company context');
        return;
      }

      // 🏢 ENTERPRISE: Real server action με idempotent task creation
      const result = await approveCommunication(
        commId,
        adminContext.uid,
        commCompanyId,
        adminContext.operationId
      );

      if (!result.ok) {
        toast.error(t('aiInbox.approveFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      // Update local state
      setCommunications(prev => {
        const updated = prev.map(comm =>
          comm.id === commId
            ? { ...comm, triageStatus: TRIAGE_STATUSES.APPROVED, linkedTaskId: result.taskId }
            : comm
        );
        if (filters.status !== 'all' && filters.status !== TRIAGE_STATUSES.APPROVED) {
          return updated.filter(comm => comm.id !== commId);
        }
        return updated;
      });

      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          approved: prev.approved + 1,
          total: prev.total
        };
      });

      toast.success(t('aiInbox.approveSuccess'));
      logger.info('Communication approved', {
        communicationId: commId,
        taskId: result.taskId,
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Approve failed', { communicationId: commId, error: err });
      toast.error(t('aiInbox.approveFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Get companyId from the communication (supports global admin)
      const comm = communications.find(c => c.id === commId);
      const commCompanyId = comm?.companyId || adminContext.companyId;

      if (!commCompanyId) {
        toast.error('Cannot reject: missing company context');
        return;
      }

      // 🏢 ENTERPRISE: Real server action για reject
      const result = await rejectCommunication(
        commId,
        commCompanyId,
        adminContext.uid,
        adminContext.operationId
      );

      if (!result.ok) {
        toast.error(t('aiInbox.rejectFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      setCommunications(prev => {
        const updated = prev.map(comm =>
          comm.id === commId
            ? { ...comm, triageStatus: TRIAGE_STATUSES.REJECTED }
            : comm
        );
        if (filters.status !== 'all' && filters.status !== TRIAGE_STATUSES.REJECTED) {
          return updated.filter(comm => comm.id !== commId);
        }
        return updated;
      });

      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          rejected: prev.rejected + 1,
          total: prev.total
        };
      });

      toast.success(t('aiInbox.rejectSuccess'));
      logger.info('Communication rejected', {
        communicationId: commId,
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Reject failed', { communicationId: commId, error: err });
      toast.error(t('aiInbox.rejectFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  const filteredCommunications = useMemo(() => {
    let list = [...communications];

    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.trim().toLowerCase();
      list = list.filter(comm =>
        (comm.from || '').toLowerCase().includes(term) ||
        (comm.subject || '').toLowerCase().includes(term) ||
        getDisplayContent(comm.content).toLowerCase().includes(term)
      );
    }

    if (filters.channel !== 'all') {
      list = list.filter(comm => comm.type === filters.channel);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      list = list.filter(comm => {
        const createdAt = resolveFirestoreTimestamp(comm.createdAt);
        return createdAt ? createdAt.getTime() >= fromDate.getTime() : false;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      list = list.filter(comm => {
        const createdAt = resolveFirestoreTimestamp(comm.createdAt);
        return createdAt ? createdAt.getTime() <= toDate.getTime() : false;
      });
    }

    return list;
  }, [communications, filters.channel, filters.dateFrom, filters.dateTo, filters.searchTerm]);

  const pendingCount = stats?.pending ?? 0;
  const isRefreshing = loading || statsLoading;

  const dashboardStatusFilters = useMemo(() => ([
    'all',
    TRIAGE_STATUSES.PENDING,
    TRIAGE_STATUSES.APPROVED,
    TRIAGE_STATUSES.REJECTED
  ]), []);

  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    {
      title: t('aiInbox.stats.total'),
      value: statsLoading ? '...' : stats?.total ?? 0,
      icon: Inbox,
      color: 'blue'
    },
    {
      title: t('aiInbox.stats.pending'),
      value: statsLoading ? '...' : stats?.pending ?? 0,
      icon: AlertTriangle,
      color: 'yellow'
    },
    {
      title: t('aiInbox.stats.approved'),
      value: statsLoading ? '...' : stats?.approved ?? 0,
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: t('aiInbox.stats.rejected'),
      value: statsLoading ? '...' : stats?.rejected ?? 0,
      icon: XCircle,
      color: 'red'
    }
  ]), [stats, statsLoading, t]);

  if (!isMounted) {
    return null;
  }

  return (
    <PageContainer ariaLabel={t('aiInbox.title')}>
      <AIInboxHeader
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        pendingCount={pendingCount}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
      />

      {showDashboard && (
        <section className={`${layout.widthFull} overflow-hidden`} aria-label={t('aiInbox.stats.total')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            onCardClick={(_, index) => {
              const nextStatus = dashboardStatusFilters[index] ?? 'all';
              setFilters(prev => ({ ...prev, status: nextStatus }));
            }}
            className={`${layout.dashboardPadding} overflow-hidden`}
          />
        </section>
      )}

      <section className={layout.widthFull} aria-label={t('aiInbox.filters.title')}>
        <aside className="hidden md:block" role="complementary" aria-label={t('aiInbox.filters.title')}>
          <AdvancedFiltersPanel
            config={aiInboxFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('aiInbox.filters.title')}>
            <AdvancedFiltersPanel
              config={aiInboxFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}
      </section>

      {error && (
        <section className={layout.sectionMarginTop} role="alert">
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </section>
      )}

      <ListContainer>
        <section className={`${layout.flexColGap4} flex-1 min-h-0`} aria-label={t('aiInbox.queueTitle')}>
          <Card>
            <CardHeader>
              <CardTitle>{t('aiInbox.queueTitle')}</CardTitle>
              <CardDescription>{t('aiInbox.queueDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className={`flex items-center justify-center ${spacing.padding.y.lg}`}>
                  <Spinner size="large" />
                </div>
              ) : filteredCommunications.length === 0 ? (
                <div className={`${layout.textCenter} ${spacing.padding.y.lg}`}>
                  <Inbox className={`${iconSizes.xl2} ${layout.centerHorizontal} text-muted-foreground ${spacing.margin.bottom.md}`} />
                  <p className={`${typography.body.sm} text-muted-foreground`}>{t('aiInbox.empty.title')}</p>
                  <p className={`${typography.body.sm} text-muted-foreground`}>{t('aiInbox.empty.description')}</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredCommunications.map((comm) => {
                    // 🏢 ENTERPRISE: Treat undefined/null triageStatus as 'pending'
                    const isPending = !comm.triageStatus || comm.triageStatus === TRIAGE_STATUSES.PENDING;
                    const isApproved = comm.triageStatus === TRIAGE_STATUSES.APPROVED;
                    const isRejected = comm.triageStatus === TRIAGE_STATUSES.REJECTED;
                    const createdAt = resolveFirestoreTimestamp(comm.createdAt);
                    const formattedDate = createdAt ? createdAt.toLocaleString('el-GR') : '';

                    return (
                      <AccordionItem key={comm.id} value={comm.id} variant="bordered">
                        <AccordionTrigger variant="bordered" size="md" className="hover:no-underline">
                          <div className={`${layout.flexGap2} items-center w-full pr-4`}>
                            {/* Status Badge */}
                            {isApproved ? (
                              <Badge variant="default" className="shrink-0">
                                <CheckCircle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.approved')}
                              </Badge>
                            ) : isRejected ? (
                              <Badge variant="destructive" className="shrink-0">
                                <XCircle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.rejected')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0">
                                <AlertTriangle className={`${iconSizes.xs} ${spacing.margin.right.xs}`} />
                                {t('aiInbox.pending')}
                              </Badge>
                            )}

                            {/* Channel Badge */}
                            <Badge variant="secondary" className="shrink-0">{comm.type}</Badge>

                            {/* Sender */}
                            <span className={`${typography.label.sm} truncate`}>
                              {comm.from || t('aiInbox.unknownSender')}
                            </span>

                            {/* Subject (if available) */}
                            {comm.subject && (
                              <span className="text-muted-foreground truncate flex-1">
                                - {comm.subject}
                              </span>
                            )}

                            {/* Date */}
                            <span className={`${typography.body.xs} text-muted-foreground shrink-0 ml-auto`}>
                              {formattedDate}
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent variant="bordered">
                          <div className={`${layout.flexColGap4} pt-2`}>
                            {/* Message Content - safe HTML rendering with signature detection (ADR-072, ADR-073) */}
                            <div className="bg-muted/50 rounded-lg p-4">
                              <div className={typography.body.sm}>
                                <EmailContentWithSignature content={getDisplayContent(comm.content)} />
                              </div>
                            </div>

                            {/* Intent Analysis */}
                            {comm.intentAnalysis && (
                              <div className={`${layout.flexGap4} flex-wrap`}>
                                <div className={layout.flexGap2}>
                                  <span className={typography.label.sm}>{t('aiInbox.intent')}:</span>
                                  <Badge variant={getIntentBadgeVariant(comm.intentAnalysis.intentType)}>
                                    {comm.intentAnalysis.intentType || t('aiInbox.unknownIntent')}
                                  </Badge>
                                </div>
                                {comm.intentAnalysis.confidence && (
                                  <div className={layout.flexGap2}>
                                    <span className={typography.label.sm}>{t('aiInbox.confidence')}:</span>
                                    <Badge variant={getConfidenceBadgeVariant(comm.intentAnalysis.confidence)}>
                                      {Math.round(comm.intentAnalysis.confidence * 100)}%
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 🏢 ENTERPRISE: Attachments Display (Gmail/Outlook Pattern) */}
                            {comm.attachments && comm.attachments.length > 0 && (
                              <div className="bg-background rounded-lg p-4 border border-border">
                                <AttachmentDisplay attachments={comm.attachments} />
                              </div>
                            )}

                            {/* Action Buttons - ALWAYS show for pending messages */}
                            <div className={`${layout.flexGap2} pt-2 border-t`}>
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprove(comm.id);
                                    }}
                                    disabled={actionLoading === comm.id}
                                  >
                                    {actionLoading === comm.id ? (
                                      <Spinner size="small" />
                                    ) : (
                                      <>
                                        <CheckCircle className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                        {t('aiInbox.approve')}
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReject(comm.id);
                                    }}
                                    disabled={actionLoading === comm.id}
                                  >
                                    <XCircle className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                    {t('aiInbox.reject')}
                                  </Button>
                                </>
                              )}
                              {comm.linkedTaskId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/crm/tasks/${comm.linkedTaskId}`);
                                  }}
                                >
                                  <Eye className={`${iconSizes.sm} ${spacing.margin.right.xs}`} />
                                  {t('aiInbox.viewTask')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
            <CardTitle className={typography.heading.md}>{t('aiInbox.howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className={`${typography.body.sm} text-muted-foreground ${layout.flexColGap2}`}>
              <p>1. {t('aiInbox.howItWorksStep1')}</p>
              <p>2. {t('aiInbox.howItWorksStep2')}</p>
              <p>3. {t('aiInbox.howItWorksStep3')}</p>
              <p>4. {t('aiInbox.howItWorksStep4')}</p>
              <p>5. {t('aiInbox.howItWorksStep5')}</p>
            </CardContent>
          </Card>
        </section>
      </ListContainer>
    </PageContainer>
  );
}

