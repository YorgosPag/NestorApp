/**
 * @jest-environment node
 *
 * Tests for the shared Meta webhook GET verification SSoT (ADR-586).
 * The hub.challenge handshake is identical across IG/Messenger/WhatsApp.
 * Runs in the node environment so `next/server` (NextResponse) has the web
 * Request/Response globals it needs.
 */

import type { NextRequest } from 'next/server';
import type { Logger } from '@/lib/telemetry';
import { handleMetaWebhookGet } from '../meta-verification';

function makeLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;
}

function makeRequest(query: string): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
  } as unknown as NextRequest;
}

describe('handleMetaWebhookGet', () => {
  it('echoes the challenge with 200 when mode + token match', async () => {
    const req = makeRequest('hub.mode=subscribe&hub.verify_token=secret-token&hub.challenge=CHAL123');
    const res = handleMetaWebhookGet(req, {
      verifyToken: 'secret-token',
      platform: 'WhatsApp',
      logger: makeLogger(),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('CHAL123');
  });

  it('returns 403 when the verify token does not match', async () => {
    const req = makeRequest('hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=CHAL123');
    const res = handleMetaWebhookGet(req, {
      verifyToken: 'secret-token',
      platform: 'WhatsApp',
      logger: makeLogger(),
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not "subscribe"', () => {
    const req = makeRequest('hub.mode=unsubscribe&hub.verify_token=secret-token&hub.challenge=CHAL123');
    const res = handleMetaWebhookGet(req, {
      verifyToken: 'secret-token',
      platform: 'Instagram',
      logger: makeLogger(),
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 when the platform verify token is not configured (undefined)', () => {
    const req = makeRequest('hub.mode=subscribe&hub.verify_token=&hub.challenge=CHAL123');
    const res = handleMetaWebhookGet(req, {
      verifyToken: undefined,
      platform: 'Messenger',
      logger: makeLogger(),
    });

    expect(res.status).toBe(403);
  });
});
