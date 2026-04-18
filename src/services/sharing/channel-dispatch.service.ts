/**
 * =============================================================================
 * CHANNEL DISPATCH SERVICE — SSoT (ADR-315 Phase M3)
 * =============================================================================
 *
 * Single entry point for outbound share dispatches across channels
 * (email / telegram / whatsapp / messenger / instagram). Decouples "who
 * created a shareable token" from "who sent the token through which channel".
 *
 * Writes one record per dispatch into `share_dispatches` (audit log), then
 * delegates the actual send to the existing outbound API routes:
 *   - `/api/communications/email/property-share` (email)
 *   - `/api/communications/share-to-channel` (social)
 *
 * Both `shareId` / `token` and `payload` are optional — this service supports
 * two flows:
 *   1. Send with a persistent link (shareId + token set).
 *   2. Send without a link (direct email/message with photos; photo_shares
 *      legacy path). Dispatch log is written either way for audit.
 *
 * @module services/sharing/channel-dispatch.service
 * @ssot channel-dispatch-service
 * @see adrs/ADR-315-unified-sharing.md §4.2-4.3
 */

import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generateDispatchId } from '@/services/enterprise-id-convenience';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  ShareDispatchChannel,
  ShareDispatchStatus,
} from '@/types/sharing';

const logger = createModuleLogger('ChannelDispatchService');

// ============================================================================
// INPUTS
// ============================================================================

export interface ChannelDispatchInput {
  channel: ShareDispatchChannel;
  /** External recipient identifier — email / phone / psid / chatId / igsid. */
  externalUserId: string;
  companyId: string;
  createdBy: string;
  /** Optional — set when dispatching an existing unified share token. */
  shareId?: string;
  token?: string;
  /** Optional — set when dispatching to a known CRM contact. */
  contactId?: string;
  /** Content to deliver. Subject only relevant for email. */
  payload: {
    subject?: string;
    body?: string;
    photoUrls?: string[];
  };
  /** When omitted for email/social, a URL built from `token` is appended. */
  appendShareUrl?: boolean;
  /** When true, skip calling the outbound API (dry-run for testing). */
  auditOnly?: boolean;
}

export interface ChannelDispatchResult {
  dispatchId: string;
  status: ShareDispatchStatus;
  errorCode?: string;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

async function writeDispatchLog(
  dispatchId: string,
  input: ChannelDispatchInput,
  status: ShareDispatchStatus,
  errorCode?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    companyId: input.companyId,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    channel: input.channel,
    externalUserId: input.externalUserId,
    contactId: input.contactId ?? null,
    shareId: input.shareId ?? null,
    token: input.token ?? null,
    payload: {
      subject: input.payload.subject ?? null,
      body: input.payload.body ?? null,
      photoUrls: input.payload.photoUrls ?? null,
    },
    status,
    errorCode: errorCode ?? null,
  };
  await setDoc(doc(db, COLLECTIONS.SHARE_DISPATCHES, dispatchId), payload);
}

async function markDispatchStatus(
  dispatchId: string,
  status: ShareDispatchStatus,
  errorCode?: string,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.SHARE_DISPATCHES, dispatchId);
  await updateDoc(ref, {
    status,
    errorCode: errorCode ?? null,
  });
}

// ============================================================================
// CHANNEL-SPECIFIC OUTBOUND CALLS
// ============================================================================

interface SharePropertyEmailRequest {
  recipients: string[];
  subject?: string;
  message?: string;
  photoUrls?: string[];
  shareUrl?: string;
}

interface ShareToChannelRequest {
  channel: ShareDispatchChannel;
  externalUserId: string;
  contactId?: string;
  message: string;
  shareUrl?: string;
  photoUrls?: string[];
}

async function dispatchEmail(input: ChannelDispatchInput): Promise<void> {
  const body = [input.payload.body, buildShareUrl(input)]
    .filter(Boolean)
    .join('\n\n');
  const request: SharePropertyEmailRequest = {
    recipients: [input.externalUserId],
    subject: input.payload.subject,
    message: body,
    photoUrls: input.payload.photoUrls,
    shareUrl: buildShareUrl(input) ?? undefined,
  };
  await apiClient.post(API_ROUTES.COMMUNICATIONS.EMAIL_PROPERTY_SHARE, request);
}

async function dispatchSocial(input: ChannelDispatchInput): Promise<void> {
  const message = [input.payload.body, buildShareUrl(input)]
    .filter(Boolean)
    .join('\n\n');
  const request: ShareToChannelRequest = {
    channel: input.channel,
    externalUserId: input.externalUserId,
    contactId: input.contactId,
    message,
    shareUrl: buildShareUrl(input) ?? undefined,
    photoUrls: input.payload.photoUrls,
  };
  await apiClient.post(API_ROUTES.COMMUNICATIONS.SHARE_TO_CHANNEL, request);
}

function buildShareUrl(input: ChannelDispatchInput): string | null {
  if (input.appendShareUrl === false) return null;
  if (!input.token) return null;
  if (typeof window === 'undefined') return null;
  return `${window.location.origin}/shared/${input.token}`;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ChannelDispatchService {
  /**
   * Send a share via the selected channel and record an audit log entry.
   * Always writes to `share_dispatches`, regardless of success/failure, so
   * retries and incident investigations have a paper trail.
   */
  static async sendViaChannel(
    input: ChannelDispatchInput,
  ): Promise<ChannelDispatchResult> {
    const dispatchId = generateDispatchId();
    await writeDispatchLog(dispatchId, input, 'queued');

    if (input.auditOnly) {
      await markDispatchStatus(dispatchId, 'sent');
      return { dispatchId, status: 'sent' };
    }

    try {
      if (input.channel === 'email') {
        await dispatchEmail(input);
      } else {
        await dispatchSocial(input);
      }
      await markDispatchStatus(dispatchId, 'sent');
      logger.info('Channel dispatch sent', {
        dispatchId,
        channel: input.channel,
        hasShareId: !!input.shareId,
      });
      return { dispatchId, status: 'sent' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'dispatch_failed';
      await markDispatchStatus(dispatchId, 'failed', message);
      logger.error('Channel dispatch failed', {
        dispatchId,
        channel: input.channel,
        error: message,
      });
      return { dispatchId, status: 'failed', errorCode: message };
    }
  }
}
