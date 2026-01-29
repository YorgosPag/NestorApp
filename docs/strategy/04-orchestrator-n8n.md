# Strategy Document: Orchestrator - n8n

**Document ID**: STRATEGY-004
**Created**: 2026-01-29
**Status**: APPROVED
**Owner**: Architecture Team

---

## 1. Executive Summary

This document defines the strategy for deploying a workflow orchestration platform for the Nestor Construct Platform. The platform currently has **no orchestration layer**. This strategy deploys **n8n self-hosted** for workflow automation.

### Decision

> **Option B: n8n self-hosted** for full control, zero SaaS fees, and security.

### Key Benefits

- **Fair-code License** - Self-host free, no per-workflow costs
- **Full Control** - Data stays on premises
- **Visual Workflows** - Low-code automation
- **Extensibility** - 400+ integrations, custom nodes

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**Status**: **NO ORCHESTRATOR EXISTS**

Currently, automations are scattered:
- Telegram webhook in `src/app/api/communications/webhooks/telegram/`
- Manual triggers for web scraping
- No scheduled jobs

### 2.2 Automation Needs

| Use Case | Current | Target |
|----------|---------|--------|
| **Document Processing** | Manual | Automatic pipeline |
| **Email Parsing** | None | Auto-extract & route |
| **Scheduled Scraping** | None | Daily/weekly runs |
| **Notification Routing** | Basic | Multi-channel |
| **Data Sync** | None | Cross-system sync |

---

## 3. Options Analysis

### Option A: Make.com (SaaS)

| Aspect | Assessment |
|--------|------------|
| **License** | Pay-per-operation |
| **Control** | Low (SaaS) |
| **Cost** | $9-99+/month |

**Cons**:
- Per-operation costs scale badly
- Data leaves infrastructure
- Vendor lock-in

**Verdict**: **NOT RECOMMENDED** - SaaS fees and data sovereignty

---

### Option B: n8n Self-hosted (RECOMMENDED)

| Aspect | Assessment |
|--------|------------|
| **License** | Fair-code (free self-host) |
| **Control** | Full |
| **Cost** | Infrastructure only |

**Pros**:
- Zero SaaS fees
- Full data control
- 400+ integrations
- Active community
- Self-hosted security

**Verdict**: **RECOMMENDED** - Best balance of features/control

---

### Option C: Node-RED

| Aspect | Assessment |
|--------|------------|
| **License** | Apache 2.0 |
| **Control** | Full |
| **Use Case** | IoT-focused |

**Cons**:
- IoT-focused, not business workflows
- Less business integrations
- Smaller enterprise community

**Verdict**: **NOT RECOMMENDED** - Wrong focus

---

## 4. Decision

### 4.1 Final Decision: **n8n Self-hosted**

### 4.2 Decision Rationale

1. **Zero SaaS Fees**: No per-operation costs
2. **Data Sovereignty**: All data stays in our infrastructure
3. **Enterprise Features**: RBAC, audit, SSO available
4. **Community**: Large, active community

---

## 5. Implementation Architecture

### 5.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Internal Network                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Docker Host                             │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │              n8n Container                   │    │    │
│  │  │  - n8n server (:5678)                       │    │    │
│  │  │  - Execution workers                         │    │    │
│  │  │  - Webhook receiver                          │    │    │
│  │  └──────────────────────┬──────────────────────┘    │    │
│  │  ┌──────────────────────▼──────────────────────┐    │    │
│  │  │              PostgreSQL                      │    │    │
│  │  │  - Workflow storage                          │    │    │
│  │  │  - Execution logs                            │    │    │
│  │  │  - Credentials (encrypted)                   │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                             │                                │
│                             │ HTTPS (internal)               │
│                             ▼                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Next.js Application                     │    │
│  │  - Trigger workflows via HTTP                       │    │
│  │  - Receive webhook callbacks                         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ External webhooks (limited)
                              ▼
                    ┌─────────────────┐
                    │  External APIs   │
                    │  - Telegram      │
                    │  - Email (IMAP)  │
                    │  - WhatsApp      │
                    └─────────────────┘
```

### 5.2 Docker Compose

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=${WEBHOOK_URL}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${DB_USER}
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - N8N_ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres
    networks:
      - internal

  postgres:
    image: postgres:15-alpine
    container_name: n8n-postgres
    restart: always
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal

volumes:
  n8n_data:
  postgres_data:

networks:
  internal:
    driver: bridge
```

### 5.3 Security Hardening

| Concern | Mitigation |
|---------|------------|
| **Unauthenticated access** | Basic auth + IP allowlist |
| **Webhook exposure** | Limited external webhooks |
| **Credential theft** | N8N_ENCRYPTION_KEY for secrets |
| **Container escape** | Non-root user, read-only where possible |
| **Network exposure** | Internal network only, no public IP |

---

## 6. Workflow Patterns

### 6.1 Document Processing Workflow

```
Email Received (IMAP trigger)
    │
    ├── Has attachment?
    │   ├── Yes → Download attachment
    │   │         └── Send to OCR service
    │   │             └── Parse response
    │   │                 └── Route by document type
    │   │                     ├── Invoice → Create obligation
    │   │                     ├── Contract → Extract terms
    │   │                     └── Other → Store with text
    │   └── No → Parse email body only
    │
    └── Update Firestore
        └── Send notification
```

### 6.2 Scheduled Scraping Workflow

```
Cron Trigger (daily 06:00)
    │
    └── For each active target:
        │
        ├── Call WebScrapingEngine API
        │   └── Parse response
        │       ├── New properties found?
        │       │   ├── Yes → Store in Firestore
        │       │   │         └── Send alert
        │       │   └── No → Log "no changes"
        │       │
        │       └── Price changes detected?
        │           ├── Yes → Store diff
        │           │         └── Send alert
        │           └── No → Continue
        │
        └── Update last_scraped timestamp
```

### 6.3 Notification Routing Workflow

```
Notification Request (HTTP webhook)
    │
    ├── Parse notification type
    │   ├── urgent → Send immediately
    │   └── normal → Queue for batch
    │
    └── Route to channels:
        ├── Telegram (if configured)
        ├── Email (always)
        └── WhatsApp (if opted-in)
```

---

## 7. Integration with Next.js

### 7.1 Triggering Workflows

```typescript
// src/services/n8n-client.ts
export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL!;
    this.apiKey = process.env.N8N_API_KEY!;
  }

  async triggerWorkflow(
    workflowId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await fetch(`${this.baseUrl}/webhook/${workflowId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(data),
    });
  }
}
```

### 7.2 Receiving Callbacks

```typescript
// src/app/api/n8n/callback/route.ts
export async function POST(request: Request) {
  const signature = request.headers.get('x-n8n-signature');

  // Verify signature
  if (!verifyN8nSignature(signature, await request.text())) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const data = await request.json();

  // Process callback based on workflow
  switch (data.workflowType) {
    case 'document-processed':
      await handleDocumentProcessed(data);
      break;
    case 'scraping-complete':
      await handleScrapingComplete(data);
      break;
    // ...
  }

  return Response.json({ success: true });
}
```

---

## 8. Security Considerations

### 8.1 Network Security

| Layer | Protection |
|-------|------------|
| **External** | No direct internet access |
| **Webhooks** | Signed, allowlisted IPs |
| **Internal** | TLS between services |
| **Credentials** | Encrypted at rest |

### 8.2 Patch Management

- **Cadence**: Monthly security updates
- **Process**: Test in staging → Deploy to production
- **Monitoring**: Subscribe to n8n security advisories

### 8.3 Recent Vulnerabilities

> **Warning**: n8n has had security issues. Recent CVEs should be reviewed before deployment.

| CVE | Severity | Mitigation |
|-----|----------|------------|
| CVE-2024-XXXX | High | Upgrade to 1.x.x |

---

## 9. Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| **G1** | n8n container starts successfully | Pending |
| **G2** | Basic auth functional | Pending |
| **G3** | Workflow executes end-to-end | Pending |
| **G4** | Webhook triggers work | Pending |
| **G5** | Credentials encrypted | Pending |
| **G6** | Backup/restore tested | Pending |
| **G7** | Security hardening applied | Pending |

---

## 10. Acceptance Criteria

### Functional
- [ ] **AC-1**: Workflows can be created via UI
- [ ] **AC-2**: Scheduled workflows run on time
- [ ] **AC-3**: Webhooks trigger workflows
- [ ] **AC-4**: Next.js can trigger/receive n8n
- [ ] **AC-5**: Credentials are securely stored

### Non-Functional
- [ ] **AC-6**: Workflow execution < 30 seconds
- [ ] **AC-7**: System handles 50 concurrent workflows
- [ ] **AC-8**: Service auto-restarts on failure
- [ ] **AC-9**: All executions logged

---

## 11. Related Documents

- **Web Monitoring**: [06-web-monitoring-agents.md](./06-web-monitoring-agents.md)
- **OCR Pipeline**: [02-ocr-document-ingestion.md](./02-ocr-document-ingestion.md)
- **Architecture Review**: `docs/architecture-review/07-automation-integrations.md`
- **n8n Documentation**: https://docs.n8n.io/

---

## 12. Local_Protocol Compliance

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

### License Compliance Note

> **n8n License**: Fair-code (not pure OSS). Self-hosted use is FREE and acceptable. Restrictions apply only to SaaS resale, which does not affect this project.

### Violation Consequences

**Any PR violating Local_Protocol will be REJECTED regardless of functionality.**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy document |
