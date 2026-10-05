/**
 * =============================================================================
 * CONVEYANCE DEPENDENCY RELAY — Firestore trigger → signed webhook → app (ADR-905 §6, Stage 3 CDC)
 * =============================================================================
 *
 * The conveyance case view depends on documents the case does NOT write: tenant files, the property, the project.
 * Only a trigger sees every writer of those. But the question "which view sees this change?" needs the CDE reach
 * judge, which is NOT projected here (ADR-874) — copying it would be a second engine. So this function is a
 * **relay**: it signs `{ eventId, source, docId, before, after }` and posts it to the app, where the SAME code that
 * builds the view decides who gets a signal and asks the ONE signal writer.
 *
 * - **No field filter here.** "Which fields matter" lives in the app (`evidenceOfFile` / `subjectViewFacts`);
 *   a list here would be a second, silently diverging answer. The receiver drops no-op writes for one query.
 * - **Delivery**: judged by the ONE projected dictionary (`judgeInternalWebhookDelivery`): 2xx done · final 4xx
 *   log + stop (a bad signature/payload does not heal by retrying) · 408/425/429/5xx/network → throw → Firebase
 *   retries (`failurePolicy`) — the receiver's rate limit is backpressure, not loss. The receiver dedupes by
 *   `Idempotency-Key` = `eventId`.
 * - **End condition**: an event older than the receiver's idempotency window is dropped instead of retried
 *   (gen1 would otherwise retry for 7 days).
 * - **Payload**: document metadata only — never bytes. Timestamps → ISO (`toWireDocument`, projected).
 *
 * @module functions/conveyance/dependency-relay
 * @enterprise ADR-905 §6 · ADR-874 (projection) · ADR-873 (runtime profiles)
 */

import * as functions from 'firebase-functions/v1';
import { defineSecret, defineString } from 'firebase-functions/params';

import { REACTIVE_TRIGGER_RUNTIME } from '../config/runtime';
import { COLLECTIONS } from '../config/firestore-collections';
import {
  CONVEYANCE_DEPENDENCY_WEBHOOK_PATH,
  toWireDocument,
  type DependencyChangeEvent,
  type DependencySource,
} from '../generated/lib/conveyance/dependency-change-event';
import {
  isInternalWebhookEventExpired,
  judgeInternalWebhookDelivery,
} from '../generated/lib/webhooks/internal-webhook-delivery';
import {
  INTERNAL_WEBHOOK_SIGNATURE_HEADER,
  signInternalWebhook,
} from '../generated/lib/webhooks/internal-webhook-signature';

/** Same value as the app's `INTERNAL_WEBHOOK_SECRET` (Netcup env). Secret Manager — never in config. */
const INTERNAL_WEBHOOK_SECRET = defineSecret('INTERNAL_WEBHOOK_SECRET');
/** The app origin, e.g. `https://nestorconstruct.gr` — set at deploy (`functions/.env.<project>`). */
const INTERNAL_WEBHOOK_BASE_URL = defineString('INTERNAL_WEBHOOK_BASE_URL');

/** Within the 60s budget of the reactive profile, leaving room for one retry decision. */
const SEND_TIMEOUT_MS = 20_000;

/** What the relay needs from the outside world — injected so the core is testable without network. */
export interface RelayDeps {
  readonly secret: () => string;
  readonly baseUrl: () => string;
  readonly send: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ status: number }>;
  readonly nowSeconds: () => number;
  readonly log: (level: 'warn' | 'error', message: string, data: Record<string, unknown>) => void;
}

type Snapshot = { readonly exists: boolean; data(): Record<string, unknown> | undefined };

function eventOf(source: DependencySource, docId: string, eventId: string, before: Snapshot, after: Snapshot): DependencyChangeEvent | null {
  const wireBefore = before.exists ? toWireDocument(before.data()) : null;
  const wireAfter = after.exists ? toWireDocument(after.data()) : null;
  if (wireBefore === null && wireAfter === null) return null;
  return { eventId, source, docId, before: wireBefore, after: wireAfter };
}

function hasTenant(event: DependencyChangeEvent): boolean {
  return [event.before, event.after].some((doc) => typeof doc?.companyId === 'string' && doc.companyId !== '');
}

/** **The relay core.** Returns normally on success or a final refusal; throws on a retryable failure. */
export async function relayDependencyWrite(
  source: DependencySource,
  change: { readonly before: Snapshot; readonly after: Snapshot },
  context: { readonly eventId: string; readonly timestamp: string; readonly params: Record<string, string> },
  deps: RelayDeps,
): Promise<void> {
  const event = eventOf(source, context.params.docId, context.eventId, change.before, change.after);
  // No tenant ⇒ no case can depend on it (the receiver queries per tenant). Cheapest possible filter.
  if (!event || !hasTenant(event)) return;
  if (isInternalWebhookEventExpired(context.timestamp, deps.nowSeconds())) {
    deps.log('error', '[ConveyanceRelay] expired — dropping', { source, docId: event.docId, publishedAt: context.timestamp });
    return;
  }
  const body = JSON.stringify(event);
  const url = `${deps.baseUrl().replace(/\/+$/, '')}${CONVEYANCE_DEPENDENCY_WEBHOOK_PATH}`;
  const { status } = await deps.send(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': event.eventId,
      [INTERNAL_WEBHOOK_SIGNATURE_HEADER]: signInternalWebhook([deps.secret()], body, deps.nowSeconds()),
    },
    body,
  });
  const delivery = judgeInternalWebhookDelivery(status);
  if (delivery === 'delivered') return;
  if (delivery === 'refused') {
    deps.log('error', '[ConveyanceRelay] refused — not retrying', { source, docId: event.docId, status });
    return;
  }
  throw new Error(`[ConveyanceRelay] receiver answered ${status} — retrying`);
}

const LIVE_DEPS: RelayDeps = {
  secret: () => INTERNAL_WEBHOOK_SECRET.value(),
  baseUrl: () => INTERNAL_WEBHOOK_BASE_URL.value(),
  send: async (url, init) => {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
    return { status: response.status };
  },
  nowSeconds: () => Math.floor(Date.now() / 1000),
  log: (level, message, data) => functions.logger[level](message, data),
};

function makeRelay(source: DependencySource, collection: string) {
  return functions
    .runWith({ ...REACTIVE_TRIGGER_RUNTIME, secrets: [INTERNAL_WEBHOOK_SECRET], failurePolicy: true })
    .firestore.document(`${collection}/{docId}`)
    .onWrite((change, context) => relayDependencyWrite(source, change, context, LIVE_DEPS));
}

export const onConveyanceFileWrite = makeRelay('file', COLLECTIONS.FILES);
export const onConveyancePropertyWrite = makeRelay('property', COLLECTIONS.PROPERTIES);
export const onConveyanceProjectWrite = makeRelay('project', COLLECTIONS.PROJECTS);
