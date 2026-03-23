# SPEC-259D: Error Monitoring Integration

| Field | Value |
|-------|-------|
| **ADR** | ADR-259 (Production Readiness Audit) |
| **Phase** | 4 of 4 |
| **Priority** | HIGH — production observability |
| **Status** | ✅ IMPLEMENTED |
| **Depends On** | — (no dependencies, can start independently) |

---

## Objective

Ενσωμάτωση error monitoring στην εφαρμογή ώστε production errors (AI pipeline, webhooks, Firestore) να καταγράφονται, να γίνονται aggregate, και να φτάνουν στον Γιώργο μέσω alert (email ή Telegram). Στόχος: **μηδενικά χαμένα errors σε production**.

---

## Current State

### Error Handling — Τι υπάρχει

| Μηχανισμός | Αρχείο | Λειτουργία | Limitation |
|-----------|--------|------------|-----------|
| `createModuleLogger()` | `src/lib/telemetry/Logger.ts` | Console logging per module | Χάνεται μετά τα Vercel logs (30 days) |
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` | React error boundary | Client-only, δεν πιάνει server errors |
| `ErrorTracker` | `src/services/ErrorTracker/` | Client-side error reporting | Δεν στέλνει alerts |
| `logAuditEvent()` | `src/lib/auth/tenant-isolation.ts` | Access denial logging | Γράφει σε console, ΟΧΙ persistent |

### Τι ΔΕΝ υπάρχει

- ❌ `@sentry/nextjs` — κανένα import
- ❌ `captureException()` — πουθενά
- ❌ `Sentry.init()` — πουθενά
- ❌ `sentry.client.config.ts` / `sentry.server.config.ts` — δεν υπάρχουν
- ❌ Alert rules — κανένα notification σε Γιώργο
- ❌ Error dashboard — κανένα visualization
- ❌ Error aggregation — κάθε error isolated

### Κρίσιμα error paths που δεν monitored

| Path | Τι χάνεται | Αρχείο |
|------|-----------|--------|
| AI pipeline tool execution fails | Tool error logged, αλλά δεν φτάνει πουθενά | `agentic-tool-executor.ts` |
| OpenAI API timeout/error | Retry logic, αλλά final failure χάνεται | `agentic-loop.ts` |
| Telegram webhook rejects | 200 response (prevent retry), error logged locally | `handler.ts` |
| Firestore permission denied | Audit logged, αλλά δεν aggregated | `tenant-isolation.ts` |
| FAILED_PRECONDITION (missing index) | Fallback silent — κανείς δεν ξέρει | `agentic-tool-executor.ts` |

---

## Target State

- ✅ Sentry SDK integrated (client + server)
- ✅ AI pipeline errors captured with context (userId, channel, tool, query)
- ✅ Webhook errors captured with request context
- ✅ FAILED_PRECONDITION captured as warning (with collection + filters)
- ✅ Alert rules: critical errors → email/Telegram notification
- ✅ Performance monitoring: agentic loop duration, OpenAI latency
- ✅ Dashboard: error trends, top errors, affected users

---

## Technology Decision

### Option A: Sentry (Recommended)

| Aspect | Details |
|--------|---------|
| **Package** | `@sentry/nextjs` |
| **License** | **MIT** ✅ (permissive — ADR-034 compliant) |
| **Free Tier** | 5,000 errors/month, 10,000 performance transactions/month |
| **Next.js Integration** | Official SDK, automatic instrumentation |
| **Cost** | Free for development; $26/month Team plan if needed |

### Option B: Lightweight Alternative (Αν Sentry υπερβολικό)

Custom error reporting σε Firestore + Telegram notification:
- Firestore collection: `error_logs`
- Telegram bot notification στον Γιώργο (reuse existing bot)
- Pros: Zero external dependency, zero cost
- Cons: Δεν υπάρχει dashboard, stack trace grouping, performance monitoring

### Recommendation

**Sentry (Option A)** — MIT license, free tier αρκεί, official Next.js support, proper error grouping. Αν ο Γιώργος προτιμά zero external deps → Option B.

---

## Files to Create/Modify (Sentry Path)

| File | Action | Details |
|------|--------|---------|
| `sentry.client.config.ts` | CREATE | Client-side Sentry init |
| `sentry.server.config.ts` | CREATE | Server-side Sentry init |
| `sentry.edge.config.ts` | CREATE | Edge runtime init (for API routes) |
| `next.config.ts` | MODIFY | Wrap with `withSentryConfig()` |
| `src/services/ai-pipeline/agentic-loop.ts` | MODIFY | `captureException()` on final failure |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | `captureMessage()` on FAILED_PRECONDITION |
| `src/app/api/communications/webhooks/telegram/handler.ts` | MODIFY | `captureException()` on webhook errors |
| `src/lib/auth/tenant-isolation.ts` | MODIFY | `captureMessage()` on access denial |
| `package.json` | MODIFY | Add `@sentry/nextjs` dependency |
| `.env.local` / Vercel env | MODIFY | Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |

---

## Implementation Steps

### Step 1: Install Sentry

```bash
npx @sentry/wizard@latest -i nextjs
```

Ή manual:
```bash
npm install @sentry/nextjs
```

**License check**: `@sentry/nextjs` → MIT ✅

### Step 2: Sentry Config Files

**`sentry.client.config.ts`**:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% performance sampling
  replaysSessionSampleRate: 0,  // No session replay (privacy)
  replaysOnErrorSampleRate: 0.5,  // 50% replay on error
});
```

**`sentry.server.config.ts`**:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Step 3: Wrap next.config

```typescript
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = { /* existing config */ };

export default withSentryConfig(nextConfig, {
  silent: true,  // Suppress Sentry webpack logs
  hideSourceMaps: true,
});
```

### Step 4: AI Pipeline Error Capture

**`agentic-loop.ts`** — on final failure:
```typescript
import * as Sentry from '@sentry/nextjs';

// After max iterations or timeout:
Sentry.captureException(error, {
  tags: {
    component: 'agentic-loop',
    channel: context.channel,
    isAdmin: context.isAdmin,
  },
  extra: {
    userId: context.userId,
    iterations: iterationCount,
    totalTokens: totalUsage.total_tokens,
    lastToolCall: lastToolName,
  },
});
```

**`agentic-tool-executor.ts`** — on FAILED_PRECONDITION:
```typescript
Sentry.captureMessage('Missing Firestore index — fallback query', {
  level: 'warning',
  tags: { component: 'tool-executor', collection },
  extra: { filters, errorMessage },
});
```

### Step 5: Webhook Error Capture

**`handler.ts`** — on critical errors:
```typescript
Sentry.captureException(error, {
  tags: {
    component: 'telegram-webhook',
    updateType: update.message ? 'message' : 'callback',
  },
  extra: {
    telegramUserId: update.message?.from?.id,
    chatId: update.message?.chat?.id,
  },
});
```

### Step 6: Access Denial Capture

**`tenant-isolation.ts`** — on denial:
```typescript
Sentry.captureMessage('Tenant isolation access denied', {
  level: 'warning',
  tags: { component: 'tenant-isolation', path },
  extra: { requestedCompanyId, userCompanyId, resource },
});
```

### Step 7: Alert Rules (Sentry Dashboard)

| Alert | Condition | Action |
|-------|-----------|--------|
| AI Pipeline Critical | Error in `agentic-loop` > 5 in 1 hour | Email Γιώργο |
| Webhook Failures | Error in `telegram-webhook` > 10 in 1 hour | Email Γιώργο |
| Missing Index | Warning `FAILED_PRECONDITION` > 3 in 1 hour | Email (low priority) |
| Access Denial Spike | Warning `tenant-isolation` > 20 in 1 hour | Email (possible attack) |

### Step 8: Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel + .env.local | `https://xxx@sentry.io/yyy` |
| `SENTRY_DSN` | Vercel | Same DSN (server-side) |
| `SENTRY_AUTH_TOKEN` | Vercel | For source map upload |
| `SENTRY_ORG` | Vercel | Sentry organization slug |
| `SENTRY_PROJECT` | Vercel | Sentry project slug |

---

## Alternative: Lightweight (Option B) — Firestore + Telegram

Αν ο Γιώργος **ΔΕΝ θέλει** external service:

### Files to Create

| File | Action | Details |
|------|--------|---------|
| `src/services/error-monitoring.service.ts` | CREATE | Log to Firestore `error_logs` collection |
| `src/config/firestore-collections.ts` | MODIFY | Add `ERROR_LOGS: 'error_logs'` |

### Architecture

```typescript
// error-monitoring.service.ts
export async function reportError(error: Error, context: Record<string, unknown>) {
  // 1. Write to Firestore error_logs (fire-and-forget)
  // 2. If critical → send Telegram message to Γιώργος
  //    (reuse existing Telegram bot: sendMessage to super admin)
}
```

**Pros**: Zero cost, zero external deps, reuses existing Telegram bot
**Cons**: No dashboard, no grouping, no performance monitoring, manual analysis

---

## Verification

1. **Sentry receives errors**: Throw test error → appears in Sentry dashboard
2. **AI pipeline captured**: Simulate agentic loop timeout → Sentry event with context
3. **FAILED_PRECONDITION**: Trigger missing index → Sentry warning with collection
4. **Alert fires**: Trigger >5 AI errors → email received by Γιώργο
5. **No false positives**: Normal operation → no alert noise
6. **Performance**: Sentry SDK adds <50ms overhead to page load

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | SPEC created — pending decision: Sentry vs Lightweight |
| 2026-03-24 | ✅ IMPLEMENTED — Sentry (Option A). Files: sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts (created), next.config.js (withSentryConfig wrap), agentic-loop.ts (captureMessage on timeout + max iterations), agentic-tool-executor.ts (captureMessage on FAILED_PRECONDITION), handler.ts (captureException on webhook error), audit.ts (captureMessage on access_denied — SSoT for all tenant isolation denials). Package: @sentry/nextjs 10.45.0 (MIT). Env vars: NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT. |
