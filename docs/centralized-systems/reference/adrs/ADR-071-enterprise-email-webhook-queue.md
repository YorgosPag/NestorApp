# ADR-071: Enterprise Email Webhook Queue System

**Status**: ✅ IMPLEMENTED & VERIFIED IN PRODUCTION
**Date**: 2026-02-05 (Updated: 2026-02-06)
**Category**: Backend Systems
**Related**: ADR-070 (Email & AI Ingestion System), ADR-073 (Firestore Composite Index Strategy)

---

## Context

Το Mailgun webhook timeout μετά από ~10 seconds:
```
"context deadline exceeded" - session-seconds: 10.015
```

**Root Cause**: Το `processInboundEmail()` παίρνει 5-15+ seconds λόγω:
- AI Analysis (message intent + document classification)
- File uploads to Firebase Storage
- Multiple Firestore queries/writes

Αυτό προκαλεί απώλεια emails όταν το Mailgun timeout πριν λάβει 200 OK response.

---

## Decision

Υιοθετούμε το enterprise pattern **"Acknowledge Fast, Process Later"** που χρησιμοποιείται από SAP, Salesforce, και Google.

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mailgun    │────▶│  Webhook (<1.5s) │────▶│ email_ingestion │
│  (Email)    │     │  Fast ACK        │     │ _queue          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                          │                         │
                          ▼                         ▼
                    Return 200 OK            ┌─────────────────┐
                    immediately              │ Background      │
                                             │ Worker (Cron)   │
                                             └─────────────────┘
                                                    │
                                                    ▼
                                             ┌─────────────────┐
                                             │ AI Analysis +   │
                                             │ Full Processing │
                                             └─────────────────┘
```

### Enterprise Patterns

1. **Acknowledge Fast, Process Later** - Webhook returns 200 immediately
2. **Message Queue με Firestore** - Persistent queue for reliability
3. **Idempotency (deduplication)** - Prevent duplicate processing
4. **Exponential Backoff** - Retry delays: 1s, 5s, 30s
5. **Dead Letter Queue** - Unrecoverable items marked for review

---

## Implementation

### Files Created

| File | Purpose |
|------|---------|
| `src/types/email-ingestion-queue.ts` | Queue types, status types, configuration constants |
| `src/services/communications/inbound/email-queue-service.ts` | Queue management (enqueue, process, claim, mark) |
| `src/server/comms/workers/email-ingestion-worker.ts` | Background worker with retry logic |
| `src/app/api/cron/email-ingestion/route.ts` | Vercel Cron endpoint (every minute) |
| `vercel.json` | Cron schedule configuration |

### Files Modified

| File | Changes |
|------|---------|
| `src/config/firestore-collections.ts` | Added `EMAIL_INGESTION_QUEUE` collection |
| `src/app/api/communications/webhooks/mailgun/inbound/route.ts` | Changed to enqueue instead of process synchronously |
| `src/services/communications/inbound/index.ts` | Export new queue functions |

### Queue Item Schema

```typescript
interface EmailIngestionQueueItem {
  id: string;
  providerMessageId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

  // Routing (resolved in fast path)
  routingResolution: {
    companyId: string;
    matchedPattern?: string;
  };

  // Raw payload
  provider: 'mailgun' | 'sendgrid';
  sender: { email: string; name?: string };
  recipients: string[];
  subject: string;
  contentText: string;
  attachments: SerializedAttachment[];

  // Retry tracking
  retryCount: number;
  maxRetries: number;  // Default: 3

  // Timestamps
  createdAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;

  // Result/Error
  result?: { communicationId?: string; contactId?: string; };
  lastError?: { message: string; occurredAt: Date; };
}
```

### Configuration

```typescript
const EMAIL_QUEUE_CONFIG = {
  COLLECTION_NAME: 'email_ingestion_queue',
  MAX_RETRIES: 3,
  RETRY_DELAYS_MS: [1000, 5000, 30000],  // Exponential backoff
  PROCESSING_TIMEOUT_MS: 120000,          // 2 minutes
  BATCH_SIZE: 10,
  POLL_INTERVAL_MS: 10000,                // 10 seconds
  STALE_PROCESSING_THRESHOLD_MS: 180000,  // 3 minutes
  MAX_ATTACHMENT_SIZE_BYTES: 10 * 1024 * 1024,  // 10MB
};
```

---

## Verification

### 1. Webhook Response Time

```bash
curl -w "@curl-format.txt" -X POST \
  -F "from=test@example.com" \
  -F "recipient=inbound@nestorconstruct.gr" \
  https://nestor-app.vercel.app/api/communications/webhooks/mailgun/inbound

# Expected: < 2 seconds (vs previous 10+ seconds timeout)
```

### 2. Queue Processing Flow

1. Send email to `inbound@nestorconstruct.gr`
2. Check Firestore `email_ingestion_queue` collection
3. Verify item status: `pending` → `processing` → `completed`
4. Verify final message in `messages` collection

### 3. Retry Logic

1. Simulate AI provider failure
2. Verify retryCount increments
3. Verify exponential backoff delays
4. Verify `dead_letter` status after max retries

### 4. Cron Health Check

```bash
curl https://nestor-app.vercel.app/api/cron/email-ingestion

# Response includes:
# - healthy: true/false
# - warnings: string[]
# - stats: { pendingCount, processingCount, failedCount, deadLetterCount }
```

---

## Consequences

### Positive

- **No more webhook timeouts** - Response in <2 seconds
- **Reliable delivery** - Queue survives process restarts
- **Automatic retries** - Transient failures self-heal
- **Visibility** - Queue stats and health monitoring
- **Scalability** - Can increase cron frequency if needed

### Negative

- **Slight delay** - Emails processed with 1-2 minute latency (acceptable)
- **More complexity** - Additional queue management code
- **Cron costs** - Vercel Cron invocations (minimal on Pro plan)

### Neutral

- **Storage** - Queue items with serialized attachments use more Firestore storage
- **Debugging** - Need to check queue collection for troubleshooting

---

## Alternatives Considered

### 1. Cloud Tasks/Functions

**Rejected**: Would require GCP infrastructure changes and additional costs.

### 2. Bull/Redis Queue

**Rejected**: Would require Redis hosting, over-engineered for our volume.

### 3. Direct Background Processing

**Rejected**: Next.js serverless doesn't support long-running background tasks reliably.

### 4. Increase Mailgun Timeout

**Not Possible**: Mailgun timeout is fixed at ~10 seconds.

---

## References

- [Mailgun Webhook Documentation](https://documentation.mailgun.com/en/latest/user_manual.html#webhooks)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Enterprise Message Queue Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling)
- [Google Cloud Tasks Best Practices](https://cloud.google.com/tasks/docs/best-practices)

---

## Maintenance Notes

### Environment Variables

Add to production:
```
CRON_SECRET=<generate-secure-random-string>
```

### Vercel Configuration

The `vercel.json` file configures the cron:
```json
{
  "crons": [{
    "path": "/api/cron/email-ingestion",
    "schedule": "* * * * *"
  }]
}
```

### Monitoring

Check queue health periodically:
- Dashboard: `/api/cron/email-ingestion` (GET)
- Firestore: `email_ingestion_queue` collection
- Logs: Filter by `EMAIL_QUEUE_SERVICE` or `EMAIL_INGESTION_WORKER`

### Dead Letter Processing

Items in `dead_letter` status need manual review:
1. Query Firestore for `status == 'dead_letter'`
2. Review `lastError` and `retryHistory`
3. Fix the issue and reset to `pending` or delete

---

---

## Production Incident Report (2026-02-06)

### Incident: Emails Stuck in Queue (10 emails, ALL pending)

**Duration**: ~6 ώρες debugging
**Impact**: Κανένα email δεν επεξεργάστηκε - 10 emails κολλημένα ως "pending"

### Root Causes (3 αλληλένδετα)

#### 1. Missing MAILGUN_DOMAIN Environment Variable
- **Πρόβλημα**: Η μεταβλητή `MAILGUN_DOMAIN` δεν υπήρχε στο Vercel
- **Αποτέλεσμα**: Τα routing rules δεν μπορούσαν να δημιουργηθούν σωστά
- **Λύση**: Προστέθηκε `MAILGUN_DOMAIN=mg.nestorconstruct.gr`

#### 2. Trailing Newline στο MAILGUN_DOMAIN (ΚΡΙΣΙΜΟ)
- **Πρόβλημα**: Χρησιμοποιήθηκε `echo` αντί `printf` για pipe στο Vercel CLI
- **Αποτέλεσμα**: Η τιμή αποθηκεύτηκε ως `mg.nestorconstruct.gr\n` - τα routing patterns γίνονταν `inbound@nestorconstruct.gr\n` που δεν ταίριαζε ποτέ
- **Λύση**: Χρήση `printf` (χωρίς newline) + `.trim()` στον κώδικα ως defensive measure
- **ΚΑΝΟΝΑΣ**: **ΠΟΤΕ `echo` για env vars στο Vercel** → πάντα `printf`

#### 3. Missing Firestore Composite Index (ROOT CAUSE)
- **Πρόβλημα**: Η query `.where('status', '==', 'pending').orderBy('createdAt', 'asc')` στο `email_ingestion_queue` χρειάζεται composite index
- **Αποτέλεσμα**: Η `claimNextQueueItems()` έσκαγε με `9 FAILED_PRECONDITION` - η `after()` function τον έπιανε σιωπηλά (caught error)
- **Λύση**: Προστέθηκαν 2 composite indexes στο `firestore.indexes.json` και deploy με Firebase CLI
- **ΚΑΝΟΝΑΣ**: **ΜΗΝ ΑΓΓΙΖΕΙΣ ΠΟΤΕ τους indexes χωρίς να τρέξεις `firebase deploy --only firestore:indexes`**

### Required Composite Indexes

```json
// INDEX 1: Worker batch processing (claimNextQueueItems)
{
  "collectionGroup": "email_ingestion_queue",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}

// INDEX 2: Deduplication (enqueueInboundEmail)
{
  "collectionGroup": "email_ingestion_queue",
  "fields": [
    { "fieldPath": "providerMessageId", "order": "ASCENDING" },
    { "fieldPath": "provider", "order": "ASCENDING" }
  ]
}
```

### Timeline

| Ώρα | Γεγονός |
|-----|---------|
| ~12:00 | Πρώτα test emails στάλθηκαν - Mailgun 200 OK αλλά κανένα στη βάση |
| ~13:00 | Εντοπίστηκε: MAILGUN_DOMAIN δεν υπήρχε στο Vercel |
| ~13:30 | Προστέθηκε MAILGUN_DOMAIN (με echo - λάθος!) |
| ~14:00 | Εντοπίστηκε: Trailing newline `\n` στο MAILGUN_DOMAIN |
| ~14:30 | Διορθώθηκε με printf + .trim() - routing rules OK πλέον |
| ~15:00 | 10 emails στην ουρά αλλά κανένα δεν processing |
| ~15:30 | Diagnostic endpoint αποκάλυψε: FAILED_PRECONDITION - missing composite index |
| ~15:45 | Firebase CLI installed, indexes deployed |
| ~16:00 | Index built - ΟΛΑ ΤΑ 10 EMAILS PROCESSED SUCCESSFULLY |

### Lessons Learned

1. **Firestore composite indexes**: Κάθε `.where()` + `.orderBy()` σε διαφορετικά πεδία ΑΠΑΙΤΕΙ composite index
2. **Index build time**: 2-5 λεπτά - η `FAILED_PRECONDITION` εξαφανίζεται πριν ο index γεμίσει πλήρως (κενά αποτελέσματα)
3. **Silent failures**: Η `after()` function πιάνει τα errors σιωπηλά - ο diagnostic endpoint ήταν κρίσιμος
4. **Defensive .trim()**: ΠΑΝΤΑ `.trim()` στα env vars ως defensive measure
5. **Diagnostic endpoints**: Πολύτιμα για debugging production issues χωρίς code changes

### Diagnostic Endpoint

`GET /api/communications/webhooks/mailgun/inbound` επιστρέφει:
- **routing**: Rules count, patterns, active status
- **queue**: Total items, breakdown by status, latest items
- **batchProcessResult**: Test batch processing (batchSize: 1)

---

### Environment Variables Checklist

| Variable | Purpose | Status |
|----------|---------|--------|
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Webhook signature verification | ✅ Set |
| `MAILGUN_DOMAIN` | Domain for routing rules generation | ✅ Set (mg.nestorconstruct.gr) |
| `MAILGUN_API_KEY` | Email sending + deferred attachment downloads | ✅ Set (2026-02-06) |

---

*Enterprise standards inspired by: SAP, Salesforce, Google, Microsoft Azure*
