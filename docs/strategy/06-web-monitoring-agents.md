# Strategy Document: Web Monitoring Agents

**Document ID**: STRATEGY-006
**Created**: 2026-01-29
**Status**: APPROVED
**Owner**: Architecture Team

---

## 1. Executive Summary

This document defines the strategy for adding scheduled execution to existing web scraping capabilities. The platform has **WebScrapingEngine implemented** but with **no scheduling** - only manual triggers.

### Decision

> **Option A: n8n scheduled workflows** for centralized orchestration.

### Key Benefits

- **Centralized Scheduling** - All jobs in one place
- **Visual Monitoring** - n8n dashboard
- **Integrated Pipeline** - Links with OCR, notifications
- **No New Infrastructure** - Reuses n8n deployment

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**File**: `src/services/real-estate-monitor/WebScrapingEngine.ts`

```typescript
export class WebScrapingEngine {
  private readonly defaultTargets: ScrapingTarget[] = [
    {
      id: 'spitogatos',
      name: 'Spitogatos.gr',
      baseUrl: 'https://www.spitogatos.gr',
      enabled: true,
      rateLimit: {
        requestsPerMinute: 30,
        respectRobotsTxt: true,
        userAgent: 'GEO-ALERT Real Estate Monitor/1.0'
      },
      selectors: { /* ... */ }
    },
    {
      id: 'xe',
      name: 'XE.gr',
      baseUrl: 'https://www.xe.gr',
      enabled: true,
      // ...
    }
  ];

  async scrapeAll(options: ScrapingOptions): Promise<ScrapingResult[]> {
    // Manual trigger only - NO SCHEDULING
  }
}
```

**File**: `src/services/real-estate-monitor/AddressResolver.ts` - Geocoding active

### 2.2 Current Capabilities

| Capability | Status | Details |
|------------|--------|---------|
| **Scraping Engine** | Yes | Spitogatos, XE targets |
| **Rate Limiting** | Yes | Built-in |
| **Geocoding** | Yes | AddressResolver |
| **Scheduling** | **NO** | Manual trigger only |
| **Diff Detection** | **NO** | No price change alerts |
| **Alert Rules** | **NO** | No configurable triggers |

### 2.3 Business Value of Scheduling

| Use Case | Without Scheduling | With Scheduling |
|----------|-------------------|-----------------|
| **Price Monitoring** | Manual check | Daily auto-check |
| **New Listings** | Miss opportunities | Instant alerts |
| **Market Trends** | No data | Historical tracking |
| **Competitor Watch** | Manual effort | Automated |

---

## 3. Options Analysis

### Option A: n8n Scheduled Workflows (RECOMMENDED)

| Aspect | Assessment |
|--------|------------|
| **Infrastructure** | Reuses existing n8n |
| **Complexity** | Low (visual workflows) |
| **Monitoring** | Built-in dashboard |

**Pros**:
- Centralized with other automations
- Visual workflow design
- Easy schedule management
- Built-in retry/error handling

**Verdict**: **RECOMMENDED** - Leverages existing infrastructure

---

### Option B: Firebase Cloud Functions Scheduled

| Aspect | Assessment |
|--------|------------|
| **Infrastructure** | Firebase Functions |
| **Complexity** | Medium (code-based) |
| **Monitoring** | Firebase Console |

**Cons**:
- Cold start delays
- Limited execution time (540s)
- Separate from other automations

**Verdict**: **NOT RECOMMENDED** - Fragmented approach

---

### Option C: Huginn (Dedicated Agent Platform)

| Aspect | Assessment |
|--------|------------|
| **Infrastructure** | New deployment |
| **Complexity** | High |
| **Monitoring** | Dedicated UI |

**Cons**:
- New system to maintain
- Ruby-based (different stack)
- Overkill for current needs

**Verdict**: **NOT RECOMMENDED** - Too complex

---

## 4. Decision

### 4.1 Final Decision: **n8n Scheduled Workflows**

### 4.2 Decision Rationale

1. **Reuse Infrastructure**: n8n already deployed for orchestration
2. **Centralized Management**: All schedules in one place
3. **Visual Workflows**: Easy to modify schedules
4. **Integration**: Direct connection to Next.js and notifications

---

## 5. Implementation Architecture

### 5.1 Scheduling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    n8n Scheduler                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cron Triggers                                       │    │
│  │  - Daily 06:00: Price monitoring                     │    │
│  │  - Weekly Mon 00:00: Market report                   │    │
│  │  - Every 4h: New listings check                      │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  POST /api/scraping/trigger                          │    │
│  │  - Auth: n8n service account                        │    │
│  │  - Body: { targets, options }                        │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 WebScrapingEngine                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  scrapeAll(options)                                  │    │
│  │  - Rate limiting                                     │    │
│  │  - robots.txt compliance                             │    │
│  │  - Error handling                                    │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Diff Detection                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Compare with previous snapshot                      │    │
│  │  - New properties                                    │    │
│  │  - Price changes                                     │    │
│  │  - Removed listings                                  │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Alert & Storage                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - Store results in Firestore                        │    │
│  │  - Send alerts (Telegram/Email)                      │    │
│  │  - Update analytics                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 n8n Workflow Definition

```json
{
  "name": "Daily Price Monitoring",
  "nodes": [
    {
      "name": "Cron Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": { "interval": [{ "field": "cronExpression", "expression": "0 6 * * *" }] }
      }
    },
    {
      "name": "Get Active Targets",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{$env.NEXT_APP_URL}}/api/scraping/targets",
        "method": "GET",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      }
    },
    {
      "name": "Trigger Scraping",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{$env.NEXT_APP_URL}}/api/scraping/trigger",
        "method": "POST",
        "body": { "targets": "={{$json.enabledTargets}}" }
      }
    },
    {
      "name": "Process Results",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Diff detection, alert generation"
      }
    },
    {
      "name": "Send Alerts",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{$env.NEXT_APP_URL}}/api/notifications/send",
        "method": "POST"
      }
    }
  ]
}
```

### 5.3 API Endpoints

```typescript
// src/app/api/scraping/trigger/route.ts
export async function POST(request: Request) {
  // Verify n8n service account
  const auth = await verifyServiceAccount(request);
  if (!auth.valid) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { targets, options } = await request.json();

  // Trigger scraping
  const results = await webScrapingEngine.scrapeAll({
    ...options,
    targets: targets || undefined,
  });

  // Detect changes
  const diff = await detectChanges(results);

  // Store snapshot
  await storeSnapshot(results);

  return Response.json({
    success: true,
    totalProperties: results.reduce((acc, r) => acc + r.properties.length, 0),
    newListings: diff.new.length,
    priceChanges: diff.priceChanges.length,
    removedListings: diff.removed.length,
  });
}
```

---

## 6. Diff Detection & Snapshots

### 6.1 Snapshot Storage

```typescript
// Firestore: scraping_snapshots/{snapshotId}
interface ScrapingSnapshot {
  id: string;
  timestamp: Date;
  target: string;           // 'spitogatos', 'xe'
  properties: {
    [externalId: string]: {
      price: number;
      title: string;
      url: string;
      firstSeen: Date;
      lastSeen: Date;
    }
  };
}
```

### 6.2 Change Detection

```typescript
interface ScrapingDiff {
  new: ScrapedProperty[];        // First time seen
  removed: ScrapedProperty[];    // Not in latest scrape
  priceChanges: {
    property: ScrapedProperty;
    previousPrice: number;
    newPrice: number;
    changePercent: number;
  }[];
}

async function detectChanges(
  current: ScrapingResult[],
  previousSnapshot: ScrapingSnapshot
): Promise<ScrapingDiff> {
  const currentIds = new Set(current.flatMap(r => r.properties.map(p => p.id)));
  const previousIds = new Set(Object.keys(previousSnapshot.properties));

  return {
    new: current.flatMap(r => r.properties.filter(p => !previousIds.has(p.id))),
    removed: Object.values(previousSnapshot.properties)
      .filter(p => !currentIds.has(p.id)),
    priceChanges: current.flatMap(r => r.properties
      .filter(p => {
        const prev = previousSnapshot.properties[p.id];
        return prev && prev.price !== p.price;
      })
      .map(p => ({
        property: p,
        previousPrice: previousSnapshot.properties[p.id].price,
        newPrice: p.price!,
        changePercent: ((p.price! - previousSnapshot.properties[p.id].price)
          / previousSnapshot.properties[p.id].price) * 100,
      }))
    ),
  };
}
```

---

## 7. Alert Rules

### 7.1 Configurable Alert Rules

```typescript
interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'new_listing' | 'price_drop' | 'price_increase' | 'removed';
    conditions?: {
      minPriceDropPercent?: number;  // e.g., 10%
      maxPrice?: number;
      areas?: string[];
      propertyTypes?: string[];
    };
  };
  actions: {
    telegram?: boolean;
    email?: boolean;
    webhook?: string;
  };
  userId: string;  // Owner of rule
}
```

### 7.2 Default Alert Rules

| Rule | Trigger | Action |
|------|---------|--------|
| **New Listing** | Any new property | Telegram |
| **Price Drop > 5%** | Price decreased 5%+ | Telegram + Email |
| **Price Drop > 15%** | Price decreased 15%+ | Telegram + Email (urgent) |
| **Listing Removed** | Property no longer listed | Log only |

---

## 8. Rate Limiting & Compliance

### 8.1 robots.txt Compliance

```typescript
// Built into WebScrapingEngine
rateLimit: {
  requestsPerMinute: 30,
  respectRobotsTxt: true,  // ALWAYS true
  userAgent: 'GEO-ALERT Real Estate Monitor/1.0'
}
```

### 8.2 Ethical Scraping Guidelines

| Guideline | Implementation |
|-----------|----------------|
| **Respect robots.txt** | Parser checks before scraping |
| **Rate limiting** | Max 30 requests/minute |
| **Identify yourself** | Custom User-Agent |
| **Cache results** | Don't re-scrape within 4 hours |
| **Handle errors gracefully** | Exponential backoff |

---

## 9. Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| **G1** | Scheduled workflow triggers on time | Pending |
| **G2** | API endpoint authenticates n8n | Pending |
| **G3** | Scraping completes successfully | Pending |
| **G4** | Diff detection works | Pending |
| **G5** | Alerts sent correctly | Pending |
| **G6** | Snapshots stored | Pending |
| **G7** | Rate limiting enforced | Pending |

---

## 10. Acceptance Criteria

### Functional
- [ ] **AC-1**: Scraping runs daily at 06:00
- [ ] **AC-2**: New listings generate alerts
- [ ] **AC-3**: Price drops > 5% generate alerts
- [ ] **AC-4**: Historical data stored for trends
- [ ] **AC-5**: Alert rules configurable per user

### Non-Functional
- [ ] **AC-6**: Scraping completes in < 5 minutes
- [ ] **AC-7**: Rate limiting prevents bans
- [ ] **AC-8**: robots.txt respected
- [ ] **AC-9**: All runs logged to audit

---

## 11. Schedule Configuration

### 11.1 Default Schedules

| Job | Schedule | Purpose |
|-----|----------|---------|
| **Price Monitor** | Daily 06:00 | Check all prices |
| **New Listings** | Every 4 hours | Catch new properties |
| **Market Report** | Weekly Monday | Generate weekly summary |
| **Data Cleanup** | Monthly 1st | Archive old snapshots |

### 11.2 Schedule Management

Schedules are managed via n8n UI:
1. Login to n8n dashboard
2. Edit workflow trigger
3. Modify cron expression
4. Save and activate

---

## 12. Related Documents

- **Scraping Engine**: `src/services/real-estate-monitor/WebScrapingEngine.ts`
- **Address Resolver**: `src/services/real-estate-monitor/AddressResolver.ts`
- **Orchestrator**: [04-orchestrator-n8n.md](./04-orchestrator-n8n.md)
- **Architecture Review**: `docs/architecture-review/07-automation-integrations.md`

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
