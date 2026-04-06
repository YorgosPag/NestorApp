/**
 * 🏢 EMAIL QUEUE ATTACHMENT SERIALIZATION
 *
 * Attachment serialize/deserialize for email ingestion queue.
 * Supports inline (pre-downloaded) and deferred (fetch later) modes.
 *
 * Pattern: "Store Reference, Fetch Later" (SAP, Salesforce, Microsoft)
 * - INLINE (< 1MB): Download now, store as base64
 * - DEFERRED (>= 1MB): Store metadata only, fetch from Mailgun later
 *
 * Extracted from email-queue-service.ts (ADR-065 SRP split).
 *
 * @module services/communications/inbound/email-queue-attachments
 */

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import {
  EMAIL_QUEUE_CONFIG,
  type SerializedAttachment,
} from '@/types/email-ingestion-queue';
import type { InboundEmailAttachment, InboundAttachmentDownload, MailgunStorageInfo } from './types';

const logger = createModuleLogger('EMAIL_QUEUE_ATTACHMENTS');

// ============================================================================
// SERIALIZE (Webhook → Queue)
// ============================================================================

/**
 * Serialize single attachment with inline/deferred mode selection
 */
async function serializeAttachment(
  attachment: InboundEmailAttachment,
  mailgunStorage?: MailgunStorageInfo
): Promise<SerializedAttachment | null> {
  try {
    if (
      attachment.sizeBytes &&
      attachment.sizeBytes > EMAIL_QUEUE_CONFIG.MAX_ATTACHMENT_SIZE_BYTES
    ) {
      logger.warn('Attachment exceeds max size for queue, skipping', {
        filename: attachment.filename,
        sizeBytes: attachment.sizeBytes,
        maxSize: EMAIL_QUEUE_CONFIG.MAX_ATTACHMENT_SIZE_BYTES,
      });
      return null;
    }

    const sizeBytes = attachment.sizeBytes || 0;
    const useDeferred = Boolean(mailgunStorage);

    if (useDeferred && mailgunStorage) {
      logger.info('Using DEFERRED mode for attachment', {
        filename: attachment.filename,
        sizeBytes,
        storageKey: mailgunStorage.storageKey,
        pattern: 'SAP/Salesforce deferred fetch',
      });

      return {
        filename: attachment.filename,
        contentType: attachment.contentType,
        sizeBytes,
        mode: 'deferred',
        storageUrl: mailgunStorage.messageUrl,
        storageKey: mailgunStorage.storageKey,
      };
    }

    const downloadResult = await attachment.download();
    if (!downloadResult) {
      logger.warn('Failed to download attachment for serialization', {
        filename: attachment.filename,
      });
      return null;
    }

    if (downloadResult.buffer.length > EMAIL_QUEUE_CONFIG.MAX_ATTACHMENT_SIZE_BYTES) {
      logger.warn('Downloaded attachment exceeds max size, skipping', {
        filename: attachment.filename,
        downloadedSize: downloadResult.buffer.length,
      });
      return null;
    }

    return {
      filename: attachment.filename,
      contentType: attachment.contentType || downloadResult.contentType,
      sizeBytes: downloadResult.buffer.length,
      mode: 'inline',
      base64Content: downloadResult.buffer.toString('base64'),
    };
  } catch (error) {
    logger.error('Error serializing attachment', {
      filename: attachment.filename,
      error: getErrorMessage(error),
    });
    return null;
  }
}

/**
 * Serialize all attachments with deferred mode support
 */
export async function serializeAttachments(
  attachments: InboundEmailAttachment[] | undefined,
  mailgunStorage?: MailgunStorageInfo
): Promise<SerializedAttachment[]> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const serialized: SerializedAttachment[] = [];
  let totalSize = 0;
  let inlineCount = 0;
  let deferredCount = 0;

  for (const attachment of attachments) {
    const result = await serializeAttachment(attachment, mailgunStorage);
    if (result) {
      if (
        result.mode === 'inline' &&
        totalSize + result.sizeBytes > EMAIL_QUEUE_CONFIG.MAX_TOTAL_ATTACHMENTS_SIZE_BYTES
      ) {
        logger.warn('Total attachments size exceeded, skipping remaining', {
          currentTotal: totalSize,
          maxTotal: EMAIL_QUEUE_CONFIG.MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
          skippedFilename: result.filename,
        });
        break;
      }

      serialized.push(result);

      if (result.mode === 'inline') {
        totalSize += result.sizeBytes;
        inlineCount++;
      } else {
        deferredCount++;
      }
    }
  }

  if (serialized.length > 0) {
    logger.info('Attachments serialized', {
      total: serialized.length,
      inlineCount,
      deferredCount,
      totalInlineSize: totalSize,
    });
  }

  return serialized;
}

// ============================================================================
// DESERIALIZE (Queue → Worker)
// ============================================================================

/**
 * Fetch deferred attachment from Mailgun Storage API
 */
async function fetchDeferredAttachment(
  storageUrl: string,
  filename: string
): Promise<InboundAttachmentDownload | null> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      logger.error('MAILGUN_API_KEY not configured for deferred attachment download', {
        filename,
      });
      return null;
    }

    const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');

    logger.info('Fetching deferred attachment from Mailgun Storage', {
      filename,
      storageUrl: storageUrl.substring(0, 80) + '...',
    });

    const response = await fetch(storageUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'message/rfc2822',
      },
    });

    if (!response.ok) {
      logger.error('Failed to fetch from Mailgun Storage', {
        filename,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    logger.info('Deferred attachment fetched successfully', {
      filename,
      sizeBytes: buffer.length,
      contentType,
    });

    return { buffer, contentType };
  } catch (error) {
    logger.error('Error fetching deferred attachment', {
      filename,
      error: getErrorMessage(error),
    });
    return null;
  }
}

/**
 * Convert serialized attachment back to InboundEmailAttachment
 * Supports both inline (pre-downloaded) and deferred (fetch later) modes.
 */
export function deserializeAttachment(serialized: SerializedAttachment): InboundEmailAttachment {
  return {
    filename: serialized.filename,
    contentType: serialized.contentType,
    sizeBytes: serialized.sizeBytes,
    download: async (): Promise<InboundAttachmentDownload | null> => {
      if (serialized.mode === 'deferred' && serialized.storageUrl) {
        return fetchDeferredAttachment(serialized.storageUrl, serialized.filename);
      }

      if (serialized.base64Content) {
        return {
          buffer: Buffer.from(serialized.base64Content, 'base64'),
          contentType: serialized.contentType,
        };
      }

      logger.warn('Attachment has no content (neither inline nor deferred)', {
        filename: serialized.filename,
        mode: serialized.mode,
      });
      return null;
    },
  };
}
