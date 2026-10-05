/**
 * @jest-environment node
 *
 * ADR-905 §6 — the CDC relay: what it sends, when it stays silent, and which failures it retries.
 */

import { relayDependencyWrite, type RelayDeps } from '../dependency-relay';
import { INTERNAL_WEBHOOK_SIGNATURE_HEADER, judgeInternalWebhook } from '../../generated/lib/webhooks/internal-webhook-signature';

const SECRET = 'k'.repeat(64);
const NOW = 1_800_000_000;

interface Sent {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

function harness(status: number) {
  const sent: Sent[] = [];
  const logs: string[] = [];
  const deps: RelayDeps = {
    secret: () => SECRET,
    baseUrl: () => 'https://app.example/',
    send: async (url, init) => {
      sent.push({ url, headers: init.headers, body: init.body });
      return { status };
    },
    nowSeconds: () => NOW,
    log: (_level, message) => logs.push(message),
  };
  return { sent, logs, deps };
}

const snap = (data: Record<string, unknown> | undefined) => ({ exists: data !== undefined, data: () => data });
const context = { eventId: 'evt-1', timestamp: new Date(NOW * 1000).toISOString(), params: { docId: 'file_1' } };
const change = (before?: Record<string, unknown>, after?: Record<string, unknown>) => ({ before: snap(before), after: snap(after) });

describe('relayDependencyWrite', () => {
  it('sends a signed event with Idempotency-Key = eventId, to the one receiver path', async () => {
    const h = harness(200);
    const at = new Date('2026-10-04T10:00:00.000Z');
    await relayDependencyWrite('file', change(undefined, { companyId: 'c1', updatedAt: { toDate: () => at } }), context, h.deps);
    expect(h.sent).toHaveLength(1);
    const [request] = h.sent;
    expect(request.url).toBe('https://app.example/api/internal/conveyance/dependency-changed');
    expect(request.headers['Idempotency-Key']).toBe('evt-1');
    expect(JSON.parse(request.body)).toEqual({
      eventId: 'evt-1', source: 'file', docId: 'file_1', before: null, after: { companyId: 'c1', updatedAt: at.toISOString() },
    });
    const verdict = judgeInternalWebhook(request.headers[INTERNAL_WEBHOOK_SIGNATURE_HEADER], request.body, { secrets: [SECRET], nowSeconds: NOW });
    expect(verdict).toEqual({ valid: true });
  });

  it('carries BOTH states — the receiver needs "before" to tell who LOST a file', async () => {
    const h = harness(200);
    await relayDependencyWrite('file', change({ companyId: 'c1', v: 1 }, { companyId: 'c1', v: 2 }), context, h.deps);
    const body = JSON.parse(h.sent[0].body);
    expect(body.before).toEqual({ companyId: 'c1', v: 1 });
    expect(body.after).toEqual({ companyId: 'c1', v: 2 });
  });

  it('stays silent for a document with no tenant (no case can depend on it)', async () => {
    const h = harness(200);
    await relayDependencyWrite('file', change(undefined, { userId: 'u1' }), context, h.deps);
    expect(h.sent).toHaveLength(0);
  });

  it('relays a deletion (tenant only in "before")', async () => {
    const h = harness(200);
    await relayDependencyWrite('property', change({ companyId: 'c1' }, undefined), context, h.deps);
    expect(JSON.parse(h.sent[0].body)).toMatchObject({ source: 'property', before: { companyId: 'c1' }, after: null });
  });

  it('5xx ⇒ throws (Firebase retries)', async () => {
    const h = harness(503);
    await expect(relayDependencyWrite('file', change(undefined, { companyId: 'c1' }), context, h.deps)).rejects.toThrow('503');
  });

  it('4xx ⇒ logs and returns (a bad signature does not heal by retrying)', async () => {
    const h = harness(401);
    await expect(relayDependencyWrite('file', change(undefined, { companyId: 'c1' }), context, h.deps)).resolves.toBeUndefined();
    expect(h.logs).toEqual([expect.stringContaining('not retrying')]);
  });

  it.each([408, 425, 429])('%i ⇒ throws — "not now" is not "no" (the rate limit is backpressure, not loss)', async (status) => {
    const h = harness(status);
    await expect(relayDependencyWrite('file', change(undefined, { companyId: 'c1' }), context, h.deps)).rejects.toThrow(String(status));
    expect(h.logs).toEqual([]);
  });

  it('an event older than the receiver idempotency window is dropped WITHOUT sending (end condition)', async () => {
    const h = harness(503);
    const stale = { ...context, timestamp: new Date((NOW - 24 * 60 * 60 - 1) * 1000).toISOString() };
    await expect(relayDependencyWrite('file', change(undefined, { companyId: 'c1' }), stale, h.deps)).resolves.toBeUndefined();
    expect(h.sent).toHaveLength(0);
    expect(h.logs).toEqual([expect.stringContaining('expired')]);
  });

  it('a retry inside the window is still sent', async () => {
    const h = harness(200);
    const retried = { ...context, timestamp: new Date((NOW - 60 * 60) * 1000).toISOString() };
    await relayDependencyWrite('file', change(undefined, { companyId: 'c1' }), retried, h.deps);
    expect(h.sent).toHaveLength(1);
  });

  it('network failure ⇒ throws (retry)', async () => {
    const h = harness(200);
    const deps: RelayDeps = { ...h.deps, send: async () => { throw new Error('ECONNRESET'); } };
    await expect(relayDependencyWrite('file', change(undefined, { companyId: 'c1' }), context, deps)).rejects.toThrow('ECONNRESET');
  });
});
