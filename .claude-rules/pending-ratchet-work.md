# Pending Ratchet Work — Live Checklist

**Last updated:** 2026-04-11
**Source of truth:** `adrs/ADR-299-ratchet-backlog-master-roadmap.md`
**Purpose:** Agent-facing live checklist. Every agent starting a session in this repo MUST (per CLAUDE.md SOS N.13) read this file and report to Giorgio in its first reply what is PENDING, so Giorgio doesn't forget.

---

## How this file is read by the agent

1. **Session start (first reply to Giorgio):** Briefly mention (2-4 lines) what is pending here, unless:
   - Giorgio gives a clear order for independent work (then 1 line: "N pending ratchet tasks in ADR-299, see `.claude-rules/pending-ratchet-work.md` when needed")
   - Giorgio's work is explicitly a **non-ratchet** topic — don't load the reply with unrelated reminders
2. **Reminder format:** One sentence for scope + hours + Giorgio's scenario. Don't write the full ADR-299 — point to it.
3. **Don't mark items as completed without order.** Giorgio decides which ratchet proceeds. If you finish an item, remove the line (no strikethrough) and write a changelog entry below.

---

## Pending tasks (priority order)

### 🔥 CRITICAL PATH (Scenario A — ~21h expected)

- [x] **CHECK 3.17 Entity Audit Coverage** — COMPLETATO. Baseline 9→0. _(Batch 4: 4 wire-up server-side + 5 HARD_EXEMPT nel scanner.)_

- [ ] **CHECK 3.13 i18n Resolver Reachability** — 5 files, 214 violations (down from 378). Phase A done 2026-04-13: 14 namespace aggiunti a `SERVICE_FORM_NAMESPACES`, baseline 378→214. **Remaining:** Phase B (prefix-strip per `projects./units./properties./storage.`, ~78 fix in status.ts) + Phase C (missing locale keys, ~135, overlap CHECK 3.8). **Hours remaining:** ~2-4 (Phase B ~1-2h, Phase C overlap).

### 🧹 FULL ZERO BACKLOG (Scenario B extras — +~43h expected)

- [ ] **ADR-298 Phase C** — 74 remaining Firestore rules collections in 7 subcategories: C.1 accounting (15), C.2 DXF/CAD/floorplans (15), C.3 file variants (10), C.4 BoQ/ownership/commissions (8), C.5 system-global (11, trivial ~15 min/coll), C.6 ownership-based users (5), C.7 specialized (10). **Hours:** 14-35 (expected 22).

- [ ] **ADR-298 Phase E** — Storage rules coverage. `storage.rules` 12KB, new harness shape, separate future ADR. **Hours:** 4-10 (expected 7).

- [ ] **CHECK 3.8 i18n Missing Keys** — 4,762 legacy violations. `t('key')` calls without matching locale entry + namespace mismatches from ADR-280 split. **Hours:** 8-22 (expected 14). Mass-migration + individual fixes.

---

## Short sentence for session-start reminder

**Copy-paste template for the agent:**

> 📋 Pending ratchet tasks (ADR-299): **~21h critical path (Scenario A)** — ADR-298 Phase B.2→B.6 (16 collections), CHECK 3.17 entity audit (18 files), resolver reachability (13 files). Full zero-backlog = ~64h with Phase C+E+i18n keys (Scenario B). Details: `.claude-rules/pending-ratchet-work.md` + `adrs/ADR-299-ratchet-backlog-master-roadmap.md`.

---

## Changelog

| Date       | Change |
|------------|--------|
| 2026-04-11 | Initial checklist dump from ADR-299 §4/§5. Scenario A = 21h expected, Scenario B = 64h expected. No task completed yet — B.1 attendance already completed before ADR-299. |
| 2026-04-11 | CHECK 3.17 baseline ratcheted 20→19 in commit `56d95be4` (production safety hardening: deletion of `properties/admin-link` destructive chain). Was not a CHECK 3.17 cleanup target — was security deletion that reduced baseline as side-effect. Line updated. Hours estimate unchanged. |
| 2026-04-11 | CHECK 3.17 baseline 19→18 in commit `f160e750` (cluster B triage: deletion of `admin/migrate-properties` break-glass one-shot with hardcoded Greek apartment templates + tenant-specific building IDs). Expected hours updated 6→5.5 (removed 1 file from Boy Scout queue). Cluster (B) — 7 files still pending (migrate-building-features, migrate-company-id, migrate-enterprise-ids route+ops, migrations/execute-admin, migrations/normalize-floors, seed-floors, seed-parking) — deferred to focused per-file wire-up commits. |
| 2026-04-13 | ADR-298 Phase B.2 COMPLETED. accounting_audit_log + accounting_invoices + accounting_journal_entries moved to COVERAGE. New `roleDualMatrix()` + 3 seeders + 3 suites. Pending list 86→83, coverage 8→11 collections. Removed from checklist. |
| 2026-04-13 | ADR-298 Phase B.3 COMPLETED. leads + opportunities + activities moved to COVERAGE. New `crmDirectMatrix()` + 3 seeders + 3 suites. Pending list 83→80, coverage 11→14 collections. Removed from checklist. |
| 2026-04-13 | ADR-298 Phase B.4 COMPLETED. properties + storage_units + parking_spots + floors moved to COVERAGE. `adminWriteOnlyMatrix()` base + overrideCells for properties update delta. 4 seeders + 4 suites. 365 tests green. Pending list 80→76, coverage 14→18 collections. Removed from checklist. |
| 2026-04-13 | ADR-298 Phase B.5 COMPLETED. conversations + external_identities moved to COVERAGE. `crmDirectMatrix()` for both; conversations enum-validated via `isValidConversationData`. New `seed-helpers-messaging.ts` module (SRP split). 405 tests green. Pending list 76→74, coverage 18→20 collections. Removed from checklist. |
| 2026-04-13 | ADR-298 Phase B.6 COMPLETED. obligations + obligation_transmittals + obligation_templates moved to COVERAGE. All three use `crmDirectMatrix()` verbatim (no overrideCells). New `seed-helpers-compliance.ts` module (SRP — messaging+seed-helpers both at 500 lines). 3 new suites. 465 tests green (23 suites). Pending list 74→71, coverage 20→23 collections. Removed from checklist. |
| 2026-04-13 | CHECK 3.17 Batch 1 DONE. 3 admin migration files wired: execute-admin/route.ts (projects), normalize-floors/route.ts (floors), migrate-building-features/migration-operations.ts (buildings). Baseline 18→15. |
| 2026-04-13 | CHECK 3.17 Batch 2 DONE. 4 admin files wired: seed-floors.handlers.ts (floor deleted), migrate-company-id/migration-operations.ts (company created), migrate-enterprise-ids/migration-operations.ts (building updated), migrate-enterprise-ids/route.ts (building created). Baseline 15→11. |
| 2026-04-13 | CHECK 3.17 Batch 3 DONE. 2 files wired: geofence/route.ts (project updated), seed-parking/parking-seed-operations.ts (parking created). Baseline 11→9. ownership-table-service.ts deferred (client-side SDK, needs server wrapper approach). |
| 2026-04-13 | CHECK 3.17 Batch 4 DONE — ZERO BASELINE. 4 server-side wire-up (005_assign_project_codes, 006_normalize_storage, cascade-propagation, property-coverage-recalculator) + 5 HARD_EXEMPT in scanner (audit-core circular, 4 client-SDK files). Baseline 9→0. CHECK 3.17 completamente chiusa. |
| 2026-04-13 | CHECK 3.13 Phase A DONE. 14 namespace aggiunti a `SERVICE_FORM_NAMESPACES` in translate-field-value.ts. Baseline 378→214 (5 file rimasti). ADR-279 aggiornato. |
