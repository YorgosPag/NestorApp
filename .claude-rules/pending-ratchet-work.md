# Pending Ratchet Work — Live Checklist

**STATUS: ACTIVE**
**Last updated:** 2026-05-22 (ADR-365 Phase 3 DONE — Accounting 19 files, −143 violations, baseline 2,889/394)
**Source of truth:** `adrs/ADR-299-ratchet-backlog-master-roadmap.md`
**Purpose:** Agent-facing live checklist. Se STATUS = ALL_DONE → salta il resto. Se STATUS = ACTIVE → leggi e ricorda a Giorgio.

---

## 🚨🚨🚨 ΥΠΟΧΡΕΩΤΙΚΗ ΑΝΑΓΝΩΣΗ — ΚΑΘΕ AGENT / DEVELOPER ΣΕ ΚΑΘΕ SESSION 🚨🚨🚨

### ADR-365 — Tailwind raw palette ratchet: τι ΠΡΕΠΕΙ να ξέρεις πριν αγγίξεις κώδικα

**Πραγματική βάση (2026-05-19): 3.659 violations σε 440 αρχεία.**
Αρχική εκτίμηση ADR-365 ήταν 249/65 — λάθος, γιατί μέτρησε **μόνο** `hover:bg-*`. Το CHECK 3.26 μετράει όλη την επιφάνεια (bg/text/border/ring/fill/stroke × 22 παλέτες × 11 αποχρώσεις × 6 state prefixes × `dark:`).

### Τι ΑΠΑΓΟΡΕΥΕΤΑΙ πλέον (zero tolerance)

Σε ΟΠΟΙΟΔΗΠΟΤΕ νέο ή αγγιγμένο αρχείο **εκτός allowlist** (`src/design-system/`, `src/styles/design-tokens/`, `tailwind.config.ts`, κλπ. — βλ. `.ssot-registry.json` → `tailwind-hardcoded-palette.allowlist`):

❌ ΟΧΙ `hover:bg-amber-100`, `text-red-600`, `dark:bg-slate-800`, `border-blue-300`, `ring-emerald-500`, κλπ.
❌ ΟΧΙ `dark:` prefix σε consumer files — semantic tokens είναι ήδη theme-aware.

### Τι ΧΡΗΣΙΜΟΠΟΙΕΙΣ αντί γι' αυτά

✅ **shadcn tokens** (παντού όπου ταιριάζει): `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-destructive`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `border-border`, `border-ring`, `ring-ring`.
✅ **CSS vars για status states**: `bg-[hsl(var(--bg-success))]`, `bg-[hsl(var(--bg-error))]`, `bg-[hsl(var(--bg-warning))]`, `bg-[hsl(var(--bg-info))]` (και με `/40` opacity για subtle).
✅ **COLOR_BRIDGE** (`src/design-system/color-bridge.ts`) για ώριμα mappings.
✅ **Mapping table** πλήρης: ADR-365 §3.1.

### Boy Scout Rule (ADR-365 §7.2 + N.0.2)

**ΟΤΑΝ αγγίζεις αρχείο για άλλο λόγο**: αν περιέχει raw palette utilities από τη baseline, καθάρισέ τα μαζί στο ίδιο commit. **Δεν χρειάζεται να καθαρίσεις τα πάντα — όσα μπορείς εύκολα.** Το ratchet θα ξαναπροσαρμοστεί προς τα κάτω.

### Πώς δουλεύει το ratchet (CHECK 3.26)

- **Νέο αρχείο**: zero tolerance — οποιοδήποτε raw palette utility μπλοκάρει το commit.
- **Υπάρχον αρχείο**: μπορεί να έχει ίδιο ή λιγότερο count από το baseline. Πάει πάνω = block.
- **Allowlist αρχείο**: εξαιρείται (design-system, tokens, brand-map, κλπ).
- **Εντολές**: `npm run tailwind-palette:audit` (full scan), `npm run tailwind-palette:baseline` (refresh μετά cleanup).

### Πλάνο cleanup (Phases 1-8)

Αρχικά εκτιμήθηκαν ~5h × 8 φάσεις. **Πραγματικά θα πάρει 30-50h** λόγω του 14.7x μεγαλύτερου baseline. Η στρατηγική παραμένει: per-domain atomic commits + Boy Scout. **Δεν είναι production bug** — είναι θέμα συντήρησης / theme-consistency / dark-mode.

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
- [x] **findReplace button** → ✅ WIRED 2026-05-19. `DxfFindReplaceHost.tsx` lazy wrapper + `findReplaceOpen` state in `useDxfViewerState` + action `text-find-replace`.
- [ ] **spellCheck toggle** → engine assente. Rimane `comingSoon: true` fino a engine disponibile.
- [x] **insert.symbol button** → ✅ WIRED 2026-05-21. `SymbolPickerDialog.tsx` (30 symbols, 3 gruppi) + `DxfSymbolPickerHost.tsx` + `symbolPickerOpen` state + action `text-insert-symbol`. `InsertTextTokenCommand` extended per raw Unicode.

#### ADR-344 / Commit chain (priorità alta, Phase 6+)
- [ ] **Commit chain store → UpdateTextStyleCommand → CommandHistory** — il bridge Fase 5.5 scrive solo lo store. Il chain verso CommandHistory appartiene ad ADR-344 Phase 6+ (TipTap session close). Quando ADR-344 Phase 6 atterrerà, il bridge ribbon ne beneficia automaticamente.

#### Fasi future ADR-345 (in ordine)
- [x] **Fase 6.1: Tab SETTINGS** — DxfSettingsPanel nel ribbon, floating colors tab disabilitata ✅ 2026-05-15
- [x] **Fase 7: Panel flyout** — 4 stati minimize, pinnedPanelIds, chevron + pin UI ✅ 2026-05-15
- [x] **Fase 8: Floating panel removal** — NON da fare. Giorgio ha confermato: sidebar rimane con Επίπεδα + Ρυθμίσεις DXF. ✅ 2026-05-15

---

---

### 🪜 ADR-358 STAIR DOMAIN — pre-existing TS residual (priorità bassa)

- [x] **HitTestingService.ts:236 — DxfStair exhaustive check failure** ✅ DONE 2026-05-21 — Root cause: `entities.ts` importάρε από `'./stair'` (barrel διαγραμμένο στο ADR-363 Phase 0.5 consumer sweep). Fix: imports → `'../bim/types/stair-types'`. ADR-358 + ADR-363 changelogs ενημερώθηκαν.

---

### 🎨 ADR-365 TAILWIND SEMANTIC PALETTE ENFORCEMENT (priorità alta, ~5h totali, 9 φάσεις)

Discovered 2026-05-19 (hover audit follow-up). ADR: `docs/centralized-systems/reference/adrs/ADR-365-tailwind-semantic-palette-enforcement.md`

**Status:** PHASE 4 DONE 2026-05-22. Baseline: 2,740/371. Per-phase handoff απαιτείται πριν από κάθε νέα session.

- [x] **Phase 0 — Infrastructure** ✅ 2026-05-19 — ratchet script (`scripts/check-tailwind-palette-ratchet.js`), `.ssot-registry.json` module `tailwind-hardcoded-palette` (Tier 2, 15 allowlist entries), `.tailwind-palette-baseline.json` (3,659 violations / 440 files — actual baseline revised from estimate 249/65), CHECK 3.26 wired into `scripts/run-checks-parallel.js` (worker_thread), npm scripts `tailwind-palette:{audit,report,baseline}`. Smoke 1-5 PASS. Hook latency ~0.73s staged / ~3.4s full.
- [x] **Phase 1 — DXF Viewer** ✅ 2026-05-22 — 20 files cleaned (−254 violations). Baseline: 3,659/440 → 3,405/420.
- [x] **Phase 2 — Procurement + Vendor Portal** ✅ 2026-05-22 — 43/44 files cleaned (−373 violations). Baseline: 3,405/420 → 3,032/399. ConflictDialog migration in working tree only, blocked by CHECK 3.22 dead-code ratchet.
- [x] **Phase 3 — Accounting** ✅ 2026-05-22 — 19 files cleaned (−143 violations). Baseline: 3,032/399 → 2,889/394.
- [x] **Phase 4 — Properties + Contacts + Building Dialogs** ✅ 2026-05-22 — 23 files cleaned (−149 violations). Baseline: 2,889/394 → 2,740/371.
- [ ] **Phase 5 — Shared Files + File Manager** (~30min, ~9 files)
- [ ] **Phase 6 — Dashboard + Admin + CRM + Header + Notifications** (~45min, ~10 files)
- [ ] **Phase 7 — Design System + Showcase + Sales + Geo-canvas** (~45min, ~8 files)
- [ ] **Phase 8 — Closure** (~20min) — baseline → 0, ADR APPROVED, changelog, pending-ratchet entry remove

Baseline after Phase 4 (2026-05-22): **2,740 violations / 371 files** (was 2,889/394). Target: 0. Mapping table + exempt SSoT list στο ADR-365 §3.1 + §2.3. **Phase 5-8 estimates likely under-scoped** — re-baseline after each phase. Note: `text-green-707` instances are WCAG exception canonical form (§2.1) — ratchet counts them but they're documented exceptions in COLOR_BRIDGE.

---

### 🧹 GRIP TYPES SSoT — canvas-mouse-types duplicate (priorità bassa, ~30min)

Discovered 2026-05-19 (N.0.2 Boy Scout durante ADR-183 Phase C cleanup, deprecated hook deletion).

- [ ] **`hooks/canvas/canvas-mouse-types.ts:19-89` duplicate grip types** — Local re-definitions of `VertexHoverInfo`, `EdgeHoverInfo`, `SelectedGrip`, `DraggingVertexState`, `DraggingEdgeMidpointState`, `DraggingOverlayBodyState`, `GripHoverThrottle`. Canonical SSoT lives in `hooks/grips/unified-grip-types.ts` (ADR-183). Fix: replace inline `export interface` blocks with `export type { … } from '../grips/unified-grip-types'`. Verify consumers (`useCanvasMouse.ts`, `useCanvasEffects.ts`, `useOverlayInteraction.ts`, `useLayerCanvasMouseMove.ts`, `canvas-mouse-drag-handlers.ts`, `hooks/canvas/index.ts`) still compile (`npx tsc --noEmit`). Side benefit: stale `(from useGripSystem)` JSDoc comments in `useLayerCanvasMouseMove.ts:44-62` + `canvas-mouse-types.ts:87,161-168` should be retargeted to `unified-grip-types`.

---

### 🧭 ADR-3XX (TBD) — AUTO-INFER ALIGNMENT GUIDES (priorità bassa, ~3h, discovered 2026-05-19 via SPEC-3D-004C)

**Discovered**: 2026-05-19 κατά τη διερεύνηση SPEC-3D-004C (GenArc Utils/Snap/Picking). Το GenArc `resolveSnapV2.ts:61-104` έχει αυτόματη "smart guides" λογική (Revit/AutoCAD-style) που το Nestor **δεν έχει**.

**Gap επιβεβαιωμένο** (3 engines grep):
- `GuideSnapEngine.ts` → μόνο explicit guides από `GuideStore` singleton.
- `OrthoSnapEngine.ts` → χρειάζεται explicit `referencePoint` (lastPoint draw flow).
- `ParallelSnapEngine.ts` → reference **lines**, όχι arbitrary points.

**Συμπεριφορά που λείπει**: όταν ο κέρσορας είναι ≤35cm από κάποιο wall/beam endpoint ή midpoint ή column corner/center → αυτόματη γαλάζια διακεκομμένη γραμμή στοίχισης (vertical ή horizontal), **χωρίς** χρειαζόμενο explicit guide από τον χρήστη.

**Όροι Γιώργου (επιβεβαιωμένοι 2026-05-19)**:
1. ✅ Δεν υπάρχει στο Nestor (επιβεβαιωμένο grep)
2. ✅ Θα βοηθήσει (Revit/AutoCAD industry standard)
3. ✅ Add-only — δεν σπάει υπάρχοντα systems (opt-in flag στα `SnapPresets`, lower priority από Endpoint, cap ≤2 inferred guides)
4. ✅ Πλήρως SSoT-ενσωματωμένο

**Architecture sketch (όταν προχωρήσει)**:
- Νέο module `snapping/services/InferredAlignmentService.ts` (Tier 3 SSoT) που εκθέτει `getAlignmentAnchors(scene): Point2D[]`.
- Reads BIM scene SSoT (`bim/`) — **όχι re-implementation** anchors. Anchors source: wall.start/end/midpoint + beam.start/end/midpoint + column.position + column.4 corners.
- Νέα `private addAutoInferredAlignmentCandidates()` στον `GuideSnapEngine.ts`, opt-in μέσω `SnapPresets.setArchitecturalPreset({ inferAlignment: true })`.
- Lower `priority` από `EndpointSnapEngine` (να μην κλέβει snap από explicit endpoints).
- Cap ≤2 inferred guides per frame (1 vertical + 1 horizontal).
- Tolerance 35cm (parameter στο preset).
- Tests: 2-3 jest cases (cursor near wall endpoint → guide emitted, cursor far → no guide, multiple anchors → best two selected).

**SSoT registry entry (when implemented)**:
```json
"inferred-alignment-service": {
  "tier": 3,
  "canonical": "src/subapps/dxf-viewer/snapping/services/InferredAlignmentService.ts",
  "forbiddenPatterns": ["wall\\.start.*Math\\.abs.*cursor", "alignment.*infer.*inline"]
}
```

**Effort**: ADR proposal ~1h + implementation ~2h + tests ~30min. **Total: ~3-3.5h.** Δεν blocks το ADR-366.

- [ ] Γράψε ADR proposal (επόμενος ελεύθερος αριθμός — αν ADR-366 PROPOSED παραμένει 5-19, ίσως ADR-367 ή επόμενος διαθέσιμος).
- [ ] Implementation `InferredAlignmentService` + `GuideSnapEngine` enhancement.
- [ ] Tests + SSoT registry entry.
- [ ] Boy Scout: όλα τα Architectural presets ενεργοποιούν `inferAlignment: true` by default.

---

### 📅 ADR-034 GANTT — Phase 4 pending items (construction tracking)

**ADR:** `docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md`
**ADR-266:** `docs/centralized-systems/reference/adrs/ADR-266-gantt-construction-reports.md`
**Gantt dir:** `src/components/building-management/tabs/TimelineTabContent/gantt/`
**Hooks dir:** `src/components/building-management/hooks/construction-gantt/`

**ADR-034 αλλαγμένο (χωρίς commit) — status line + Phase 4 table + ADR-266 cross-ref + changelog.**

- [x] **4.8 Dependency arrows** ✅ DONE 2026-05-21 — `GanttDependencyArrows.tsx` + `useGanttDependencyArrows.ts`, portal into `.rmg-timeline-container`, RAF-throttled bezier SVG, ADR-034 §4.8 updated
- [x] **4.5 Alert engine — deadline notifications** ✅ DONE 2026-05-21 — ADR-266 Phase D.3 (6+1 alert rules, `construction_alerts` collection, API routes, `ScheduleAlertBanner`, Telegram digest, cron bypass) + Phase D.5 (Portfolio Dashboard). ADR-034 status line stale — needs sync.
- [ ] **4.6 AI integration UC-017** (~15-20h, νέο AI pipeline module)
  - Partial spec: ADR-034 §12
  - Τελευταίο στη σειρά — δεν μπλοκάρει 4.8/4.5

**Προτεινόμενη σειρά:** 4.8 ✅ → 4.5 ✅ → 4.6

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
| 2026-05-22 | **ADR-365 Phase 2 PARTIAL — Procurement + Vendor Portal**. 43 files committed (VendorPortal × 5, ExtractedDataReviewPanel, SetupLockBanner, SignatoryProposalCard, SignatoryDisambiguationModal, SourcingEventSummaryCard, QuoteLineEditorTable, QuoteDetailsHeader, QuoteEditMode, ComparisonPanel, ComparisonWinnerBanner, RecommendationCard, OfflineBanner, QuoteRevisionDetectedDialog, extracted-data-review-helpers, ProcurementSubNav, VendorDetail, VendorCard, SupplierComparisonTable, SupplierMetricsCard, PurchaseOrderForm, PurchaseOrderKPIs, AgreementDetail, MaterialDetail, hub/cards × 6, ContactRfqInvitesSection, ProcurementContactTab, ProjectProcurementTabs, KpiPendingApprovalPos, VendorGridCard, VendorListCard, scan/page, RfqDetailClient, AnalyticsKpiTiles). Baseline: 3,405/420 → 3,034/400 (−371 violations, −20 files). ConflictDialog migration in working tree (−2 more), blocked by CHECK 3.22 dead-code ratchet — pending Giorgio decision. ADR-365 status + changelog + adr-index + MEMORY.md updated. |
| 2026-05-22 | **ADR-365 Phase 1 DONE — DXF Viewer subapp**. 20 files cleaned: GripContextMenu, GripHoverMenu, WallDnaSection, WallPersistenceSection, StairWarningsSection, StairPersistenceSection, StairPresetsSection, StairPerTreadOverrideSection, DimensionsTab, DraftRecoveryBanner, SpellCheckContextMenu, TextTemplateList, PlaceholderPicker, CustomDictionaryEditorDialog, MirrorConfirmOverlay, DraggableOverlayToolbar, PolygonControls, IsolateStatusIndicator, FloorplanBackgroundPanel, PromptDialog. Baseline: 3,659/440 → 3,405/420 (−254 violations, −20 files). ADR-365 status + changelog updated. |
| 2026-05-21 | ADR-363 BIM entity points SSoT migration CLOSED — `slab-grips.ts` + `slab-opening-grips.ts` + `BeamRenderer.ts` (4 methods) migrated to `getBimEntityKeyPoints2D`. Transforms/geometry/validator files intentionally skipped (need 3D `Point3D`, SSoT returns 2D only). Broken import `bim-entity-points.ts` `'../extended-types'` → `'../../types/entities'` fixed. Item removed from checklist. |
| 2026-05-19 | ADR-363 R1 DONE — `useBimCopyTool` (AutoCAD COPY FSM + full canvas wiring). ADR-363 R2 DONE — stair bridge helpers moved to `bim/hooks/bridge/`, cross-domain coupling fixed. Both removed from checklist. |
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
| 2026-05-19 | ADR-365 Phase 0 DONE. Infrastructure deployed: ratchet script + SSoT registry module (Tier 2) + baseline + CHECK 3.26 in parallel orchestrator + npm scripts. Actual baseline 3,659/440 (revised from 249/65 — original audit was hover-only). Smoke 1-5 PASS. Hook latency ~0.73s staged. |
| 2026-05-19 | Auto-Infer Alignment Guides discovered via SPEC-3D-004C (GenArc port catalog). 3-engine grep confirmed gap (GuideSnapEngine/OrthoSnapEngine/ParallelSnapEngine — κανένα δεν κάνει auto-infer από arbitrary anchors). New pending entry added (~3h ADR proposal + implementation). 4 Giorgio conditions all ✅ satisfied (independent feature, not blocking ADR-366). |
| 2026-05-19 | **ADR-363 Phase 6 CLOSED — Multi-Layer DNA BOQ + Material→ΑΤΟΕ SSoT**. Phase 6.1 (multi-entry wall walls με `dna.layers.length > 1` → 1 parent + N children, deterministic IDs `boq_bim_${entityId}_layer_${layerId}`, per-layer detach guard ανεξάρτητο, cascade delete via `where('parentBoqItemId', '==', parentId)` query) + Phase 6.2 (material→ΑΤΟΕ catalog SSoT για 18 wall-material-catalog presets — ΟΙΚ-2/3/4/7/10/12 με quantityKind area/volume). Files: `bim/services/boq-multi-layer-builder.ts` (15 tests), `bim/config/material-to-atoe-mapping.ts` (23 tests), `bim/services/BimToBoqBridge.ts` extended (24 tests total — 12 existing single-entry preserved + 12 νέα multi-layer). BOQItem schema +4 optional fields (parentBoqItemId, isGroupParent, layerIndex, materialId) — 100% back-compat. Industry alignment 6/6 (SPEC-3D-004D §12 Q4 Revit/ArchiCAD/Bentley/Tekla/Vectorworks/Allplan Material Takeoff pattern). Ratchet entry «ADR-363 PHASE 6.x» removed από checklist. Future: user-editable bim_atoe_overrides + BOQ parent/children expandable UI (Phase 6.2+ non-blocking). |
| 2026-05-19 | **ADR-345 Fase 5.5-FR DONE** — findReplace button wired: `DxfFindReplaceHost.tsx` (NUOVO) + `findReplaceOpen` state in `useDxfViewerState` + `contextual-text-editor-tab.ts` comingSoon rimosso + `DxfViewerContent` lazy mount. spellCheck + insert.symbol rimangono comingSoon. ADR-345 changelog + Fase 5.5-FR subsection aggiunti. |
| 2026-05-19 | **ADR-363 Phase 7.2 CORE LANDED** (Mirror/Rotate/Copy BIM). Files: `bim/transforms/bim-mirror-geometry.ts` + `bim-rotate-geometry.ts` + `bim-copy-builder.ts` (SSoTs, pure functions, 7 BIM kinds each), `core/commands/entity-commands/BimCopyCommand.ts` (ICommand wrapper), MirrorEntityCommand + RotateEntityCommand extended with BIM dispatch (private `computeMirrorUpdates` / `computeRotateUpdates`). Kind-specific enterprise ID gen via `generateWallId/...`, opening↔wall + slab-opening↔slab host rewire on copy. 59 tests across 6 suites (21 mirror-geom + 12 rotate-geom + 10 copy-builder + 5 mirror dispatch + 5 rotate dispatch + 6 BimCopyCommand) all green. Ribbon buttons + MI/RO/CO shortcuts ήδη υπήρχαν; useMirrorTool + useRotationTool ήδη wired και τώρα δουλεύουν σε BIM. Ratchet block 7.2 αντικαθίσταται από smaller follow-up (~1h): `useBimCopyTool` clipboard flow. |
| 2026-05-21 | **ADR-358 stair TS gap CLOSED** — `entities.ts` consumer sweep fix: imports από `'./stair'` → `'../bim/types/stair-types'`. Root cause ήταν χαμένο αρχείο από ADR-363 Phase 0.5 sweep, όχι missing `case 'stair'` στο HitTestingService. Ratchet entry αφαιρέθηκε. |
| 2026-05-19 | **ADR-363 Phase 0.5 CLOSED — Stair Migration to `bim/` ολοκληρώθηκε**. Reality-vs-ADR drift διορθώθηκε: 45 barrel stubs `systems/stairs/` αφαιρέθηκαν, 2 barrels `types/stair.ts` + `rendering/entities/StairRenderer.ts` διαγράφηκαν, 2 hooks (`useStairPersistence`, `useRibbonStairBridge`) μετακινήθηκαν σε `bim/hooks/use-stair-persistence.ts` + `use-ribbon-stair-bridge.ts` με fixed imports. `bim/renderers/StairRenderer.ts` legacy imports διορθώθηκαν. Consumer sweep: 17 × systems/stairs + 4 × useStairPersistence + 1 × useRibbonStairBridge + 65 × types/stair. SSoT registry module `bim-folder-residency` (Tier 3, baseline 0) με 5 forbidden patterns. `stair-presets-service` + `stair-firestore-service` paths ενημερώθηκαν σε bim/. Stair tests: 21 suites / 322 tests / green. Ratchet entry «ADR-363 STAIR MIGRATION — Phase 0.5 incomplete» αφαιρέθηκε. Νέα boy-scout entry προστέθηκε για bridge/* helpers (cross-domain coupling BIM→UI follow-up, ~1h). |
