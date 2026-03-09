/**
 * =============================================================================
 * File Webhook API — Webhook notifications for document events
 * =============================================================================
 *
 * Registers and manages webhooks for document lifecycle events.
 * Subscribers receive POST notifications when files are created,
 * updated, deleted, approved, or shared.
 *
 * @module api/files/webhook
 * @enterprise ADR-191 Phase 5.4 — Webhook Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const maxDuration = 10;

// ============================================================================
// TYPES
// ============================================================================

interface WebhookRegistration {
  url: string;
  events: string[];
  secret: string;
  companyId: string;
  createdBy: string;
  active: boolean;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET — List registered webhooks for the authenticated user's company
 */
async function handleGet(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const snapshot = await adminDb
      .collection('file_webhooks')
      .where('createdBy', '==', ctx.uid)
      .get();

    const webhooks = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      secret: '***', // Never expose secrets
    }));

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('[Webhook API] GET error:', error);
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}

/**
 * POST — Register a new webhook
 */
async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { url, events, secret, companyId } = (await request.json()) as Partial<WebhookRegistration>;

    if (!url || !events || !secret || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: url, events, secret, companyId' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Valid event types
    const validEvents = [
      'file.created',
      'file.updated',
      'file.deleted',
      'file.approved',
      'file.rejected',
      'file.shared',
      'file.commented',
      'file.moved',
    ];

    const invalidEvents = events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(', ')}. Valid: ${validEvents.join(', ')}` },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection('file_webhooks').add({
      url,
      events,
      secret,
      companyId,
      createdBy: ctx.uid,
      active: true,
      createdAt: new Date(),
    });

    return NextResponse.json({
      id: docRef.id,
      message: 'Webhook registered',
    });
  } catch (error) {
    console.error('[Webhook API] POST error:', error);
    return NextResponse.json({ error: 'Failed to register webhook' }, { status: 500 });
  }
}

/**
 * DELETE — Deactivate a webhook
 */
async function handleDelete(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { webhookId } = await request.json();

    if (!webhookId) {
      return NextResponse.json({ error: 'Missing webhookId' }, { status: 400 });
    }

    const docRef = adminDb.collection('file_webhooks').doc(webhookId);
    const docSnap = await docRef.get();

    if (!docSnap.exists || docSnap.data()?.createdBy !== ctx.uid) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await docRef.update({ active: false });

    return NextResponse.json({ message: 'Webhook deactivated' });
  } catch (error) {
    console.error('[Webhook API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to deactivate webhook' }, { status: 500 });
  }
}

export const GET = withStandardRateLimit(withAuth(handleGet));
export const POST = withStandardRateLimit(withAuth(handlePost));
export const DELETE = withStandardRateLimit(withAuth(handleDelete));
