import 'server-only';

/**
 * @fileoverview **ΤΑ ΣΧΗΜΑΤΑ ΕΙΣΟΔΟΥ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΤΟΥ ΔΙΚΤΥΟΥ** — ό,τι φέρνει ο πελάτης, ελεγμένο
 * **πριν** φτάσει σε γραφέα.
 * @related ADR-867 Β5 · `network-door.ts`
 * @module app/api/network/_shared/network-params
 *
 * ⚠️ **Τα όρια ζουν ΣΤΟΥΣ ΓΡΑΦΕΙΣ, όχι εδώ**: το μήκος μηνύματος το κρίνει ο γραφέας
 * (`MAX_NETWORK_MESSAGE_CHARS` → `too-long`), ώστε ο κανόνας να είναι **ένας** για κάθε δρόμο που
 * στέλνει. Εδώ ελέγχεται μόνο το **σχήμα** — και ένα ανώτατο φράγμα ασφαλείας στο μέγεθος του
 * σώματος, πολύ πάνω από το όριο του γραφέα, ώστε ένα τεράστιο σώμα να μη φτάσει καν στη μνήμη.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ErrorResponse } from '@/lib/auth/api-denial';

import { ACT_TEAM_CHANGE_KINDS } from '@/services/network-messaging/act-team-change';
import {
  NETWORK_THREAD_PAGE_MAX,
  NETWORK_THREAD_PAGE_SIZE,
} from '@/services/network-messaging/thread-directory';
import { MAX_NETWORK_MESSAGE_CHARS } from '@/services/network-messaging/thread-messages';

import { networkBadRequest } from './network-door';

/** Ένα βήμα εισόδου: η τιμή, **ή** η έτοιμη απάντηση 400 — ποτέ και τα δύο. */
export type NetworkInputStep<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: NextResponse<ErrorResponse> };

/** Η παράμετρος διαδρομής **υποχρεωτικά** — ή 400 με το όνομά της. */
export async function requireRouteParam<K extends string>(
  routeContext: { readonly params: Promise<Record<K, string>> } | undefined,
  key: K,
): Promise<NetworkInputStep<string>> {
  const value = await routeParam(routeContext, key);
  return value === null ? { ok: false, response: networkBadRequest({ [key]: 'invalid' }) } : { ok: true, value };
}

/** Νήμα **και** σώμα — το προοίμιο κάθε πράξης που γράφει σε νήμα. */
export async function threadInput<T>(
  request: NextRequest,
  routeContext: { readonly params: Promise<{ threadId: string }> } | undefined,
  schema: z.ZodType<T>,
): Promise<NetworkInputStep<{ readonly threadId: string; readonly body: T }>> {
  const threadId = await requireRouteParam(routeContext, 'threadId');
  if (!threadId.ok) return threadId;
  const body = await readNetworkBody(request, schema);
  return body.ok ? { ok: true, value: { threadId: threadId.value, body: body.value } } : body;
}

/**
 * **Το σώμα του αιτήματος, ελεγμένο** — ή η απάντηση 400. Χαλασμένο JSON και λάθος σχήμα δίνουν
 * την **ίδια** μορφή άρνησης (`invalid-request`), ώστε η οθόνη να έχει **έναν** δρόμο σφάλματος.
 */
export async function readNetworkBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
): Promise<NetworkInputStep<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: networkBadRequest({ body: 'not-json' }) };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, response: networkBadRequest({ issues: parsed.error.issues }) };
}

/**
 * Αναγνωριστικό εγγράφου σε διαδρομή — **ποτέ** `/` (θα άλλαζε το μονοπάτι του εγγράφου).
 * ⚠️ Δεν ελέγχεται πρόθεμα: ένα λάθος id απαντά «δεν υπάρχει» από τον γραφέα, **ίδια** απάντηση
 * με το ξένο — ώστε το σχήμα να μην προδίδει τίποτα.
 */
export const DocumentIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

/** Η παράμετρος διαδρομής — `null` ⇒ η πόρτα απαντά 400. */
export async function routeParam<K extends string>(
  routeContext: { readonly params: Promise<Record<K, string>> } | undefined,
  key: K,
): Promise<string | null> {
  const params = await routeContext?.params;
  const parsed = DocumentIdSchema.safeParse(params?.[key]);
  return parsed.success ? parsed.data : null;
}

/** `GET /api/network/threads?limit=&cursor=` */
export const ThreadListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(NETWORK_THREAD_PAGE_MAX).default(NETWORK_THREAD_PAGE_SIZE),
  cursor: z.string().min(1).max(512).optional(),
});

/** `POST …/messages` — το φράγμα είναι **διπλάσιο** του ορίου του γραφέα, επίτηδες (κεφαλίδα). */
export const SendMessageBodySchema = z.object({
  text: z.string().max(MAX_NETWORK_MESSAGE_CHARS * 2),
});

/** `PUT …/mute` */
export const MuteBodySchema = z.object({ muted: z.boolean() });

/**
 * `PUT /api/network/away` — έναρξη **προαιρετική** (απούσα ⇒ «από τώρα»), λήξη υποχρεωτική.
 * ⚠️ **Κανένα πεδίο κειμένου**, επίτηδες (ΓΚΠΔ ελαχιστοποίηση — δες `network-away.ts`).
 */
export const AwayBodySchema = z.object({
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }),
}).strict();

/** `PATCH /api/network/act-teams/{teamId}` — η αλλαγή **και** η έκδοση που είδε ο άνθρωπος. */
export const ActTeamChangeBodySchema = z.object({
  change: z.object({
    kind: z.enum(ACT_TEAM_CHANGE_KINDS),
    uid: DocumentIdSchema,
  }),
  expectedVersion: z.number().int().min(1),
});
