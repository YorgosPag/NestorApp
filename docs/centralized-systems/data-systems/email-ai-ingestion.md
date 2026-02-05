# 📧 **EMAIL & AI INGESTION SYSTEM**

> **Enterprise Documentation**: Email webhook processing, AI analysis, and communication ingestion
>
> **📊 Stats**: 1 ADR | 3 Providers | Last Updated: 2026-02-05

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-070** | Email & AI Ingestion System | ✅ APPROVED |

---

## 📋 **SYSTEM OVERVIEW**

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL INGESTION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Mailgun  │  │  Brevo   │  │ SendGrid │  (Webhook Providers) │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │             │             │                             │
│       └──────────┬──┴─────────────┘                             │
│                  ▼                                              │
│     ┌───────────────────────────┐                               │
│     │  Webhook Rate Limiter     │                               │
│     │  (with-rate-limit.ts)     │                               │
│     └────────────┬──────────────┘                               │
│                  ▼                                              │
│     ┌───────────────────────────┐                               │
│     │  Signature Verification   │                               │
│     │  (HMAC-SHA256)            │                               │
│     └────────────┬──────────────┘                               │
│                  ▼                                              │
│     ┌───────────────────────────┐                               │
│     │  Email Inbound Service    │                               │
│     │  (email-inbound-service)  │                               │
│     └────────────┬──────────────┘                               │
│                  │                                              │
│        ┌─────────┼─────────┐                                    │
│        ▼         ▼         ▼                                    │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│   │ Routing │ │   AI    │ │Attach.  │                          │
│   │  Rules  │ │Analysis │ │Process  │                          │
│   └────┬────┘ └────┬────┘ └────┬────┘                          │
│        │           │           │                                │
│        └───────────┼───────────┘                                │
│                    ▼                                            │
│     ┌───────────────────────────┐                               │
│     │      Firestore Write      │                               │
│     │  (messages, files, etc.)  │                               │
│     └───────────────────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 **WEBHOOK ENDPOINTS**

### Provider Endpoints

| Provider | Endpoint | Method | Content-Type |
|----------|----------|--------|--------------|
| **Mailgun** | `/api/communications/webhooks/mailgun/inbound` | POST | `multipart/form-data` |
| **Brevo** | `/api/communications/webhooks/brevo/inbound` | POST | `application/json` |
| **SendGrid** | `/api/webhooks/sendgrid/inbound` | POST | `multipart/form-data` |

### Health Check

```bash
# Check Mailgun endpoint status
curl https://nestor-app.vercel.app/api/communications/webhooks/mailgun/inbound
# Expected: {"status":"ok","service":"mailgun-inbound","hasSigningKey":false}
```

---

## 🛡️ **SIGNATURE VERIFICATION**

### Mailgun HMAC-SHA256

```typescript
// Signature verification (from route.ts)
function verifyMailgunSignature(params: {
  timestamp?: string;
  token?: string;
  signature?: string;
  signingKey?: string;
}): { valid: boolean; reason?: string };

// Expected digest = HMAC-SHA256(timestamp + token, signingKey)
```

### Security Policy Integration

```typescript
import { getCurrentSecurityPolicy } from '@/config/environment-security-config';

const policy = getCurrentSecurityPolicy();
// In production: policy.requireWebhookSecrets = true
// Requires MAILGUN_WEBHOOK_SIGNING_KEY to be set
```

---

## 📨 **EMAIL INBOUND SERVICE**

### Canonical Location

```
src/services/communications/inbound/email-inbound-service.ts
```

### Main Function

```typescript
import { processInboundEmail } from '@/services/communications/inbound';

const result = await processInboundEmail({
  provider: 'mailgun',
  providerMessageId: string,
  sender: ParsedAddress,
  recipients: string[],
  subject: string,
  contentText: string,
  receivedAt?: string,
  attachments?: InboundEmailAttachment[],
  raw?: Record<string, unknown>,
});

// Returns:
// { processed: true, skipped: false, communicationId: string, attachments: [...] }
// { processed: false, skipped: true, reason: 'routing_unmatched' | 'duplicate' }
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Routing** | Pattern-based routing via Firestore rules |
| **Deduplication** | Uses `generateGlobalMessageDocId()` to prevent duplicates |
| **Contact Auto-Creation** | Creates new contact if sender not found |
| **AI Analysis** | Intent classification for triage |
| **Attachment Processing** | Upload to Firebase Storage with classification |

---

## 🔀 **ROUTING CONFIGURATION**

### Firestore Location

```
Collection: system
Document: settings
Field: integrations.emailInboundRouting
```

### Required Structure

```json
{
  "integrations": {
    "emailInboundRouting": [
      {
        "pattern": "inbound@nestorconstruct.gr",
        "companyId": "pzNUy8ksddGCtcQMqumR",
        "isActive": true
      },
      {
        "pattern": "@nestorconstruct.gr",
        "companyId": "pzNUy8ksddGCtcQMqumR",
        "isActive": true
      }
    ]
  }
}
```

### Pattern Types

| Pattern | Matches |
|---------|---------|
| `inbound@example.com` | Exact email match |
| `@example.com` | Any email at domain |
| `example.com` | Any email at domain (shorthand) |

---

## 🤖 **AI ANALYSIS SYSTEM**

### Provider Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  AI PROVIDER FACTORY                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Environment Variable: AI_PROVIDER                      │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    Mock     │  │   OpenAI    │  │  (Future)   │    │
│  │  Provider   │  │  Provider   │  │  Anthropic  │    │
│  │  (default)  │  │  (if key)   │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Canonical Files

| Component | Path |
|-----------|------|
| Interface | `src/services/ai-analysis/providers/IAIAnalysisProvider.ts` |
| Factory | `src/services/ai-analysis/providers/ai-provider-factory.ts` |
| Mock Provider | `src/services/ai-analysis/providers/MockAIAnalysisProvider.ts` |
| OpenAI Provider | `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` |
| Schemas | `src/schemas/ai-analysis.ts` |
| Config | `src/config/ai-analysis-config.ts` |

### Analysis Types

#### 1. Message Intent Analysis

```typescript
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';

const aiProvider = createAIAnalysisProvider();
const analysis = await aiProvider.analyze({
  kind: 'message_intent',
  messageText: 'I need help with my project',
  context: {
    senderName: 'John Doe',
    channel: 'email',
  },
});

// Returns: MessageIntentAnalysis
// {
//   kind: 'message_intent',
//   intentType: 'support_request' | 'inquiry' | 'complaint' | ...,
//   confidence: 0.85,
//   needsTriage: true,
//   extractedEntities: { projectId?: string, ... },
//   rawMessage: string,
// }
```

#### 2. Document Classification

```typescript
const classification = await aiProvider.analyze({
  kind: 'document_classify',
  content: Buffer.from(fileContent),
  filename: 'invoice.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 12345,
});

// Returns: DocumentClassifyAnalysis
// {
//   kind: 'document_classify',
//   documentType: 'invoice' | 'contract' | 'floor_plan' | ...,
//   confidence: 0.92,
//   needsTriage: false,
//   signals: ['amount: 5000€', 'date: 2026-02-05'],
// }
```

### Provider Configuration

```typescript
// src/config/ai-analysis-config.ts
export const AI_ANALYSIS_DEFAULTS = {
  PROVIDER: process.env.AI_PROVIDER,        // 'mock' | 'openai'
  FALLBACK_CONFIDENCE: 0.5,
  FALLBACK_NEEDS_TRIAGE: true,
  OPENAI: {
    BASE_URL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    TEXT_MODEL: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    VISION_MODEL: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
    TIMEOUT_MS: 30000,
    MAX_RETRIES: 2,
  },
};
```

---

## 📎 **ATTACHMENT PROCESSING**

### Pipeline

1. **Validation**: Check size limits per file type
2. **Download**: Get content from webhook payload
3. **Classification**: AI analysis (for documents/images)
4. **Upload**: Firebase Storage with metadata
5. **Record**: Create `files` collection entry

### Storage Path Format

```
companies/{companyId}/files/{category}/{fileId}.{ext}
```

### Size Limits

| Type | Max Size |
|------|----------|
| Image | 10 MB |
| Document | 50 MB |
| Video | 100 MB |
| Audio | 50 MB |

---

## ⚙️ **ENVIRONMENT VARIABLES**

### Required for Production

| Variable | Description | Required |
|----------|-------------|----------|
| `MAILGUN_WEBHOOK_SIGNING_KEY` | HMAC signing key from Mailgun | ✅ Production |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis | ❌ Optional |
| `AI_PROVIDER` | Provider selection (`mock` or `openai`) | ❌ Optional |

### Vercel Configuration

```bash
# Set in Vercel Dashboard → Settings → Environment Variables
MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key
OPENAI_API_KEY=sk-xxx
AI_PROVIDER=openai
```

---

## 🧪 **TESTING**

### Unit Tests

```
src/services/ai-analysis/__tests__/MockAIAnalysisProvider.test.ts
# 36 tests covering all analysis scenarios
```

### Manual Testing

1. **Health Check**:
   ```bash
   curl https://nestor-app.vercel.app/api/communications/webhooks/mailgun/inbound
   ```

2. **Send Test Email**:
   - Send to: `inbound@nestorconstruct.gr`
   - Check Vercel logs for webhook hit
   - Check Firestore `messages` collection

3. **Verify Attachment Upload**:
   - Send email with PDF attachment
   - Check Firebase Storage
   - Check `files` collection

---

## 🚨 **SETUP CHECKLIST**

### Step 1: Firestore Routing Rule

```javascript
// In Firebase Console → Firestore → system/settings
{
  integrations: {
    emailInboundRouting: [
      {
        pattern: "inbound@nestorconstruct.gr",
        companyId: "pzNUy8ksddGCtcQMqumR",
        isActive: true
      }
    ]
  }
}
```

### Step 2: Mailgun Dashboard

1. Login to Mailgun Dashboard
2. Go to Receiving → Routes
3. Create new route:
   - **Expression Type**: Match Recipient
   - **Recipient**: `inbound@nestorconstruct.gr`
   - **Action**: Forward to `https://nestor-app.vercel.app/api/communications/webhooks/mailgun/inbound`
4. Copy Signing Key from Webhooks settings

### Step 3: Vercel Environment Variables

```bash
MAILGUN_WEBHOOK_SIGNING_KEY=<from-mailgun-dashboard>
```

### Step 4: (Optional) Enable AI Analysis

```bash
OPENAI_API_KEY=sk-xxx
AI_PROVIDER=openai
```

---

## 📚 **RELATED DOCUMENTATION**

- **[ADR Index](../reference/adr-index.md)** - Complete ADR listing
- **[Entity Systems](./entity-systems.md)** - Entity linking, uploads
- **[Alert Engine](./alert-engine.md)** - Real-time notifications
- **[Security Overview](../security/index.md)** - Authentication & authorization

---

> **🔄 Last Updated**: 2026-02-05
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
