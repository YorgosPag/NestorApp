# ADR-018: Unified Upload Service

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Entity Systems |
| **Canonical Location** | `UnifiedUploadService` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `UnifiedUploadService` from `@/services/upload`
- **Pattern**: Gateway + Strategy Pattern

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-054](./ADR-054-enterprise-upload-system-consolidation.md)** | Extends | Photo/Logo upload SSoT, `buildStoragePath()`, storage path centralization |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** | Downstream | FileRecord data model (586 lines) — the document lifecycle this service creates |
| **[ADR-202](./ADR-202-floorplan-save-orchestrator.md)** | Downstream | 4-step canonical save pattern for floorplans built on this service |
| **[ADR-190](./ADR-190-photo-upload-ssot-consolidation.md)** | Sibling | Photo upload deduplication — eliminated 3 parallel upload paths |
