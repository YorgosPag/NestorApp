# AI Module Contracts (Interface Definitions)

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../reference/adrs/ADR-169-modular-ai-architecture.md)

---

## Αρχή

Κάθε module έχει **τυπικό συμβόλαιο εισόδων/εξόδων** (Zod schemas). Τα AI βήματα που κάνουν routing/εκτέλεση χρησιμοποιούν **Structured Outputs only** (JSON mode) - μειώνει hallucinations.

---

## IntakeMessage (raw + normalized)

```typescript
{
  id: string;                    // unique message ID
  channel: 'email' | 'telegram' | 'in_app' | 'messenger' | 'sms';
  rawPayload: unknown;           // original webhook/form data
  normalized: {
    sender: { email?: string; phone?: string; name?: string; telegramId?: string };
    recipients: string[];
    subject?: string;
    contentText: string;
    contentHtml?: string;
    attachments: Attachment[];
    timestampIso: string;        // ISO-8601 (μετατροπή σε Date εσωτερικά)
  };
  metadata: {
    providerMessageId: string;
    signatureVerified: boolean;
  };
}
```

---

## UnderstandingResult

```typescript
{
  messageId: string;
  intent: z.enum(['appointment_request', 'invoice', 'document_request', 'property_search', 'outbound_send', 'report_request', 'dashboard_query', 'unknown']);
  entities: Record<string, unknown>;  // extracted entities — ROADMAP: discriminated unions ανά intent (next hardening step)
  confidence: number;            // 0-100%
  rationale: string;             // γιατί αυτό το intent (for audit)
  language: string;              // detected language code ('el', 'en', 'it', etc.)
  urgency: 'low' | 'normal' | 'high' | 'critical';
  policyFlags: string[];         // ['new_sender', 'high_amount', 'missing_delivery_note', etc.]
  companyDetection: {
    companyId: string | null;
    signal: 'recipient_email' | 'known_contact' | 'content_match' | 'fallback';
    confidence: number;
  };
}
```

---

## Proposal

```typescript
{
  messageId: string;
  suggestedActions: Action[];    // [{type: 'send_email', to: '...', body: '...'}, ...]
  requiredApprovals: string[];   // role IDs that must approve
  autoApprovable: boolean;       // confidence > threshold
  summary: string;               // human-readable πρόταση
  alternativeActions?: Action[]; // εναλλακτικές (π.χ. 3 ώρες ραντεβού)
}
```

---

## ExecutionPlan

```typescript
{
  messageId: string;
  idempotencyKey: string;        // αποτρέπει διπλή εκτέλεση
  actions: Action[];
  sideEffects: string[];         // ['email_sent', 'task_created', 'contact_created', etc.]
  rollbackPlan?: Action[];       // τι γίνεται αν αποτύχει
}
```

---

## Contract Versioning & Compatibility

- Κάθε payload περιέχει `schemaVersion: number` (ξεκινά από 1)
- **Backward compatibility**: Νέα πεδία = optional. Ποτέ δεν αφαιρούμε/μετονομάζουμε πεδία χωρίς major version bump
- **Deprecation policy**: Παλιό schema υποστηρίζεται τουλάχιστον 2 releases μετά τη νέα version

---

## Config-Driven Thresholds & Defaults

- Όλα τα νούμερα (timeouts, retries, backoff, alert thresholds, confidence thresholds) ορίζονται σε **config** (όχι hardcoded)
- Per-tenant overrides: κάθε εταιρεία μπορεί να παρακάμψει τα defaults στο Company-Level Configuration
- Αλλαγή config = **χωρίς code change**, χωρίς redeploy

---

## Replay Protection & Deduplication

- **Inbound dedupe**: `providerMessageId` ελέγχεται πριν processing - αν υπάρχει ήδη → skip
- **Outbound idempotency**: `idempotencyKey` σε κάθε execute action
- **Replay window**: Μηνύματα με ίδιο `providerMessageId` μέσα σε 24h → rejected ως duplicate

---

## Data Retention & Privacy

**Defaults** (config-driven, overridable per tenant):
- **Audit logs**: Retention **5 χρόνια** (default - φορολογικός/λογιστικός έλεγχος)
- **Attachments**: Retention βάσει τύπου (τιμολόγια: **10 χρόνια** default, γενικά: **3 χρόνια** default)
- **PII (Προσωπικά Δεδομένα)**: Emails, τηλέφωνα, ΑΦΜ = ευαίσθητα → encrypted at rest, tenant-scoped, GDPR-aware
- **Tenant isolation**: Κανένα PII δεν μοιράζεται μεταξύ εταιρειών

Κάθε εταιρεία μπορεί να παρακάμψει τα retention defaults στο Company-Level Configuration (π.χ. εταιρεία με αυστηρότερους κανονισμούς → 15 χρόνια audit logs).
