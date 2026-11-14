/**
 * ADR-915 §40.7 Φ2 — το αίτημα στο μητρώο: διακόπτης, φρουρός αριθμού, ονομασμένες αποτυχίες. Κανένα δίκτυο.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lookupEnergyInspector, type BuildingcertTransport } from '../buildingcert.client';

const FOUND = readFileSync(join(__dirname, 'fixtures', 'buildingcert-found.html'), 'utf-8');

function transport(respond: () => Promise<Response>, enabled = true): BuildingcertTransport & { calls: jest.Mock } {
  const calls = jest.fn(respond);
  return { fetchImpl: calls as unknown as typeof fetch, enabled: () => enabled, calls };
}

describe('Δ — ο διακόπτης', () => {
  it('Δ1 κλειστός ⇒ unavailable/disabled και ΚΑΜΙΑ κλήση δικτύου', async () => {
    const t = transport(async () => new Response(FOUND), false);
    expect(await lookupEnergyInspector('2600', t)).toEqual({ kind: 'unavailable', reason: 'disabled' });
    expect(t.calls).not.toHaveBeenCalled();
  });
});

describe('Ρ — το αίτημα', () => {
  it('Ρ1 POST της δημόσιας φόρμας με ΜΟΝΟ τον αριθμό', async () => {
    const t = transport(async () => new Response(FOUND, { status: 200 }));
    expect(await lookupEnergyInspector(' 2600 ', t)).toMatchObject({ kind: 'found', row: { number: '2600' } });
    const [url, init] = t.calls.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('buildingcert.gr/inspectors/searchRequests.view');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('search_ministry_code=2600');
    expect(String(init.body)).toContain('search_last_name=&');
  });

  it('Ρ2 αριθμός που δεν είναι ψηφία ⇒ absent χωρίς κλήση', async () => {
    const t = transport(async () => new Response(FOUND));
    expect(await lookupEnergyInspector('26ΟΟ', t)).toEqual({ kind: 'absent' });
    expect(t.calls).not.toHaveBeenCalled();
  });
});

describe('Α — αποτυχίες με όνομα', () => {
  it('Α1 5xx ⇒ unavailable/server', async () => {
    expect(await lookupEnergyInspector('2600', transport(async () => new Response('x', { status: 503 })))).toEqual({
      kind: 'unavailable',
      reason: 'server',
    });
  });

  it('Α2 δίκτυο/timeout ⇒ unavailable/network', async () => {
    expect(await lookupEnergyInspector('2600', transport(async () => { throw new Error('ECONNRESET'); }))).toEqual({
      kind: 'unavailable',
      reason: 'network',
    });
  });
});
