# Pending Ratchet Work — Live Checklist

**STATUS: ALL_DONE**
**Last updated:** 2026-05-04 (ADR-233 + ADR-314 entrambi confirmed implementati)
**Source of truth:** `adrs/ADR-299-ratchet-backlog-master-roadmap.md`
**Purpose:** Agent-facing live checklist. Se STATUS = ALL_DONE → salta il resto. Se STATUS = ACTIVE → leggi e ricorda a Giorgio.

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


### 🏗️ FEATURE PENDING



---

### 🧹 FULL ZERO BACKLOG (Scenario B extras — +~43h expected)

- [x] **ADR-298 Phase C** — COMPLETATO. Phase C.7 DONE 2026-04-14. 11 collezioni → COVERAGE. FIRESTORE_RULES_PENDING ora VUOTA (zero entry). Coverage totale: 92 collezioni. 291 test verdi.

- [x] **ADR-298 Phase E** — COMPLETATO 2026-04-14. ADR-301 (Storage Rules Coverage SSoT). 4 path pattern, 48 celle, harness completo, CHECK 3.19 verde.

- [x] **CHECK 3.8 i18n Missing Keys** — COMPLETATO 2026-04-14. 4,750→0 violazioni. 3 fasi: (1) 730 file `useTranslation` single→array (namespace ADR-280 subs), (2) 479 chiavi genuinamente mancanti aggiunte ai locale files el+en, (3) settings.json creato. Baseline 0.

---

## Short sentence for session-start reminder

**Copy-paste template for the agent:**

> 📋 Pending ratchet tasks (ADR-299): **~21h critical path (Scenario A)** — ADR-298 Phase B.2→B.6 (16 collections), CHECK 3.17 entity audit (18 files), resolver reachability (13 files). Full zero-backlog = ~64h with Phase C+E+i18n keys (Scenario B). Details: `.claude-rules/pending-ratchet-work.md` + `adrs/ADR-299-ratchet-backlog-master-roadmap.md`.

---

## Changelog

| Date       | Change |
| 2026-05-04 | ADR-233 CLOSED — tutti e 3 gli item già implementati nel codice (POST 409 route.ts:220-233, PATCH 409 building-update.handler.ts:104-119, BuildingListCard formatBuildingLabel, unit tests entity-code-config.test.ts). Ratchet era stale. |
| 2026-05-04 | ADR-314 CLOSED — CHECK 3.18 baseline 0/0/0 ALL GREEN dal 2026-04-19 (Phase A-E DONE). `.ssot-discover-baseline.json` confirma centralizedFiles=135 protected=135 unprotected=0 duplicateExports=0 antiPatterns=0. STATUS → ALL_DONE. |
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
| 2026-04-13 | CHECK 3.13 Phase B DONE. 3 namespace aggiuntivi (`projects`, `properties-enums`, `storage`) + prefix-strip fallback in `translateFieldValue` e scanner `resolves()`. Baseline 214→79 (5 file rimasti). ADR-279 aggiornato. |
| 2026-04-13 | ADR-298 Phase C.1 DONE. 16 accounting collections → COVERAGE. 4 new matrix builders + coverage-matrices-accounting.ts (SRP split) + seed-helpers-accounting.ts + 16 suites. Pending 71→55, coverage 23→39. |
| 2026-04-13 | CHECK 3.13 Phase C DONE — ZERO BASELINE. 79 chiavi locale mancanti aggiunte in 9 namespace (el+en): contacts-core (company.sections/fields), storage (card.stats.level/value/stage/priority/dueDate + types.parking), building-tabs (floorplan.description + protocols.description), building (propertyTypes.*), properties-enums (status.underConstruction/blocked + saleStatus.*), dxf-viewer (steps.*), contacts-relationships (status enum + 22 types), crm (stages.*), filters (allPrices). Baseline 79→0. CHECK 3.13 completamente chiusa. ADR-279 Phase C entry aggiunto. |
| 2026-04-13 | ADR-298 Phase C.5 DONE. 11 system-global collections → COVERAGE. 4 new matrix builders (systemGlobalMatrix, systemAdminGlobalMatrix, countersMatrix, tasksMatrix) + coverage-matrices-system.ts (SRP split) + seed-helpers-system.ts + 11 suites. Pending 55→44, coverage 39→50. |
| 2026-04-14 | ADR-298 Phase C.2+C.3 DONE. 18 DXF/CAD/floorplan + file management collections → COVERAGE. 7 new matrix builders (fileTenantFullMatrix, cadFilesMatrix, fileAuditLogMatrix, fileSharesMatrix, photoSharesMatrix, fileCommentsMatrix, fileApprovalsMatrix) + coverage-matrices-dxf.ts (SRP split) + seed-helpers-dxf.ts + 18 suites. 1477 tests green (68 suites). Pending 44→26, coverage 50→68 collections. |
| 2026-04-14 | ADR-298 Phase C.4 DONE. 5 BoQ/commissions/ownership collections → COVERAGE. 4 new matrix builders (boqCategoriesMatrix, brokerageMatrix, commissionRecordsMatrix, ownershipTablesMatrix) + coverage-matrices-boq.ts (SRP split) + seed-helpers-boq.ts + 5 suites. 119 tests green (5 suites). Pending 26→21, coverage 68→73 collections. |
| 2026-04-14 | ADR-298 Phase C.6 DONE. 8 ownership-based collections → COVERAGE: companies, security_roles, users, user_notification_settings, user_2fa_settings, workspaces, teams, positions. 3 new matrix builders (companiesMatrix, usersMatrix, ownerOnlyMatrix) + coverage-matrices-users.ts (SRP) + seed-helpers-users.ts + 8 suites. 198 tests green. Pending 21→13, coverage 73→81 collections. |
| 2026-04-14 | ADR-298 Phase C.7 DONE — PHASE C COMPLETA. 11 specialized collections → COVERAGE: contact_relationships, contact_links, relationships, relationship_audit, employment_records, notifications, audit_logs, system_audit_logs, audit_log, search_documents, voice_commands. 5 new matrix builders (contactRelationshipsMatrix, employmentRecordsMatrix, notificationsMatrix, auditLogMatrix, searchDocumentsMatrix, voiceCommandsMatrix) + coverage-matrices-specialized.ts (SRP) + seed-helpers-specialized.ts + 11 suites. 291 tests green. Pending 13→0 (VUOTA). Coverage 81→92 collections. FIRESTORE_RULES_PENDING = []. |
| 2026-04-14 | ADR-301 Phase A DONE — Storage Rules Coverage SSoT. 4 path patterns → COVERAGE (canonical_with_project, canonical_no_project, cad, temp). Harness: emulator.ts + auth-contexts.ts + seed-helpers.ts + assertions.ts. Registry: personas.ts + operations.ts + coverage-manifest.ts. 4 test suites, 48 cells. CHECK 3.19 (zero-tolerance, pre-commit). jest.config.storage-rules.js + 5 npm scripts. ADR-298 Phase E chiusa. |
| 2026-04-26 | ADR-233 uniqueness validation + ADR-314 SSoT discovery aggiunti come pending. STATUS tornato ACTIVE. SSoT violations (53→0) già DONE dal 2026-04-09 — entry MEMORY.md corretta. |
| 2026-04-14 | CHECK 3.8 i18n Missing Keys DONE — ZERO BASELINE. 4,750→0 violazioni in 3 fasi: (1) 730 file single-ns→array (ADR-280 namespace split: dxf-viewer+5 subs, common+9 subs, building+5 subs, contacts+5 subs, properties+3 subs, projects+2 subs, accounting+2 subs, crm+1 sub, files+1 sub); (2) 479 chiavi genuinamente mancanti aggiunte a 30 locale files el+en; (3) settings.json creato (el+en). Baseline regenerated: 0 violations / 0 files. |
