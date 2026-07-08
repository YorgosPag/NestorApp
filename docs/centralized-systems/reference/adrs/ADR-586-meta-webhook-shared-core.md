# ADR-586: Meta Webhook Shared Core SSoT (`lib/communications/meta-webhook`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the copy-pasted Meta Graph webhook handlers (`src/app/api/communications/webhooks/{instagram,messenger,whatsapp}`). All 3 platforms migrated to one shared core + thin per-platform payload walks (jscpd baseline **4489 → 4465**, −24 clones). 22 Jest tests on the shared core.

**Related:**
- **ADR-174** (Meta Omnichannel Integration) — the Instagram / Messenger / WhatsApp webhook ingestion this decision refactors. Behaviour unchanged.
- **ADR-134** (post-response pipeline batch, Telegram pattern) — the `after()` batch trigger the shared core owns.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates against re-introducing them.
- **ADR-585** (Domain Card View-Model Hook) — sibling de-dup in the same 2026-07-08 clone-reduction sweep (different bucket: `domain/cards`).
- **ADR-070/071** (email ingestion pipeline, Mailgun → `email_ingestion_queue`) — the `webhooks/mailgun` handler is a different archetype (email, not Meta Graph) → **out of scope**, untouched.

---

## Context

Three Meta Platform products — Instagram Messaging, Facebook Messenger, WhatsApp Cloud API — each had a `route.ts` + `handler.ts` under `src/app/api/communications/webhooks/<platform>/`. All three are the **same Meta Graph webhook**: identical verification handshake, identical `X-Hub-Signature-256` HMAC gate, identical post-response AI-pipeline batch, identical feedback-button payload encoding. Only the payload schema, the sender-id field, and the reply rendering genuinely differ.

jscpd (ADR-584) measured the twins directly:

| Pair | Cloned lines |
|---|---|
| `instagram` ↔ `messenger` | 300 (13 clones) |
| `instagram` ↔ `whatsapp` | 252 (10 clones) |

The duplicated blocks were, verbatim across all three:
- **`verifySignature`** — HMAC-SHA256 over the raw body with `META_APP_SECRET`, constant-time compare. **Byte-identical ×3.**
- **`handleGET`** — the `hub.challenge` handshake (only the verify-token env var + log label differed).
- **The POST envelope** — read body → verify signature → parse → guard on `payload.object` → iterate entries → enqueue → trigger `after()` batch → always return 200.
- **`feedXToPipeline`** try/catch/log boilerplate.
- **Feedback / category payload parsing** (`fb_{id}_{up|down}`, `fbc_{id}_{w|d|u|s}`) + `CATEGORY_MAP` (Messenger ↔ WhatsApp identical).

A **real SSoT audit (grep)** confirmed **no** shared Meta-webhook utility existed — each handler carried its own copy.

Big-player practice is exactly what Meta's own docs prescribe: **one shared Graph-webhook pipeline + per-platform field mapping**. So the SSoT is a shared core (verify / handshake / envelope / batch / feedback-decode / route wiring) with each platform reduced to a thin adapter owning only its payload walk and reply rendering.

---

## Decision

New shared module **`src/lib/communications/meta-webhook/`** (co-located with the existing `src/lib/communications/` comms SSoT):

### Shared core
| File | Owns |
|---|---|
| `meta-signature.ts` | `verifyMetaWebhookSignature(rawBody, signature, logger)` — the HMAC gate. |
| `meta-verification.ts` | `handleMetaWebhookGet(request, { verifyToken, platform, logger })` — the `hub.challenge` handshake. |
| `meta-post.ts` | `handleMetaWebhookPost(request, config)` — the full POST envelope, generic over `<TPayload, TMessage>`. Owns verify + object guard + feed loop + batch + always-200. Per-platform injects `collectPipelineMessages(payload)` (payload walk + CRM side effects → messages) and `feedToPipeline(msg)`. |
| `meta-pipeline-batch.ts` | `triggerPipelineBatchAfterResponse(logPrefix, logger)` — the `after()` AI-pipeline batch (ADR-134). |
| `meta-feedback.ts` | `CATEGORY_MAP`, `parseFeedbackPayload`, `parseCategoryPayload`, `applyFeedbackRating`, `applyNegativeCategory` — decode + Firestore writes. Reply **rendering** stays per-platform (text vs quick-reply vs buttons). |
| `meta-webhook-route.ts` | `createMetaWebhookRoute({ handleGET, handlePOST })` → `{ GET, POST }` (rate-limited). `maxDuration` stays a static per-route export. |
| `index.ts` | Public barrel. |

### Thin per-platform adapters
Each `route.ts` becomes: `export const { GET, POST } = createMetaWebhookRoute({ handleGET, handlePOST });` (+ static `maxDuration`).

Each `handler.ts` keeps **only** its payload walk: `collectPipelineMessages(payload)` iterates the platform-specific entry shape (`entry.messaging` for IG/Messenger, `entry.changes` for WhatsApp), performs CRM storage / read receipts / feedback, and returns the pipeline messages. `handlePOST` delegates to `handleMetaWebhookPost`. Handlers import the core via `import * as MetaWebhook` (namespace import — also keeps the identical import list from re-forming a clone).

### Google-level improvement (not just de-dup)
The old handlers used a **module-level mutable `pendingPipelineMessages` array** reset with `.length = 0` per request — a latent cross-invocation race on warm serverless containers (two concurrent requests share the module scope). The shared envelope returns the messages from `collectPipelineMessages` as a **request-local array**; the module-level state is gone. Zero races (N.7.2 #2).

### Per-platform differences preserved (surgical, not flattened)
- **Signature scheme, sender-id extraction, queue keys** — unchanged.
- **Reply UX** — Instagram plain text, Messenger quick replies, WhatsApp buttons (2-message split) — untouched.
- **Instagram feedback is text-based** (👍/👎 emoji + numbered categories via `getLatestFeedbackForChannel`), a different archetype from the button-based `fb_`/`fbc_` payloads → it does **not** use `parseFeedbackPayload`; it reuses only the shared Firestore writes (`applyFeedbackRating` / `applyNegativeCategory`), and its 3 repeated `getFeedbackService` lookups were folded into a local `getLatestChannelFeedback` helper.

---

## Consequences
- ✅ **−24 jscpd clones** (baseline `4489 → 4465`), locked via `npm run jscpd:baseline`. All 13 touched files pass `jscpd:diff` (0 new clones).
- ✅ A change to the signature gate / verification handshake / pipeline batch / feedback decode now happens **once** and applies to all three platforms.
- ✅ Removed a latent module-level concurrency race (pending-messages now request-local).
- ✅ New Meta platform = a payload-walk adapter + `createMetaWebhookRoute` — no re-copied envelope.
- ✅ 22 Jest tests cover the shared core (signature HMAC incl. tamper/wrong-secret/length, GET 200/403 matrix, feedback/category decode).
- ⚠️ Runtime (live webhook) verification pending; behaviour-preserving refactor + jest + jscpd verified. No `tsc` per N.17.

---

## Files
**Shared core:** `src/lib/communications/meta-webhook/{meta-signature,meta-verification,meta-post,meta-pipeline-batch,meta-feedback,meta-webhook-route,index}.ts`.
**Tests:** `src/lib/communications/meta-webhook/__tests__/{meta-signature,meta-feedback,meta-verification}.test.ts`.
**Rewritten (thin adapters):** `webhooks/{instagram,messenger,whatsapp}/{route,handler}.ts`.

---

## Changelog
- **2026-07-08** — Created. Extracted the Meta webhook shared core; migrated Instagram / Messenger / WhatsApp to `handleMetaWebhookPost` + `createMetaWebhookRoute` + shared signature/GET/feedback SSoT. Removed module-level pending-message race. jscpd 4489 → 4465 (−24). 22 tests. All 13 touched files pass `jscpd:diff`.
