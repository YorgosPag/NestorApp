# ADR-070: Email & AI Ingestion System

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-05 |
| **Category** | Backend Systems |
| **Canonical Location** | `src/services/communications/inbound/email-inbound-service.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### The Need

Η εφαρμογή χρειάζεται να λαμβάνει emails από εξωτερικούς αποστολείς (πελάτες, συνεργάτες) και να τα επεξεργάζεται αυτόματα με AI analysis για triage και classification.

### The Problem

- ❌ **No email ingestion**: Τα emails δεν μπορούσαν να εισέλθουν στο σύστημα αυτόματα
- ❌ **Manual triage**: Χειροκίνητη ταξινόμηση επικοινωνιών
- ❌ **No AI integration**: Έλλειψη AI analysis για intent detection
- ❌ **Scattered attachments**: Τα attachments δεν αποθηκεύονταν κεντρικά

---

## 2. Decision

Υλοποιήθηκε **Enterprise Email Ingestion Pipeline** με:
- Multi-provider webhook support (Mailgun, SendGrid)
- AI analysis integration (mock + OpenAI providers)
- Pattern-based routing
- Automatic contact creation
- Attachment processing με Firebase Storage

### Architecture Overview

```
Email Provider → Webhook → Signature Check → Routing → AI Analysis → Firestore
```

### Canonical Files

| Component | Path |
|-----------|------|
| **Email Service** | `src/services/communications/inbound/email-inbound-service.ts` |
| **Types** | `src/services/communications/inbound/types.ts` |
| **Mailgun Webhook** | `src/app/api/communications/webhooks/mailgun/inbound/route.ts` |
| **AI Interface** | `src/services/ai-analysis/providers/IAIAnalysisProvider.ts` |
| **AI Factory** | `src/services/ai-analysis/providers/ai-provider-factory.ts` |
| **Mock Provider** | `src/services/ai-analysis/providers/MockAIAnalysisProvider.ts` |
| **OpenAI Provider** | `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` |
| **AI Schemas** | `src/schemas/ai-analysis.ts` |
| **AI Config** | `src/config/ai-analysis-config.ts` |

### API Usage

```typescript
// Process inbound email
import { processInboundEmail } from '@/services/communications/inbound';

const result = await processInboundEmail({
  provider: 'mailgun',
  providerMessageId: 'msg_123',
  sender: { email: 'user@example.com', name: 'John' },
  recipients: ['inbound@nestorconstruct.gr'],
  subject: 'Project inquiry',
  contentText: 'Hello, I need help...',
  attachments: [...],
});

// AI Analysis
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';

const aiProvider = createAIAnalysisProvider();
const analysis = await aiProvider.analyze({
  kind: 'message_intent',
  messageText: 'I have a problem with my order',
});
```

### Routing Configuration

Stored in Firestore: `system/settings` → `integrations.emailInboundRouting`

```json
{
  "integrations": {
    "emailInboundRouting": [
      {
        "pattern": "inbound@nestorconstruct.gr",
        "companyId": "pzNUy8ksddGCtcQMqumR",
        "isActive": true
      }
    ]
  }
}
```

---

## 3. Consequences

### Positive

- ✅ **Automated ingestion**: Emails arrive automatically in the system
- ✅ **AI-powered triage**: Intent detection reduces manual work
- ✅ **Multi-provider support**: Flexibility in email provider choice
- ✅ **Secure webhooks**: HMAC signature verification
- ✅ **Centralized attachments**: All files in Firebase Storage
- ✅ **Contact auto-creation**: No manual contact entry needed
- ✅ **Testable**: Mock provider for deterministic testing (36 tests)

### Negative

- ⚠️ **External dependency**: Requires webhook configuration in email provider dashboard
- ⚠️ **AI costs**: OpenAI API has usage costs (mitigated by mock provider option)

---

## 4. Prohibitions (after this ADR)

- ⛔ **Direct email parsing**: Use `processInboundEmail()` service only
- ⛔ **Custom AI implementations**: Use `IAIAnalysisProvider` interface
- ⛔ **Hardcoded routing**: Use Firestore routing rules
- ⛔ **Inline attachment storage**: Use `buildIngestionFileRecordData()` pattern

---

## 5. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Webhook signature verification | ✅ Production |
| `OPENAI_API_KEY` | OpenAI API access | ❌ Optional |
| `AI_PROVIDER` | Provider selection (`mock` / `openai`) | ❌ Optional |
| `OPENAI_TEXT_MODEL` | Text analysis model | ❌ Default: `gpt-4o-mini` |
| `OPENAI_VISION_MODEL` | Vision analysis model | ❌ Default: `gpt-4o-mini` |

---

## 6. Testing

### Unit Tests

```bash
# Run AI provider tests
npm test -- MockAIAnalysisProvider.test.ts
# 36 tests pass
```

### Integration Testing

1. **Health check**: `GET /api/communications/webhooks/mailgun/inbound`
2. **Send test email** to `inbound@nestorconstruct.gr`
3. **Check Firestore** `messages` collection
4. **Verify attachments** in Firebase Storage

---

## 7. Setup Checklist

- [ ] Create Firestore routing rule in `system/settings`
- [ ] Configure Mailgun receiving route
- [ ] Add `MAILGUN_WEBHOOK_SIGNING_KEY` to Vercel
- [ ] (Optional) Add `OPENAI_API_KEY` for AI analysis
- [ ] (Optional) Set `AI_PROVIDER=openai`

---

## 8. References

- **Documentation**: [`docs/centralized-systems/data-systems/email-ai-ingestion.md`](../../data-systems/email-ai-ingestion.md)
- **Related**: [ADR-018: Unified Upload Service](./ADR-018-unified-upload-service.md)
- **Related**: [ADR-012: Entity Linking Service](./ADR-012-entity-linking-service.md)
- **Industry Standard**: Mailgun Webhooks, OpenAI API

---

## 9. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-05 | ADR Created | Claude Code (Anthropic AI) |
| 2026-02-05 | Status: Approved | Γιώργος Παγώνης |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
