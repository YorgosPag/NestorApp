# HANDOFF — Ενιαίος Performance HUD 2D+3D (ΟΛΟΚΛΗΡΩΘΗΚΕ) + επόμενο: cross-subapp `PerformanceWithMemory` SSoT

**Ημ/νία:** 2026-06-27
**ADR:** ADR-366 §B.5.U
**Κατάσταση:** Κύριο task ΟΛΟΚΛΗΡΩΜΕΝΟ & UNCOMMITTED. tsc-clean (δικά μου), 21/21 jest. Commit/push **ΜΟΝΟ ο Giorgio**. Working tree **μοιράζεται με άλλον agent** → ΠΟΤΕ `git add -A`.

---

## 1. ΤΙ ΕΓΙΝΕ (ολοκληρωμένο)

Ενοποιήθηκε ο μετρητής επιδόσεων σε **ΕΝΑ HUD/store/thresholds/history** που δουλεύει σε **2D ΚΑΙ 3D** (Revit/Cinema4D-grade). Το 2D PERF panel έδειχνε **mock** (`fps:50` hardcoded)· τώρα το ώριμο 3D HUD (ADR-366 §B.5) είναι ο **κοινός πυρήνας** και το 2D μια δεύτερη **πηγή metrics** στο ίδιο store.

### SSoT αρχιτεκτονική (μετά από 3 γύρους audit του Giorgio)
- `renderMode`: `Bim3dRenderMode` → **`HudRenderMode`** = **alias του `ViewMode3D`** (όχι διπλό union· type-only import). Εξαλείφθηκε εντελώς το `Bim3dRenderMode`.
- WebGL-only metrics (triangles/vertices/drawCalls/objectsVisible/objectsTotal/gpuMemoryMb) → **`number|null`**· σε 2D = null → «—» greyed μέσω `EMPHASIS_MAP['2d']`.
- **NEW `bim-3d/performance/performance-collector-shared.ts`** → `commitPerformanceSnapshot()` (ΜΙΑ πηγή write στα stores).
- **NEW `utils/cpu-memory.ts`** → `readCpuMemoryMb()` (ΜΙΑ πηγή CPU-memory read· neutral layer· χρήση από **3D collector + 2D collector + DxfPerformanceOptimizer**).
- `TICK_MS` → `DXF_TIMING.PERFORMANCE_HUD_POLL` (ήδη κεντρικό).
- ΕΝΑ toggle: PERF κουμπί (DebugToolbar) + action `toggle-perf` + Quality3D switch → όλα `usePerformanceHUDStore.setEnabled`.
- Mock retired: deleted `usePerformanceMonitorToggle.ts` + `ClientOnlyPerformanceDashboard.tsx`· removed dead `hasMemoryAPI`/`PerformanceWithMemory`/`PerformanceMemoryInfo` από `dxf-perf-types`.

### Αρχεία
**NEW:** `bim-3d/performance/{hud-render-mode,Performance2DCollector,usePerformanceModeBridge,performance-collector-shared}.ts`, `components/dxf-layout/UnifiedPerformanceHudLeaf.tsx`, `utils/cpu-memory.ts`, `bim-3d/performance/__tests__/{Performance2DCollector,usePerformanceModeBridge,PerformanceHUDExpanded.null-render,performance-thresholds.ssot}.test.{ts,tsx}`
**MOD:** `bim-3d/performance/{PerformanceHUDStore,per-mode-promotion,PerformanceHUDMini,PerformanceHUDExpanded,PerformanceHistoryStore,PerformanceDiagnosticDialog,performance-thresholds,PerformanceCollector,baseline-tracker,regression-detector}.ts(x)`, `bim-3d/telemetry/{telemetry-batcher,anonymizer}.ts`, `bim-3d/viewport/BimViewport3D.tsx`, `components/dxf-layout/CanvasLayerStack.tsx`, `debug/DebugToolbar.tsx`, `app/{DxfViewerContent,DxfViewerDialogs,useDxfViewerCallbacks}.ts(x)`, `performance/{DxfPerformanceOptimizer,dxf-perf-types}.ts`, `i18n/locales/{el,en}/bim3d.json`, `docs/.../ADR-366*.md`, `docs/.../adr-index.md`
**DELETED:** `hooks/usePerformanceMonitorToggle.ts`, `core/performance/components/ClientOnlyPerformanceDashboard.tsx`

### Εκκρεμεί στο κύριο task
- 🔴 **Browser-verify**: PERF ON σε 2D → πραγματικά fps/frameTime/CPU mem, 3D metrics «—». Switch 3D → ίδιο HUD με triangles/drawCalls/GPU. Καθαρή εναλλαγή.
- 🔴 **Commit** (ο Giorgio): stage ΜΟΝΟ τα παραπάνω + ADR-366/ADR-040/adr-index/i18n. CHECK 6B/6D → ADR-040 staged μαζί. **ΟΧΙ** `git add -A`.

---

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ (το task της νέας συνεδρίας)

**Cross-subapp κεντρικοποίηση του type `PerformanceWithMemory` (Chrome `performance.memory`).**

Προϋπάρχον διπλότυπο (ΟΧΙ δικό μου) σε **8+ σημεία**:
- `subapps/geo-canvas/profiling/performance-profiler-types.ts`
- `subapps/geo-canvas/performance/monitoring/performance-monitor-types.ts`
- `subapps/geo-canvas/optimization/memory-leak-detector-types.ts`
- `core/performance/core/enterprise-perf-types.ts`
- (το `dxf-viewer` ΗΔΗ καθαρίστηκε → χρησιμοποιεί `utils/cpu-memory.ts`)
- + ad-hoc readers (`getSystemInfo` στο `core/performance/core/enterprise-perf-utils.ts`, κ.ά.)

### ΥΠΟΧΡΕΩΤΙΚΑ ΒΗΜΑΤΑ (με τη σειρά)
1. **GREP SSOT AUDIT ΠΡΩΤΑ** — `grep` για `PerformanceWithMemory`, `usedJSHeapSize`, `performance.memory`, `jsHeapSizeLimit` σε όλο το `src/`. Δες αν υπάρχει ΗΔΗ canonical type/reader πριν φτιάξεις νέο. **Μη δημιουργήσεις διπλότυπο.**
2. **Best-practice μεγάλων παικτών** — Ο Giorgio: full enterprise + full SSoT, ΑΛΛΑ αν οι μεγάλοι (Revit/Maxon/Cinema4D) δεν προτείνουν app-wide unification ενός τόσο μικρού platform type, ακολούθησε την πρακτική τους (συνήθως: ΕΝΑ shared platform/utils type, per-app readers ΟΧΙ). Πάρε απόφαση τεκμηριωμένα.
3. **Execution mode (N.8)** — Είναι cross-subapp (geo-canvas + core + dxf), 8+ αρχεία, 2+ domains → **Orchestrator/Plan Mode + νέο ADR + έγκριση Giorgio ΠΡΙΝ την υλοποίηση**. ΜΗΝ ξεκινήσεις κώδικα χωρίς approval.
4. Πρόταση κατεύθυνσης: ΕΝΑΣ canonical `PerformanceWithMemory` type + ΕΝΑΣ `readCpuMemoryMb()` σε neutral location (π.χ. `src/core/performance` ή `src/lib`), που να επαναχρησιμοποιεί ΚΑΙ το `utils/cpu-memory.ts` του dxf-viewer (να γίνει thin re-export). Επιβεβαίωσε με grep πριν.

### ΚΑΝΟΝΕΣ
- ΠΟΤΕ νέο διπλότυπο. Προϋπάρχοντα διπλότυπα που βρίσκεις → κεντρικοποίησέ τα (διαταγή Giorgio).
- ΠΟΤΕ commit/push (ο Giorgio). ΠΟΤΕ `git add -A` (shared tree).
- N.17: ΕΝΑ tsc τη φορά (έλεγξε για running tsc πριν).
- Γλώσσα: Ελληνικά.

---

## 3. ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push.
- ΜΗΝ `git add -A` (μοιραζόμενο working tree).
- ΜΗΝ αγγίξεις αρχεία άλλων agents (beam/structural/foundation — έχουν 16 προϋπάρχοντα tsc errors, ΟΧΙ δικά μας).
- ΜΗΝ ξεκινήσεις την cross-subapp υλοποίηση χωρίς grep audit + έγκριση Giorgio.
