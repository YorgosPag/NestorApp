# ADR-524 — Πολλαπλή πλήρωση όμοιων πλαισίων κολόνας/τοιχίου (batch-fill same-color frames)

- **Status:** Implemented (UNCOMMITTED)
- **Date:** 2026-06-25
- **Owner:** DXF Viewer / BIM drawing
- **Domain:** Column tool — region detection + UX
- **Related:** ADR-419 (Κολώνα σε περιοχή / 4 γραμμές), ADR-363 (BIM drawing mode / region detection SSoT), ADR-398 §3.17 (adopt-rect), ADR-030 (Universal Selection — select-similar-by-color), ADR-040 (micro-leaf / store patterns), ADR-445 (structural colour identity)

---

## 1. Πλαίσιο (Context)

Στην κάτοψη ενός διαμερίσματος, οι θέσεις των κολόνων/τοιχίων είναι σχεδιασμένες
ως **κλειστά ορθογώνια πλαίσια από 4 γραμμές συγκεκριμένου χρώματος** (π.χ. καφέ).
Σήμερα (ADR-419 «Κολώνα σε περιοχή»), ο χρήστης με ενεργό το εργαλείο κολόνας και
`regionMethod = 'inside'` κάνει **ένα κλικ μέσα σε ένα πλαίσιο** → εντοπίζεται το
εσώκλειστο ορθογώνιο (`findEnclosingRectangle`) και δημιουργείται μία κολόνα/τοιχίο
που γεμίζει ακριβώς το πλαίσιο.

**Αίτημα Giorgio (2026-06-25):** Αφού τοποθετηθεί η πρώτη κολόνα σε ένα πλαίσιο
χρώματος Χ, το σύστημα γνωρίζει πλέον ένα **δίδυμο** «πλαίσιο χρώματος Χ ↔ κολόνα».
Να σαρώνει όλη την κάτοψη για τα **υπόλοιπα όμοια (ίδιου χρώματος) πλαίσια** και να
ρωτά τον χρήστη: «Βρέθηκαν N ακόμη όμοια πλαίσια — να τοποθετήσω κι εκεί
κολόνες/τοιχία;». Ο χρήστης απαντά Ναι/Όχι.

## 2. Απόφαση (Decision)

Προσθήκη **opt-in batch-fill suggestion** μετά από κάθε επιτυχημένη τοποθέτηση
κολόνας μέσω «1 κλικ μέσα σε πλαίσιο» (`regionMethod = 'inside'`):

1. Υπολογίζεται το **resolved (rendered) χρώμα** του πλαισίου που μόλις γέμισε
   (majority vote στις 4 ακμές του).
2. Σαρώνεται η κάτοψη για **όλα τα κλειστά ορθογώνια ίδιου resolved χρώματος**.
3. Φιλτράρονται **idempotent** όσα έχουν ήδη κολόνα/τοιχίο (το πλαίσιο που μόλις
   γέμισε εξαιρείται **αυτόματα** — η νέα κολόνα είναι ήδη στη scene).
4. Φιλτράρονται γεωμετρικά (build → `null`) όσα δεν είναι έγκυρα δομικά μέλη
   (π.χ. το εξωτερικό περίγραμμα — `MAX_MEMBER_THICKNESS_MM` guard, ήδη υπάρχων).
5. Αν απομένουν N > 0 → confirm dialog «Ναι σε όλα / Όχι».
6. «Ναι» → batch δημιουργία (κολόνες & τοιχία ταξινομημένα κατά EC2/EC8 aspect).

### 2.1 Ποια paths ενεργοποιούν την πρόταση
Η πρόταση τρέχει μετά από **κάθε** τοποθέτηση κολόνας/τοιχίου **σε πλαίσιο**,
ανεξάρτητα από το πώς έγινε:
- **Freehand «Υιοθέτηση μεγέθους ορθογωνίου»** (ADR-398 §3.17) — το **default**
  σενάριο του χρήστη: κανονικό εργαλείο κολόνας → κλικ μέσα σε ορθογώνιο → «Ναι,
  υιοθέτηση» → μετά το commit ανοίγει η batch πρόταση.
- **«Κολώνα σε περιοχή» / 1 κλικ μέσα** (`regionMethod='inside'`).

ΔΕΝ τρέχει στο `'box'` (βάζει ήδη σε όλα τα επιλεγμένα), στο `'lines'` (ρητή
επιλογή 4 γραμμών), ούτε στο freehand «Όχι/Άκυρο» του adopt (δεν γέμισε πλαίσιο).

> **Διόρθωση 2026-06-25:** Η πρώτη υλοποίηση συνέδεσε την πρόταση ΜΟΝΟ στο
> `regionMethod='inside'`. Ο χρήστης όμως δουλεύει με το freehand adopt path →
> εμφανιζόταν μόνο το adopt dialog, ποτέ η batch πρόταση. Η λογική εξήχθη σε κοινό
> hook `useColumnBatchFillSuggest` (point-based) που καλείται **και** από τα δύο paths.

### 2.2 Πλήρης επανάχρηση SSoT — μηδέν νέος μηχανισμός
| Ανάγκη | Υπάρχον SSoT (reuse) |
|---|---|
| Εξαγωγή segments | `extractLineSegments` (`bim/walls/wall-in-region.ts`) |
| Ανίχνευση ορθογωνίων | `findRectanglesFromSegments` (corner-graph, ίδιο με ADR-419) |
| Πλησιέστερο segment ανά ακμή | `pickSegmentAt` |
| Resolved χρώμα οντότητας | `resolveEntityColorHex` (`systems/selection/select-similar-by-color.ts`, ADR-030/445) |
| DetectedRectangle → ColumnEntity | `buildColumnFillingRect` (ADR-419) |
| Κολόνα vs τοιχίο (aspect>4) | `rectColumnPlacement` / `rectAspectKind` (EC2 §9.6.1) |
| Ταξινόμηση για μήνυμα | `splitColumnsByIntent` |
| Containment (idempotency) | `isPointInPolygon` (`GeometryUtils`) |
| Confirm dialog store | `createConfirmStore` (SSoT factory) |
| Layers | `getAllLayers` (`stores/LayerStore`) |

Το **μόνο νέο** είναι: (α) ο pure orchestrator `column-batch-fill.ts` που συνδέει τα
παραπάνω, (β) ένα confirm store + dialog (mirror `ColumnPerimeterConfirmDialog`),
(γ) ~50 γραμμές wiring στο `use-column-region-clicks.ts`.

## 3. Αρχιτεκτονική

### 3.1 Νέα αρχεία
- `bim/columns/column-batch-fill.ts` — **pure** geometry/color orchestrator:
  - `resolveRectFrameColorHex(rect, segments, tol, entityById, colorOf)` — majority resolved χρώμα 4 ακμών.
  - `findSameColorRects(entities, targetHex, tol, colorOf)` — όλα τα ορθογώνια ίδιου χρώματος.
  - `rectAlreadyFilled(rect, columns)` — idempotency (κέντρο κολόνας μέσα στο πλαίσιο).
  - `scanSameColorUnfilledRects(placedRect, placedSegments, entities, tol, colorOf)` — entry point → `{ rects, colorHex }`.
- `bim/columns/append-columns-with-breakdown.ts` — SSoT append helper (onColumnCreated + breakdown emit), κοινό σε region + batch.
- `hooks/drawing/use-column-batch-fill-suggest.ts` — **κοινός** hook `suggestBatchFillAt(point)` (point-based): βρίσκει πλαίσιο γύρω από το σημείο → scan → confirm → batch build. Καλείται και από τα δύο paths.
- `bim/columns/column-batch-fill-confirm-store.ts` — `createConfirmStore`-based handshake (`'fill-all' | 'cancel'`).
- `ui/dialogs/ColumnBatchFillConfirmDialog.tsx` — self-subscribing portal dialog (mirror `ColumnPerimeterConfirmDialog`).

### 3.2 Τροποποιημένα αρχεία
- `hooks/drawing/useColumnTool.ts` — instantiate `useColumnBatchFillSuggest`· (α) περνά το `suggestBatchFillAt` στο `useColumnRegionClicks`, (β) στο `onAdoptRect` καλεί `suggestBatchFillAt(proposal.center)` μετά από επιτυχές commit.
- `hooks/drawing/use-column-region-clicks.ts` — `commitInRegionRects` αποκτά optional `onCommitted` callback (καλείται ΜΟΝΟ στο πραγματικό commit — sync ή μετά το intent-resolve), που στο `'inside'` path τρέχει `suggestBatchFillAt(point)`. Έτσι η scene είναι πάντα ενημερωμένη (idempotency) **και** δεν υπάρχει επικάλυψη με το intent-confirm dialog. `appendColumns` → SSoT `appendColumnsWithBreakdown`.
- `app/dxf-viewer-lazy-components.tsx` — lazy export του dialog.
- `app/DxfViewerDialogs.tsx` — mount (always-mounted, self-subscribing).
- `i18n/locales/{el,en}/dxf-viewer-shell.json` — keys `columnBatchFill.*`.

### 3.3 Ροή (sequence)
```
regionMethod='inside' → onRegionClick → findEnclosingRectangle(segs, point)
  → commitInRegionRects([rect], { onCommitted })   // κολόνα στη scene (sync ή μετά intent)
      └─ onCommitted → suggestBatchFill(rect, segs):
           entities = getSceneEntities()             // FRESH (περιλαμβάνει τη νέα κολόνα)
           colorOf  = resolveEntityColorHex(·, layersById)
           { rects } = scanSameColorUnfilledRects(rect, segs, entities, tol, colorOf)
           built = rects.map(buildColumnFillingRect).filter(Boolean)
           if (built.length === 0) return
           { primary, secondary } = splitColumnsByIntent(built, 'columns')
           action = await requestColumnBatchFillConfirm({ columnCount, wallCount })
           if (action === 'fill-all') appendColumns(built)
```

## 4. Σχεδιαστικές αποφάσεις (defaults — Giorgio «προχώρα»)

1. **«Ίδιο πλαίσιο» =** ίδιο **resolved (rendered)** χρώμα (όχι raw `entity.color`),
   μέσω του ΙΔΙΟΥ SSoT που βλέπει ο renderer (`resolveEntityColorHex`). Έτσι το
   «καφέ» ταιριάζει ακριβώς με ό,τι βλέπει το μάτι (ByLayer / ACI / TrueColor).
   Επιπλέον geometric guards (ορθογωνιότητα + `MAX_MEMBER_THICKNESS_MM`) ήδη
   αποκλείουν π.χ. το εξωτερικό περίγραμμα του σχεδίου.
2. **Idempotent:** πλαίσια που έχουν ήδη κολόνα/τοιχίο εξαιρούνται· επανεκτέλεση
   δεν διπλασιάζει. Μόλις γεμίσουν όλα, δεν ξαναρωτά (N=0 → καμία πρόταση).
3. **Κολόνα vs τοιχίο:** αυτόματα μέσω aspect (>4 → τοιχίο, EC2 §9.6.1) — ήδη στο
   `buildColumnFillingRect`. Το dialog δείχνει το breakdown («X κολόνες, Y τοιχία»).
4. **UX:** confirm μετά την πρώτη τοποθέτηση. Δύο κουμπιά (Ναι σε όλα / Όχι). ESC = Όχι.

## 5. Trade-offs / γνωστά όρια
- **Undo:** η batch δημιουργία ακολουθεί το ΙΔΙΟ path με το υπάρχον in-region/box
  commit (`appendColumns` → ένα `CreateBimEntityCommand` ανά κολόνα). Άρα το undo
  είναι ανά κολόνα, όχι atomic batch — συνεπές με την υπάρχουσα συμπεριφορά
  box-select. (Πιθανή μελλοντική αναβάθμιση: `CreateColumnsCommand` atomic.)
- **Μόνο ορθογώνια:** η σάρωση χρησιμοποιεί `findRectanglesFromSegments` (ίδιο με
  ADR-419 inside). Γ/Τ/Π/σύνθετα πλαίσια δεν προτείνονται μαζικά σε αυτή τη φάση
  (καλύπτονται από το «από περίγραμμα» path, ADR-363 Φ3c).

## 6. Testing
- `column-batch-fill.test.ts` (pure): majority color, same-color filtering,
  idempotency (filled vs unfilled), oversized exclusion, mixed κολόνα/τοιχίο count.

## 6b. Bug fix — stale-scene race στα multi-column paths (auto-foundation)

**Σύμπτωμα (Giorgio browser test):** οι batch κολόνες δημιουργήθηκαν, αλλά **δεν
μπήκαν πέδιλα** στη θεμελίωση (ενώ η μεμονωμένη κολόνα παίρνει πέδιλο μέσω
`useAutoFoundationDesign`, που ακούει `drawing:entity-created`).

**Ρίζα:** `appendEntityToScene` δημιουργεί **νέο `LevelSceneManagerAdapter` σε κάθε
κλήση**. Ο adapter έχει `pendingScene` cache που λύνει το React-stale-getLevelScene
race **μόνο per-instance**. Το batch έκανε **N× `addColumnToScene`** → N adapters →
κάθε προσθήκη διάβαζε stale scene → έμενε ουσιαστικά η τελευταία + το auto-foundation
(διαβάζει live scene) δεν έβλεπε σωστά τις κολόνες → καμία πέδιλο. Το ίδιο race
υπήρχε (προϋπάρχον) και σε **region box-select** + **discrete-perimeter**.

**Fix (SSoT, Boy Scout):** νέο `addColumnsToScene` → `appendEntitiesToScene`
(ADR-511 — **ΕΝΑΣ** adapter + `CompoundCommand`, «room-fill = one undo»). Νέο batch
callback `onColumnsCreated` στο `useColumnTool` (wired στο `useSpecialTools` →
`addColumnsToScene`). Όλα τα multi-column hooks (batch-fill **+** region **+**
perimeter) γράφουν πλέον μέσω ΕΝΟΣ batch appender (`appendColumnsBatchRef`, με
per-entity fallback). `appendColumnsWithBreakdown` δέχεται πλέον batch `appendAll`.
Αποτέλεσμα: όλες οι κολόνες μπαίνουν σωστά (μηδέν data-loss), ΕΝΑ undo step, και το
auto-foundation βλέπει όλο το set → πέδιλα για όλες.

## 7. Changelog
- **2026-06-25** — Αρχική υλοποίηση (UNCOMMITTED). Pure orchestrator + confirm
  store/dialog + wiring στο `use-column-region-clicks.ts`. Πλήρης επανάχρηση
  region-detection + color SSoT· μηδέν νέος μηχανισμός ανίχνευσης/χρώματος.
- **2026-06-25 (fix)** — Browser test (Giorgio): εμφανιζόταν μόνο το adopt dialog,
  ποτέ η batch πρόταση, γιατί ο χρήστης δουλεύει με freehand adopt (όχι
  `regionMethod='inside'`). Εξαγωγή σε κοινό point-based hook
  `useColumnBatchFillSuggest` που καλείται **και** από το adopt path
  (`useColumnTool.onAdoptRect`) **και** από το region 'inside'. SSoT append helper.
- **2026-06-25 (SSoT audit — Giorgio)** — κεντρικοποίηση 3 διπλότυπων:
  1. **build-loop** (`rects → ColumnEntity[]`) ήταν 2× (region + batch, δικό μου) →
     ΕΝΑ `buildColumnsFromRects` (`column-from-faces.ts`).
  2. **append+count+emit** ήταν **3×** (region + perimeter-commit *προϋπάρχον* + batch)
     → ΕΝΑ `appendColumnsWithBreakdown(entities, onCreated, ignored?)`. Κεντρικοποιήθηκε
     ΚΑΙ το προϋπάρχον `use-column-perimeter-commit` (Boy Scout — δεν το δημιούργησα εγώ).
  3. **layers-as-Record (id+name keyed)** → ΕΝΑ `getLayersById()` SSoT στο `LayerStore`
     (ο owner των layers), αντί τοπικού `buildLayersMap`.
- **2026-06-25 (foundation fix)** — βλ. §6b: stale-scene race (N adapters) έσπαγε το
  auto-foundation στα batch. Fix με `addColumnsToScene`/`appendEntitiesToScene` (ΕΝΑΣ
  adapter) + νέο `onColumnsCreated` batch callback· κεντρικοποιήθηκαν ΚΑΙ τα προϋπάρχοντα
  region box-select + discrete-perimeter (ίδιο race). Boy Scout.
