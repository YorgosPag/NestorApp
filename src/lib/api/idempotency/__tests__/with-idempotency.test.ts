/**
 * @jest-environment node
 *
 * ADR-853 Ε3 Φάση 2 — ΑΓΚΥΡΕΣ του **συνόρου ιδεμποτίας**: μία εκτέλεση ανά `Idempotency-Key`.
 *
 *   Ι1  πρώτη φορά εκτελεί· η επανάληψη ΑΝΑΠΑΡΑΓΕΙ (ίδιο status/σώμα, `Idempotent-Replayed`) — χωρίς εκτέλεση
 *   Ι2  τρία αιτήματα με το ίδιο κλειδί ⇒ ο handler τρέχει ΑΚΡΙΒΩΣ μία φορά
 *   Ι3  όσο τρέχει η πρώτη ⇒ 409 IN_FLIGHT + Retry-After
 *   Ι4  ίδιο κλειδί, άλλο σώμα ⇒ 422 KEY_REUSED
 *   Ι5  ο handler ΕΠΕΣΤΡΕΨΕ 503 ⇒ το κλειδί ελευθερώνεται και η επόμενη εκτελεί
 *   Ι6  ο handler ΕΣΚΑΣΕ ⇒ το 500 αποθηκεύεται και αναπαράγεται (Stripe) — ποτέ δεύτερη εκτέλεση
 *   Ι7  🏆 κλείδωμα πέρα από το lease ⇒ 409 OUTCOME_UNKNOWN, ποτέ σιωπηλή δεύτερη εκτέλεση
 *   Ι8  απάντηση μη-JSON ⇒ η επανάληψη παίρνει 409 REPLAY_UNAVAILABLE
 *   Ι9  χωρίς κεφαλίδα · GET · `natural` · ωμή ροή ⇒ διέλευση, ΚΑΜΙΑ εγγραφή
 *   Ι10 δύο άνθρωποι με το ίδιο κλειδί ⇒ ανεξάρτητοι
 *   Ι11 άκυρο κλειδί ⇒ 400 · ληγμένη εγγραφή ⇒ νέα εκτέλεση · αποθήκη εκτός ⇒ 503 χωρίς εκτέλεση
 *
 * ADR-909 Β2.0 — το σύνορο **μαθαίνει multipart** (αποτύπωμα πάνω στα ΜΕΡΗ, όχι στο ωμό σώμα):
 *
 *   Μ1  ίδια μέρη, ΑΛΛΟ boundary ⇒ αναπαραγωγή, ο handler τρέχει μία φορά
 *   Μ2  ίδιο κλειδί, άλλα BYTES αρχείου ⇒ 422 KEY_REUSED
 *   Μ3  ίδιο κλειδί, άλλο πεδίο κειμένου ⇒ 422 KEY_REUSED
 *   Μ4  άλλη σειρά μερών · άλλο όνομα αρχείου ⇒ η ΙΔΙΑ πράξη
 *   Μ5  multipart που δεν διαβάζεται ⇒ 400 BODY_UNREADABLE, ΠΟΤΕ εκτέλεση χωρίς σύνορο
 *   Μ6  ο handler διαβάζει το σώμα του ΑΝΕΓΓΙΧΤΟ μετά το αποτύπωμα
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import {
  IDEMPOTENCY_ERROR,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_LEASE_MS,
  IDEMPOTENCY_TTL_MS,
  IDEMPOTENT_REPLAYED_HEADER,
} from '../idempotency-contract';
import { runIdempotently, type IdempotencyDeps, type IdempotentExecution } from '../with-idempotency';

const T0 = Date.UTC(2026, 8, 22, 10, 0, 0);
const RECORDS = COLLECTIONS.IDEMPOTENCY_RECORDS;

function world(now = T0): { fake: FakeFirestore; deps: IdempotencyDeps; clock: { now: number } } {
  const fake = new FakeFirestore();
  const clock = { now };
  return { fake, clock, deps: { db: () => fake as unknown as Firestore, now: () => clock.now } };
}

function post(body: unknown, key: string | null = 'key-1', extra: Record<string, string> = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extra };
  if (key !== null) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return new NextRequest('https://nestorconstruct.gr/api/things?x=1', { method: 'POST', headers, body: JSON.stringify(body) });
}

/** Ένας handler που μετρά πόσες φορές έτρεξε. */
function handler(response: () => NextResponse = () => NextResponse.json({ success: true, data: { n: 1 } }, { status: 201 }), thrown = false) {
  const calls = { count: 0 };
  const execute = async (): Promise<IdempotentExecution> => {
    calls.count += 1;
    return { response: response(), thrown };
  };
  return { calls, execute };
}

const bodyOf = async (response: NextResponse): Promise<unknown> => JSON.parse(await response.text());

describe('Ι — μία εκτέλεση ανά κλειδί', () => {
  it('Ι1 η επανάληψη ΑΝΑΠΑΡΑΓΕΙ την απάντηση χωρίς να εκτελέσει', async () => {
    const { deps } = world();
    const { calls, execute } = handler();
    const first = await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    const again = await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.headers.get(IDEMPOTENT_REPLAYED_HEADER)).toBe('true');
    expect(await bodyOf(again)).toStrictEqual({ success: true, data: { n: 1 } });
    expect(calls.count).toBe(1);
  });

  it('Ι2 τρία αιτήματα με το ίδιο κλειδί ⇒ ο handler τρέχει ΑΚΡΙΒΩΣ μία φορά', async () => {
    const { deps } = world();
    const { calls, execute } = handler();
    for (let i = 0; i < 3; i += 1) await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(calls.count).toBe(1);
  });

  it('Ι3 όσο τρέχει η πρώτη ⇒ 409 IN_FLIGHT με Retry-After, χωρίς εκτέλεση', async () => {
    const { deps } = world();
    let concurrent: NextResponse | null = null;
    const inner = handler();
    const execute = async (): Promise<IdempotentExecution> => {
      concurrent = await runIdempotently(post({ a: 1 }), 'user_a', undefined, inner.execute, deps);
      return { response: NextResponse.json({ success: true, data: {} }), thrown: false };
    };
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(concurrent).not.toBeNull();
    const busy = concurrent as unknown as NextResponse;
    expect(busy.status).toBe(409);
    expect(busy.headers.get('retry-after')).not.toBeNull();
    expect(await bodyOf(busy)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.IN_FLIGHT });
    expect(inner.calls.count).toBe(0);
  });

  it('Ι4 ίδιο κλειδί, ΑΛΛΟ σώμα ⇒ 422 KEY_REUSED χωρίς εκτέλεση', async () => {
    const { deps } = world();
    const { calls, execute } = handler();
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    const reused = await runIdempotently(post({ a: 2 }), 'user_a', undefined, execute, deps);
    expect(reused.status).toBe(422);
    expect(await bodyOf(reused)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.KEY_REUSED });
    expect(calls.count).toBe(1);
  });
});

describe('Ε — η έκβαση της πρώτης εκτέλεσης', () => {
  it('Ι5 ο handler ΕΠΕΣΤΡΕΨΕ 503 ⇒ το κλειδί ελευθερώνεται, η επόμενη ΕΚΤΕΛΕΙ', async () => {
    const { deps, fake } = world();
    const unavailable = handler(() => NextResponse.json({ error: 'later' }, { status: 503 }));
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, unavailable.execute, deps);
    expect(fake.all(RECORDS)).toHaveLength(0);
    const ok = handler();
    const second = await runIdempotently(post({ a: 1 }), 'user_a', undefined, ok.execute, deps);
    expect(second.status).toBe(201);
    expect(ok.calls.count).toBe(1);
  });

  it('Ι6 ο handler ΕΣΚΑΣΕ ⇒ το 500 αποθηκεύεται και αναπαράγεται — ποτέ δεύτερη εκτέλεση', async () => {
    const { deps } = world();
    const { calls, execute } = handler(() => NextResponse.json({ error: 'boom' }, { status: 500 }), true);
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    const again = await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(again.status).toBe(500);
    expect(again.headers.get(IDEMPOTENT_REPLAYED_HEADER)).toBe('true');
    expect(calls.count).toBe(1);
  });

  it('Ι6β ακόμη και 503 που προήλθε από ΕΚΡΗΞΗ αποθηκεύεται (μπορεί να είχε γράψει)', async () => {
    const { deps, fake } = world();
    const { execute } = handler(() => NextResponse.json({ error: 'x' }, { status: 503 }), true);
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(fake.all(RECORDS)).toHaveLength(1);
  });

  it('Ι7 🏆 κλείδωμα πέρα από το lease ⇒ OUTCOME_UNKNOWN, ΠΟΤΕ σιωπηλή δεύτερη εκτέλεση', async () => {
    const { deps, clock } = world();
    const hung = async (): Promise<IdempotentExecution> => {
      clock.now += IDEMPOTENCY_LEASE_MS + 1;
      const late = handler();
      const retry = await runIdempotently(post({ a: 1 }), 'user_a', undefined, late.execute, deps);
      expect(retry.status).toBe(409);
      expect(await bodyOf(retry)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.OUTCOME_UNKNOWN });
      expect(late.calls.count).toBe(0);
      return { response: NextResponse.json({ success: true, data: {} }), thrown: false };
    };
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, hung, deps);
  });

  it('Ι8 απάντηση μη-JSON ⇒ η επανάληψη παίρνει REPLAY_UNAVAILABLE, χωρίς εκτέλεση', async () => {
    const { deps } = world();
    const { calls, execute } = handler(() => new NextResponse('csv,data', { headers: { 'content-type': 'text/csv' } }));
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    const again = await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(again.status).toBe(409);
    expect(await bodyOf(again)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.REPLAY_UNAVAILABLE });
    expect(calls.count).toBe(1);
  });
});

describe('Δ — πότε το σύνορο ΔΕΝ εφαρμόζεται', () => {
  const passThrough = async (request: NextRequest, natural = false) => {
    const { deps, fake } = world();
    const { calls, execute } = handler();
    const policy = natural ? { mode: 'natural' as const, why: 'set boolean' } : undefined;
    await runIdempotently(request, 'user_a', policy, execute, deps);
    await runIdempotently(request.clone(), 'user_a', policy, execute, deps);
    return { runs: calls.count, records: fake.all(RECORDS).length };
  };

  it('Ι9α χωρίς κεφαλίδα ⇒ κάθε αίτημα εκτελείται, καμία εγγραφή', async () => {
    expect(await passThrough(post({ a: 1 }, null))).toStrictEqual({ runs: 2, records: 0 });
  });

  it('Ι9β GET με κεφαλίδα ⇒ διέλευση', async () => {
    const get = new NextRequest('https://nestorconstruct.gr/api/things', { headers: { [IDEMPOTENCY_KEY_HEADER]: 'k' } });
    expect(await passThrough(get)).toStrictEqual({ runs: 2, records: 0 });
  });

  it('Ι9γ `natural` ⇒ διέλευση χωρίς κόστος αποθήκης', async () => {
    expect(await passThrough(post({ a: 1 }), true)).toStrictEqual({ runs: 2, records: 0 });
  });

  it('Ι9δ ωμή ροή (`octet-stream`) ⇒ διέλευση (δεν ορίζεται αποτύπωμα πάνω σε ροή)', async () => {
    const upload = new NextRequest('https://nestorconstruct.gr/api/upload', {
      method: 'POST', headers: { [IDEMPOTENCY_KEY_HEADER]: 'k', 'content-type': 'application/octet-stream' }, body: 'bytes',
    });
    expect(await passThrough(upload)).toStrictEqual({ runs: 2, records: 0 });
  });
});

describe('Μ — multipart: το αποτύπωμα είναι των ΜΕΡΩΝ, όχι του ωμού σώματος', () => {
  const UPLOAD_URL = 'https://nestorconstruct.gr/api/properties/prop_1/floorplan';
  type Part = readonly [name: string, value: string | Blob, filename?: string];

  /** Κάθε κλήση χτίζει ΝΕΟ `FormData` ⇒ νέο τυχαίο boundary, όπως κάθε αίτηση του browser. */
  function upload(parts: readonly Part[], key = 'key-1'): NextRequest {
    const form = new FormData();
    for (const [name, value, filename] of parts) {
      if (typeof value === 'string') form.append(name, value);
      else form.append(name, value, filename ?? 'a.png');
    }
    return new NextRequest(UPLOAD_URL, { method: 'POST', headers: { [IDEMPOTENCY_KEY_HEADER]: key }, body: form });
  }

  const png = (bytes: readonly number[]): Blob => new Blob([new Uint8Array(bytes)], { type: 'image/png' });
  const parts = (bytes: readonly number[], levelId = 'lvl_1'): readonly Part[] => [
    ['file', png(bytes)], ['levelId', levelId], ['recipe', '{"v":1}'],
  ];

  /** Πρώτη αποστολή των «κανονικών» μερών, και μετά μία δεύτερη — τι απάντησε, και πόσες φορές έτρεξε ο handler. */
  async function secondAfterFirst(second: NextRequest): Promise<{ response: NextResponse; runs: number }> {
    const { deps } = world();
    const { calls, execute } = handler();
    await runIdempotently(upload(parts([1, 2, 3])), 'user_a', undefined, execute, deps);
    const response = await runIdempotently(second, 'user_a', undefined, execute, deps);
    return { response, runs: calls.count };
  }

  it('Μ1 ίδια μέρη, ΑΛΛΟ boundary ⇒ αναπαραγωγή, ο handler τρέχει μία φορά', async () => {
    const again = upload(parts([1, 2, 3]));
    expect(again.headers.get('content-type')).not.toBe(upload(parts([1, 2, 3])).headers.get('content-type'));

    const { response, runs } = await secondAfterFirst(again);
    expect(runs).toBe(1);
    expect(response.status).toBe(201);
    expect(response.headers.get(IDEMPOTENT_REPLAYED_HEADER)).toBe('true');
  });

  it('Μ2 ίδιο κλειδί, άλλα BYTES αρχείου ⇒ 422 KEY_REUSED χωρίς εκτέλεση', async () => {
    const { response, runs } = await secondAfterFirst(upload(parts([1, 2, 4])));
    expect(response.status).toBe(422);
    expect(await bodyOf(response)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.KEY_REUSED });
    expect(runs).toBe(1);
  });

  it('Μ3 ίδιο κλειδί, άλλο πεδίο κειμένου ⇒ 422 KEY_REUSED', async () => {
    const { response, runs } = await secondAfterFirst(upload(parts([1, 2, 3], 'lvl_2')));
    expect(response.status).toBe(422);
    expect(runs).toBe(1);
  });

  it('Μ4 άλλη σειρά μερών · άλλο όνομα αρχείου ⇒ η ΙΔΙΑ πράξη', async () => {
    const shuffled = upload([['recipe', '{"v":1}'], ['levelId', 'lvl_1'], ['file', png([1, 2, 3]), 'renamed.png']]);
    const { response, runs } = await secondAfterFirst(shuffled);
    expect(response.headers.get(IDEMPOTENT_REPLAYED_HEADER)).toBe('true');
    expect(runs).toBe(1);
  });

  it('Μ5 multipart που δεν διαβάζεται ⇒ 400 BODY_UNREADABLE, ΠΟΤΕ εκτέλεση χωρίς σύνορο', async () => {
    const { deps, fake } = world();
    const { calls, execute } = handler();
    const broken = new NextRequest(UPLOAD_URL, {
      method: 'POST',
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1', 'content-type': 'multipart/form-data; boundary=x' },
      body: 'this is not a multipart body',
    });
    const refused = await runIdempotently(broken, 'user_a', undefined, execute, deps);

    expect(refused.status).toBe(400);
    expect(await bodyOf(refused)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.BODY_UNREADABLE });
    expect(calls.count).toBe(0);
    expect(fake.all(RECORDS)).toHaveLength(0);
  });

  it('Μ6 ο handler διαβάζει το σώμα του ΑΝΕΓΓΙΧΤΟ μετά το αποτύπωμα', async () => {
    const { deps } = world();
    const request = upload(parts([1, 2, 3]));
    const seen: string[] = [];
    await runIdempotently(request, 'user_a', undefined, async () => {
      seen.push(String((await request.formData()).get('levelId')));
      return { response: NextResponse.json({ success: true }), thrown: false };
    }, deps);

    expect(seen).toStrictEqual(['lvl_1']);
  });
});

describe('Σ — σύνορα του κλειδιού', () => {
  it('Ι10 δύο άνθρωποι με το ΙΔΙΟ κλειδί ⇒ ανεξάρτητοι', async () => {
    const { deps } = world();
    const { calls, execute } = handler();
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    const other = await runIdempotently(post({ a: 1 }), 'user_b', undefined, execute, deps);
    expect(other.headers.get(IDEMPOTENT_REPLAYED_HEADER)).toBeNull();
    expect(calls.count).toBe(2);
  });

  it('Ι11α άκυρο κλειδί (πάνω από 255 · κενό) ⇒ 400 χωρίς εκτέλεση', async () => {
    const { deps } = world();
    const { calls, execute } = handler();
    for (const key of ['k'.repeat(256), 'with space']) {
      const refused = await runIdempotently(post({ a: 1 }, key), 'user_a', undefined, execute, deps);
      expect(refused.status).toBe(400);
    }
    expect(calls.count).toBe(0);
  });

  it('Ι11β ληγμένη εγγραφή (η TTL δεν πρόλαβε) ⇒ νέα εκτέλεση', async () => {
    const { deps, clock } = world();
    const { calls, execute } = handler();
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    clock.now += IDEMPOTENCY_TTL_MS + 1;
    await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, deps);
    expect(calls.count).toBe(2);
  });

  it('Ι11γ αποθήκη εκτός ⇒ 503 STORE_UNAVAILABLE και ΚΑΜΙΑ εκτέλεση', async () => {
    const broken: IdempotencyDeps = { db: () => { throw new Error('UNAVAILABLE'); }, now: () => T0 };
    const { calls, execute } = handler();
    const refused = await runIdempotently(post({ a: 1 }), 'user_a', undefined, execute, broken);
    expect(refused.status).toBe(503);
    expect(await bodyOf(refused)).toMatchObject({ errorCode: IDEMPOTENCY_ERROR.STORE_UNAVAILABLE });
    expect(calls.count).toBe(0);
  });
});
