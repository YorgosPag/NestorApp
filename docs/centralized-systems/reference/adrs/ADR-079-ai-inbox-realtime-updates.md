# ADR-079: AI Inbox Real-Time Updates via Firestore onSnapshot

## Status
**ACCEPTED** - 2026-02-06

## Context

The AI Inbox (`/admin/ai-inbox`) loaded emails via Server Actions (one-time fetch). Users had to **hard refresh** to see new emails. WebSocket listeners existed in the code but **never worked on Vercel production** (serverless limitation - no persistent connections).

### Problems
1. **No real-time updates**: New emails invisible until manual refresh
2. **Dead code**: WebSocket listeners (`email_received`, `email_processed`) never fired in production
3. **Unnecessary server calls**: `getTriageStats()` called separately, duplicating data traversal

## Decision

Replace WebSocket dead code with **Firestore `onSnapshot()` real-time listener**, following the proven pattern established by `useRealtimeMessages` hook (same `messages` collection).

### Architecture

```
Tenant Admin (companyId present):
  useRealtimeTriageCommunications(companyId, statusFilter)
    → Firestore onSnapshot() on messages collection
    → Client-side stats computation via useMemo
    → Toast notifications for new emails
    → "Live" indicator in header

Super Admin (companyId undefined):
  Server Actions fallback (getTriageCommunications + getTriageStats)
    → Firestore Security Rules require companyId filter
    → Manual refresh button retained
```

### Composite Indexes Required

1. **Filtered query** (specific status):
   - Collection: `messages`
   - Fields: `companyId ASC` + `triageStatus ASC` + `createdAt DESC`

2. **All-statuses query**:
   - Collection: `messages`
   - Fields: `companyId ASC` + `createdAt DESC`

### Firestore Rules Compatibility

The existing `messages` collection rules support client-side reads:
```
allow read: if isAuthenticated() && belongsToCompany(resource.data.companyId)
```

A query with `where('companyId', '==', userCompanyId)` is accepted because Firestore can statically guarantee all results belong to the user's company.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/inbox/useRealtimeTriageCommunications.ts` | **NEW** | Real-time hook with onSnapshot |
| `src/hooks/inbox/index.ts` | **MODIFIED** | Export new hook |
| `src/app/admin/ai-inbox/AIInboxClient.tsx` | **MODIFIED** | Integrated hook, removed WebSocket dead code |
| `src/components/admin/ai-inbox/AIInboxHeader.tsx` | **MODIFIED** | Added "Live" indicator badge |
| `firestore.indexes.json` | **MODIFIED** | Added 2 composite indexes |

## Consequences

### Positive
- **Instant updates**: New emails appear immediately without refresh
- **Eliminated dead code**: Removed WebSocket listeners that never worked in production
- **Reduced server calls**: Stats computed client-side from live data (no separate API call)
- **Visual feedback**: "Live" badge shows real-time connection status
- **Proven pattern**: Follows `useRealtimeMessages` architecture (battle-tested)

### Negative
- **Super admin limitation**: Cannot use real-time (Firestore rules require companyId filter)
- **Index build time**: Composite indexes take 2-5 minutes to build after deploy

### Neutral
- Server Actions retained as fallback for super admin
- Toast notifications for new emails (same UX as previous WebSocket design)

## Pattern Adoption

The Firestore `onSnapshot()` real-time pattern established here has been adopted by:

| Page | Hook / Service | Date | Context |
|------|---------------|------|---------|
| AI Inbox | `useRealtimeTriageCommunications` | 2026-02-06 | This ADR |
| Contacts | `useContactsState` → `ContactsService.subscribeToContacts()` | 2026-02-09 | ADR-145: Server-side Admin SDK writes (UC-015/UC-016) ανιχνεύονται real-time |

## References
- `src/hooks/inbox/useRealtimeMessages.ts` - Proven pattern source
- `src/hooks/useContactsState.ts` - Contacts real-time subscription (ADR-145)
- ADR-070: Email AI Ingestion System
- ADR-071: Enterprise Email Webhook Queue
- ADR-145: Super Admin AI Assistant (UC-015/UC-016 server-side writes)
- Firestore Security Rules: `messages` collection
