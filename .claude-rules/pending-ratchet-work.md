# Pending Ratchet Work — Live Checklist

**STATUS: ACTIVE**
**Last updated:** 2026-05-15 (ADR-345 Fasi 6.1 + 7 + 8-partial completate)
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


### 🏗️ FEATURE PENDING — ADR-345 DXF Ribbon Interface

**ADR:** `docs/centralized-systems/reference/adrs/ADR-345-dxf-ribbon-interface.md`
**Bridge hook:** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonTextEditorBridge.ts`
**Data decl:** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-text-editor-tab.ts`

#### Fase 5.5 — comingSoon stubs (priorità media)
- [ ] **findReplace button** → deve montare `FindReplaceDialog` (ADR-344 Phase 9, uncommitted work di altro agent). Attualmente `comingSoon: true`.
- [ ] **spellCheck toggle** → engine assente. Rimane `comingSoon: true` fino a engine disponibile.
- [ ] **insert.symbol button** → symbol picker dialog non ancora creato. `comingSoon: true`.

#### ADR-344 / Commit chain (priorità alta, Phase 6+)
- [ ] **Commit chain store → UpdateTextStyleCommand → CommandHistory** — il bridge Fase 5.5 scrive solo lo store. Il chain verso CommandHistory appartiene ad ADR-344 Phase 6+ (TipTap session close). Quando ADR-344 Phase 6 atterrerà, il bridge ribbon ne beneficia automaticamente.

#### Fasi future ADR-345 (in ordine)
- [x] **Fase 6.1: Tab SETTINGS** — DxfSettingsPanel nel ribbon, floating colors tab disabilitata ✅ 2026-05-15
- [x] **Fase 7: Panel flyout** — 4 stati minimize, pinnedPanelIds, chevron + pin UI ✅ 2026-05-15
- [x] **Fase 8: Floating panel removal** — NON da fare. Giorgio ha confermato: sidebar rimane con Επίπεδα + Ρυθμίσεις DXF. ✅ 2026-05-15

---

### 🪜 ADR-363 STAIR MIGRATION — Phase 0.5 incomplete (priorità media, ~3-4h)

Ανακαλύφθηκε 2026-05-19 (N.0.2 Boy Scout κατά Phase B doc sync).

- [ ] **`systems/stairs/` → `bim/` import migration** — `bim/stairs/` + `bim/geometry/stairs/` έχουν ΑΝΤΙΓΡΑΦΑ αρχείων (stale duplicates). Ο ζωντανός SSoT παραμένει `systems/stairs/`. 20+ αρχεία import από `systems/stairs/`: `StairGeometryService` (5 sites), `stair-grips` (3), `stair-floor-link` (3), `stair-preview-store` (2), κλπ. Fix: (1) Αλλαγή imports → `bim/stairs/` ή `bim/geometry/stairs/`. (2) Αφαίρεση barrel stubs από `systems/stairs/`. (3) `rmdir systems/stairs/`. (4) tsc zero errors + tests green. (5) SSoT registry module `bim-folder-residency` με baseline 0. (6) ADR-363 Phase 0.5 acceptance criteria tick. Σχετικά: ADR-363 §Phase 0.5.

---

### 🪜 ADR-358 STAIR DOMAIN — pre-existing TS residual (priorità bassa)

- [ ] **HitTestingService.ts:236 — DxfStair exhaustive check failure** — `convertToEntityModel` switch manca branch `case 'stair'`. Pre-esistente dal Phase 9C base (commit `9970706a`). Richiede decisione campi `EntityModel` stair-specific (treads, riserHeight, run, ecc.) — domain stair-tool (`ADR-358-dxf-stair-tool-google-level.md`). Identificato 2026-05-16 durante Phase 9D-3a TS check. Defer a sessione dedicata stair-tool.

---

### 🎨 ADR-365 TAILWIND SEMANTIC PALETTE ENFORCEMENT (priorità alta, ~5h totali, 9 φάσεις)

Discovered 2026-05-19 (hover audit follow-up). ADR: `docs/centralized-systems/reference/adrs/ADR-365-tailwind-semantic-palette-enforcement.md`

**Status:** PROPOSED — αναμένει Phase 0 implementation. Per-phase handoff απαιτείται πριν από κάθε νέα session.

- [ ] **Phase 0 — Infrastructure** (~1h) — ratchet script + `.ssot-registry.json` module + baseline file + pre-commit hook + npm scripts
- [ ] **Phase 1 — DXF Viewer** (~1.5h, ~17 files) — grip menus, wall/stair/dimensions panels, text-toolbar/templates/dictionary, mirror/draggable overlays, statusbar, floorplan-background, prompt-dialog
- [ ] **Phase 2 — Procurement + Vendor Portal** (~30min, ~9 files)
- [ ] **Phase 3 — Accounting** (~20min, ~3 files)
- [ ] **Phase 4 — Properties + Contacts + Building Dialogs** (~40min, ~12 files)
- [ ] **Phase 5 — Shared Files + File Manager** (~30min, ~9 files)
- [ ] **Phase 6 — Dashboard + Admin + CRM + Header + Notifications** (~45min, ~10 files)
- [ ] **Phase 7 — Design System + Showcase + Sales + Geo-canvas** (~45min, ~8 files)
- [ ] **Phase 8 — Closure** (~20min) — baseline → 0, ADR APPROVED, changelog, pending-ratchet entry remove

Initial baseline: ~249 violations / ~65 consumer files (post-exemption). Target: 0. Mapping table + exempt SSoT list στο ADR-365 §3.1 + §2.3.

---

### 🧹 GRIP TYPES SSoT — canvas-mouse-types duplicate (priorità bassa, ~30min)

Discovered 2026-05-19 (N.0.2 Boy Scout durante ADR-183 Phase C cleanup, deprecated hook deletion).

- [ ] **`hooks/canvas/canvas-mouse-types.ts:19-89` duplicate grip types** — Local re-definitions of `VertexHoverInfo`, `EdgeHoverInfo`, `SelectedGrip`, `DraggingVertexState`, `DraggingEdgeMidpointState`, `DraggingOverlayBodyState`, `GripHoverThrottle`. Canonical SSoT lives in `hooks/grips/unified-grip-types.ts` (ADR-183). Fix: replace inline `export interface` blocks with `export type { … } from '../grips/unified-grip-types'`. Verify consumers (`useCanvasMouse.ts`, `useCanvasEffects.ts`, `useOverlayInteraction.ts`, `useLayerCanvasMouseMove.ts`, `canvas-mouse-drag-handlers.ts`, `hooks/canvas/index.ts`) still compile (`npx tsc --noEmit`). Side benefit: stale `(from useGripSystem)` JSDoc comments in `useLayerCanvasMouseMove.ts:44-62` + `canvas-mouse-types.ts:87,161-168` should be retargeted to `unified-grip-types`.

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
| 2026-05-15 | ADR-345 Fasi 6.1 + 7 completate. Fase 8 parziale (colors rimossa, levels rimane per ora). |
| 2026-05-12 | ADR-345 Fase 5.5 pending items aggiunti (findReplace/spellCheck/symbol comingSoon, commit chain ADR-344 Ph6+, Fasi 6/7/8). STATUS → ACTIVE. |
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
| 2026-05-19 | BIM renderGrips centralization DONE (Boy Scout N.0.2). `protected finalizeRender(entity, options)` aggiunta a `BaseEntityRenderer`. 7 BIM renderers (`WallRenderer`, `ColumnRenderer`, `BeamRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`, `SlabRenderer`, `StairRenderer`) ora chiamano `this.finalizeRender()`. Bug fix bonus: `finalizeRendering` ora passa `options` a `renderGrips`. ADR-363 changelog aggiornato. |
| 2026-05-19 | ADR-183 Phase C completata. Cancellati `hooks/useDxfGripInteraction.ts` (451 righe) + `hooks/grips/useGripSystem.ts` (387 righe), entrambi `@deprecated` dal 2026-02-16 con zero function call-sites. Types migrati inline in `hooks/grips/unified-grip-types.ts` (canonical SSoT). Aggiunta nuova voce Boy Scout: `canvas-mouse-types.ts:19-89` duplicate grip types (~30min). ADR-183 changelog aggiornato. |
| 2026-05-19 | ADR-365 Tailwind Semantic Palette Enforcement created (Proposed). Hover audit revealed 249 raw palette violations σε 86 files (από τα οποία ~21 SSoT exempt → ~65 consumer files). Plan: 9 phases (Phase 0 infrastructure + Phases 1-8 per-domain migration + Phase 8 closure). Per-session handoff απαιτείται. |
