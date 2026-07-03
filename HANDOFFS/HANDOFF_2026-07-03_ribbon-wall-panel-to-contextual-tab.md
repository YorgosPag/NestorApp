# HANDOFF — Ribbon «Δομικά»: πρώτη κατηγορία (Τοίχος) → μόνο «Τοίχος», τα υπόλοιπα στο contextual tab «Ιδιότητες τοίχου»

**Ημερομηνία:** 2026-07-03
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer`)
**Μοντέλο:** Opus 4.8 (αρχιτεκτονικό/ribbon UX — κράτα Opus)

---

## 🎯 ΣΤΟΧΟΣ (τι θέλει ο Giorgio)

Στο ribbon tab **«Δομικά»**, η **ΠΡΩΤΗ κατηγορία (panel) = Τοίχος** πρέπει να έχει **ΜΟΝΟ το εικονίδιο «Τοίχος»**.
Μόλις ο χρήστης πατήσει το «Τοίχος», **ΟΛΑ τα υπόλοιπα μεγάλα εικονίδια τοίχου** (wall-on-entity,
wall-region-lines/inside/box, wall-from-perimeter, walls-from-grid) πρέπει να **μεταφερθούν στο
contextual tab «Ιδιότητες τοίχου»** ως **ΜΕΓΑΛΑ (large) εικονίδια**, και στην πρώτη κατηγορία της «Δομικά»
να μείνει **μόνο το «Τοίχος»**.

**ΕΥΡΟΣ (σταδιακά — Giorgio ρητά):** ΜΟΝΟ ο **τοίχος** σε αυτό το βήμα. ΟΧΙ κολώνες/δοκάρια/πλάκες/πέδιλα
τώρα — θα ακολουθήσουν αργότερα με το ίδιο pattern.

## 🏛️ Big-players precedent (γιατί αυτό ΕΙΝΑΙ το σωστό)

Αυτό είναι **ακριβώς** το **Revit "Modify | Place Wall" contextual ribbon**: όταν διαλέγεις εργαλείο
τοίχου, ανοίγει contextual tab με ΟΛΑ τα relevant tools + ιδιότητες. Το μόνιμο tab μένει καθαρό με το
entry point. Ίδια φιλοσοφία σε **Figma** (contextual toolbar ανά εργαλείο) και **Cinema 4D/Maxon**
(mode-specific palettes). → Υλοποίηση **Revit/Figma-level**, FULL enterprise + FULL SSoT.

---

## 🚨 ΚΑΝΟΝΕΣ ΤΟΥ GIORGIO ΓΙΑ ΑΥΤΟ ΤΟ TASK (υποχρεωτικοί)

1. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις κώδικα** — ψάξε αν υπάρχει ήδη αντίστοιχος μηχανισμός,
   ώστε να τον χρησιμοποιήσεις, ΟΧΙ διπλότυπα. (Το §χαρτογράφηση παρακάτω έχει ήδη κάνει την πρώτη σάρωση —
   **επαλήθευσέ την με δικό σου grep, μη την εμπιστευτείς τυφλά**· ο κώδικας μπορεί να άλλαξε.)
2. **Revit/Maxon/Figma-level.** Αν οι μεγάλοι παίκτες ΔΕΝ προτείνουν κάτι, ακολούθησε την πρακτική τους.
3. **FULL enterprise + FULL SSoT.** N.7 (Google-level), N.7.1 (≤500 γρ./αρχείο, ≤40 γρ./function),
   N.2/N.3 (no `any`, no inline styles), N.11 (i18n keys σε `el` + `en`, ΟΧΙ hardcoded strings —
   κάθε νέο label ΠΡΩΤΑ στα locales).
4. **⚠️ SHARED WORKING TREE — δουλεύει ΚΑΙ άλλος agent.** ΠΟΤΕ `git add -A`. Stage ΜΟΝΟ τα δικά σου αρχεία.
5. **ΠΟΤΕ commit/push — ο Giorgio κάνει commit, ΟΧΙ εσύ** (N.(-1)).
6. **ΟΧΙ tsc** (N.17) — μόνο jest, στοχευμένα.
7. **ADR-driven (N.0.1):** Phase 1 recognition (code = source of truth) → υλοποίηση → ADR update
   στο ΙΔΙΟ λογικό βήμα. Δες adr-index για το σχετικό ADR (ribbon/contextual) + το επόμενο free number.

## ⚠️ ΚΑΤΑΣΤΑΣΗ WORKING TREE (πριν ξεκινήσεις)

Το working tree έχει **UNCOMMITTED** δουλειά (region detection — άσχετη με αυτό το task, ο Giorgio θα την
κάνει commit ξεχωριστά): `useColumnTool.ts`, `use...` tests, `bim/walls/perimeter-from-faces.ts`,
`perimeter-from-faces.test.ts`, `ADR-419-floor-finish-per-room.md`. **ΜΗΝ τα αγγίξεις, ΜΗΝ τα κάνεις
revert, ΜΗΝ κάνεις `git add -A`.** Επίσης πιθανώς δουλεύει άλλος agent στο tree.

---

## 🗺️ ΧΑΡΤΟΓΡΑΦΗΣΗ (αρχική σάρωση — επαλήθευσε με grep)

### Α. Το «Δομικά» tab + wall panel (η πηγή που θα «αδειάσει»)
**`ui/ribbon/data/structural-tab.ts`** — panel `structural-walls` (~γρ. 104–134), πρώτο panel του tab.
Έχει **7 large buttons**, όλα `size:'large'`:
- `toolBtn('structuralTab.wall', 'ribbon.commands.bim.wall.label', 'struct-wall-single', 'wall', 'W')` ← **ΜΟΝΟ ΑΥΤΟ μένει**
- `wall-on-entity`, `wall-region-lines`, `wall-region-inside`, `wall-region-box`, `wall-from-perimeter`
- `splitActionBtn('structuralTab.wallsFromGrid', ...)` (split: fromGrid / fromGridCenter / fromGridOuter)

Tab metadata: `id:'structural'`, PERMANENT (χωρίς `isContextual`). Registration: `ui/ribbon/data/ribbon-default-tabs.ts`.

### Β. Ribbon data model
**`ui/ribbon/types/ribbon-types.ts`**: `ButtonSize = 'large'|'small'` (εδώ μεγάλα/μικρά)· `RibbonTab`
(`isContextual?`, `contextualTrigger?`)· `RibbonPanelDef` (`visibilityKey?`)· `RibbonButton` (`size`, `type`,
`command`, `variants?`). Helper `toolBtn()` στο structural-tab.ts (~γρ.39) → πάντα `size:'large'`, `type:'simple'`.

### Γ. Contextual tab «Ιδιότητες τοίχου» — **ΥΠΑΡΧΕΙ ΗΔΗ** (SSoT στόχος)
**`ui/ribbon/data/contextual-wall-tab.ts`**:
- `WALL_CONTEXTUAL_TRIGGER = 'wall-selected'` (~γρ.37)
- `CONTEXTUAL_WALL_TAB: RibbonTab` — `id:'wall-editor'`, `labelKey:'ribbon.tabs.wallProperties'`,
  `isContextual:true`, `contextualTrigger: WALL_CONTEXTUAL_TRIGGER`. **9 panels** properties (draw/category/
  family-type/geometry/tilt/joins/material/envelope/ifc/attach/actions), όλα `size:'small'` widgets/comboboxes.
- Registered στο `app/ribbon-contextual-config.ts` → `RIBBON_CONTEXTUAL_TABS` (~γρ.73).

### Δ. Trigger flow — **ΑΥΤΟΜΑΤΟ, δεν χρειάζεται νέο** (SSoT)
```
useActiveContextualTrigger (app/ribbon-contextual-config.ts ~γρ.150-343)
  → wall branch (~γρ.251): if (isWallDrawingTool(activeTool)) return WALL_CONTEXTUAL_TRIGGER
                            + if (entity.type==='wall') return WALL_CONTEXTUAL_TRIGGER
  → RibbonRoot.tsx (~γρ.95-118): auto setActiveTabId(firstContextualId) όταν trigger ενεργό
```
`isWallDrawingTool` (**`systems/tools/region-tool-ids.ts` ~γρ.58**):
`tool==='wall' || isWallRegionTool(tool) || tool==='wall-from-perimeter'`.

### Ε. Bridge (αν χρειαστεί): `ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts` (singleton, ήδη υπάρχει).

---

## ✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (Option A — Revit "Modify | Place Wall")

**Ένα contextual tab, με τα εργαλεία ΜΕΓΑΛΑ στην αρχή + τις ιδιότητες μετά** (ακριβώς Revit):

1. **`structural-tab.ts`**: στο panel `structural-walls`, **κράτα ΜΟΝΟ** `toolBtn('structuralTab.wall', …)`.
   Αφαίρεσε τα άλλα 6 (wall-on-entity, 3× region, from-perimeter, from-grid split).
2. **`contextual-wall-tab.ts`**: πρόσθεσε **ΝΕΟ panel `wall-tools` ΣΤΗΝ ΑΡΧΗ** του `CONTEXTUAL_WALL_TAB.panels[]`,
   με τα 6 εργαλεία ως **`size:'large'`** (ίδια tool ids/labelKeys/actions — copy από structural-tab, μηδέν νέα
   command semantics). Το split (from-grid) μένει split.
3. **`systems/tools/region-tool-ids.ts`**: **ΚΡΙΣΙΜΟ GOTCHA** — το `wall-on-entity` ΔΕΝ είναι στο
   `isWallDrawingTool`. Αν μπει στο contextual tab, με το κλικ ο trigger γίνεται `null` → **κλείνει το tab
   μόνο του**. Πρόσθεσε `tool==='wall-on-entity'` στο `isWallDrawingTool` (ώστε το tab να παραμένει ανοιχτό).
   Επαλήθευσε ότι δεν υπάρχουν άλλα wall tool ids εκτός predicate.
4. **i18n:** δεν χρειάζονται νέα labels (τα labelKeys υπάρχουν ήδη — reuse). Αν χρειαστεί panel label
   `ribbon.panels.wallTools` → πρόσθεσέ το σε `el` + `en` locales ΠΡΙΝ τη χρήση.
5. **ADR:** ενημέρωσε το σχετικό ADR (ribbon/contextual — δες adr-index· πιθανοί: το ADR του
   `contextual-wall-tab`, ή ADR-443 structural permanent tab). Αν δεν υπάρχει κατάλληλο → νέο ADR (επόμενο
   free number από adr-index) που τεκμηριώνει το «permanent-entry + contextual-tools» pattern (θα επεκταθεί
   σε κολώνες/δοκάρια κ.λπ.).

**Γιατί Option A και όχι δεύτερο tab:** το `RibbonTabsRegion` δείχνει ΟΛΑ τα matching contextual tabs
παράλληλα· δεύτερο tab για εργαλεία = 2 tabs = χαμηλότερη discoverability. Το Revit βάζει tools+properties
στο ΙΔΙΟ contextual tab. → **ΕΝΑ tab.**

**Τι ΔΕΝ χρειάζεται (ήδη SSoT):** κανένα νέο store, κανένα νέο trigger, καμία αλλαγή στο auto-switch. Ο
μηχανισμός εμφάνισης/εναλλαγής contextual tab δουλεύει ήδη — απλώς μετακινείς button definitions + διορθώνεις
το predicate.

## 🔎 SSoT AUDIT να τρέξεις ΠΡΩΤΑ (grep)
- `grep -rn "wall-on-entity\|wall-region\|wall-from-perimeter\|wallsFromGrid" src/subapps/dxf-viewer/ui/ribbon`
- `grep -rn "isWallDrawingTool\|WALL_CONTEXTUAL_TRIGGER\|CONTEXTUAL_WALL_TAB" src/subapps/dxf-viewer`
- `grep -rn "activeTabId\|setActiveTabId\|RibbonTabsRegion\|useActiveContextualTrigger" src/subapps/dxf-viewer/ui/ribbon src/subapps/dxf-viewer/app`
- Επιβεβαίωσε: υπάρχει ήδη pattern «large tools μέσα σε contextual tab»; (π.χ. κολώνα/άλλο). Αν ναι → mirror.

## 🧪 Verification
- **jest** (στοχευμένα): tests για structural-tab / contextual-wall-tab / region-tool-ids (πρόσθεσε/ενημέρωσε).
  π.χ. «panel structural-walls έχει μόνο 1 button (wall)», «CONTEXTUAL_WALL_TAB έχει panel wall-tools με 6 large
  buttons», «isWallDrawingTool('wall-on-entity') === true».
- **Browser** (`nestorconstruct.gr/dxf` ή localhost): «Δομικά» → πρώτη κατηγορία δείχνει ΜΟΝΟ «Τοίχος» →
  κλικ «Τοίχος» → ανοίγει «Ιδιότητες τοίχου» με τα 6 εργαλεία ΜΕΓΑΛΑ + τις ιδιότητες → κλικ σε κάθε εργαλείο
  (ειδικά wall-on-entity) ΔΕΝ κλείνει το tab.
- **ΟΧΙ tsc** (N.17).

## 📁 Key files
- `ui/ribbon/data/structural-tab.ts` (wall panel ~104–134)
- `ui/ribbon/data/contextual-wall-tab.ts` (CONTEXTUAL_WALL_TAB)
- `app/ribbon-contextual-config.ts` (trigger ~150–343, wall ~251)
- `systems/tools/region-tool-ids.ts` (`isWallDrawingTool` ~58) ← GOTCHA
- `ui/ribbon/types/ribbon-types.ts` (types)
- `ui/ribbon/components/RibbonRoot.tsx` (auto-switch ~95–118)
- `ui/ribbon/data/ribbon-default-tabs.ts` (tab registration)

## ⛔ Εκτός scope (μη τα κάνεις τώρα)
- Κολώνες/δοκάρια/πλάκες/πέδιλα/κουφώματα — **μόνο ΤΟΙΧΟΣ** αυτό το βήμα (θα ακολουθήσουν ίδιο pattern).
- Καμία αλλαγή στη λειτουργικότητα των wall tools — μόνο **θέση στο ribbon** αλλάζει.
