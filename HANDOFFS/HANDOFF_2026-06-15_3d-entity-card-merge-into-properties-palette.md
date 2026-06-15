# HANDOFF — Κατάργηση 3D right card → συγχώνευση στο floating Properties panel με υπο-καρτέλες (Revit-grade)

**Ημερομηνία:** 2026-06-15 · **Μοντέλο:** Opus (cross-cutting UI) · **Domain:** DXF Viewer 3D viewport + floating panel + BIM properties

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH τα κάνει Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent + πολλά UNCOMMITTED → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **FULL ENTERPRISE + FULL SSOT, Revit-grade** (ρητό αίτημα Giorgio). Καμία πρόχειρη λύση, κανένα hardcode, **καμία διπλή υλοποίηση** — επέκτεινε/επαναχρησιμοποίησε υπάρχοντα.
5. N.2/N.3/N.11: ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ inline styles· ΟΧΙ hardcoded strings (i18n el+en). N.7.1: code files ≤500 γρ, functions ≤40 γρ. N.23 native-tooltip ratchet: ΟΧΙ νέο `title=` σε HTML JSX.
6. **N.8 EXECUTION MODE:** cross-cutting (3D viewport + floating panel + router + i18n) → **ΣΤΑΜΑΤΑ & ρώτα Giorgio** Orchestrator vs Plan Mode ΠΡΙΝ κώδικα.
7. **N.0.1 ADR-driven:** Phase 1 Recognition (κώδικας = source of truth) → plan σε slices → **έγκριση Giorgio** → υλοποίηση → ADR + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY. Browser-verify (screenshot) μετά από κάθε slice.
8. **DXF Viewer ADR-040 (micro-leaf):** ΠΡΟΣΟΧΗ — το 3D card είναι ADR-040 micro-leaf (subscribe ΜΟΝΟ Selection3DStore). Άλλαγμα 3D viewport files → ΔΙΑΒΑΣΕ ADR-040 + stage το (CHECK 6B/6D pre-commit BLOCK). Δες CLAUDE.md «DXF VIEWER ARCHITECTURE».

---

## 1. ΤΟ ΑΙΤΗΜΑ (Giorgio + screenshot `Στιγμιότυπο οθόνης 2026-06-15 125729.jpg`)
Στην **3D προβολή**, όταν επιλέγεται κολώνα (ή άλλο BIM), εμφανίζεται **ΔΕΞΙΑ από τον καμβά** ένα panel «Στύλος» με **5 tabs: Γεωμετρία | Υλικά | ΒΚΕ | Σχόλια | Ιστορικό**. **Ο Giorgio ΔΕΝ θέλει πια να εμφανίζεται αυτό το δεξί panel.**

Θέλει:
- Όσα στοιχεία **δεν είναι διπλότυπα** → να μεταφερθούν στο **αριστερό floating panel** (το `FloatingPanelContainer` → tab «Ιδιότητες», εκεί που μόλις μπήκαν οι ιδιότητες κολώνας — ADR-363 Φ4).
- Επειδή υπάρχουν **Σχόλια + Ιστορικό** (και ΒΚΕ), θέλει **μέσα στην καρτέλα «Ιδιότητες» του floating panel ΥΠΟ-ΚΑΡΤΕΛΕΣ** (sub-tabs) τύπου: Σχόλια, Ιστορικό (και ΒΚΕ).
- **FULL ENTERPRISE + FULL SSOT, Revit-grade** (Revit = ΕΝΑ Properties palette, όχι δεύτερο panel στον καμβά).

**Διευκρίνιση που δόθηκε στον Giorgio:** «ΒΚΕ» = η ετικέτα `entityCard.tabs.boq` (`bim3d` el = «ΒΚΕ») = **BOQ / Bill of Quantities** (Προμέτρηση/Επιμέτρηση): `BimBoqTab` δείχνει parent/children + ποσότητα + «Άνοιγμα στο ΒΚΕ».

---

## 2. ΑΝΑΛΥΣΗ ΔΙΠΛΟΤΥΠΩΝ (πρότεινε στον Giorgio, ζήτα επιβεβαίωση)
Το αριστερό floating «Ιδιότητες» tab ήδη έχει: υπο-tabs **Διαστάσεις | Υλικά | BIM 3D** + (για κολώνα, ADR-363 Φ4) Στατικά/Οπλισμός + Σοβάς + Κέλυφος + Υλικό.

| 3D card tab | Component | Διπλότυπο; | Πρόταση |
|---|---|---|---|
| Γεωμετρία | `BimGeometryTab` | ΝΑΙ (Διαστάσεις subtab + ribbon geometry + column props) | **DROP** |
| Υλικά | `BimMaterialsTab` | ΝΑΙ (Υλικά subtab + Material field) | **DROP** |
| ΒΚΕ (BOQ) | `BimBoqTab` | ΟΧΙ | **MOVE → sub-tab** |
| Σχόλια | `BimCommentsTab` | ΟΧΙ | **MOVE → sub-tab** |
| Ιστορικό (audit) | `BimAuditTab` | ΟΧΙ | **MOVE → sub-tab** |

(Ο Giorgio ανέφερε ρητά Σχόλια + Ιστορικό· το ΒΚΕ είναι επίσης unique → πρότεινέ το ως 3ο sub-tab.)

---

## 3. ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ (FULL SSOT — επέκτεινε, ΜΗΝ διπλασιάσεις)

### 3.1 Το δεξί panel προς ΑΦΑΙΡΕΣΗ
- `bim-3d/properties/BimEntityCardPanel.tsx` — το right card (5 tabs, `Tabs` από `@/components/ui/tabs`). ADR-040 micro-leaf: subscribe ΜΟΝΟ `Selection3DStore` (`selectedBimId`/`selectedBimType`), entity data από `Bim3DEntitiesStore.getState()`. Per-user last-active-tab via `tabs/last-active-tab-tracker`.
- **Mount:** `bim-3d/viewport/BimViewport3D.tsx` (εκεί γίνεται render — αφαίρεσέ το από εκεί). Δες και `bim-3d/accessibility/entity-keyboard-navigator.ts` (αναφορά).
- **Tabs (όλα reusable, παίρνουν `bimId`/`bimType`):** `properties/tabs/{BimGeometryTab,BimMaterialsTab,BimBoqTab,BimCommentsTab,BimAuditTab}.tsx`.
  - `BimBoqTab` props `{ bimId, companyId, projectId }`.
  - `BimCommentsTab` props `{ bimId }` (χρησιμοποιεί `BimCommentsStore` + `BimCommentsService` + `ProjectHierarchyContext`/`useAuth`).
  - `BimAuditTab` props `{ bimId, bimType }`.
- i18n namespace: `bim3d` (`entityCard.tabs.*`, `entityCard.comments.*`, `boq.*`, κ.λπ.).

### 3.2 Το αριστερό floating panel (target)
- `ui/FloatingPanelContainer.tsx` → tab `properties` → `ui/hooks/usePanelContentRenderer.tsx` (case `'properties'`) → **`ui/wall-advanced-panel/BimPropertiesRouter.tsx`** (BIM-aware router: wall→Wall, column→Column [ADR-363 Φ4], stair→Stair).
- **Δικό μου πρόσφατο (ADR-363 Φ4, UNCOMMITTED):** `ui/column-advanced-panel/{ColumnPropertiesTab,ColumnAdvancedPanel,ColumnPropertyRow,column-property-fields}.ts(x)` + κοινός writer `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` + pure `resolveColumnPanelVisibility`. Πρότυπο για το πώς μπαίνει per-type panel.
- **ΚΡΙΣΙΜΟ — selection mismatch:** το floating panel διαβάζει `primarySelectedId` (universal/2D selection), ΕΝΩ το 3D card διαβάζει `Selection3DStore`. Για να γεμίζει το floating Properties tab με **3D επιλογή**, χρειάζεται γέφυρα: είτε (Α) η 3D επιλογή να γράφει ΚΑΙ στο universal selection (`primarySelectedId`), είτε (Β) ο `BimPropertiesRouter`/`FloatingPanelContainer` να διαβάζει ΚΑΙ `Selection3DStore`. **Αυτή είναι η κεντρική αρχιτεκτονική απόφαση — πρότεινε (Α) ως Revit-grade SSOT (μία έννοια «επιλεγμένο στοιχείο»).** Έλεγξε αν 3D selection ήδη sync-άρει με universal (grep `selectBimEntity`, `Selection3DStore`, `useUniversalSelection`).

### 3.3 Sub-tabs pattern (reuse)
- Tabs primitive: `@/components/ui/tabs` (`Tabs/TabsList/TabsTrigger/TabsContent`) — ίδιο που χρησιμοποιεί το `BimEntityCardPanel`.
- Υπάρχον sub-tab pattern μέσα στο floating: δες πώς το Ιδιότητες tab δείχνει «Διαστάσεις | Υλικά | BIM 3D» (grep στο `ui/panels/` + `usePanelContentRenderer`).

---

## 4. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Revit-grade, FULL SSOT)
**ΕΝΑ Properties palette (αριστερό floating), μηδέν δεύτερο panel στον καμβά.** Μέσα στο «Ιδιότητες» tab, ένα **γενικό sub-tab shell** (όχι column-specific):

```
Ιδιότητες (floating tab)
 └─ BimPropertiesRouter (ανά τύπο entity)
     └─ [υπο-καρτέλες — ΚΟΙΝΕΣ για όλα τα BIM types, SSOT]
         • Παράμετροι  → το per-type panel (Column/Wall/Stair properties)   ← υπάρχον
         • ΒΚΕ         → BimBoqTab        (reuse, bimId/companyId/projectId)
         • Σχόλια      → BimCommentsTab   (reuse, bimId)
         • Ιστορικό    → BimAuditTab      (reuse, bimId/bimType)
```
- Το sub-tab shell μπαίνει **ΜΙΑ φορά** (γενικό, π.χ. `ui/column-advanced-panel/`→ή νέο `ui/bim-properties/` wrapper) ώστε ΒΚΕ/Σχόλια/Ιστορικό να δουλεύουν για **κάθε** BIM type (όχι μόνο κολώνα) — αυτό είναι το SSOT win (το δεξί card ήταν ήδη γενικό).
- Γεωμετρία/Υλικά **δεν** μεταφέρονται (διπλότυπα).
- Αφαίρεσε το `BimEntityCardPanel` mount από `BimViewport3D.tsx` (+ τυχόν last-active-tab tracker αν μένει ορφανό· κράτα τα tab components — επαναχρησιμοποιούνται).
- Πρόσεξε `companyId`/`projectId` source: το card τα παίρνει από `useProjectHierarchyOptional` + `useAuth` — διαθέσιμα και στο floating context (το `BimBoqTab`/`BimCommentsTab` τα χρειάζονται).

## 5. PHASE 1 RECOGNITION CHECKLIST
1. Διάβασε `BimViewport3D.tsx` → πού/πώς γίνεται mount το `BimEntityCardPanel` + πώς λειτουργεί η 3D επιλογή (`Selection3DStore`, `selectBimEntity`).
2. Επιβεβαίωσε αν 3D selection sync-άρει με universal `primarySelectedId` (γέφυρα §3.2). Αν όχι → σχεδίασε τη γέφυρα (Α προτιμητέο).
3. Διάβασε `BimPropertiesRouter.tsx` + `ColumnPropertiesTab.tsx` (ADR-363 Φ4) → πού μπαίνει το sub-tab shell.
4. Διάβασε τα 3 reusable tabs (`BimBoqTab/BimCommentsTab/BimAuditTab`) → props/contexts που χρειάζονται στο floating.
5. Επιβεβαίωσε τη λίστα διπλοτύπων (§2) με τον Giorgio.
6. **N.8:** δήλωσε execution mode + ρώτα Orchestrator vs Plan Mode.

## 6. ΠΡΟΤΕΙΝΟΜΕΝΑ SLICES (πρότεινε, ζήτα έγκριση)
- **Slice 1:** Γενικό sub-tab shell στο «Ιδιότητες» (Παράμετροι | ΒΚΕ | Σχόλια | Ιστορικό), reuse των 3 tab components· δουλεύει με την **υπάρχουσα** selection (2D/universal).
- **Slice 2:** Γέφυρα 3D selection → universal `primarySelectedId` (ώστε επιλογή στο 3D να γεμίζει το floating Properties) + auto-activate Properties tab (όπως ήδη stair/column).
- **Slice 3:** Αφαίρεση `BimEntityCardPanel` mount από `BimViewport3D` (+ καθάρισμα ορφανών· κράτα tab components).
- **Slice 4 (DEFER):** last-active-sub-tab persistence (reuse `last-active-tab-tracker`)· γενίκευση sub-tabs σε wall/stair/beam panels.

## 7. VERIFY
3D προβολή → επίλεξε κολώνα → **ΔΕΝ** εμφανίζεται δεξί card· το **αριστερό** «Ιδιότητες» γεμίζει, με υπο-καρτέλες Παράμετροι/ΒΚΕ/Σχόλια/Ιστορικό· Σχόλια/Ιστορικό/ΒΚΕ λειτουργικά (ίδια δεδομένα με πριν)· καμία διπλή Γεωμετρία/Υλικά· 60fps pan/zoom (ADR-040).

## 8. ΚΑΤΑΣΤΑΣΗ TREE
Shared tree, πολλά UNCOMMITTED (άλλοι agents — ΜΗΝ τα αγγίξεις). **Δικά μου UNCOMMITTED (ADR-363 Φ4 — βάση για αυτό το task):** `ui/column-advanced-panel/*`, `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts`, `BimPropertiesRouter.tsx`, `FloatingPanelContainer.tsx`, `useRibbonColumnBridge.ts`, `column-command-keys.ts`, `contextual-column-tab.ts`, `i18n/.../dxf-viewer-shell.json`, `ADR-363`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. **Commit τα κάνει ο Giorgio.**

**ADR/refs:** ADR-363 (Φ4 Properties-palette split — μόλις προστέθηκε), ADR-366 (3D viewport / entity card B.2/C.4), ADR-040 (micro-leaf), `docs/centralized-systems/reference/adr-index.md`.
**MEMORY:** `reference_column_properties_palette_ssot.md` (πώς δουλεύει το floating column Properties + κοινός writer/resolvers).
