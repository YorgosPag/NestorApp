# Pending — Firestore Orphan Indexes Cleanup

**Status:** DEFERRED (post ADR-327 Phase 1 complete)
**Created:** 2026-04-29
**Origin:** Step (b) deploy `firebase deploy --only firestore:rules,firestore:indexes` reported:
> there are 9 indexes defined in your project that are not present in your firestore indexes file

**Impact:** Zero. Storage cost negligible (~cents/month). No correctness risk. No query failure risk.

**Why deferred:** Cleanup with `--force` would drop indexes that may still be referenced by legacy queries → potential `FAILED_PRECONDITION` production incident. Audit-first approach required.

## Cleanup Protocol (when ready)

### Step 1 — Inventory (read-only, zero risk)
```bash
firebase firestore:indexes --project pagonis-87766
```
Diff output vs `firestore.indexes.json` → identify the 9 orphans.

### Step 2 — Audit per orphan
For each `(collectionGroup, fields[])`:
- Grep codebase for matching `firestoreQueryService.subscribe/getAll(KEY, { constraints: [...] })` shape
- If query exists → orphan is legitimate, was forgotten in JSON. **Add to JSON.**
- If no query → dead/legacy. **Drop candidate.**

### Step 3 — Decision matrix

| Category | Action |
|----------|--------|
| Index in use + query exists | Add to JSON, no drop |
| Index unused + zero queries | Drop with `--force` |
| Ambiguous | Leave as-is, document |

### Step 4 — Drop (only after Step 2 confirmed safe)
```bash
firebase deploy --only firestore:indexes --force --project pagonis-87766
```

## When to do this

**After ADR-327 Phase 1 complete** (steps c through k all shipped). Single commit:
```
chore(firestore): cleanup 9 orphan indexes after ADR-327 Phase 1 audit
```

Estimated effort: 1-2h (mostly audit time).

## Probable origin of orphans

1. Auto-suggested by Firebase Console on `FAILED_PRECONDITION` errors — clicked "create index" but never added to JSON
2. Old deployments before `firestore.indexes.json` became authoritative SSoT
3. Code refactors that removed queries but left the index live
