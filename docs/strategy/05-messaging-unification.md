# Strategy Document: Messaging Unification

**Document ID**: STRATEGY-005
**Created**: 2026-01-29
**Status**: APPROVED
**Owner**: Architecture Team

---

## 1. Executive Summary

This document defines the strategy for expanding messaging capabilities beyond Telegram. The platform currently has **Telegram fully implemented** and **Email active**, but **WhatsApp/SMS are declared but not implemented**.

### Decision

> **Option B: Meta Cloud API for WhatsApp** with direct integration.

### Key Benefits

- **Direct API** - No middleware costs
- **Lower Costs** - vs Twilio per-message fees
- **Official Support** - Meta-backed
- **Unified Model** - Single conversation model for all channels

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**File**: `src/types/conversations.ts`

```typescript
// Canonical Conversation Model - already enterprise-grade
export interface Conversation {
  id: string;
  channel: CommunicationChannel;
  participants: ConversationParticipant[];
  status: ConversationStatus;
  // ... full model exists
}

export interface CanonicalMessage {
  id: string;
  conversationId: string;
  channel: CommunicationChannel;
  // ... full model exists
}
```

**File**: `src/lib/communications/providers/telegram.ts` - Fully implemented

### 2.2 Current Capabilities

| Channel | Status | Details |
|---------|--------|---------|
| **Telegram** | Yes | Full implementation, webhooks |
| **Email** | Yes | SendGrid/Resend |
| **WhatsApp** | **NO** | Types declared, not implemented |
| **SMS** | **NO** | Types declared, not implemented |

### 2.3 Canonical Model (SSoT)

The `src/types/conversations.ts` already defines a **channel-agnostic** conversation model. This is the Single Source of Truth (SSoT) that all channels must normalize to.

---

## 3. Options Analysis

### Option A: WhatsApp via Twilio

| Aspect | Assessment |
|--------|------------|
| **Integration** | Easy (Twilio SDK) |
| **Cost** | $0.005-0.05/message + Twilio fees |
| **Reliability** | High (managed) |

**Cons**:
- Per-message costs add up
- Extra layer (Twilio middleware)
- Markup on Meta API prices

**Verdict**: **NOT RECOMMENDED** - Higher costs

---

### Option B: WhatsApp via Meta Cloud API (RECOMMENDED)

| Aspect | Assessment |
|--------|------------|
| **Integration** | Direct API |
| **Cost** | $0.003-0.02/message (direct) |
| **Reliability** | High (Meta infrastructure) |

**Pros**:
- Direct API access, no middleware
- Lower per-message costs
- Official Meta support
- Full feature access

**Cons**:
- More complex setup (Business verification)
- Requires Meta Business Manager

**Verdict**: **RECOMMENDED** - Best cost/control balance

---

### Option C: Keep Telegram-only

| Aspect | Assessment |
|--------|------------|
| **Integration** | Already done |
| **Cost** | Free |
| **Reach** | Limited |

**Cons**:
- Not everyone uses Telegram
- Business communication limited

**Verdict**: **NOT SUFFICIENT** - Limited reach

---

## 4. Decision

### 4.1 Final Decision: **Meta Cloud API for WhatsApp**

### 4.2 Decision Rationale

1. **Direct API**: No middleware markup
2. **Lower Costs**: Direct Meta pricing
3. **Business Reach**: WhatsApp has wider business adoption
4. **Unified Model**: Fits existing conversation architecture

---

## 5. Implementation Architecture

### 5.1 Multi-Channel Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Inbound Messages                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Telegram Webhook → Telegram Adapter                 │    │
│  │  /api/webhooks/telegram                             │    │
│  └───────────────────────┬─────────────────────────────┘    │
│  ┌───────────────────────│─────────────────────────────┐    │
│  │  WhatsApp Webhook → WhatsApp Adapter                 │    │
│  │  /api/webhooks/whatsapp                             │    │
│  └───────────────────────┬─────────────────────────────┘    │
│  ┌───────────────────────│─────────────────────────────┐    │
│  │  Email Webhook → Email Adapter                       │    │
│  │  /api/webhooks/email                                │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Inbound Normalization                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  InboundMessageNormalized                            │    │
│  │  - providerEventId                                   │    │
│  │  - channel: ImplementedChannel                       │    │
│  │  - sender: { externalUserId, displayName }          │    │
│  │  - content: { text, attachments }                   │    │
│  │  - timestamp                                         │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Message Router                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Deduplicate (providerEventId)                   │    │
│  │  2. Resolve identity (ExternalIdentity → Contact)   │    │
│  │  3. Find/create conversation                         │    │
│  │  4. Store CanonicalMessage                          │    │
│  │  5. Trigger business logic                           │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Firestore Storage                            │
│  - conversations/{conversationId}                           │
│  - messages/{messageId}                                     │
│  - external_identities/{identityId}                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Outbound Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Outbound Request                          │
│  sendMessage(conversationId, content, channel?)             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Channel Router                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Get conversation                                 │    │
│  │  2. Determine channel (explicit or conversation's)  │    │
│  │  3. Get recipient external identity                  │    │
│  │  4. Check consent (opt-in status)                   │    │
│  │  5. Apply rate limiting                              │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Telegram   │ │  WhatsApp   │ │   Email     │
    │  Provider   │ │  Provider   │ │  Provider   │
    │             │ │             │ │             │
    │ Bot API     │ │ Meta Cloud  │ │ SendGrid    │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### 5.3 WhatsApp Provider Implementation

```typescript
// src/lib/communications/providers/whatsapp.ts
export class WhatsAppProvider implements MessageProvider {
  private phoneNumberId: string;
  private accessToken: string;

  async sendMessage(
    recipient: ExternalIdentity,
    content: MessageContent
  ): Promise<SendResult> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient.externalUserId,  // Phone number
          type: content.attachments?.length ? 'document' : 'text',
          text: content.text ? { body: content.text } : undefined,
        }),
      }
    );

    const data = await response.json();
    return {
      success: response.ok,
      providerMessageId: data.messages?.[0]?.id,
      error: data.error?.message,
    };
  }
}
```

---

## 6. Inbound Normalization Contract

### 6.1 All Adapters Must Output

```typescript
interface InboundMessageNormalized {
  providerEventId: string;      // For idempotency
  providerMessageId: string;
  channel: ImplementedChannel;
  sender: {
    externalUserId: string;     // Phone, telegram ID, email
    displayName: string;
    username?: string;
  };
  recipient: {
    externalUserId: string;     // Our bot/number
    isBot: boolean;
  };
  content: {
    text?: string;
    attachments?: MessageAttachment[];
  };
  timestamp: Date;
  rawPayload?: unknown;         // For debugging only
}
```

### 6.2 WhatsApp Webhook Normalization

```typescript
// src/app/api/webhooks/whatsapp/route.ts
function normalizeWhatsAppMessage(
  webhook: WhatsAppWebhook
): InboundMessageNormalized {
  const message = webhook.entry[0].changes[0].value.messages[0];
  const contact = webhook.entry[0].changes[0].value.contacts[0];

  return {
    providerEventId: webhook.entry[0].id,
    providerMessageId: message.id,
    channel: 'whatsapp',
    sender: {
      externalUserId: message.from,  // Phone number
      displayName: contact.profile.name,
    },
    recipient: {
      externalUserId: webhook.entry[0].changes[0].value.metadata.phone_number_id,
      isBot: true,
    },
    content: {
      text: message.text?.body,
      attachments: message.image ? [{
        type: 'image',
        url: message.image.url,
      }] : undefined,
    },
    timestamp: new Date(parseInt(message.timestamp) * 1000),
    rawPayload: webhook,
  };
}
```

---

## 7. Rate Limiting & Compliance

### 7.1 WhatsApp Business Policy

| Policy | Requirement |
|--------|-------------|
| **24-hour window** | Free replies within 24h of user message |
| **Template messages** | Required for outbound outside window |
| **Opt-in** | User must opt-in for marketing |
| **Opt-out** | Must honor STOP requests |

### 7.2 Rate Limits

```typescript
const rateLimits = {
  telegram: {
    messagesPerSecond: 30,
    messagesPerChat: 1,  // per second
  },
  whatsapp: {
    tier1: 250,    // messages/day (new business)
    tier2: 1000,   // after quality rating
    tier3: 10000,  // verified business
    tier4: 100000, // enterprise
  },
  email: {
    perHour: 100,  // SendGrid free tier
  },
};
```

### 7.3 Consent Management

```typescript
interface ExternalIdentity {
  // ... existing fields
  consent: {
    marketing: boolean;        // Can receive promotions
    transactional: boolean;    // Can receive order updates
    consentedAt?: Date;
    optOutAt?: Date;
  };
}
```

---

## 8. Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| **G1** | WhatsApp Business verification | Pending |
| **G2** | Webhook receives messages | Pending |
| **G3** | Messages normalize correctly | Pending |
| **G4** | Outbound messages deliver | Pending |
| **G5** | Rate limiting enforced | Pending |
| **G6** | Consent checked before send | Pending |
| **G7** | Opt-out honored | Pending |

---

## 9. Acceptance Criteria

### Functional
- [ ] **AC-1**: WhatsApp messages appear in unified inbox
- [ ] **AC-2**: Agents can reply via WhatsApp
- [ ] **AC-3**: Media attachments work both ways
- [ ] **AC-4**: Conversation history unified across channels
- [ ] **AC-5**: Opt-out stops marketing messages

### Non-Functional
- [ ] **AC-6**: Message delivery < 5 seconds
- [ ] **AC-7**: 99.9% delivery success rate
- [ ] **AC-8**: Rate limits prevent throttling
- [ ] **AC-9**: All messages logged to audit

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Webhook spoofing** | Verify Meta signature |
| **Token theft** | Tokens in env vars, encrypted |
| **Data exposure** | TLS only, no logging of content |
| **Spam abuse** | Rate limiting, consent checks |

---

## 11. Related Documents

- **Conversation Types**: `src/types/conversations.ts`
- **Existing Telegram**: `src/lib/communications/providers/telegram.ts`
- **Orchestrator**: [04-orchestrator-n8n.md](./04-orchestrator-n8n.md)
- **Meta WhatsApp Docs**: https://developers.facebook.com/docs/whatsapp/cloud-api

---

## 12. Paid Exception Notice

> **WARNING**: WhatsApp via Meta Cloud API is a **PAID SERVICE** and deviates from "strongest free OSS first" policy.

### Exception Justification Required

| Requirement | Status |
|-------------|--------|
| **Business Case** | User demand for WhatsApp must be documented |
| **ROI Calculation** | Cost vs benefit analysis required |
| **Free Alternative First** | Telegram + Email must be default channels |
| **Opt-in Only** | WhatsApp is NOT default, requires explicit activation |

### Default Channel Priority

1. **Telegram** (FREE) - Primary channel
2. **Email** (FREE/low-cost) - Secondary channel
3. **WhatsApp** (PAID) - Only with business justification

### Cost Ceiling

- **Per-message cost**: $0.003-0.02
- **Monthly ceiling**: Must be defined before activation
- **Monitoring**: Monthly cost review required

---

## 13. Local_Protocol Compliance

> **MANDATORY**: All implementation PRs for this strategy MUST comply with Local_Protocol (CLAUDE.md) as a **non-negotiable quality gate**.

### Required Compliance Checks

| Rule | Requirement | Enforcement |
|------|-------------|-------------|
| **ZERO `any`** | No TypeScript `any` types | PR blocked if found |
| **ZERO `as any`** | No type casting to `any` | PR blocked if found |
| **ZERO `@ts-ignore`** | No TypeScript ignores | PR blocked if found |
| **ZERO inline styles** | Use design tokens only | PR blocked if found |
| **ZERO duplicates** | Use centralized systems | PR blocked if found |
| **ZERO hardcoded values** | Use config/constants | PR blocked if found |

### Pre-PR Checklist

Before any PR implementing this strategy:

- [ ] Searched for existing code (Grep/Glob)
- [ ] No `any` types in new code
- [ ] Uses centralized systems from `centralized_systems.md`
- [ ] No inline styles (uses design tokens)
- [ ] Asked permission before creating new files
- [ ] TypeScript compiles without errors

### Violation Consequences

**Any PR violating Local_Protocol will be REJECTED regardless of functionality.**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy document |
