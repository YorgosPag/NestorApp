# AI Orchestration & Reliability

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../reference/adrs/ADR-169-modular-ai-architecture.md)

---

## State Machine per Request

```
RECEIVED → ACKED → UNDERSTOOD → PROPOSED → APPROVED → EXECUTED → AUDITED
                                    ↓            ↓          ↓
                                 REJECTED    MODIFIED    FAILED → DLQ
```

Κάθε αίτημα ακολουθεί αυτό το state machine. Η μετάβαση μεταξύ states καταγράφεται στο audit trail.

---

## Reliability Patterns

| Pattern | Περιγραφή |
|---------|-----------|
| **Job Queue** | Κάθε αίτημα μπαίνει σε queue (Firestore `ai_pipeline_queue`). Ήδη υπάρχει pattern: `email_ingestion_queue`. |
| **Retries + Exponential Backoff** | Αν αποτύχει API call → retry 3 φορές (1s, 4s, 16s). Μετά → DLQ. |
| **Idempotency Keys** | Κάθε execute action έχει unique key → δεν στέλνεται 2 φορές email/έγγραφο. |
| **DLQ (Dead Letter Queue)** | Αιτήματα που αποτυγχάνουν επανειλημμένα → human recovery flow. Ο `defaultResponsible` ειδοποιείται. |
| **Timeouts** | Κάθε AI call: max 30s. Κάθε pipeline step: max 60s. Συνολικό pipeline: max 5 λεπτά. |
| **Concurrency Control** | Batch processing με concurrency limit (ήδη υπάρχει στο email pipeline). |

---

## Queue Architecture

```
Inbound Message
    ↓
ai_pipeline_queue (Firestore collection)
    ↓
Worker claims item (status: processing)
    ↓
Pipeline execution (Intake → ... → Audit)
    ↓
Success → status: completed
Failure → retry (up to 3x) → DLQ
```

**Existing pattern**: Η `email_ingestion_queue` χρησιμοποιεί ήδη αυτό το μοτίβο με `claimNextQueueItems()` + composite index (status + createdAt).

---

## Timeout Configuration

| Scope | Default | Configurable |
|-------|---------|-------------|
| Single AI call | 30s | ✅ Per-tenant |
| Pipeline step | 60s | ✅ Per-tenant |
| Total pipeline | 5 min | ✅ Per-tenant |
| Retry intervals | 1s, 4s, 16s | ✅ Global config |
| Max retries | 3 | ✅ Global config |

Βλ. [contracts.md](./contracts.md) → Config-Driven Thresholds για τις αρχές configuration.
