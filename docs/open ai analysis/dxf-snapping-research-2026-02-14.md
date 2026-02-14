# DXF Viewer Snapping Research Report (2026-02-14)

## 1) Scope
Το report καλύπτει την τρέχουσα συμπεριφορά snapping στο `dxf-viewer`, ασυνέπειες/ρίσκα που βρέθηκαν στον κώδικα, και προτάσεις βελτίωσης με βάση πρακτικές μεγάλων CAD vendors (AutoCAD/BricsCAD/Bentley-style patterns).

## 2) Τρέχουσα αρχιτεκτονική snapping

### Κεντρικός άξονας
- `src/subapps/dxf-viewer/snapping/context/SnapContext.tsx`
- `src/subapps/dxf-viewer/snapping/hooks/useSnapManager.tsx`
- `src/subapps/dxf-viewer/snapping/orchestrator/SnapOrchestrator.ts`
- `src/subapps/dxf-viewer/snapping/orchestrator/SnapEngineRegistry.ts`
- `src/subapps/dxf-viewer/snapping/orchestrator/SnapCandidateProcessor.ts`
- `src/subapps/dxf-viewer/snapping/ProSnapEngineV2.ts`

### Engines που συμμετέχουν
Endpoint, Midpoint, Center, Intersection, Nearest, Near, Quadrant, Tangent, Grid, Perpendicular, Parallel, Ortho, Extension, Node, Insertion (`src/subapps/dxf-viewer/snapping/engines/*.ts`).

### Runtime integration
- Hover/click pipeline: `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`
- Drawing point pipeline: `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts`
- Integration glue: `src/subapps/dxf-viewer/hooks/common/useProSnapIntegration.ts`
- Toolbar/shortcuts/statusbar: `src/subapps/dxf-viewer/ui/components/ProSnapToolbar.tsx`, `src/subapps/dxf-viewer/keyboard/useProSnapShortcuts.ts`, `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx`

## 3) Τι λειτουργεί καλά ήδη
1. Υπάρχει οργανωμένη engine-based προσέγγιση (modular modes αντί για monolith).
2. Το `IntersectionSnapEngine` έχει cache + spatial grid λογική, που είναι σημαντικό performance pattern για CAD κλίμακα.
3. Υπάρχει διακριτή ορχήστρωση candidates μέσω orchestrator/processor και όχι ad-hoc if chains.

## 4) Ευρήματα ασυνέπειας / ρίσκα

### 4.1 Μεικτή πολιτική priority (μερικώς centralized, μερικώς hardcoded)
- Κάποια engines διαβάζουν από `SNAP_ENGINE_PRIORITIES`.
- Άλλα κρατούν hardcoded priorities (`NearSnapEngine.ts`, `QuadrantSnapEngine.ts`, `TangentSnapEngine.ts`, `GridSnapEngine.ts`).

Impact:
- Ασυνεπής σειρά επιλογής candidate.
- Δύσκολο tuning και regressions όταν αλλάζει ένα mode.

### 4.2 Πιθανή ασυνέπεια shape στο snap context
- Shared helpers (`snap-engine-utils.ts`) βασίζονται σε `context.snapRadius` fallback behavior.
- Το core `SnapEngineContext` (`shared/BaseSnapEngine.ts`) εκθέτει `worldRadiusForType/worldRadiusAt` και όχι canonical `snapRadius` πεδίο.

Impact:
- Υψηλός κίνδυνος διαφορετικής ακτίνας ανά engine/entry point.
- Δύσκολο debugging σε zoom-dependent misses.

### 4.3 Πιθανός κίνδυνος μονάδων γωνίας (arc nodes)
- `NodeSnapEngine.ts` υπολογίζει arc endpoints με `pointOnCircle(..., startAngle/endAngle)`.
- Θέλει επιβεβαίωση ότι όλη η αλυσίδα δουλεύει σε ίδιο unit contract (deg vs rad).

Impact:
- Εσφαλμένα node snaps σε arcs/circles σε συγκεκριμένα αρχεία DXF.

### 4.4 Πολλαπλά snap computations στο ίδιο pointer cycle
- Γίνεται snap compute στο mousemove (hover) και ξανά στο click path (`useCentralizedMouseHandlers.ts`).
- Επιπλέον υπάρχει snap apply στο drawing pipeline (`useDrawingHandlers.ts`).

Impact:
- Διπλό κόστος CPU.
- Πιθανό mismatch: προεπισκόπηση candidate != τελικό candidate του click.

### 4.5 Divergence default settings
- `DEFAULT_PRO_SNAP_SETTINGS.enabled = true` (`extended-types.ts`)
- Context αρχικοποιεί `snapEnabled = false` (`SnapContext.tsx`)

Impact:
- Δύο πηγές αλήθειας για το startup state.
- Ασάφεια για expected behavior σε fresh session.

### 4.6 Παράλληλες έννοιες snap έξω από το ProSnap
- `useRulersGrid.ts` έχει ruler/grid snapping logic που δεν είναι πλήρως ενοποιημένη με ProSnap state.
- Υπάρχει legacy wrapper path (`pro-snap-engine.ts`) παράλληλα με V2.

Impact:
- Split-brain snapping behavior.
- Δυσκολία σε predictable UX και troubleshooting.

### 4.7 Πιθανές συγκρούσεις keyboard shortcuts
- Συντομεύσεις F-keys ορίζονται σε πολλά σημεία (`useProSnapShortcuts.ts`, `CadStatusBar.tsx`, `ConstraintsSystem.tsx`).

Impact:
- Ένα πλήκτρο μπορεί να αλλάζει πάνω από ένα subsystem.
- “Φαινομενικά random” toggles για χρήστη.

### 4.8 Candidate cycling με σταθερό modulo
- `SnapCandidateProcessor.ts` χρησιμοποιεί κύκλο `% 10` αντί για δυναμικό πλήθος candidates.

Impact:
- Μη ντετερμινιστικό/ελλιπές cycling όταν candidates >10 ή <10.

## 5) Πώς το χειρίζονται μεγάλοι CAD vendors (μοντέλο αναφοράς)

### 5.1 AutoCAD-style συμπεριφορά
- Ιεραρχία modes + deterministic priority.
- Σαφές visual feedback: hover marker και ξεκάθαρο glyph ανά mode.
- “Running object snaps” συνεχώς ενεργά, με προσωρινά overrides ανά εντολή.
- Aperture/pickbox radius από ενιαίο configuration.

### 5.2 BricsCAD/Bentley-style patterns
- Single snap pipeline (όχι πολλαπλά compute paths για το ίδιο event).
- Strong geometric predicates με σταθερό tolerance model.
- Performance guards: spatial indices, caches, και invalidation rules.

### 5.3 Συμπέρασμα benchmark
Το δικό μας σύστημα είναι κοντά σε CAD architecture, αλλά χρειάζεται ενοποίηση state/rules για να φτάσει enterprise-level predictability.

## 6) Προτεινόμενες βελτιώσεις (prioritized)

### P0 (άμεσο)
1. Ενιαίο priority registry: κατάργηση hardcoded engine priorities.
2. Ενιαίο radius contract: canonical API στο context (μία πηγή truth για world/pixel radius).
3. Dynamic candidate cycling: modulo πάνω στο πραγματικό candidate count.

### P1 (υψηλής αξίας)
1. Ενοποίηση pointer pipeline ώστε hover preview και click commit να χρησιμοποιούν shared snap result ανά event tick.
2. Ενοποίηση defaults (`enabled`) σε ένα authoritative source.
3. Κεντρικός shortcut manager για F-keys με conflict resolution.

### P2 (ποιότητα CAD UX)
1. Κανονικοποίηση angle units με explicit types/guards για arcs.
2. Snap diagnostics overlay (active mode, radius, rejected reason) για debugging.
3. Ενοποίηση ProSnap με ruler/grid snapping policy (μία πολιτική, όχι παράλληλα μονοπάτια).

## 7) Προτεινόμενο acceptance criteria για επόμενο implementation phase
1. Same-cursor hover candidate == click-selected candidate στο 99%+ deterministic replay tests.
2. Μηδενικά hardcoded priorities εκτός κεντρικού registry.
3. Ένα μόνο shortcut handler layer για snap/constraint F-keys.
4. Arc snap tests που αποδεικνύουν σωστό unit handling σε deg/rad edge-cases.
5. Telemetry counters: snap compute time, candidate count, cache hit ratio.

## 8) Executive summary
Το snapping subsystem έχει καλή βάση (modular engines + orchestrator + intersection optimization), αλλά σήμερα υπάρχουν ασυνέπειες σε priority, context contract, event pipeline και shortcut ownership. Με στοχευμένη ενοποίηση σε 1 pipeline/1 config authority/1 shortcut authority, το UX μπορεί να πλησιάσει ξεκάθαρα AutoCAD-grade predictability.
