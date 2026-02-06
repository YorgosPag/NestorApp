# ADR-073: Firestore Composite Index Strategy

**Status**: ✅ IMPLEMENTED
**Date**: 2026-02-05
**Category**: Backend Systems

---

## Context

Firestore requires **composite indexes** for queries that combine multiple `where()` clauses with `orderBy()`. Without proper indexes, queries fail with:

```
FirebaseError: The query requires an index. You can create it here: [link]
```

### Affected Services

The `EnterpriseSecurityService.ts` performs composite queries for security-related data:

1. **security_roles** - Query by `tenantId`, `environment`, `isActive`, ordered by `level`
2. **email_domain_policies** - Query by `tenantId`, `environment`, `isActive`, ordered by `riskLevel`
3. **country_security_policies** - Query by `tenantId`, `environment`, `isActive`, ordered by `securityClass`

---

## Decision

Create composite indexes in `firestore.indexes.json` for all query patterns used by enterprise security services.

### Index Definitions

```json
{
  "collectionGroup": "security_roles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "environment", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "level", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "email_domain_policies",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "environment", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "riskLevel", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "country_security_policies",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "environment", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "securityClass", "order": "DESCENDING" }
  ]
}
```

---

## Rationale

### Why Composite Indexes?

1. **Query Performance** - Firestore indexes are pre-computed, making queries O(1) regardless of collection size
2. **Required by Firestore** - Multi-field queries with `orderBy()` REQUIRE composite indexes
3. **Tenant Isolation** - `tenantId` field ensures data isolation between companies

### Field Order

The field order in composite indexes MUST match the query pattern:
- Equality filters first (`tenantId`, `environment`, `isActive`)
- Range/orderBy filters last (`level`, `riskLevel`, `securityClass`)

### Descending Order

`riskLevel` and `securityClass` use `DESCENDING` order to return highest priority items first.

---

## Deployment

```bash
# Deploy indexes (takes 2-5 minutes to build)
firebase deploy --only firestore:indexes

# Verify in Firebase Console
# Navigate to: Firestore Database → Indexes → Check status
```

### Index Build Time

- **Small collections (<1000 docs)**: ~1-2 minutes
- **Medium collections (1000-10000 docs)**: ~3-5 minutes
- **Large collections (>10000 docs)**: ~5-10 minutes

---

## Testing Checklist

- [ ] No "query requires an index" error in browser console
- [ ] Security roles load successfully on login
- [ ] Email domain policies load for email triage
- [ ] Country security policies load for international contacts
- [ ] CRM Tasks page loads without errors

---

## Email Ingestion Queue Indexes (Added 2026-02-06)

### Incident Context

10 emails κολλήθηκαν ως "pending" στην ουρά `email_ingestion_queue` επειδή ΕΛΕΙΠΑΝ οι composite indexes. Η `after()` function πιανε τα errors σιωπηλά.

### Required Indexes

```json
// INDEX 1: Worker batch processing - claimNextQueueItems()
// Query: .where('status', '==', 'pending').orderBy('createdAt', 'asc')
{
  "collectionGroup": "email_ingestion_queue",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}

// INDEX 2: Deduplication check - enqueueInboundEmail()
// Query: .where('providerMessageId', '==', id).where('provider', '==', 'mailgun')
{
  "collectionGroup": "email_ingestion_queue",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "providerMessageId", "order": "ASCENDING" },
    { "fieldPath": "provider", "order": "ASCENDING" }
  ]
}
```

### Deployment Command

```bash
firebase deploy --only firestore:indexes --project pagonis-87766
```

### Critical Rules

1. **ΠΟΤΕ μην αφαιρείς indexes** χωρίς να ελέγξεις ποιες queries τους χρησιμοποιούν
2. **ΠΟΤΕ μην αλλάζεις field order** στους indexes - πρέπει να ταιριάζει με τη query
3. **Μετά από deploy** - οι indexes χρειάζονται 2-5 λεπτά να χτιστούν
4. **Η `FAILED_PRECONDITION` εξαφανίζεται** πριν ο index γεμίσει πλήρως - μπορεί να επιστρέφει κενά αποτελέσματα

---

## Related

- `EnterpriseSecurityService.ts` - Uses security indexes
- `src/services/communications/inbound/email-queue-service.ts` - Uses email queue indexes
- `src/server/comms/workers/email-ingestion-worker.ts` - Worker that depends on indexes
- `firestore.indexes.json` - Index definitions file (SSoT)
- ADR-063 - Company Isolation via Custom Claims
- ADR-071 - Enterprise Email Webhook Queue System

---

## Consequences

### Positive

- Eliminates query failures in production
- Enables efficient security role lookups
- Supports multi-tenant architecture

### Negative

- Additional index storage cost (minimal)
- Index build time during deployment

### Neutral

- Requires `firebase deploy --only firestore:indexes` after changes

---

*Enterprise standard: SAP/Salesforce/Microsoft Dynamics Level*
