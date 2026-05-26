# Pending Ratchet Work — Live Checklist

**STATUS: ACTIVE**
**Last updated:** 2026-05-26 — **ADR-376 Phase C.3 DONE — ADR-376 COMPLETE ALL PHASES SHIPPED**: PDF Opening Schedule Export (Πίνακας Κουφωμάτων). 1 PDF with 2 sections (Θύρες + Παράθυρα), Revit-style combined sheet. 3 NEW files (opening-schedule-pdf-exporter.ts + OpeningSchedulePdfHost.tsx + 6 tests PASS) + 9 MODIFIED (EventBus + command-keys + annotate-tab + RibbonButtonIcon + useRibbonOpeningBridge + DxfViewerContent + schedule-presets mark column + i18n el/en). ADR-376 §7 C.3 + §11 v11 changelog + adr-index updated. local_ΑΝΑΦΟΡΑ_2.txt ΑΠ7 ✅ ΥΛΟΠΟΙΗΜΕΝΟ. Pending ratchet: legacy `boq_bim_<openingId>` rows από Phase A single-entry path (αν υπάρχουν production data) — cleanup TODO παρακάτω. .ssot-registry.json `opening-boq-grouper` + `opening-tag-drag-controller` + `opening-tag-style` entries pending μέχρι να καθαρίσει working tree.
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
- [x] **spellCheck toggle** ✅ DONE 2026-05-23 — Stub `comingSoon: true` già presente in `contextual-text-editor-tab.ts:385`. Engine assente by design — nessun ulteriore lavoro necessario finché non esiste un engine.
- [x] **insert.symbol button** → ✅ WIRED 2026-05-21. `SymbolPickerDialog.tsx` (30 symbols, 3 gruppi) + `DxfSymbolPickerHost.tsx` + `symbolPickerOpen` state + action `text-insert-symbol`. `InsertTextTokenCommand` extended per raw Unicode.

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

**Status:** PHASE 8 SALES DONE 2026-05-22. Baseline: 620/167. Per-phase handoff απαιτείται πριν από κάθε νέα session.

- [x] **Phase 0 — Infrastructure** ✅ 2026-05-19 — ratchet script (`scripts/check-tailwind-palette-ratchet.js`), `.ssot-registry.json` module `tailwind-hardcoded-palette` (Tier 2, 15 allowlist entries), `.tailwind-palette-baseline.json` (3,659 violations / 440 files — actual baseline revised from estimate 249/65), CHECK 3.26 wired into `scripts/run-checks-parallel.js` (worker_thread), npm scripts `tailwind-palette:{audit,report,baseline}`. Smoke 1-5 PASS. Hook latency ~0.73s staged / ~3.4s full.
- [x] **Phase 1 — DXF Viewer** ✅ 2026-05-22 — 20 files cleaned (−254 violations). Baseline: 3,659/440 → 3,405/420.
- [x] **Phase 2 — Procurement + Vendor Portal** ✅ 2026-05-22 — 43/44 files cleaned (−373 violations). Baseline: 3,405/420 → 3,032/399. ConflictDialog migration in working tree only, blocked by CHECK 3.22 dead-code ratchet.
- [x] **Phase 3 — Accounting** ✅ 2026-05-22 — 19 files cleaned (−143 violations). Baseline: 3,032/399 → 2,889/394.
- [x] **Phase 4 — Properties + Contacts + Building Dialogs** ✅ 2026-05-22 — 23 files cleaned (−149 violations). Baseline: 2,889/394 → 2,740/371.
- [x] **Phase 5 — Shared Files + File Manager** ✅ 2026-05-22 — 9 files cleaned (−73 violations). Baseline: 2,740/371 → 2,667/362.
- [x] **Phase 6 — Dashboard + Admin + CRM + Header + Notifications** ✅ 2026-05-22 — 11 files cleaned (−137 violations). Baseline: 2,667/362 → 2,530/354.
- [x] **Phase 7 — Design System + Showcase + Sales + Geo-canvas** ✅ 2026-05-22 — 8 files cleaned (−51 violations). Added `--showcase-link` CSS var. Baseline: 2,530/354 → 2,479/346.
- [x] **Phase 8 (partial) — Admin + Accounting + Contacts + Procurement + Reports + Compositions** ✅ 2026-05-22 — 50+ files cleaned (−1,836 violations). Baseline: 2,479/346 → **643/178**. ADR changelog updated.
- [x] **Phase 8 Sales — 31 αρχεία Sales domain** ✅ 2026-05-22 — interest-cost-helpers/tabs/pricing-settings, CounterproposalTab, ForwardCurveChart, HedgingComparisonTable, DSCRStressTab, CounterproposalScenarioRow, monte-carlo-panels, DrawScheduleTab, EquityWaterfallDialog, InterestReserveChart, MonteCarloTab, SensitivityTab, ChequeDetailDialog, CreatePaymentPlanWizard, InstallmentSchedule, InterestCostSection, LoanCard, LoanStatusTimeline, PaymentPlanOverview, TransactionChainCard, SalesPropertyListCard, sales-colors.ts, AppurtenancesSection, ContractCard, ContractTimeline, PropertyHierarchyCard, SalesParkingCard, SalesStorageCard, PropertySummaryContent. Baseline: 643/178 → **620/167** (−23 violations, −11 files).
- [x] **Phase 8 — Final closure** ✅ 2026-05-22 — 36 files cleaned (−36 violations). Baseline: 620/167 → **0/0**. `npm run tailwind-palette:baseline` run. ADR-365 status: **APPROVED**. Zero-tolerance enforcement active via CHECK 3.26.

**ADR-365 FULLY COMPLETE — all 9 phases done. Baseline = 0 violations / 0 files.**

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

### 🎬 ADR-366 §C.1 ANIMATION SYSTEM — ✅ FULLY CLOSED 2026-05-25

**Status (2026-05-25)**: All 3 sub-phases DONE. Animation Phase 9 ολόκληρη closed.

- ✅ **C.1.a Logic Foundation** — DONE 2026-05-25 (commit `1e393c1d`).
- ✅ **C.1.b UX / Timeline** — DONE 2026-05-25 (commit `68c473a5`). **+drag interaction DONE 2026-05-25** (uncommitted). **+§C.1.Q4 bezier 4-point editor DONE 2026-05-25** (uncommitted, FULL ENTERPRISE: 5 new + 4 modified + 23 tests). **+real scene-bbox turntable DONE 2026-05-25** (uncommitted, 2 new + 3 modified + 7 tests, SSoT REUSE computeSceneFramingBounds). Deferred resolved: ~~TimelineEditor unit tests~~ ✅ 2026-05-25, ~~snap-to-grid~~ ✅ 2026-05-25, ~~axis-constrained gizmo~~ ✅ 2026-05-25.
- ✅ **C.1.c Rendering / Queue** — DONE 2026-05-25 (8 new + 6 modified + storage rules + 3 test suites). MP4Exporter (WebCodecs H.264 + VP9 fallback inside MP4 via mp4-muxer@5.2.2 MIT) + RenderQueueStore (Zustand FIFO + AbortController Map) + RenderQueuePanel (Floating3DPanel 8th tab) + animation-queue-processor + render-checkpoint + animation-action-handlers (auto-save flow) + origin-indicator-overlay extraction (SRP cap) + Save+Export ribbon comingSoon REMOVED + Storage rules block (500MB, mp4/webm) + notification keys + i18n ~15×2. ADR drift resolved: rasterizer-not-pathtracer + project_assets DROPPED + VP9-in-MP4 + checkpoint field reuse. Cross-session subscribe DEFERRED Phase 10.

---

### 📅 ADR-034 GANTT — Phase 4 pending items (construction tracking)

**ADR:** `docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md`
**ADR-266:** `docs/centralized-systems/reference/adrs/ADR-266-gantt-construction-reports.md`
**Gantt dir:** `src/components/building-management/tabs/TimelineTabContent/gantt/`
**Hooks dir:** `src/components/building-management/hooks/construction-gantt/`

**ADR-034 αλλαγμένο (χωρίς commit) — status line + Phase 4 table + ADR-266 cross-ref + changelog.**

- [x] **4.8 Dependency arrows** ✅ DONE 2026-05-21 — `GanttDependencyArrows.tsx` + `useGanttDependencyArrows.ts`, portal into `.rmg-timeline-container`, RAF-throttled bezier SVG, ADR-034 §4.8 updated
- [x] **4.5 Alert engine — deadline notifications** ✅ DONE 2026-05-21 — ADR-266 Phase D.3 (6+1 alert rules, `construction_alerts` collection, API routes, `ScheduleAlertBanner`, Telegram digest, cron bypass) + Phase D.5 (Portfolio Dashboard). ADR-034 status line stale — needs sync.
- [x] **4.6 AI integration UC-017** ✅ DONE 2026-05-23 — UC-017 module 11 source files + 4 tests (41 pass). 6 features FAST/QUALITY/VISION. `src/services/ai-pipeline/modules/uc-017-gantt-ai/`. Intent `ADMIN_GANTT_AI` + registered.
  - Τελευταίο στη σειρά — δεν μπλοκάρει 4.8/4.5

**Προτεινόμενη σειρά:** 4.8 ✅ → 4.5 ✅ → 4.6

---

### 🧹 FULL ZERO BACKLOG (Scenario B extras — +~43h expected)

- [x] **ADR-298 Phase C** — COMPLETATO. Phase C.7 DONE 2026-04-14. 11 collezioni → COVERAGE. FIRESTORE_RULES_PENDING ora VUOTA (zero entry). Coverage totale: 92 collezioni. 291 test verdi.

- [x] **ADR-298 Phase E** — COMPLETATO 2026-04-14. ADR-301 (Storage Rules Coverage SSoT). 4 path pattern, 48 celle, harness completo, CHECK 3.19 verde.

- [x] **CHECK 3.8 i18n Missing Keys** — COMPLETATO 2026-04-14. 4,750→0 violazioni. 3 fasi: (1) 730 file `useTranslation` single→array (namespace ADR-280 subs), (2) 479 chiavi genuinamente mancanti aggiunte ai locale files el+en, (3) settings.json creato. Baseline 0.

---

### 🧱 ADR-373 ISO 19650 — Phase 2 deferred items (priorità media, ~10-15h totali, discovered 2026-05-24 via Phase 1 implementation)

**ADR**: `docs/centralized-systems/reference/adrs/ADR-373-iso19650-metadata-enrichment.md`

Phase 1 ✅ IMPLEMENTED 2026-05-24 (schema + AI enricher + tests + post-finalize hook). Φύλαξη για Phase 2 — επόμενες υλοποιήσεις:

- [x] **Manual override UI** ✅ DONE 2026-05-24 — Iso19650MetadataSection.tsx + updateIso19650Metadata() + file-mutation-gateway + i18n (P2.1).
- [x] **Virtual ISO 19650 folder view** ✅ DONE 2026-05-24 — buildTreeByISO19650 + FileManagerToolbar 4th view mode + iso19650-tree ViewMode (P2.2).
- [x] **Backfill script** ✅ DONE 2026-05-24 — GET/POST /api/admin/iso19650/backfill, super_admin only, dry-run + execute, max 20/call, idempotent (P2.3).
- [x] **Distributed concurrency token bucket** ✅ DONE 2026-05-24 — enrichment-slot-service.ts Admin SDK, max 5 slots/company, TTL 5min self-heal, fail-open (P2.4).
- [x] **Monthly aggregate cost dashboard** ✅ DONE 2026-05-24 — iso19650-cost-log-service.ts + GET /api/admin/iso19650/costs, byDiscipline/byMonth aggregates, max 500 records, rules deployed (P2.5).
- [x] **`suitabilityCode` field** ✅ DONE 2026-05-24 — SUITABILITY_CODES + SUITABILITY_CODE_REGEX + SuitabilityCode type in iso19650-constants.ts. FileRecord field. isSuitabilityCode() + validateSuitabilityCode() in validators.ts. Enricher schema+prompt+buildAiResult extended. 76 tests green (73 suites / 1179 total).
- [x] **i18n keys για ISO labels** ✅ DONE 2026-05-24 — `el/iso19650.json` + `en/iso19650.json` NEW. Namespace 'iso19650' registered in SUPPORTED_NAMESPACES + namespace-loaders. 13 disciplines + 9 series + 4 CDE states + 4 suitability codes + 7 labels. i18n audit clean.
- [x] **`vision-helpers.ts` SSoT extraction** ✅ DONE (prior session) — `downloadFile` / `extractOutputText` / `isImageMime` / `VisionContent` εξαχθηκαν σε shared module. iso19650-enricher.ts + contact-document-classifier.ts imports updated.

**Effort**: ~13.5h totale per Phase 2 (additional al Phase 3 ZIP export).

---

### 🧹 ADR-370/371 DUPLICATE NUMBERING — housekeeping (priorità bassa, ~15min, discovered 2026-05-24 via ADR-373 OQ8)

**Discovered**: 2026-05-24 durante ADR-373 Phase 1 Recognition (Glob verification del prossimo ADR libero).

**Πρόβλημα**: 4 αρχεία ADR με 2 collisione numerazione:
- `docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md`
- `docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md` ← duplicate
- `docs/centralized-systems/reference/adrs/ADR-371-bim-3d-readonly-viewer.md`
- `docs/centralized-systems/reference/adrs/ADR-371-bim-corner-snap-system.md` ← duplicate

**Effetto**: confusione nello index, ambiguità riferimenti incrociati, blocca uso di `adr-index.md` come SSoT.

**Fix proposto** (Γιώργος approval pending):
1. I due `corner-snap-system` ADRs sembrano duplicati l'uno dell'altro (stesso suffix). Verifica se sono lo stesso contenuto o due fasi diverse.
2. Se duplicati: cancella uno, l'altro rinomina come ADR-374 (next free dopo ADR-373).
3. Se distinti: rinomina ADR-370-bim-corner-snap-system.md → ADR-374, ADR-371-bim-corner-snap-system.md → ADR-375.
4. Grep tutti i riferimenti (`grep -rn "ADR-370\|ADR-371"` in docs/ + src/) e aggiorna.
5. Re-run auto-script per `adr-index.md`.

**Effort**: ~15min lookup + rename + reference update.

**Σχέση με ADR-373**: nessuna — domain diverso (BIM viewer vs file metadata). Non blocks ADR-373 implementation.

- [ ] Verifica se i 2 `corner-snap-system` ADRs sono content-equal o distinti
- [ ] Rinomina + ricerca + sostituzione tutti i riferimenti
- [ ] Re-run `adr-index.md` auto-script

---

### 🪟 ~~ADR-363 Opening — scene-units thread στα edit paths~~ ✅ CLOSED 2026-05-25 (later)

Closed via `hostWall.params.sceneUnits ?? 'mm'` frozen-context pattern σε **4 πραγματικούς callers** (όχι 11 — pending list είχε 7 false positives + 1 missing caller). Files: `bim-readonly-hydration.ts:132`, `useOpeningPersistence.ts:109`, `UpdateOpeningParamsCommand.ts:71`, `WallSplitCommand.ts:149`. 3 νέα tests στο `opening-geometry.test.ts` (scene-units 'm' describe block). 27/27 PASS. Καμία API change σε commands/`OpeningParams`. Out of scope: pre-existing `wall.geometry.length * 1000` σε `applyOpeningGripDrag` — separate ratchet candidate. Βλ. ADR-363 §12 changelog 2026-05-25 (later).

---

### 🎨 ADR-375 Phase C — BIM Line Weight Advanced (C.1 ✅ DONE, C.2-C.7 pending, ~20-35h remaining)

**ADR**: `docs/centralized-systems/reference/adrs/ADR-375-bim-entity-line-weight-semantic-system.md`
**Status**: C.1 ✅ DONE 2026-05-26 (Pen Table editor). C.2-C.7 ⏸️ DEFERRED.

**Phase C scope** (ADR-375 §5.Phase-C):

1. **Pen Table editor** ✅ DONE 2026-05-26 — `dxf_viewer_pen_tables/{companyId}`, Zustand store, `setPenTableSource()` resolver injection, `PenTablePanel.tsx` 16×6 grid. 10 tests.
2. **Pen Sets presets** — Bundles Design / Construction / Presentation. Ένα click αλλάζει ολόκληρη pen table. Reference: ArchiCAD Pen Sets pattern.
3. **Subcategories** — Door panel vs Door swing, Wall layers cut vs skin. Διαφορετικό pen ανά μέρος του ίδιου entity.
4. **Per-view overrides (Visibility/Graphics)** — Override styles ανά view χωρίς να αλλάζουν defaults. Επεκτείνει το ViewTemplate.
5. **Per-element overrides** — Πάχος γραμμής για ΕΝΑΝ συγκεκριμένο τοίχο. Νέο field `entity.params.lineWeightOverride?`.
6. **Layer-driven overrides** — Integration με ADR-358. Layer controls override BIM defaults (όπως Revit Layer Lineweight αν existed).
7. **3D parity (ADR-370)** — Τα ίδια SSoT tokens (PenTable + ObjectStyles + ViewRange) να εφαρμόζονται σε THREE.js line widths. Mirror του 2D Phase A pattern σε 3D viewer.

**Phase D scope** (ξεχωριστό ADR στο μέλλον — όχι μέρος C):
- Underlay rendering (όροφος από πάνω/κάτω σαν halftone reference)

**Δομικός περιορισμός εντοπίστηκε 2026-05-26 runtime verification**:
- Το σύστημα έχει **1 `dxf_viewer_levels` doc που reuses floorId** όταν αλλάζεις όροφο. Δεν υπάρχουν παράλληλα 2+ BIM Level entities με ίδιο `appliedViewTemplateId`.
- Συνέπεια: το Update propagation (`propagateToLinkedLevels`) στο `view-template.service.ts` είναι **unit-tested (28 tests PASS) αλλά runtime-unobservable**.
- Δεν είναι B.3 bug — είναι ίσως candidate για Phase D / νέο ADR (multi-level architecture extension).

**Pre-requisites για Phase C**:
- Καμία. Phase A + B είναι solid baseline.
- ⚠️ Πριν Phase C.7 (3D parity), επιβεβαίωσε ADR-370 status (3D viewer Group A/B/C state).

**Effort estimate (ψιλικά)**: C.1 ~3-5h · C.2 ~2-3h · C.3 ~5-8h · C.4 ~5-8h · C.5 ~3-5h · C.6 ~3-5h · C.7 ~5-10h. Total ~25-40h.

- [ ] **C.1** Pen Table editor (UI grid + persistence)
- [ ] **C.2** Pen Sets presets (Design / Construction / Presentation)
- [ ] **C.3** Subcategories (Door panel/swing, Wall layers)
- [ ] **C.4** Per-view overrides (extends ViewTemplate)
- [ ] **C.5** Per-element overrides (`entity.params.lineWeightOverride?`)
- [ ] **C.6** Layer-driven overrides (ADR-358 integration)
- [ ] **C.7** 3D parity (ADR-370 THREE.js line widths)

---

## Short sentence for session-start reminder

**Copy-paste template for the agent:**

> 📋 Pending ratchet tasks (ADR-299): **ADR-365 Tailwind Palette ✅ COMPLETE** — 0 violations / 0 files (2026-05-22). Zero-tolerance via CHECK 3.26 active. Remaining pending: Grip Types SSoT, ADR-3XX Auto-Infer Alignment, ADR-370/371 duplicate numbering cleanup, **ADR-375 Phase C BIM Line Weight Advanced (~25-40h, deferred 2026-05-25, runtime-verified Phase A+B 2026-05-26 with 5 hotfixes v1.6-v1.8)**. (ADR-363 Opening scene-units thread ✅ CLOSED 2026-05-25 later — 4 callers, 27/27 tests PASS. ADR-366 §C.1 Animation Phase 9 ✅ FULLY CLOSED 2026-05-25 (axis-constrained gizmo ✅ DONE 2026-05-25 — closes last deferred C.1.b item, Phase 9 zero deferred); ADR-345 spellCheck ✅ DONE 2026-05-23, ADR-034 UC-017 ✅ DONE 2026-05-23; **ADR-363 Phase 2 canvas-wiring follow-up ✅ 2026-05-25** — opening tool silent-failure fix.)

---

## Changelog

| Date       | Change |
| 2026-05-26 | **ADR-375 v1.9 — StairRenderer + OpeningRenderer secondary-line coverage HOTFIX.** Stairs δεν αντιδρούσαν σε DrawingScale / ViewRange Cut Plane / ObjectStyles (Giorgio runtime report). Root cause: v1.7 hotfix κάλυψε 6 BIM renderers (Wall/Slab/Column/Beam/Opening/SlabOpening) αλλά **όχι StairRenderer** (διαφορετικό pattern, υπήρχε partial migration σε 1/3 line widths) + `OpeningRenderer` είχε wired μόνο κύρια γραμμή, τα 4 secondary cues (hingeArc/leaf/sliding/glazing) hardcoded. **Fix**: (a) `StairRenderer.render()` υπολογίζει μία φορά `cutState = resolveCutState({zBottomMm: basePoint.z, zTopMm: basePoint.z+totalRise, category: 'stair'}, ds.viewRange)` + `baseLineWidth = resolveLineWeightPx({category: 'stair', cutState, scaleDenominator, dpi: 96, objectStyles})` και τα προωθεί στο `StairStyleContext` (+`baseLineWidth: number` field, required) + στα `drawHandrails/drawWalkline/drawArrow` params. Removed `RENDER_LINE_WIDTHS` import + hardcoded `cutState:'cut'` στο drawArrow. (b) `stair-render-structure-style.ts` — 8 occurrences `RENDER_LINE_WIDTHS.{THICK,NORMAL,THIN}` → `scx.baseLineWidth`. Visual hierarchy μέσω dash patterns (suspended dashed, walkline dashed, handrails dashed). Per-element hierarchy via Object Subcategories Phase C.3 (pending). (c) `OpeningRenderer.ts` — `_opBaseLineWidth` προωθούμενο από render → drawKindOverlay → drawHingeArc/drawSlidingIndicator/drawGlazing. 4 hardcoded lines 177/182/214/232 → `baseLineWidth`. Hover halo lines (StairRenderer:84, OpeningRenderer:60) εσκεμμένα διατηρούν `RENDER_LINE_WIDTHS.NORMAL` (scale-independent UX glow). **Files**: 3 modified (`StairRenderer.ts`, `stair-render-structure-style.ts`, `OpeningRenderer.ts`) + 1 test factory updated (`__tests__/stair-render-structure-style.test.ts` — `makeScx()` παίρνει optional `baseLineWidth = 1.5`). **Tests**: 16/16 stair-render-structure-style PASS. TSC clean. Pending commit (must isolate from άλλου agent ADR-376 Phase C.2 work που υπάρχει στο working tree). |
| 2026-05-26 | **ADR-376 Phase B.2 DONE — BOQ signature-group aggregation.** Single aggregated BOQ row per Mode C signature group (kind+width+height+sillHeight+openDirection). Revit Schedule pattern, 6/6 industry convergence (Revit / ArchiCAD / Tekla / Allplan / Bentley / Vectorworks). Drift fix στο ADR-376 §7 B.2 row — αρχικό "mirroring multi-layer wall pattern" ήταν λάθος γιατί openings είναι atomic (no multi-component layers); διορθώθηκε σε "single aggregated row per signature group". 2 new files + 3 modified + 29/29 tests PASS. New: `bim/services/opening-boq-grouper.ts` (pure SSoT — computeOpeningSignature + signatureKey + signatureGroupBoqId + compactMarkRange Revit-style range collapsing `Π.001..Π.150` + groupBySignature bucket + buildOpeningGroupPayload BOQItem factory με enriched title `Κούφωμα παραθύρου (BIM) — 1200×1400 (sill 900)` + description `Marks: Π.101..Π.150`; zero Firestore I/O), `bim/services/__tests__/opening-boq-grouper.test.ts` (29 assertions: signature stability 5 + group ID 2 + mark range 9 + group aggregation 4 + payload building 9). Modified: `bim/services/BimToBoqBridge.ts` (+upsertOpeningGroupForOpening με old+new signature dual recompute όταν params μεταβάλλεται · +deleteOpeningFromGroup · +private recomputeSignatureGroup με detach guard + delete-when-empty + createdAt preservation · +private fetchOpeningsForSignature με (companyId, projectId, floorplanId, kind) Firestore query + JS-side signature filter · legacy `upsertBoqItemForBim('opening', …)` πλέον warns + skips · +floorplanId? optional στο BimBoqContext), `hooks/data/useOpeningPersistence.ts` (persist callback captures prevParams από lastSavedParamsRef πριν την save για old-signature recompute · pass entity.params + floorplanId στο bridge · delete path passes lastKnownParams από ref ή deleted scene entity), `ADR-376-opening-tags.md` (§7 B.2 row drift fix + status DONE + §11 v7 changelog + status header PHASE_B2_DONE), `ADR-175-quantity-surveying-measurements-system.md` (§4.3 BIM auto-feed patterns sub-section — wall multi-layer vs opening signature aggregation distinction). Pending: Phase C (draggable tag) + `.ssot-registry.json` opening-boq-grouper entry (surgical commit όταν καθαρίσει working tree). Migration TODO: legacy `boq_bim_<openingId>` rows από Phase A single-entry path (αν υπάρχουν production data) ΔΕΝ διαγράφονται αυτόματα. |
| 2026-05-25 | **ADR-366 §C.1.b Waypoint 3D drag interaction DONE.** Closes the largest deferred item from C.1.b post-completion: waypoints are now draggable in the 3D viewport (not just visual). 3 new files + 3 modified + 17 new tests. New: `waypoint-drag-controller.ts` (pure FSM idle/hovering/dragging + camera-aligned drag plane Blender/AutoCAD pattern + Three.js Raycaster pick + ray.intersectPlane projection + exported pure helpers `setNdcFromClient` + `computeCameraAlignedPlane`), `use-waypoint-drag-interaction.ts` (React hook με DOM pointer listeners attached MONO όταν `AnimationStore.toolActive===true` + AbortController per session για clean teardown + setPointerCapture για robust drag across canvas edges + single-writer SSoT to `AnimationStore.updateWaypoint`), `__tests__/waypoint-drag-controller.test.ts` (17 tests: NDC conversion 4 + camera-plane math 1 + FSM transitions 7 + pick raycast 2 + drag projection 3). Modified: `WaypointDragHandle.ts` (+`getHandlesGroup(): Group|null` raycast exposure + `setHoverState(role|null)` με `paintSprite` helper + cold/hot palette mirror Dim3DGripsRenderer pattern, removed legacy warm/hot mix), `ThreeJsSceneManager.ts` (+`getWaypointHandlesRoot()` + `setWaypointHoverState()` getters), `BimViewport3D.tsx` (+`useWaypointDragInteraction({managerRef, canvasEl})` hook call). Tests: 50/50 PASS (33 existing C.1.c + 17 new drag). Still deferred from C.1.b: bezier 4-point editor (§C.1.Q4 «Προχωρημένα»), real scene-bbox για turntable (synthetic camera-distance still in use), TimelineEditor+WaypointDragHandle React component tests, axis-constrained gizmo arrows (X/Y/Z), snap-to-grid. |
| 2026-05-25 | **ADR-366 §C.1.c Animation Rendering / Queue DONE → Animation Phase 9 FULLY CLOSED.** 8 new + 6 modified files + Storage rules block + package.json (+mp4-muxer@5.2.2 MIT). New: MP4Exporter.ts (WebCodecs `VideoEncoder` H.264 Main L3.1 primary + VP9 Profile 0 fallback inside MP4 via mp4-muxer; dedicated offscreen WebGLRenderer + PerspectiveCamera so live viewport canvas stays untouched; rAF yield + AbortSignal), RenderQueueStore.ts (Zustand FIFO + activeJobId + module-scope `Map<jobId, AbortController>` non-serializable + idempotent enqueue + hydrateFromFirestore equality guard preserving runtime blobUrl), RenderQueuePanel.tsx (Floating3DPanel 8th tab; semantic <progress> + status badge palette via ADR-365 CSS vars + cancel/retry/download/remove + ETA), animation-queue-processor.ts (React hook glue; status-fingerprint subscription claims next queued job when idle; drives MP4Exporter + uploads to Firebase Storage + throttled progress persistence 1.5s + checkpoint serialization on AbortError → cancelled-resumable), render-checkpoint.ts (pure serialize/deserialize, semantic field reuse `lastSampleCount` → `lastFrameIndex`), animation-action-handlers.ts (extracted `handleAnimationSave` + `handleAnimationExport` keeping useDxfViewerCallbacks under 500-line cap; auto-save creates bim_animation doc when loadedDocId===null με default name `t('animation.defaultName',{time:HH:mm})`), origin-indicator-overlay.ts (SVG crosshair helper extracted from useDxfViewerCallbacks for SRP), 3 test suites under __tests__/. Modified: Floating3DPanel ('renders' tab union member + conditional via selectAnyJobs + w-72 widen), contextual-animation-tab.ts (animation.save + animation.export `comingSoon: true` REMOVED + real actions wired), useDxfViewerCallbacks.ts (+useAuth + animation.save/animation.export cases dispatching to handlers + bim3d namespace), BimViewport3D.tsx (+useAnimationQueueProcessor mount + notification callbacks wired), notification-keys.ts (+bim3d.animation.{render,save,export}.* — 8 keys), i18n el/en bim3d.json (+animation.notification.* + animation.queue.* + animation.defaultName + floatingPanel.tabs.renders, ~15 keys × 2 locales). Storage rules: new block `/companies/{companyId}/bim_animations/{animationId}/renders/{fileName}` (500MB cap, mp4/webm only). ADR drift resolved (4): (1) §C.1.Q9 standard rasterizer not path-tracer (impractical 4h+/animation); (2) §C.1.Q8 project_assets DROPPED (service does not exist; mp4 stored direct to Storage); (3) §C.1.Q7 VP9-in-MP4 fallback (separate WebM lib deferred); (4) checkpoint field reuse. Cross-session queue subscribe DEFERRED Phase 10. Auto-save policy: Giorgio chose option A (auto-create + activate Save). C.1.c checklist + ratchet entry removed. Animation Phase 9 ολόκληρη CLOSED. |
| 2026-05-25 | **ADR-366 §C.1.b Animation UX/Timeline DONE** — 10 αρχεία (4 new + 6 modified) + 100 i18n entries. New: TimelineEditor.tsx (~280 LOC vertical waypoint editor) + TimelineWaypointForm.tsx (~115 LOC properties form split για N.7.1) + WaypointDragHandle.ts (~165 LOC Three.js Sprite renderer mirror Dim3DGripsRenderer) + contextual-animation-tab.ts (~165 LOC declarative RibbonTab). Modified: AnimationStore (+toolActive + selectAnimationToolActive — SSoT deviation από brief: domain store ΟΧΙ ViewMode3DStore, mirror BimDimensions3DStore pattern), Floating3DPanel (+7th tab 'animation', conditional w-48→w-72 widen design risk resolution), ribbon-contextual-config (+ANIMATION trigger early-return), ThreeJsSceneManager (+WaypointDragHandleRenderer lifecycle), useDxfViewerCallbacks (+5 animation actions: tool-toggle/turntable/add-waypoint/delete-waypoint/reverse + syntheticBboxFromCamera helper), bim3d.json el/en (+50 keys × 2 locales pure Greek). Deferred (NOT blocker): drag interaction (raycaster + mouse handler), bezier 4-point editor, real scene-bbox, unit tests. C.1.b checklist removed. Pending: only C.1.c. |
| 2026-05-25 | **ADR-366 §C.1.a Animation Logic Foundation DONE** — 12 αρχεία (7 new + 5 SSoT extensions) + 5 test suites. C.1 split σε 3 sub-phases (C.1.a / C.1.b / C.1.c) στο ADR §C.1 Implementation Phases. Pending entry για C.1.b (UX/Timeline ~7-9h) + C.1.c (Rendering/Queue ~6-8h) added. SSoT extensions: enterprise-id `anm_bim_`/`rnj_bim_`, COLLECTIONS.BIM_ANIMATIONS + SUBCOLLECTIONS.BIM_RENDER_JOBS, RBAC `bim_animations:animations:{C,R,U,D}` × 4 roles + read viewer, AuditEntityType `'bim_animation'`, Firestore rules block. |
| 2026-05-24 | **Selection SSoT Cleanup DONE** — Removed dual-write pattern from `CanvasLayerStack.tsx`. `universalSelection` is now the ONLY write path for entity/overlay selection. `setSelectedEntityIds` removed from `entityState` type + CanvasSection prop. ADR-040 changelog updated. 3 files changed (CanvasLayerStack.tsx, canvas-layer-stack-types.ts, CanvasSection.tsx). |
| 2026-05-22 | **🚨 ADR-365 green-707 TYPO INCIDENT — DOCUMENTATION INCONSISTENCY DISCOVERED.** Phases 3-8 migration mapping `green-*` → `text-green-707` / `bg-green-707` is a TYPO (intended `green-700`, the COLOR_BRIDGE canonical at `src/design-system/color-bridge.ts:142`). `green-707` is **not** a valid Tailwind shade (`SHADES = ['50','100',…,'700',…,'950']` in `scripts/check-tailwind-palette-ratchet.js:80`) and is **not** defined anywhere in `tailwind.config.ts`, `src/styles/`, or `globals.css`. Impact: **304 occurrences across 183 files** silently emit no CSS — Tailwind JIT scans source, finds no class definition, drops the utility. Visual result: success badges / form-validation labels / terminal logs / toggles render as default text color in those files. **Why baseline reads 0/0**: the ratchet regex looks for valid shades only; `green-707` bypasses it entirely. The "complete" status of ADR-365 is **only formally complete** — semantic intent is correct but emitted CSS is broken for green success states. **Pending fix** (next phase): global rename `green-707` → semantic token (`text-[hsl(var(--text-success))]` or equivalent) + remove "WCAG exception" entry from ADR-365 §2.1 + add invalid-shade detection to ratchet script (catch `green-\d+` not in `SHADES` list). Origin commit `1788cad9` (Phase 5). |
| 2026-05-22 | **ADR-365 Phase 8 Final Closure — APPROVED.** 36 files fixed (ThemeProgressBar, ParkingGeneralTab, StorageGeneralTab, RecipientsList, OverlayListCard, PropertyGridCard, FloorPlanViewer, select-styles, TechnicalAlertConfigPanel, ProposalActionContent, EnterpriseMigrationPageContent, PropertyStatusDemoPageContent, ContactsTabContent, CompactToolbar/types, ThreadView, GenericPeriodSelector, PhotosTabBase, HeaderBar, AIQueryInput, ChequeDetailDialog, EmptyState, EntityFilesToolbar, DescriptionNotesCard, calendar, TemplateSelector, EnterprisePhotoUpload, base-tabs, PropertyStatusSelector, PageErrorState, CardIcon, AgreementListCard, LevelListCard, MaterialListCard, PurchaseOrderListCard, QuoteListCard, design-system.ts, text-utils.ts, sidebar-utils.ts, NotificationProvider, modal-layout.ts, UserTypeSelector, FloorPlanPreview, FloorPlanUploadModal, PolygonControls). Baseline: 36/36 → **0/0**. npm run tailwind-palette:baseline run. ADR-365 status: APPROVED. |
| 2026-05-22 | **ADR-365 Phase 5 DONE — Shared Files + File Manager**. 9 files: ArchiveView, TrashView, VersionHistory, UploadEntryPointSelector, HierarchicalEntryPointSelector, hierarchical-entry-cards, CameraCaptureDialog, ApprovalPanel, BatchActionsBar. Baseline: 2,740/371 → 2,667/362 (−73 violations, −9 files). Mappings: orange/amber/yellow→warning tokens; red→destructive; green→text-green-707/bg-success; violet→primary; dark: removed; eslint-disable comments removed. |
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
| 2026-05-22 | **ADR-345 commit chain CLOSED (was outdated)** — Confirmed 2026-05-22 via code audit: `useTextToolbarCommandBridge` (ADR-344 Phase 6.E, 2026-05-12) is mounted in `DxfViewerContent.tsx:124` (always active). Chain ribbon→store→CommandHistory ήδη λειτουργεί: `useRibbonTextEditorBridge.setValue` → store change (isPopulating=false) → subscribe callback → `UpdateTextStyleCommand/UpdateTextGeometryCommand/UpdateTextCurrentScaleCommand/UpdateMTextParagraphCommand` → `CommandHistory`. Known gap (existing, same as floating panel): `lineSpacingFactor` + `layerId` deferred, no commands yet. Ratchet entry αφαιρέθηκε. ADR-345 §Fase-5.5 ενημερώθηκε. |
| 2026-05-19 | **ADR-363 Phase 0.5 CLOSED — Stair Migration to `bim/` ολοκληρώθηκε**. Reality-vs-ADR drift διορθώθηκε: 45 barrel stubs `systems/stairs/` αφαιρέθηκαν, 2 barrels `types/stair.ts` + `rendering/entities/StairRenderer.ts` διαγράφηκαν, 2 hooks (`useStairPersistence`, `useRibbonStairBridge`) μετακινήθηκαν σε `bim/hooks/use-stair-persistence.ts` + `use-ribbon-stair-bridge.ts` με fixed imports. `bim/renderers/StairRenderer.ts` legacy imports διορθώθηκαν. Consumer sweep: 17 × systems/stairs + 4 × useStairPersistence + 1 × useRibbonStairBridge + 65 × types/stair. SSoT registry module `bim-folder-residency` (Tier 3, baseline 0) με 5 forbidden patterns. `stair-presets-service` + `stair-firestore-service` paths ενημερώθηκαν σε bim/. Stair tests: 21 suites / 322 tests / green. Ratchet entry «ADR-363 STAIR MIGRATION — Phase 0.5 incomplete» αφαιρέθηκε. Νέα boy-scout entry προστέθηκε για bridge/* helpers (cross-domain coupling BIM→UI follow-up, ~1h). |
| 2026-05-25 | **ADR-376 Phase A — Opening Tags blank-canvas case (PENDING)**. Phase A implementation complete (per `local_ΑΝΑΦΟΡΑ_2.txt` ΟΜΑΔΑ ΑΜ): mark allocation γίνεται μόνο όταν ο user φόρτωσε κάτοψη μέσω wizard (έχει `level.floorId`). Σε blank-canvas / non-wizard placement, ο allocator skip-άρει (console.warn, `mark = undefined`, opening persists κανονικά). Pending direction Giorgio: πώς να γίνει mark allocation όταν δεν υπάρχει floor context (π.χ. default floor=0; ζήτα από user; ξεχωριστή φάση Phase B). Ratchet entry NEW — εκκρεμεί guidance. |
| 2026-05-25 | **ADR-376 v5.1 + v5.2 + v5.3 CLOSURES** — (v5.1) Layers panel UI toggle wired: `AnnotationsSection.tsx` + `LevelPanel` integration + i18n el/en + 9 SSoT tests + `.ssot-registry.json` `opening-tag-layer` Tier 3 entry. (v5.2) Cross-floor allocator bug fix στο `opening-mark-service.ts:parseMarkSeq` (seq cap [1,99] per §4.1 floor-prefix hundreds convention) — 20/20 tests PASS, previously 19/20. (v5.3) **Blank-canvas decision RESOLVED Option D** (Giorgio): silent skip παραμένει final design — §8 Out-of-scope. Previous «blank-canvas non-wizard placement» pending entry CLOSED. Zero further code work για Phase A. |
| 2026-05-25 | **ADR-376 Phase B.1 DONE** — Renumber Openings command (IMAGINiT Door Mark Update pattern). NEW (6): opening-renumber-service + tests (12/12 PASS), RenumberOpeningsCommand (ICommand + writeBatch + scene optimistic + undo), RenumberOpeningsDialog (Radix Dialog + scope radio + kind checkbox + manual-include toggle + live preview), RenumberOpeningsHost (EventBus listener + lazy load), annotate-tab-openings ribbon panel. MODIFIED (9): opening-types.ts (+markIsManual flag), opening-command-keys (+renumber action), contextual-opening-tab (+quick-action panel), ribbon-default-tabs (annotate uses new panel), useRibbonOpeningBridge (+onAction + markIsManual on Mark edit), RibbonButtonIcon (+bim-opening-renumber icon), EventBus (+bim:opening-renumber-requested event), DxfViewerContent (lazy mount Host), i18n el+en. Industry standard 5/5 convergence (IMAGINiT/ArchiCAD/Tekla/Bentley/Vectorworks): preserve manual overrides by default, opt-in to wipe. `.ssot-registry.json` νέο entry `opening-renumber-service` (Tier 3). ADR-376 §7 status table + §4.9 markIsManual semantics + §11 changelog v6. ΑΝΑΦΟΡΑ_2 ΟΜΑΔΑ ΑΞ added. Pending: Phase B.2 (BOQ Schedule signature group-by Mode C) + Phase C (draggable tag). |
