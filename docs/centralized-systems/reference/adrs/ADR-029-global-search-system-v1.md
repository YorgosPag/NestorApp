# ADR-029: Global Search System v1

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `/api/search` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `/api/search` + `src/types/search.ts`
- **Features**: Greek-friendly, prefix matching, tenant isolation

---

## Architecture (current)

Two writers populate `search_documents`:
1. **Cloud Function** triggers (`functions/src/search/indexTriggers.ts`) — reactive, canonical for Project + Contact. Uses `functions/src/search/indexBuilder.ts` local config.
2. **Main app API** fire-and-forget `POST /api/search/reindex` called from service layers — uses `src/config/search-index-config.ts` (the intended SSoT).

**Known drift (being fixed)**: the two config files diverge on entity-type coverage, titleField fallbacks, and collection references. This causes last-write-wins races and `title: "Unknown"` regressions for legal entity contacts. Tracked in Changelog entries 2026-04-22.

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-22 | Claude (Opus 4.7) | HOTFIX (Phase A): Legal-entity contacts indexed with `title: "Unknown"` because the Cloud Function `indexBuilder.ts` CONTACT titleField lacked the `companyName` fallback present in the main-app SSoT (`src/config/search-index-config.ts`). Reproduced on contact `cont_ba3c…` (ΑΦΜ 040817944, "ALFA"). Fix: add `companyName` + `serviceName` fallbacks to the Cloud Function titleField, and include both fields in `searchableFields`. Pattern now matches main-app config. Full structural SSoT fix (codegen) tracked as Phase B. |
