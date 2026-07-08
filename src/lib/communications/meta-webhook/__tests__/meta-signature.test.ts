/**
 * Tests for the shared Meta webhook signature verification SSoT (ADR-586).
 * Security-critical: this gate protects every Meta webhook (IG/Messenger/WhatsApp).
 */

import { createHmac } from 'crypto';
import type { Logger } from '@/lib/telemetry';
import { verifyMetaWebhookSignature } from '../meta-signature';

function makeLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;
}

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyMetaWebhookSignature', () => {
  const ORIGINAL_SECRET = process.env.META_APP_SECRET;

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.META_APP_SECRET;
    } else {
      process.env.META_APP_SECRET = ORIGINAL_SECRET;
    }
  });

  it('allows (dev fallback) with a warning when META_APP_SECRET is not configured', () => {
    delete process.env.META_APP_SECRET;
    const logger = makeLogger();

    expect(verifyMetaWebhookSignature('{"a":1}', null, logger)).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rejects when the signature header is missing but a secret is configured', () => {
    process.env.META_APP_SECRET = 'top-secret';
    const logger = makeLogger();

    expect(verifyMetaWebhookSignature('{"a":1}', null, logger)).toBe(false);
  });

  it('accepts a correctly computed HMAC-SHA256 signature', () => {
    process.env.META_APP_SECRET = 'top-secret';
    const body = '{"object":"whatsapp_business_account"}';
    const logger = makeLogger();

    expect(verifyMetaWebhookSignature(body, sign(body, 'top-secret'), logger)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    process.env.META_APP_SECRET = 'top-secret';
    const body = '{"object":"whatsapp_business_account"}';
    const logger = makeLogger();

    expect(verifyMetaWebhookSignature(body, sign(body, 'wrong-secret'), logger)).toBe(false);
  });

  it('rejects a signature of mismatched length (avoids timingSafeEqual throw)', () => {
    process.env.META_APP_SECRET = 'top-secret';
    const logger = makeLogger();

    expect(verifyMetaWebhookSignature('{"a":1}', 'sha256=short', logger)).toBe(false);
  });

  it('rejects when the body is tampered after signing', () => {
    process.env.META_APP_SECRET = 'top-secret';
    const signature = sign('{"amount":1}', 'top-secret');
    const logger = makeLogger();

    expect(verifyMetaWebhookSignature('{"amount":9999}', signature, logger)).toBe(false);
  });
});
