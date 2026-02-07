# AI Observability (Logs / Metrics / Traces)

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../reference/adrs/ADR-169-modular-ai-architecture.md)

---

## Correlation IDs

Κάθε αίτημα λαμβάνει **unique correlation ID** (`requestId`) που ακολουθεί σε **κάθε** module, log entry, API call.

**Format**: `req_{timestamp}_{random}`

Επίσης: `companyId` (tenant) + `messageId` παντού.

**Παράδειγμα log entry**:
```json
{
  "requestId": "req_1707300000_a1b2c3",
  "companyId": "pzNUy8ksddGCtcQMqumR",
  "messageId": "msg_email_12345",
  "module": "UnderstandingModule",
  "action": "intent_detected",
  "intent": "invoice",
  "confidence": 94,
  "durationMs": 1200
}
```

---

## Metrics

| Metric | Περιγραφή |
|--------|-----------|
| `pipeline.latency` | Χρόνος ανά module + συνολικός (ms) |
| `pipeline.error_rate` | Ποσοστό αποτυχιών ανά module |
| `ai.approval_rate` | Πόσα εγκρίθηκαν vs απορρίφθηκαν |
| `ai.auto_approval_rate` | Πόσα πέρασαν αυτόματα (confidence > threshold) |
| `ai.cost_per_request` | Κόστος tokens ανά αίτημα (ανά tier) |
| `queue.backlog` | Πόσα αιτήματα περιμένουν στο queue |
| `escalation.count` | Πόσες κλιμακώσεις ανά ημέρα/εβδομάδα |

---

## Alerts

| Alert | Trigger |
|-------|---------|
| **Queue Backlog** | > 50 items στο queue → ειδοποίηση owner |
| **Failure Spike** | > 5 failures σε 10 λεπτά → ειδοποίηση |
| **Vendor Outage** | Mailgun/Telegram/OpenAI API unreachable → fallback mode |
| **Cost Spike** | AI κόστος > daily threshold → ειδοποίηση owner |

---

## Dashboard Integration

Τα metrics τροφοδοτούν το [UC-008 - AI-Powered Dashboards](./use-cases/UC-008-dashboards.md):
- **AI Activity Dashboard**: Αιτήματα, αυτόματες ενέργειες, χρόνοι απόκρισης, accuracy
- **Executive Dashboard**: Top KPIs από κάθε κατηγορία

---

## Ops Dashboards (BACKLOG)

> **Status**: BACKLOG — Καταγραφή απαιτήσεων για μελλοντική υλοποίηση

- **Cost per Company/Use-Case**: Κόστος AI tokens ανά εταιρεία και σενάριο (ιδίως Vision tier)
- **Budget Guardrails**: Αυτόματο fallback σε approval-only ή FAST tier αν ξεπεραστεί budget threshold
- **SLA Tracking**: Χρόνος από intake → execution ανά use case, με alerts για παραβίαση SLA
- **DLQ Management UI**: Requeue, drain, export CSV, assign incident owner
- **Incident Mode**: "Vendor down" dashboard — queue depth, auto-degrade status, manual fallback options
