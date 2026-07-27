# ADR-662 — Μετάβαση Τοπογραφικού από αριστερό floating panel → Ribbon (μόνιμο tab + contextual + Properties)

| | |
|---|---|
| **Κατάσταση** | 🟢 Φάσεις 1 + 1b + 2 (trim-first) ΥΛΟΠΟΙΗΘΗΚΑΝ (μόνιμο ribbon tab + bridge Host + live toggles/numeric fields + αφαίρεση διπλών display/param sections από το αριστερό panel) · 🟡 Φάση 2β **(Δρόμος Γ — επιφάνεια = first-class selectable entity)** ΣΕ ΕΞΕΛΙΞΗ: **Stage A ΟΛΟΚΛΗΡΩΘΗΚΕ** (type foundation + render/hit-test plumbing — η επιφάνεια είναι πλέον renderable + επιλέξιμη hover/click/marquee, 6/7 coverage jest πράσινα· το 7ο κόκκινο = pre-existing `leader` orphan ADR-635, άσχετο)· **Stage B ΟΛΟΚΛΗΡΩΘΗΚΕ** (producer: `topoSurfacePerimeter` + `buildTopoSurfaceEntity` + `useTopoSurfaceEntity` + regenerate-on-load — η επιφάνεια πλέον **γεννιέται/φαίνεται/επιλέγεται**, idempotent-replace, footprint σε display frame)· **Stage C ΟΛΟΚΛΗΡΩΘΗΚΕ** (object-bound: επιλογή επιφάνειας → «Τοπογραφική Επιφάνεια» contextual tab + Properties palette με ανάγλυφο/διαφάνεια/στυλ + ετικέτες σημείων — reuse markup/stores) → **Φάση 2β Δρόμος Γ ΟΛΟΚΛΗΡΩΘΗΚΕ** · 🟢 **Φάση 4 ΟΛΟΚΛΗΡΩΘΗΚΕ** (το αριστερό `TopographyPanel` tab **αποσύρθηκε** → single-access· τα review sections QA/auto-breakline/cut-fill/cloud ζουν ως **section-in-dialog** μέσω `TopoRibbonHost`, τα object-bound displays στο Properties palette) |
| **Ημερομηνία** | 2026-07-15 |
| **Κατηγορία** | DXF Viewer / Ribbon · Topography |
| **Σχετικά ADR** | **ADR-444** (μόνιμα MEP discipline ribbon tabs — ΤΟ ΠΡΟΤΥΠΟ) · **ADR-345** (contextual ribbon tabs infra) · **ADR-587** (entity-keyed trigger SSoT) · **ADR-532** (contextual trigger = leaf subscription) · **ADR-650/656** (τοπογραφικό — TIN/ισοϋψείς/γεωαναφορά/relief) · **ADR-583** (annotation-symbol = North arrow contextual tab) · **ADR-040** (canvas perf) |
| **Τύπος** | Architecture decision + Migration blueprint |

---

## 1. Πρόβλημα

Στο DXF viewer σήμερα οι **μελέτες** ζουν ως **μόνιμα Ribbon tabs** (Αρχική, Δομικά, Αρχιτεκτονικά, Ηλεκτρολογικά, Ύδρευση, Αποχέτευση, Θέρμανση, Κλιματισμός, Πυρόσβεση & Αέριο, Εισαγωγή, Ανάλυση, Προβολή, Επισήμανση, Ρυθμίσεις — `DEFAULT_RIBBON_TABS`).

Το **Τοπογραφικό** είναι η **μοναδική μελέτη εκτός Ribbon**: ζει ως μία καρτέλα στο **αριστερό floating panel** (`FloatingPanelContainer` → `PanelTabs.tsx:83` `id:'topography'` → `usePanelContentRenderer.tsx:135` → `<TopographyPanel/>`), δίπλα σε Επίπεδα/Χρώματα/Ιδιότητες/Διαστάσεις/Υλικά/BIM 3D.

**Ο πόνος (screenshots 2026-07-15):**
- Το `TopographyPanel.tsx` μοντάρει **~14 sections** σε ένα κάθετο scroll ~15 σελίδων: import + wizard, ισοδιάσταση/index, breaklines, generate, στυλ ισοϋψών (ακριβείς↔όμορφες), ετικέτες σημείων, κάναβος ΕΓΣΑ87, βέλος Βορρά, γεωαναφορά, έδαφος 3Δ + relief opacity, νέφος 3Δ, cut/fill, QA, auto-breaklines, παραδοτέα.
- Είναι **μονότονο/άχρωμο** → δύσχρηστο, χωρίς οπτική ιεραρχία.
- **Θα μεγαλώσει κι άλλο** (ADR-650/656 milestones σε εξέλιξη) → το μοντέλο «όλα σε ένα mega-panel» δεν κλιμακώνει.
- **Ασυνέπεια UX**: ο μηχανικός βρίσκει τα εργαλεία κάθε άλλης μελέτης στο Ribbon, αλλά του τοπογραφικού πρέπει να τα ψάξει σε ένα panel 15 σελίδων.

**Τα 5 ερωτήματα του Giorgio** (ΝΑΙ/ΟΧΙ + τεκμηρίωση από big players):
1. Είναι σωστό που το τοπογραφικό ζει στο αριστερό panel ενώ οι άλλες μελέτες στο Ribbon;
2. Πρέπει να προστεθεί μόνιμο Ribbon tab «Τοπογραφικό» με τις εντολές;
3. Όταν επιλέγεται οντότητα τοπογραφικού → contextual tab + panel Ιδιοτήτων;
4. Δηλαδή: να μεταφερθεί το τοπογραφικό πάνω στο Ribbon; ΝΑΙ/ΟΧΙ;
5. Τι θα έκαναν οι μεγάλοι;

> **Οδηγία-κλειδί:** ο κανόνας είναι **η πρακτική των big players, όχι η προτίμηση**. Αν δεν το προτείνουν, το ακολουθούμε.

---

## 2. Big-player evidence (web-research 2026-07-15, με πηγές)

Ερευνήθηκαν 5 εργαλεία-αναφορά. **Σύγκλιση σε ένα σαφές μοτίβο:**

### 2.1 Autodesk Revit (BIM authoring)
- Οι εντολές εδάφους (**Toposolid**, Subregion, Grading, **Excavate**) ζουν σε **μόνιμο ribbon tab «Massing & Site»**.
- Όταν επιλέγεται Toposolid → **contextual tab «Modify | Toposolid»** με τα shape-editing / Add Point / Modify Sub Elements / Excavate.
- Οι ιδιότητες (π.χ. **contour display** = type property) → **Properties palette** αριστερά.
- → Ρητός διαχωρισμός: **εντολές = ribbon**, **contextual editing = Modify tab**, **ιδιότητες = Properties palette**. Κανένα mega-panel.

### 2.2 Autodesk Civil 3D (πλησιέστερο στο δικό μας τοπογραφικό)
- **TIN Surface**: όταν επιλέγεται μια επιφάνεια → εμφανίζεται **contextual ribbon tab «Tin Surface»** με ΟΛΑ τα surface tools· «Depending on the type of object that is selected, different tools are displayed on the contextual tab».
- Τα δεδομένα/ορισμός της επιφάνειας → **Toolspace → Prospector** (δεξί-κλικ στο όνομα → «Surface Properties»).
- Contour smoothing / surface style = **display style** στο Surface Properties, ΔΕΝ αλλάζει την τριγωνοποίηση (ήδη το μιμούμαστε — ADR-650 M3 «Ακριβείς↔Όμορφες»).
- → Ξανά: **εντολές/tools = ribbon (permanent + contextual)**, **ορισμός/ιδιότητες = palette (Toolspace)**.

### 2.3 Graphisoft ArchiCAD
- **Mesh tool** στο **Toolbox** (μόνιμη παλέτα εργαλείων)· ρυθμίσεις επιλεγμένου mesh στο **Info Box** (contextual settings bar) + **Mesh Settings dialog** (Floor Plan & Section / Model 3D appearance).
- → tool = toolbar· settings επιλεγμένου = contextual Info Box + settings dialog. Όχι mega-panel.

### 2.4 Maxon Cinema 4D
- **Attribute Manager**: «context sensitive» — δείχνει τις ιδιότητες του **επιλεγμένου** αντικειμένου/tool/tag/material και **αυτόματα εναλλάσσεται** ανά επιλογή. Σε πολλαπλή επιλογή διαφορετικών τύπων δείχνει μόνο τα **κοινά** tabs.
- Τα εργαλεία = context-sensitive **Tools palette** (αριστερά).
- → properties = ενιαίο **context-sensitive** palette ανά επιλογή· tools = palette.

### 2.5 Figma
- **Right sidebar = «Properties panel»** (Design/Prototype tabs): δείχνει τις ιδιότητες του **επιλεγμένου** layer (θέση/μέγεθος/fill/stroke/effects). Αλλάζει ανά επιλογή.
- Τα δημιουργικά εργαλεία = **toolbar** (πάνω).
- → creation = toolbar· properties = context-driven side panel.

### 2.6 Συμπέρασμα σύγκλισης
| Τι | Πού το βάζουν ΟΛΟΙ οι μεγάλοι |
|---|---|
| **Authoring εντολές/tools** (create/generate/import/export/edit) | **Ribbon tab / toolbar** — μόνιμα, ορατά |
| **Object editing όταν επιλεγεί** | **Contextual tab** (Revit «Modify», Civil 3D «Tin Surface») |
| **Ιδιότητες/display επιλεγμένου** | **Properties palette** (Revit Properties · Civil 3D Toolspace · C4D Attribute Manager · Figma Properties panel) |
| **«Όλα σε ένα κάθετο mega-panel»** | **ΚΑΝΕΙΣ** — δεν είναι μοτίβο κανενός |

**Κανένας** από τους 5 δεν στοιβάζει όλες τις εντολές+ρυθμίσεις εδάφους σε ένα μονολιθικό panel. Το δικό μας `TopographyPanel` είναι το **μόνο** anti-pattern.

---

## 3. Απόφαση (ΝΑΙ/ΟΧΙ στα 5 ερωτήματα)

| # | Ερώτημα | Απάντηση | Τεκμηρίωση |
|---|---|---|---|
| 1 | Σωστό το τοπογραφικό στο αριστερό panel ενώ οι άλλες στο Ribbon; | **ΟΧΙ** | Ασυνέπεια UX + αντίθετο με ΟΛΟΥΣ τους big players (§2.6). |
| 2 | Μόνιμο Ribbon tab «Τοπογραφικό» με τις εντολές; | **ΝΑΙ** | Revit «Massing & Site», Civil 3D «Surface», ArchiCAD Toolbox — οι authoring εντολές ζουν μόνιμα στο ribbon/toolbar. Reuse ADR-444 pattern. |
| 3 | Contextual tab + Properties όταν επιλέγεται τοπο-οντότητα; | **ΝΑΙ, με προϋπόθεση** | Το μοτίβο είναι σωστό (Civil 3D «Tin Surface» contextual + Toolspace properties). ΑΛΛΑ βλ. §5: το τοπογραφικό σήμερα **δεν έχει δικούς entity types** — χρειάζεται topo-aware αναγνώριση πριν στηθεί contextual tab. Το North arrow **ήδη** έχει contextual tab (ADR-583). |
| 4 | Να μεταφερθεί το τοπογραφικό στο Ribbon; | **ΝΑΙ** | Συνδυασμός #2 (εντολές→ribbon) + #3 (ιδιότητες→contextual/Properties). |
| 5 | Τι θα έκαναν οι μεγάλοι; | **Θα το έβγαζαν από το mega-panel** | §2 — ομόφωνα: εντολές→ribbon, ιδιότητες→palette/contextual. |

**Τελική απόφαση:** Μεταφορά του τοπογραφικού σε **μόνιμο Ribbon tab «Τοπογραφικό»** (authoring εντολές) + **Properties palette** για display/ιδιότητες επιλεγμένου + **contextual tab** για επιλεγμένη τοπο-οντότητα (αφού λυθεί το θέμα entity-recognition, §5). Το αριστερό `TopographyPanel` **αδειάζει σταδιακά** και τελικά καταργείται.

---

## 4. SSoT audit — τι υπάρχει ήδη (reuse, ΟΧΙ νέος μηχανισμός)

Πραγματικό grep στα αρχεία-κλειδιά (2026-07-15). **Μηδέν νέοι μηχανισμοί** — όλα υπάρχουν:

| Ανάγκη | Υπάρχον SSoT (reuse) | Τι θα προστεθεί |
|---|---|---|
| Μόνιμο discipline tab | `ui/ribbon/data/systems-discipline-tabs.ts` (ADR-444: `toolBtn`/`actionBtn` helpers + `RibbonTab`) | `topography-tab.ts` (νέο data file, ΙΔΙΟ pattern) |
| Εγγραφή tab στο ribbon | `ui/ribbon/data/ribbon-default-tabs.ts` (`DEFAULT_RIBBON_TABS` + `DEFAULT_RIBBON_TAB_ORDER`) | +1 entry `'topography'` + import |
| Contextual tab registry | `app/ribbon-contextual-config.ts` (`RAW_RIBBON_CONTEXTUAL_TABS` + `withStandardLeadPanel` — ήταν `withStandardClose` πριν το ADR-581 Φ7) | +1 `CONTEXTUAL_TOPO_SURFACE_TAB` |
| Selection → trigger | `app/resolve-contextual-trigger.ts` (`ENTITY_CONTEXTUAL_TRIGGER` map + `resolveContextualTrigger()`) | topo trigger (βλ. §5 για το πώς) |
| Trigger tokens barrel | `ui/ribbon/data/contextual-triggers.ts` | +1 `TOPO_SURFACE_CONTEXTUAL_TRIGGER` |
| Auto-activate contextual tab | `ui/ribbon/components/RibbonRoot.tsx:98-124` (ADR-345 §5.4) | καμία αλλαγή (δουλεύει ήδη) |
| Ribbon toggle widget (live toggles) | SSoT `ribbon-toggle-widget` (memory) | reuse για grid/North HUD toggles |
| Ribbon numeric combobox (interval/index) | SSoT `ribbon-editable-numeric-combobox` (memory) | reuse για ισοδιάσταση/index |
| Properties palette shell | `ui/bim-properties/BimPropertiesShell` + `usePanelContentRenderer.tsx:116` (`case 'properties'`) | topo property tab μέσα στο υπάρχον Properties |
| Panel design tokens | `config/panel-tokens.ts` (ENTERPRISE, zero-hardcoded) | reuse για χρωματική ιεραρχία (§7) |

**Ρητή τήρηση §6 του handoff:** ΔΕΝ φτιάχνεται νέος ribbon-tab μηχανισμός ούτε νέος contextual μηχανισμός — μιμούμαστε ADR-444 + ADR-345/587.

---

## 5. ⚠️ Κρίσιμο εύρημα — το τοπογραφικό ΔΕΝ έχει δικούς entity types

Grep στα `systems/topography/*-entities.ts` + `types/entities.ts` δείχνει: **το τοπογραφικό ψήνει (bake) native πρωτογενείς οντότητες**, δεν εισάγει νέο τύπο στο `Entity` union:

| Τοπο-παραγόμενο | Πραγματικός entity type | Πηγή |
|---|---|---|
| Ισοϋψείς | `lwpolyline` (+ `text` για labels) | `topo-to-entities.ts:45/61` |
| Κάναβος ΕΓΣΑ87 | `line` (+ `text`) | `topo-grid-entities.ts:29/55` |
| Βέλος Βορρά (baked) | `lwpolyline` + `text` | `north-arrow-entities.ts:37/52` |
| Βέλος Βορρά (live) | `annotation-symbol` — **ΗΔΗ έχει contextual tab** (ADR-583) | `ENTITY_CONTEXTUAL_TRIGGER['annotation-symbol']` |
| **TIN επιφάνεια** | **ΚΑΝΕΝΑΣ** — ζει σε store (`getTopoSurface()`), **όχι scene entity** | `topo-surface.ts:38` |

**Συνέπεια:** Σε αντίθεση με walls/columns/beams (first-class BIM entities με 1:1 contextual trigger), όταν επιλέγεις σήμερα μια ισοϋψή → παίρνεις το **γενικό Line-Tool style tab** (`isStyleEditablePrimitiveType` fallback, `resolve-contextual-trigger.ts:198`), όχι topo tab. Το Civil 3D έχει «Tin Surface» contextual tab επειδή η επιφάνεια είναι **επιλέξιμο αντικείμενο** — στο δικό μας η TIN είναι store, όχι entity.

**Άρα το Q3 έχει design prerequisite. Τρεις δρόμοι (απόφαση στη φάση υλοποίησης):**
- **(Α) Topo tag/subtype στα baked entities** — προσθήκη ελαφριού `params.topoRole` (`'contour'|'grid'|'point-label'`) στις παραγόμενες οντότητες, ώστε ο `resolveContextualTrigger` να επιστρέφει `TOPO_SURFACE_CONTEXTUAL_TRIGGER` **πριν** το style-primitive fallback. Faithful στο Civil 3D, ελάχιστα invasive. **Προτεινόμενο.**
- **(Β) Layer-based αναγνώριση** — οι τοπο-οντότητες ζουν σε dedicated layers (`ensure-contour-layers`/`ensure-grid-layers`/…). Αναγνώριση μέσω layerId. Λιγότερο καθαρό (layer-name coupling — αντίθετο με memory `2d_draworder`/`dxfrenderer_effectiveoptions`).
- **(Γ) Επιλέξιμη TIN επιφάνεια** — να γίνει η επιφάνεια first-class selectable entity. Μεγαλύτερο scope· ίσως μελλοντικό.

**Σύσταση:** Φάση 1-2 **χωρίς** το contextual tab (permanent tab + Properties καλύπτουν το 90% του πόνου)· το contextual topo tab μπαίνει σε **Φάση 3** μέσω δρόμου (Α). Το North-arrow contextual tab ήδη δουλεύει — δεν το αγγίζουμε.

---

## 6. Αναλυτικό σχέδιο υλοποίησης

### 6.1 Χαρτογράφηση sections → προορισμός (command vs property)

Κάθε section του σημερινού `TopographyPanel.tsx` ταξινομείται:

| Section (σημερινό) | Φύση | Προορισμός |
|---|---|---|
| Import file + `TopoImportWizard` | **ΕΝΤΟΛΗ** (authoring) | Ribbon panel «Δεδομένα» |
| `TopoCloud3DSection` (import νέφους) | **ΕΝΤΟΛΗ** import + **DISPLAY** toggle | Import→ribbon «Δεδομένα»· ορατότητα→Properties |
| Ισοδιάσταση + index (interval/major) | **PARAM** generate | Ribbon numeric combobox στο panel «Επιφάνεια» (reuse SSoT) |
| Breakline pick tool + clear | **ΕΝΤΟΛΗ** (tool) | Ribbon panel «Επιφάνεια» (`toolBtn`) |
| Generate contours | **ΕΝΤΟΛΗ** | Ribbon panel «Επιφάνεια» (`actionBtn`) |
| `TopoAutoBreaklineSection` (extract feature lines) | **ΕΝΤΟΛΗ** (analysis-assisted) | Ribbon panel «Επιφάνεια» |
| Στυλ ισοϋψών (Ακριβείς↔Όμορφες) | **DISPLAY** | Properties palette (surface style)· ή ribbon toggle |
| `TopoPointLabelsSection` | **DISPLAY/SETTING** | Properties (label style) + bake εντολή→ribbon «Παρουσίαση» |
| `TopoGridSection` (ΕΓΣΑ87) | **DISPLAY** toggle + **ΕΝΤΟΛΗ** bake | toggle→ribbon toggle widget· bake→ribbon «Παρουσίαση» |
| `NorthArrowSection` | **DISPLAY** toggle + **ΕΝΤΟΛΗ** bake | toggle→ribbon toggle widget· bake→ribbon «Παρουσίαση»· επιλεγμένο σύμβολο→**υπάρχον** ADR-583 contextual tab |
| `TopoGeoReferenceSection` (auto-align + common point) | **ΕΝΤΟΛΗ** (transform authoring) | Ribbon panel «Γεωαναφορά» |
| `Terrain3DSection` (relief opacity, 3Δ solid) | **DISPLAY** | Properties palette (3D surface style) |
| `TopoCutFillSection` (όγκοι εκσκαφών) | **ΑΝΑΛΥΣΗ/ΕΝΤΟΛΗ** | Ribbon panel «Ανάλυση» |
| `TopoQaSection` | **ΑΝΑΛΥΣΗ** | Ribbon panel «Ανάλυση»· flags→inline/Properties |
| `TopoDeliverablesSection` (φάκελος/ZIP) | **ΕΝΤΟΛΗ** (export) | Ribbon panel «Παραδοτέα» |

### 6.2 Δομή του μόνιμου tab «Τοπογραφικό» (`topography-tab.ts`, ADR-444 pattern)

```
TOPOGRAPHY_TAB (id: 'topography', labelKey: 'ribbon.tabs.topography')
├── panel «Δεδομένα»       : Εισαγωγή αρχείου · Οδηγός εισαγωγής · Εισαγωγή νέφους
├── panel «Επιφάνεια»      : Ισοδιάσταση [numeric] · Index [numeric] · Γραμμές ασυνέχειας [tool]
│                            · Δημιουργία ισοϋψών [action] · Auto-breaklines [action]
├── panel «Γεωαναφορά»     : Αυτόματη ευθυγράμμιση · Κοινό σημείο (1=μετατόπιση/2=στροφή)
├── panel «Παρουσίαση»     : Κάναβος ΕΓΣΑ87 [toggle+bake] · Βέλος Βορρά [toggle+bake] · Ετικέτες σημείων [bake]
├── panel «Ανάλυση»        : Όγκοι εκσκαφών (Cut/Fill) · Έλεγχος ποιότητας (QA)
└── panel «Παραδοτέα»      : Εξαγωγή φακέλου (ZIP)
```

- Θέση στη `DEFAULT_RIBBON_TAB_ORDER`: **μετά τα MEP tabs, πριν το `insert`** (ή δίπλα στο `analyze` — το τοπογραφικό είναι μελέτη-domain, ταιριάζει με τις άλλες μελέτες).
- Κάθε button reuse **υπάρχον** command/action key (τα toggles/actions ήδη υπάρχουν στα stores/hooks — `useTopoContours`, `contour-config-store`, `north-arrow-store`, κ.λπ.). Μόνο tab/panel i18n keys είναι νέα (ίδιο pattern ADR-444).

### 6.3 Contextual tab (Φάση 3 — μέσω δρόμου §5.Α)
- Νέο `TOPO_SURFACE_CONTEXTUAL_TRIGGER` στο `contextual-triggers.ts`.
- Νέο `CONTEXTUAL_TOPO_SURFACE_TAB` (δράσεις: Επεξεργασία στυλ · Επανα-generate · Ετικέτες) → `RAW_RIBBON_CONTEXTUAL_TABS`.
- `resolveContextualTrigger`: πριν το `isStyleEditablePrimitiveType` fallback, έλεγχος `params.topoRole` → topo trigger. Coverage test (`resolve-contextual-trigger-coverage.test.ts`) καλύπτει το νέο branch.
- North-arrow: **καμία αλλαγή** (ADR-583 ήδη ενεργό).

### 6.4 Properties palette
- Νέο topo property tab μέσα στο υπάρχον `BimPropertiesShell` (ή αντίστοιχο), για: contour style, relief opacity, label style, grid/north display. Reuse `bim_properties_palette_shell` SSoT (memory).

### 6.5 Φάσεις migration (κάθε φάση = deployable, ADR-N.0.1)
- **Φάση 1** — `topography-tab.ts` + εγγραφή στο `DEFAULT_RIBBON_TABS`/order. Τα ribbon buttons καλούν τα **υπάρχοντα** actions/tools. Το αριστερό panel **μένει** (dual access, μηδέν regression). i18n keys (el+en).
- **Φάση 2** — display/ιδιότητες → Properties palette topo tab. Αφαίρεση των αντίστοιχων sections από το αριστερό panel (πρώτα οι display, μένουν οι εντολές αν χρειάζεται).
- **Φάση 3** — topo contextual tab (§6.3) μέσω `params.topoRole`. 
- **Φάση 4** — κατάργηση της καρτέλας `'topography'` από `PanelTabs.tsx:83` + `usePanelContentRenderer.tsx:135` + deprecate `TopographyPanel.tsx`. Καθαρισμός.

### 6.6 SSoT / anti-duplication
- Πριν από κάθε «done»: `npm run jscpd:diff <staged>` (N.18) — τα ribbon data files είναι επιρρεπή σε copy-paste sibling clones (μίμηση ADR-444 ≠ αντιγραφή· χρησιμοποίησε τα helpers `toolBtn`/`actionBtn`, μην τα ξαναγράψεις).
- Νέος renderable/topo type → coverage test θα σπάσει αν ξεχαστεί (ADR-587).

---

## 7. Δεύτερο θέμα — «μονότονο/άχρωμο panel» (οπτική ιεραρχία big-player level)

Ο πόνος «άχρωμο» λύνεται **δομικά** από τη μετάβαση (οι εντολές σπάνε σε ribbon panels με icons/χρώμα ανά κατηγορία, όπως τα άλλα discipline tabs), όχι με βαφή του παλιού panel. Επιπλέον:
- **Χρωματική ιεραρχία** ανά ribbon panel/κατηγορία εντολών **μόνο** μέσω `config/panel-tokens.ts` (ENTERPRISE, zero-hardcoded) — **ΟΧΙ** inline styles (N.3), **ΟΧΙ** div-soup (N.4). Semantic `section`/`header`/`h3`.
- Section headers + icons + το ίδιο active/hover χρωματικό vocabulary με τα Δομικά/Αρχιτεκτονικά tabs → οπτική συνέπεια με τις άλλες μελέτες (το ζητούμενο «big-player level»).
- Το Properties palette topo tab ακολουθεί το `bim-properties` shell (ήδη έχει την ιεραρχία Παράμετροι/ΒΚΕ/Σχόλια/Ιστορικό).

---

## 8. Ρίσκα

| Ρίσκο | Μετριασμός |
|---|---|
| **ADR-040 regression** — αν τα ribbon widgets κάνουν high-freq subscribe | Τα ribbon data files είναι **στατικά** (καμία `useSyncExternalStore`)· τα live toggles reuse τα υπάρχοντα LOW-freq ribbon-toggle widgets. Ο `RibbonRoot` auto-activate (`98-124`) είναι ήδη ADR-040-safe. **Δεν αγγίζουμε** CanvasSection/leaves. |
| **Διπλή πρόσβαση κατά τη μετάβαση** (panel + ribbon ταυτόχρονα) | Σκόπιμο στη Φάση 1 (μηδέν regression)· καθαρίζει στη Φάση 4. |
| **Contextual tab χωρίς entity type** (§5) | Καθυστερεί στη Φάση 3 με ρητό δρόμο (Α)· δεν μπλοκάρει το κύριο κέρδος. |
| **Sibling clone στα ribbon data** (N.18) | `jscpd:diff` πριν «done»· reuse helpers, όχι re-write. |
| **i18n missing keys** (CHECK 3.8) | el+en keys **πριν** τη χρήση σε κώδικα (N.11). |
| **Shared working tree** | Μόνο δικά μου αρχεία· ADR append-only· ποτέ checkout/reset. |

## 9. ADR-040 συμμόρφωση
Καμία αλλαγή στα micro-leaf/orchestrator αρχεία. Το ribbon είναι εκτός του high-freq canvas subscription path. Τα ribbon data files είναι pure config (χωρίς store subscriptions). Οι live toggles/HUD reuse υπάρχοντα LOW-freq widgets. → **Συμβατό εξ ορισμού.**

---

## 10. Επόμενο βήμα
- Το ADR είναι το «τι/πώς». Η **υλοποίηση** (5+ αρχεία / 2+ domains → **Orchestrator**, ~2.5-3.5× tokens, N.8) απαιτεί **ρητή έγκριση Giorgio** — δεν ξεκινά αυτόματα.
- Πρόταση εκκίνησης: **Φάση 1** (permanent ribbon tab, μηδέν regression) ως πρώτο, αυτοτελές deployable βήμα.

---

## 11. Έλξεις (OSNAP) στο περίγραμμα της επιφάνειας

**Αίτημα Giorgio (2026-07-27):** «όταν κάνω hover πάνω στο περίγραμμα μιας τοπογραφικής επιφάνειας να φαίνονται τα σημάδια των έλξεων — κυρίως στις κορυφές — και να με έλκουν». Στο στιγμιότυπο ο Giorgio κύκλωσε **τις κορυφές** του λαδί περιγράμματος (layer `TOPO-SURFACE`) ⇒ καρδιά του αιτήματος = **ENDPOINT**.

### 11.1 Αιτία — το `topo-surface` ήταν ΑΟΡΑΤΟ στη μηχανή έλξης

Το entity έφτανε κανονικά στη μηχανή (`useGlobalSnapSceneSync` → `initialize(allEntities)`), περνούσε το φίλτρο ορατότητας, και το hover/hit-test **δούλευε ήδη**. Έλειπε **μόνο** η παραγωγή υποψηφίων σημείων: `grep -rl "topo-surface" snapping/` → **κανένα αρχείο**. Κανένας κλάδος στα `getEntityEndpoints` / `getEntityMidpoints` / `getEntityCenter` / `NearestSnapEngine` / `PerpendicularSnapEngine` ⇒ μηδέν fux, μηδέν έλξη. Δεν ήταν πρόβλημα overlay/rendering/plumbing.

### 11.2 Big-player evidence (web-research 2026-07-27)

| Εργαλείο | Πρακτική | Συνέπεια για εμάς |
|---|---|---|
| **Civil 3D** | Το OSNAP πιάνει **ό,τι εμφανίζει** το surface style (triangles/contours/border). Οι χρήστες «ξεφεύγουν» κρύβοντας το TIN σε layer (`DEFPOINTS`) — δηλαδή ο διακόπτης είναι η **ορατότητα**, όχι μια ρύθμιση έλξης. | Δόγμα **«ό,τι ζωγραφίζεται, ελκύει»**. Ο διακόπτης υπάρχει ήδη: layer/`visible`. |
| **Revit Toposolid** | Το snap μέσα στο toposolid είναι **περιορισμένο**· η επίσημη σύσταση είναι βοηθητικές γραμμές/reference planes. | Χαμηλός πήχης — δεν τον αντιγράφουμε. |
| **AutoCAD** | `OSOPTIONS` **default 7** (bit 1) = **καταστολή** osnap σε γραμμοσκίαση. | Απόκλιση **συνειδητή**: η δική μας γραμμοσκίαση είναι first-class σχέδιο με λαβές (ADR-507), όχι σκέτο γέμισμα. |

**Απόφαση Giorgio (AskUserQuestion 2026-07-27):** NEAREST + PERPENDICULAR **και στα δύο** (τοπογραφική επιφάνεια **και** γραμμοσκίαση) — ένας type-driven κλάδος, μηδέν φράχτης. Λόγος: το ADR-507 έδωσε ήδη ENDPOINT/MIDPOINT/CENTER στη γραμμοσκίαση· «έλξη στην κορυφή αλλά όχι πάνω στη γραμμή» είναι ασυνέπεια που ο χρήστης τη νιώθει.

### 11.3 Λύση — ΕΝΑ SSoT, ανακαλωδίωση αντί για προσθήκη

Ο πρόχειρος δρόμος ήταν 5 νέοι κλάδοι `isTopoSurfaceEntity(e) → e.footprint` δίπλα στους 5 υπάρχοντες `isHatchEntity(e) → e.boundaryPaths`: **sibling clone** (N.18) που το name-based `ssot:discover` (CHECK 3.18) **δεν** πιάνει.

Αντ' αυτού, η παρατήρηση: **τα δύο πεδία κρατούν ταυτόσημο σχήμα δεδομένων** (`Point2D[][]`, implicitly κλειστά rings) κάτω από διαφορετικό όνομα. Άρα:

**`snapping/shared/entity-closed-rings.ts`** (νέο) απαντά **ένα** ερώτημα — «ποια κλειστά δαχτυλίδια ορίου έχει αυτή η οντότητα;» (`hatch → boundaryPaths`, `topo-surface → footprint`, οτιδήποτε άλλο → κενό). Οι **υπάρχοντες** hatch κλάδοι **αντικαταστάθηκαν** από έναν ring-driven κλάδο ⇒ το topo μπήκε **δωρεάν** και τα διπλότυπα **μειώθηκαν** αντί να αυξηθούν.

Το πλαίσιο συντεταγμένων: τα rings διαβάζονται **ΩΜΑ**. Το `buildTopoSurfaceEntity` **έχει ήδη** προβάλει σε display frame μέσω `getActiveWorldToDisplayProjector` — καμία `mmToSceneUnits`, κανένας δεύτερος projector (αλλιώς οι fux εμφανίζονται αλλού από τη γραμμή). Το σχόλιο του `TopoSurfaceEntity.footprint` έλεγε λανθασμένα «world canonical mm» — **διορθώθηκε** (boy-scout N.0.2· ο κώδικας νικά).

| Έλξη | Πηγή σημείων | Αποτέλεσμα στο περίγραμμα |
|---|---|---|
| **ENDPOINT** | `entityClosedRings` → κάθε κορυφή κάθε ring | οι κόκκινα κυκλωμένες κορυφές |
| **MIDPOINT** | `ringEdgeMidpoints(ring, closed=true)` (υπάρχον SSoT) | μέσα ακμών **+ ακμή κλεισίματος** |
| **CENTER** | `hatchBoundsCenter(rings)` (υπάρχον SSoT) | κέντρο bbox **όλων** των rings |
| **NEAREST** | `nearestFootOnClosedRings` (νέο, πάνω στο `polyline-perpendicular-feet`) | clamped foot στην κοντινότερη ακμή |
| **PERPENDICULAR** | `perpendicularFeetOverClosedRings` (νέο, ίδιο SSoT) | unclamped foot ανά ακμή (και σε προέκταση) |

**Μηδέν νέα γεωμετρικά μαθηματικά**: τα δύο ring-set helpers είναι fan-out πάνω στα υπάρχοντα `nearestFootOnPolyline` / `perpendicularFeetOverPolyline` (ADR-363 Φ5.5e/f/g) — η διάσχιση ακμών ζει **μία** φορά.

### 11.4 Πυκνότητα — γιατί ΔΕΝ μπήκε throttling

Ένα TIN perimeter μπορεί να έχει εκατοντάδες κορυφές. Και οι τρεις engines (ENDPOINT/MIDPOINT/CENTER) χτίζουν **spatial index** (`BaseSnapEngine.initializeSpatialIndex`) και ερωτούν με ακτίνα ⇒ επιστρέφονται **μόνο** τα σημεία κοντά στον κέρσορα. Αυτό είναι ήδη το «snap only near cursor» των μεγάλων. Καμία προσθήκη LOD/throttling **χωρίς μετρημένο πρόβλημα**.

### 11.5 Τι ΔΕΝ έγινε (καταγραφή, όχι εκκρεμότητα)

- **TIN vertices/triangles**: ο Giorgio ζήτησε **περίγραμμα** ⇒ μόνο `footprint`. Αν ποτέ ζητηθεί Civil-3D parity σε εμφανιζόμενα τρίγωνα, η πηγή είναι `getTopoSurface(surfaceId)`, όχι το footprint.
- **NODE osnap σε survey points**: τα τοπογραφικά σημεία **είναι ήδη** `PointEntity` (`topo-point-labels.ts` → `type: 'point'`) ⇒ ο `NodeSnapEngine` τα καλύπτει· **καμία εργασία**.
- **Label στην έλξη**: το NEAREST candidate κρατά το γενικό `'Nearest'` ⇒ το overlay δείχνει σκέτο glyph (ADR-597 req #4). Δικό του i18n key θα απαιτούσε `snap-description-keys` + el/en (N.11) — **δεν** ζητήθηκε.
- **Ιδέα πέρα από τους μεγάλους (πρόταση, μη υλοποιημένη):** η fux σε τοπογραφική επιφάνεια να δείχνει **το υψόμετρο** στο σημείο έλξης (υπάρχει SSoT `systems/topography/grade-at-plan-point.ts`). Ένας μηχανικός που ελκύεται σε κορυφή και βλέπει «+12.47» παίρνει πληροφορία που το AutoCAD **δεν** δίνει. Απαιτεί i18n key + απόφαση Giorgio.

---

## 12. Ετικέτα Εμβαδού στην τοπογραφική επιφάνεια

**Αίτημα Giorgio (2026-07-27):** «κλικ πάνω στην τοπογραφική επιφάνεια, δεύτερο κλικ → να εμφανίζεται εκεί το εμβαδόν της».

### 12.1 SSoT audit — υπήρχε ήδη το εργαλείο

Το ζητούμενο 2-κλικ μοτίβο υπήρχε **αυτούσιο** ως **ADR-649 «Ετικέτα Εμβαδού Γραμμοσκίασης»**: FSM store, pure builders, click dispatcher, lifecycle hook, ribbon κουμπί. Ήταν όμως δεμένο στη γραμμοσκίαση σε **πέντε** σημεία (pick, hover-highlight, FSM field, κείμενο, entity builder). Προσθήκη `isTopoSurfaceEntity` σε καθένα = **πέντε sibling clones** (N.18). **Απόφαση Giorgio: γενίκευση του υπάρχοντος, ΟΧΙ δεύτερο εργαλείο.**

### 12.2 ⚠️ Το εύρημα που καθόρισε τη λύση — τα rings ΔΕΝ δίνουν εμβαδόν

Το `topoSurfacePerimeter` τεκμηριώνει ρητά: *«A surface with interior holes yields multiple rings (**outer + hole loops**)»*. Δηλαδή ένα επιπλέον ring μπορεί να είναι **τρύπα**, όχι νησίδα. Και επειδή η αλυσοποίηση γίνεται σε **μη-προσανατολισμένες** ακμές (`chainUndirectedEdges`), **το πρόσημο του shoelace δεν μπορεί να τα ξεχωρίσει**:

| Πράξη πάνω στα rings | Αποτέλεσμα |
|---|---|
| Άθροισμα όλων | **υπερεκτίμηση** όταν υπάρχει τρύπα |
| outer − υπόλοιπα | **υποεκτίμηση** όταν υπάρχει γνήσια νησίδα |

Και τα δύο δίνουν **λάθος αριθμό**, σιωπηλά. (Το `hitTestTopoSurface` χρησιμοποιεί `.some` — σωστό για *επιλογή*, άσχετο με το εμβαδόν.)

**Λύση: το εμβαδόν βγαίνει από τα ΤΡΙΓΩΝΑ του TIN, όχι από τα rings.** Αθροίζεις ό,τι υπάρχει· οι τρύπες αποκλείονται εξ ορισμού (δεν υπάρχει τρίγωνο εκεί). Ίδια πηγή που αναφέρει το Civil 3D, μηδέν αμφισημία τοπολογίας.

### 12.3 Δύο εμβαδά (απόφαση Giorgio — Civil 3D «2D Area» / «3D Area»)

| Μέγεθος | Τι είναι | Ποιος το χρειάζεται |
|---|---|---|
| **Εμβαδόν** (`plan2DMm2`) | προβολή σε κάτοψη | το «νομικό» εμβαδόν οικοπέδου — τίτλος, τοπογραφικό διάγραμμα |
| **Επιφάνεια εδάφους** (`surface3DMm2`) | πραγματική επιφάνεια κατά μήκος των κλίσεων | εκσκαφή / επένδυση / φύτευση επικλινούς — αυτό τιμολογείται |

Πάντα `3D ≥ 2D`· ίσα **μόνο** σε οριζόντιο έδαφος. Η ετικέτα γράφει **δύο γραμμές** όταν η οντότητα έχει ανάγλυφο, **μία** όταν είναι επίπεδη (γραμμοσκίαση) — `surface3DMm2: null` σημαίνει «δεν υπάρχει η έννοια», **ΟΧΙ** `0` (που θα ήταν ισχυρισμός για μηδενική επιφάνεια).

### 12.4 Δομή — δύο νέα SSoT, μία γενίκευση

| Module | Ερώτημα που απαντά |
|---|---|
| **NEW** `systems/topography/topo-surface-area.ts` | «πόσο είναι το εμβαδόν αυτής της TIN;» — pure, ένα πέρασμα, δύο απαντήσεις (η z-συνιστώσα του `u × v` δίνει την προβολή, το πλήρες μέτρο την επιφάνεια) |
| **NEW** `systems/measure/entity-area-facts.ts` | «τι εμβαδόν δίνει **αυτή η οντότητα**;» — ο ΕΝΑΣ dispatcher· νέος τύπος ⇒ αλλαγή **μόνο** εδώ |
| **MOVED** `bim/hatch/hatch-area-label{,-store}.ts` → `systems/measure/area-label{,-store}.ts` | το εργαλείο δεν είναι πια hatch-only· `hatchId` → `entityId` |

**Σκόπιμα διαφορετική γεωμετρία ανά τύπο — μην την ενοποιήσεις:** γραμμοσκίαση → `computeHatchAreaMm2` (outer **−** islands, even-odd· τα `boundaryPaths` **είναι** outer-minus-holes εξ ορισμού)· τοπογραφική → άθροισμα τριγώνων.

**Το pick έγινε δωρεάν:** `pickTopEntityAt(point, entities, hasMeasurableArea)` — το `performDetailedHitTest` εφαρμόζει ήδη **το σωστό ανά τύπο** hit-test (γραμμοσκίαση even-odd, τοπογραφική «οποιοδήποτε ring»), άρα δεν χρειάστηκε δεύτερος picker. Το ίδιο predicate οδηγεί και το hover-highlight, ώστε το hover να **μην** υπόσχεται λιγότερα από όσα δέχεται το κλικ.

**Το όριο για αγκύρωση/μέγεθος** το δίνει το `entityClosedRings` (§11) — το ΙΔΙΟ SSoT με τις έλξεις. Αγκύρωση = centroid του **μεγαλύτερου** ring, **ΟΧΙ** του `rings[0]`: στη γραμμοσκίαση το `[0]` είναι εξ ορισμού το outer, στην τοπογραφική είναι **αυθαίρετο** (μπορεί να είναι τρύπα).

### 12.5 Τι ΔΕΝ έγινε

- **Tool id `hatch-area-label`**: παρέμεινε — εσωτερικό αναγνωριστικό σε 9 σημεία, μηδέν όφελος για τον χρήστη από τη μετονομασία (το ορατό label ήταν ήδη γενικό, «Ετικέτα Εμβαδού»). Τεκμηριώθηκε ως ιστορικό σε `tool-definitions.ts` + `ui/toolbar/types.ts`.
- ~~**Ζωντανή ετικέτα**~~ — **ΞΕΠΕΡΑΣΜΕΝΟ (2026-07-27).** Υλοποιήθηκε ως **ADR-649 §associative**: προαιρετικό `sourceEntityId` στην ετικέτα· το εμβαδόν ξαναμετριέται command-time από τον `cascadeAreaLabels` μέσα στον `associative-geometry-reconcile`. Η **απουσία** του πεδίου παραμένει έγκυρη κατάσταση (παλιές ετικέτες = στιγμιότυπα, καμία αναδρομική μετάλλαξη).

---

## 13. Λαβές στην τοπογραφική επιφάνεια

**Απόφαση Giorgio (2026-07-27). Αυτό είναι ΑΛΛΑΓΗ ΣΥΜΒΟΛΑΙΟΥ, όχι διόρθωση bug.** Μέχρι σήμερα η επιφάνεια ήταν ρητά **grip-less** («derived → η επεξεργασία γίνεται από το topography subsystem») και αυτό ήταν **καρφωμένο σε test**. Το test άλλαξε επειδή άλλαξε η απόφαση — όχι επειδή ήταν λάθος.

### 13.1 Έρευνα — γιατί κανείς δεν δίνει λαβές σε παραγόμενο όριο

| Παίκτης | Τι κάνει | Γιατί |
|---|---|---|
| **Civil 3D** | Το «Surface Border» **δεν** έχει λαβές· επεξεργάζεσαι τον ορισμό (Add Boundary / Extract Objects → πολυγραμμή → rebuild). | Το border είναι **ζωγραφιά χωρίς δείκτη** πίσω στα δεδομένα. |
| **Revit Toposolid** | Στην απλή επιλογή καμία λαβή σχήματος· `Modify Sub Elements` → οι κορυφές ζωντανεύουν και επεξεργάζονται τα **σημεία**. | Κρατά τον δρόμο της επιστροφής, αλλά τον κλειδώνει πίσω από **mode**. |
| **ArchiCAD Mesh** | Hotspots σε κάθε κόμβο. | Εκεί το όριο είναι **ιδιόκτητο** (ο χρήστης το σχεδίασε) — **άλλο μοντέλο δεδομένων, δεν μεταφέρεται**. |

**Τι κάνουμε εμείς:** το `footprint` μας **δεν** είναι ζωγραφιά — κάθε κορυφή του **είναι κόμβος της TIN**. Άρα κρατάμε τον δρόμο της επιστροφής και παίρνουμε το μοντέλο της Revit **χωρίς το mode**: η λαβή είναι εκεί που κλικάρει ο χρήστης, και σέρνοντάς την μετακινείται το **survey point**. Η αλλαγή **επιβιώνει της επόμενης αναδημιουργίας**, γιατί έγινε στην πηγή.

### 13.2 🔴 Ταυτότητα κόμβου: ΜΕ ΣΥΝΤΕΤΑΓΜΕΝΕΣ, ποτέ με δείκτη

Ο `TopoPoint` **δεν έχει id** και ο `TinSurface` **δεν κρατά** back-pointer προς τα σημεία. Ο πειρασμός «το `positions[i]` είναι το `points[i]`» είναι **ΛΑΘΟΣ**: ο `collectVertices` κάνει **dedup σε πλέγμα μικρομέτρου**, οπότε δύο συμπίπτοντα survey points καταρρέουν σε **έναν** κόμβο και **όλοι οι επόμενοι δείκτες μετατοπίζονται**.

Η μόνη έγκυρη ταυτότητα είναι το **ίδιο κλειδί πλέγματος** που χρησιμοποιεί ο TIN builder — γι' αυτό το `topo-survey-point-resolve` καλεί το **εξαγόμενο** `localVertexKey`, **ποτέ** μια δεύτερη στρογγυλοποίηση (θα διαφωνούσαν σιωπηλά στο όριο).

### 13.3 🔴 Τρία πλαίσια συντεταγμένων — η κλασική παγίδα του υποσυστήματος

```
DISPLAY (η λαβή, DXF local mm) ──unproject──▶ WORLD (ΕΓΣΑ mm, ο store) ──−origin──▶ LOCAL (TIN)
```

- Παράλειψη του **πρώτου** βήματος ⇒ η λαβή δείχνει σωστά και γράφει το σημείο σε **λάθος συντεταγμένες** σε κάθε geo-referenced έργο.
- Παράλειψη του **δεύτερου** ⇒ καμία αντιστοίχιση.

Γι' αυτό το `geo-transform` απέκτησε **`unproject`** — τον ακριβή αντίστροφο του `project`, από τον **ίδιο** `forwardRigidMap` πυρήνα ώστε οι δύο κατευθύνσεις να μην μπορούν να αποκλίνουν.

Ο περιορισμός **Shift** εφαρμόζεται **πριν** τη μετατροπή, στο πλαίσιο που βλέπει ο χρήστης: αλλιώς σε στραμμένη geo-reference ο «οριζόντιος» άξονας της οθόνης θα κούμπωνε σε λοξή διεύθυνση του εδάφους.

### 13.4 Τι ΔΕΝ παίρνει λαβή — και γιατί η άρνηση είναι το χαρακτηριστικό

| Δεν υπάρχει | Γιατί |
|---|---|
| Λαβή σε κορυφή από **γραμμή ασυνέχειας** | Δεν έχει πού να γράψει. Λαβή που φαίνεται αλλά δεν μετακινεί τίποτα είναι ακριβώς το bug που πλήρωσε η `image` — **το μάθημα ADR-654**. |
| Λαβή **μέσου ακμής** (σε αντίθεση με τη γραμμοσκίαση) | Στη γραμμοσκίαση σημαίνει «πρόσθεσε κορυφή» — καθαρά 2D. Εδώ θα σήμαινε «πρόσθεσε survey point», που απαιτεί **υψόμετρο**: θα το επινοούσαμε με παρεμβολή και θα το παρουσιάζαμε ως **μετρημένο**. Πλαστό μετρημένο υψόμετρο σε τοπογραφικό δεν είναι διευκόλυνση, είναι σφάλμα. (Η Revit το κρατά κι αυτή ξεχωριστά: `Add Point`.) |
| Επεξεργασία **υψομέτρου** από την κάτοψη | Η λαβή είναι **planimetric (XY)**. Σέρνοντας δηλώνεις «το σημείο μετρήθηκε εκεί», **όχι** «άλλαξε το έδαφος». Για το Z υπάρχει το topography panel. |

### 13.5 Δομή — δύο SSoT ερωτήματα, μία νέα οικογένεια εντολών

| Module | Ερώτημα που απαντά |
|---|---|
| **NEW** `systems/grip/closed-ring-grips.ts` | «ΠΟΥ πάνω σε κλειστά rings κάθονται οι λαβές;» — καθαρή γεωμετρία, **μηδέν πολιτική**. Δεύτερο μισό του `entity-closed-rings` (§11, «ΠΟΙΑ rings»). Καταναλωτές: γραμμοσκίαση (λεπτός προσαρμογέας `ringIdx`→`pathIdx`) **και** τοπογραφική. |
| **NEW** `systems/topography/topo-survey-point-resolve.ts` | «αυτή η κορυφή του περιγράμματος ΠΟΙΟ survey point είναι;» — μνημονευμένο (pointer compare στον ορισμό επιφάνειας), ώστε η παραγωγή λαβών να μη σαρώνει χιλιάδες σημεία σε κάθε επιλογή. |
| **NEW** `systems/topography/topo-surface-grips.ts` | παραγωγή λαβών + preview· λαβή **μόνο** σε κορυφή που αντιστοιχεί σε survey point. |
| **NEW** `core/commands/entity-commands/MoveTopoSurveyPointCommand.ts` | η undoable γραφή. |
| **NEW** `hooks/grips/grip-topo-surface-commits.ts` | ο commit της λαβής (ο μοναδικός που δεν κάνει patch την οντότητα που κρατά τη λαβή). |

**Γιατί ξεχωριστή οικογένεια εντολών:** όλες οι υπόλοιπες grip εντολές πατούν στο `MergeableUpdateCommand`, που κάνει patch **ένα πεδίο μιας οντότητας**. Εδώ η αλήθεια **δεν ζει σε οντότητα** — ζει στο `TopoPointStore`, και το `topo-surface` είναι το **παράγωγο**. Patch στο `footprint` θα **εξατμιζόταν** στην επόμενη αναδημιουργία· ακριβώς ο λόγος που η επιφάνεια ήταν grip-less μέχρι σήμερα.

Είναι επίσης η **πρώτη undoable μεταβολή** του `TopoPointStore` (μέχρι τώρα κάθε γραφή — import, αφαίρεση ακίδων — ήταν μονόδρομη). Το snapshot-based undo είναι σκόπιμα **χονδροειδές** (ολόκληρος ο πίνακας σημείων): ο πίνακας είναι ήδη immutable-replaced από τον store, άρα το κόστος είναι **μία αναφορά** και η ορθότητα δεν εξαρτάται από το να «ξεκάνουμε» σωστά μια στοχευμένη μετάλλαξη.

**Τρία βήματα, με αυτή τη σειρά — η σειρά ΕΙΝΑΙ το συμβόλαιο:**
1. γράψε τα σημεία στον store → ο μνημονευμένος TIN ακυρώνεται μόνος του (pointer compare)
2. ξαναπαράγε το `footprint` → renderer / hit-test / έλξεις / λαβές δείχνουν τη νέα αλήθεια
3. `reconcileAssociativeGeometry` → τα εξαρτημένα (π.χ. ζωντανή ετικέτα εμβαδού) ξανα-derive

Το (3) τρέχει **σύγχρονα μέσα στην εντολή**, ποτέ ως reactive effect — **ADR-492 §4**: effect που άκουγε geometry events και ξανα-εξέπεμπε γεωμετρία έκανε βρόχο με τον proactive analysis cycle → storm/freeze.

### 13.6 Επαλήθευση

**Τεστ:** 103 πράσινα σε 6 σουίτες (παραγωγή λαβών, `grip-kinds` coverage, dispatch coverage, commit-mode-aware coverage, ribbon hatch bridge — καμία παλινδρόμηση στη γραμμοσκίαση, που καταναλώνει πλέον το ίδιο ring SSoT).

🔴 **ΚΑΜΙΑ ζωντανή επαλήθευση στον browser.** Απαιτούν χειροκίνητο έλεγχο: το σύρσιμο λαβής σε **geo-referenced** έργο (εκεί χτυπά η παγίδα των τριών πλαισίων — §13.3), το ortho με Shift σε **στραμμένη** geo-reference, και το undo/redo της πρώτης undoable γραφής στον `TopoPointStore`.

---

## Changelog
- **2026-07-27 — §13 ΥΛΟΠΟΙΗΘΗΚΕ (λαβές τοπογραφικής επιφάνειας).** **Αλλαγή συμβολαίου, όχι fix**: η επιφάνεια ήταν ρητά grip-less και **καρφωμένο σε test**· το test άλλαξε επειδή άλλαξε η **απόφαση**. Έρευνα Civil 3D / Revit / ArchiCAD: κανείς δεν δίνει draggable λαβές σε **παραγόμενο** όριο, γιατί κανείς δεν κρατά τον δρόμο της επιστροφής προς την πηγή — **εμείς τον κρατάμε** (κάθε κορυφή του `footprint` **είναι** κόμβος της TIN), οπότε παίρνουμε το μοντέλο Revit «Modify Sub Elements» **χωρίς το mode**. Νέα: `systems/grip/closed-ring-grips` (το «ΠΟΥ» — δεύτερο μισό του `entity-closed-rings` του §11· η γραμμοσκίαση έγινε λεπτός προσαρμογέας), `topo-survey-point-resolve` (ταυτότητα **με συντεταγμένες**, μέσω του **εξαγόμενου** `localVertexKey` — ο dedup του `collectVertices` κάνει τους δείκτες **ψεύτες**), `topo-surface-grips`, `MoveTopoSurveyPointCommand` (**πρώτη undoable** μεταβολή του `TopoPointStore`), `grip-topo-surface-commits`. Το `geo-transform` απέκτησε **`unproject`** από τον ίδιο `forwardRigidMap` πυρήνα — χωρίς αυτό η λαβή θα έδειχνε σωστά και θα έγραφε το σημείο σε **λάθος συντεταγμένες** σε κάθε geo-referenced έργο. **Σκόπιμες αρνήσεις** (§13.4): καμία λαβή σε κορυφή γραμμής ασυνέχειας (μάθημα ADR-654 — λαβή που δεν κάνει τίποτα), **καμία** λαβή μέσου ακμής (θα επινοούσε **υψόμετρο** με παρεμβολή και θα το παρουσίαζε ως μετρημένο), planimetric μόνο. **Τεστ: 103 πράσινα / 6 σουίτες.** 🔴 **Καμία ζωντανή επαλήθευση** — εκκρεμούν σύρσιμο σε geo-referenced έργο, ortho με Shift σε στραμμένη geo-reference, undo/redo.
- **2026-07-15** — Δημιουργία (PROPOSED). Research-first: web-research 5 big players (Revit/Civil 3D/ArchiCAD/C4D/Figma) + πραγματικό SSoT audit. Απόφαση: μεταφορά τοπογραφικού σε μόνιμο Ribbon tab + Properties palette + (Φάση 3) contextual tab. Κρίσιμο εύρημα §5 (topo = baked native entities, όχι δικοί types).
- **2026-07-15 — Φάση 1 ΥΛΟΠΟΙΗΘΗΚΕ** (permanent «Τοπογραφικό» ribbon tab). Το αριστερό `TopographyPanel` **μένει** (dual access, μηδέν regression).
  - **Κρίσιμο εύρημα υλοποίησης** (fresh grep): τα topo commands wire-άρονταν **απευθείας σε React hooks/local state** μέσα στο `TopographyPanel` — **μηδέν action keys / EventBus events / hosts**. Μόνο το breakline tool (`topo-breakline`) είχε έτοιμο command key. Άρα το «μηδέν νέα λογική» απαιτούσε **thin bridge Host** (SSoT mirror του Schedule/Print/Export), όχι μόνο ribbon data. Έγκριση Giorgio για πλήρες tab + bridge Host.
  - **Αρχιτεκτονική** (μηδέν αλλαγή στη business logic του τοπογραφικού): ribbon button → `action`/`commandKey` → `routeRibbonAction` → `dxf-special-actions` (thin emit `topo:ribbon-action`) → **`TopoRibbonHost`** (mount-time topo hooks + global-store calls + section-in-dialog). Οι εντολές που θέλουν React context (`useTopoContours/useTopoGrid/useNorthArrow/useTopoPointLabels` bake/generate) τρέχουν εντός του Host· οι global-store toggles/one-shots (grid/north/cloud/QA/cut-fill/auto-breakline) καλούν τα module setters· οι form-heavy (import/γεωαναφορά/παραδοτέα) ανοίγουν τα **ΥΠΑΡΧΟΝΤΑ** section components σε dialog (section-in-dialog = μηδέν νέα φόρμα).
  - **Tab** (`topography-tab.ts`, reuse SSoT `toolBtn`/`actionBtn`): panels Δεδομένα / Επιφάνεια / Γεωαναφορά / Παρουσίαση / Ανάλυση / Παραδοτέα. Θέση στη `DEFAULT_RIBBON_TAB_ORDER`: μετά `fire-gas`, πριν `insert`.
  - **Scope Φάσης 1 (ρητό)**: authoring εντολές + tools. Οι **numeric παράμετροι** (ισοδιάσταση/index/βήμα κανάβου) + τα **live pressed-state toggles** μένουν στο αριστερό panel (persisted stores, dual access)· τα ribbon commands διαβάζουν τις τρέχουσες τιμές. Numeric ribbon widgets = **Φάση 1b** (χρειάζονται RibbonField binding). Contextual tab = Φάση 3 (§5.Α). Properties = Φάση 2.
  - **Αρχεία**: NEW `topography-tab.ts`, `drawing-event-map-topo.ts`, `app/TopoRibbonHost.tsx`, `app/topo-ribbon-actions.ts`. MODIFY `ribbon-default-tabs.ts`, `drawing-event-map.ts`, `dxf-special-actions.ts`, `dxf-viewer-lazy-components.tsx`, `DxfViewerDialogs.tsx`, `RibbonButtonIcon.tsx` (topo glyphs), i18n `dxf-viewer-shell.json` (el+en).
  - **ADR-040**: τα ribbon data files είναι static config· ο Host είναι always-on LOW-freq leaf (μόνο level context· zero canvas subscription) — mirror `BimScheduleHost`. Καμία αλλαγή σε CanvasSection/leaves.
- **2026-07-16 — Φάση 1b ΥΛΟΠΟΙΗΘΗΚΕ** (live pressed-state toggles + editable numeric fields). Το ribbon «Τοπογραφικό» γίνεται αυτάρκες σε big-player πιστότητα (Revit/ArchiCAD ζωντανή κατάσταση ON/OFF)· το αριστερό `TopographyPanel` **μένει** (dual access, μηδέν regression· καταργείται Φάση 4).
  - **SSoT audit (fresh grep)**: reuse `RibbonToggleWidget`/`RibbonToggleConfig` (ADR-599) για τα toggles και ο υπάρχων generic numeric primitive `RibbonEditableCombobox` (+ `ribbon-combobox-numeric.ts`, ADR-345 §4.5) για τα fields. **Εύρημα**: δεν υπήρχε generic numeric widget shell (analog του `RibbonToggleWidget`) — μόνο το bespoke `RibbonWallDimensionWidget`. Καλύφθηκε με νέο λεπτό shell `RibbonNumericFieldWidget` που **γεφυρώνει** ένα `{value, commit}` store hook στο `RibbonEditableCombobox` (μηδέν αντιγραφή draft/preset/ESC logic).
  - **Αρχιτεκτονική** (self-contained, μηδέν bridge — mirror `PlanLinesToggle`): κάθε widget `useToggleState`/`useNumericState` = `useSyncExternalStore(subscribe…, get…, get…)` πάνω στο αντίστοιχο persisted topo store + setter. Ίδια getters/setters που ήδη οδηγούν τα left-panel sections (`topo-grid-store`/`north-arrow-store`/`pointcloud-3d-store`/`contour-config-store`/`cut-fill-store` + hook `useContourDisplay`). Το interval κάνει display↔canonical conversion (mm ×1000/÷1000) εντός του config hook.
  - **Widgets (9)**: toggles = Κάναβος visible, Βορράς visible, Νέφος visible, Στυλ ισοϋψών (Ακριβείς↔Όμορφες), Mode Βορρά (Κανάβου↔Πραγματικός), Mode Cut/Fill (Στάθμη↔Επιφάνεια)· numeric = Ισοδιάσταση (m), Index (κύριες ανά), Βήμα κανάβου (m). Τα Φάσης-1 `topo.grid.toggle`/`topo.north.toggle`/`topo.cloud.toggle` actions αντικαταστάθηκαν στο tab από widgets (τα orphaned action handlers στο `topo-ribbon-actions`/`dxf-special-actions` αφέθηκαν — harmless dead dispatch, καθαρίζουν Φάση 4).
  - **Αρχεία**: NEW `ui/ribbon/components/RibbonNumericFieldWidget.tsx`, `TopoRibbonToggleWidgets.tsx`, `TopoRibbonNumericWidgets.tsx`. MODIFY `ui/ribbon/components/RibbonPanel.tsx` (9 `widgetId` cases), `ui/ribbon/data/topography-tab.ts` (`topoWidget` helper + swap), i18n `dxf-viewer-shell.json` el+en (`ribbon.commands.topo.{gridVisible,northVisible,cloudVisible,contourStyle,northMode,cutFillMode,intervalField,indexField,gridStepField}`), test `topography-tab.test.ts` (widget-button guards).
  - **ADR-040**: τα topo stores είναι LOW-freq (αλλάζουν σε click)· `useSyncExternalStore` στα widgets είναι επιτρεπτό όπως `PlanLinesToggle`. Καμία αλλαγή σε CanvasSection/leaves/orchestrators. **N.18**: `jscpd:diff` καθαρό (builder-based configs· reuse primitives, όχι sibling clones).
- **2026-07-16 — Φάση 2 (trim-first) ΥΛΟΠΟΙΗΘΗΚΕ** (αφαίρεση διπλών display/param sections από το αριστερό `TopographyPanel`). Το αριστερό panel παύει να είναι mega-panel για ό,τι ζει ήδη στο ribbon· η κάρτα `'topography'` **μένει** (Φάση 4). **Deployable, μηδέν regression** (κάθε αφαιρεθέν control υπάρχει ήδη στο ribbon).
  - **RESEARCH-FIRST (big-player, fresh web-research 2026-07-16)**: επιβεβαιώθηκε §2 — **κανένας** μεγάλος δεν βάζει terrain display σε selection-driven properties palette **χωρίς επιλέξιμο αντικείμενο**. Revit 2026: contour display = **Type Property του Toposolid** (select→Properties→Edit Type)· global-σε-view = **Visibility/Graphics** (view settings, ΟΧΙ palette). Civil 3D: surface style = **Surface Properties**, προσβάσιμο ΜΟΝΟ με επιλογή επιφάνειας (canvas) **ή** named node στο **Prospector tree**. C4D Attribute Manager / Figma right panel = καθαρά selection-driven. → Η επιλογή «document-level topo tab σε selection-driven shell» (handoff §5.Γ) **απορρίφθηκε ως anti-pattern**. Η big-player-faithful τελική κατάσταση = **object-bound display** (topo-selectable → Properties), που είναι το **Φάση 2β / συγχώνευση με Φάση 3** (Orchestrator, N.8 — δεν έγινε σε αυτή τη συνεδρία).
  - **SSoT audit (fresh grep, μηδέν επινοημένα APIs)**: `BimPropertiesShell` = 100% selection-driven (`usePrimarySelectedId`→`useResolvedSelectedEntity`→`isBimEntity`)· χωρίς επιλεγμένο BIM entity → render `BimPropertiesRouter` (empty state) **χωρίς sub-tabs**, **κανένα hook για non-entity content**. → topo tab εκεί χωρίς επιλέξιμη οντότητα = αδύνατο χωρίς shell surgery (⇒ Φάση 2β). Object-ish display stores που **δεν** ribbon-ίστηκαν και **μένουν** (Φάση 2β): `terrain-3d-store` (relief/surface opacity + style), `topo-point-label-store` (showElevation/numberCode/boundaryXy). Το `contour-config-store` εξάγει ΜΟΝΟ `intervalMm`/`majorEvery` (ήδη Φ1b).
  - **Απόφαση Giorgio (AskUserQuestion)**: big-player-faithful, staged — **Α (trim) τώρα** + **Β (object-bound) μετά** ως ξεχωριστό εγκεκριμένο Orchestrator (N.8).
  - **Trim set (4 αφαιρέσεις, 100% διπλά με ribbon, μηδέν μοναδικό control χαμένο)**: (1) inline `interval`/`index` numeric inputs → ribbon Φ1b `contour-interval`/`contour-index`· (2) `contourStyle` section (Ακριβείς↔Όμορφες) → ribbon Φ1b `contour-style`· (3) `<TopoGridSection/>` (visible+step+bake) → ribbon `grid-visible`/`grid-step`/`grid-bake`· (4) `<NorthArrowSection/>` (visible+mode+bake) → ribbon `north-visible`/`north-mode`/`north-bake`. Το `generate` διαβάζει τις τιμές απευθείας από `getContourConfig()` (persisted store — μηδέν λειτουργική απώλεια).
  - **ΔΕΝ αφαιρέθηκαν (μοναδικά controls ή object-ish για Φάση 2β)**: `TopoCloud3DSection` (μοναδικό stats readout count/MB· auto-hides χωρίς νέφος), `Terrain3DSection` + `TopoPointLabelsSection` (object-ish display → Φάση 2β), breakline section (μοναδικό «clear»), import/generate/γεωαναφορά/QA/auto-breakline/παραδοτέα (εντολές/ανάλυση).
  - **Orphans**: `TopoGridSection.tsx` / `NorthArrowSection.tsx` πλέον unreferenced (μόνο το panel τα εισήγαγε)· **deprecate/delete στη Φάση 4** (knip αγνοεί το dxf-viewer → μηδέν dead-code ratchet break).
  - **Αρχεία**: MODIFY `ui/panels/topography/TopographyPanel.tsx` (αφαίρεση 4 διπλών + imports/vars + module-doc refresh). **Καμία** αλλαγή σε stores/ribbon/Properties. **i18n**: τα keys `topography.contourStyle.*`/`intervalLabel`/`majorEveryLabel` γίνονται πλέον **unused** (μόνο το panel body τα καλούσε) — αβλαβές (CHECK 3.8 = missing keys, όχι unused· μένουν στα locales, καθαρίζονται Φάση 4). Τα `topography.grid.*`/`topography.north.*` **παραμένουν σε χρήση** από τα orphaned sections μέχρι τη Φάση 4.
  - **ADR-040**: μηδέν αλλαγή σε micro-leaf/orchestrator· καμία νέα subscription. **N.18** `jscpd:diff` καθαρό (αφαίρεση κώδικα, όχι νέο). **N.17**: μηδέν tsc.
- **2026-07-16 — Φάση 2β (Δρόμος Γ) ΞΕΚΙΝΗΣΕ: type foundation (Stage A μερικό)**. Απόφαση Giorgio (AskUserQuestion): η τοπογραφική **επιφάνεια γίνεται first-class επιλέξιμο scene entity** (Revit-Toposolid / Civil-3D-Surface μοντέλο — το έδαφος = αντικείμενο με δικές του ιδιότητες), αντί για tag στα baked entities (Δρόμος Α). Big-player-faithful (Revit/ArchiCAD/C4D/Figma: terrain/mesh = first-class object)· το document-level tab επιβεβαιώθηκε ξανά ως anti-pattern.
  - **RESEARCH-FIRST (fresh web, με πηγές)**: Revit 2026 contour display = **Type Property του Toposolid** (select→Properties→Edit Type) — αλλά το Toposolid είναι clickable solid· Civil 3D: «click σε ισοϋψή → Surface Properties» **ή** Prospector node → ίδιο dialog (surface style στην Information tab). Στο δικό μας η TIN ζει σε store (όχι entity) → γι' αυτό ο Δρόμος Γ (προαγωγή σε entity).
  - **SSoT audit (fresh grep, code=truth) — 2 διορθώσεις στο ADR §5.Α**: (1) το «`params.topoRole`» **δεν υφίσταται** — οι primitives (`line`/`lwpolyline`/`text`) δεν έχουν `params`, μόνο `metadata?`/typed fields στο `BaseEntity`· (2) ο Δρόμος Β (Prospector tree) απαιτεί **νέα navigator infra** (δεν υπάρχει δέντρο στο dxf-viewer — flat tabs μόνο). Ο Δρόμος Γ αποφεύγει και τα δύο.
  - **Αρχιτεκτονική (thin/derived — απόφαση Giorgio)**: `TopoSurfaceEntity` = **δείκτης** (`surfaceId: TopoSurfaceId`) + `footprint: Point2D[][]` (περίγραμμα TIN για hit-test), **non-BIM** (mirror `ImageEntity` — εκτός `isBimEntityType`). Γεωμετρία recompute από `getTopoSurface(id)`· ξαναχτίζεται στο load όπως οι ισοϋψείς (`regenerate-topo.ts`) → **κανένα per-entity Firestore doc** (καμία δεύτερη πηγή αλήθειας· η ίδια προειδοποίηση στο `TerrainSceneLayer.ts` §12.2 M4b). Relief/surface style (`terrain-3d-store`) + point-label style (`topo-point-label-store`) → ιδιότητες του surface object (reuse `Terrain3DSection`/`TopoPointLabelsSection` markup).
  - **Staged plan (κάθε stage deployable)**: **A** νόμιμος τύπος (type + registries + coverage) · **B** γεννιέται/φαίνεται (footprint outline)/επιλέγεται · **C** object-bound Properties + contextual tab (ΣΤΟΧΟΣ Φ2β) · **D** follow-up (3D raycast tag, style persistence, καθαρισμός αριστερού panel).
  - **Landed αυτή τη συνεδρία (type foundation, additive/deployable — non-renderable, μηδέν coverage tripwire)**: NEW `types/topo-surface.ts` (`TopoSurfaceEntity` + `isTopoSurfaceEntity`, mirror `types/annotation-symbol.ts`)· MODIFY `types/base-entity.ts` (`EntityType` +`'topo-surface'`), `types/entities.ts` (import+re-export+`Entity` union+guard), `types/dxf-export.types.ts` (`ENTITY_TYPE_MAPPING['topo-surface']=null` — full-Record tsc). Επαλήθευση full-Record `EntityType` maps: μόνο `ENTITY_TYPE_MAPPING` full (καλύφθηκε)· `FILTER_BUTTON_LABEL_KEY` = `as`-cast partial (ανεκτικό)· τα υπόλοιπα `Partial<Record<EntityType>>`.
  - **ΕΚΚΡΕΜΕΙ (Stage A plumbing — ατομικό chunk, πρέπει να προσγειωθεί μαζί για coverage-green)**: renderable registration + renderer + DxfEntityUnion variant + hit-test model + 4 hit registries + 7 coverage tests. Πλήρες per-file checklist στο `HANDOFFS/HANDOFF-topography-phase2b-stageA-plumbing.md`.
  - **ADR-040**: το surface entity είναι non-high-freq· το 3D mesh μένει στον υπάρχοντα imperative `TerrainSceneLayer`. **N.17**: μηδέν tsc (τυχόν exhaustive-switch gaps στο `Entity` union → CI CHECK 3.29 / περιοδικό tsc Giorgio).
  - **Stage A render plumbing (landed 2026-07-16, additive/deployable)**: NEW `rendering/entities/TopoSurfaceRenderer.ts` — pure leaf (ADR-040), ζωγραφίζει το footprint outline της TIN (phase-resolved stroke για hover/selection), fill hit-test = point-in-polygon σε οποιοδήποτε ring (mirror `ImageRenderer`), καμία grip (derived entity). Registration: `'topo-surface'` → `ENTITY_RENDER_CONTRACTS` (`dxf(...)`), `DXF_RENDERABLE_TYPES`, `entity-renderer-registry`. Το 3D mesh παραμένει στον imperative `TerrainSceneLayer` (κανένα per-type 3D mesh).
  - **Stage A hit-test plumbing (landed 2026-07-16, additive/deployable)**: NEW `DxfTopoSurface` variant στο `DxfEntityUnion` + `TO_DXF_HANDLERS['topo-surface']` + `buildEntityModelFromDxf` case + `TO_ENTITY_MODEL_SUPPORTED_TYPES` (αλλιώς η επιφάνεια θα έπεφτε σε `null` default → αόρατη/μη-επιλέξιμη, το ADR-583/612/651 trap). Hit-test seams (τα ΤΡΙΑ που ένωσε η Φ10): broad-phase AABB `calculateTopoSurfaceBounds` (footprint-ring vertices) στο `HIT_TEST_BOUNDS_HANDLERS` + `ENTITY_BOUNDS_PROVIDERS` (`viaBoundsCalculator` — marquee ΚΑΙ hover διαβάζουν την ΙΔΙΑ συνάρτηση), narrow-phase `hitTestTopoSurface` (point-in-polygon `.some` ring, SSoT με `TopoSurfaceRenderer.hitTest`) στο `NARROW_HIT_TEST_HANDLERS`, `HIT_TEST_MODEL_DXF_HANDLERS` flat-fields. Coverage: `renderable-entity-fixtures` + `resolve-contextual-trigger-coverage` (προσωρινά `NO_SELECTION_TAB` — contextual tab έρχεται στο Stage C). Η επιφάνεια είναι πλέον **επιλέξιμη** (hover/click/marquee)· **ΕΚΚΡΕΜΕΙ**: object-bound Properties + «Τοπογραφική Επιφάνεια» contextual tab (Stage C).
- **2026-07-16 — Stage B ΟΛΟΚΛΗΡΩΘΗΚΕ: ο producer (γέννηση/regenerate/εμφάνιση του footprint)**. Η επιφάνεια πλέον **γεννιέται** — μέχρι τώρα ήταν renderable+επιλέξιμη αλλά κανείς δεν έφτιαχνε `TopoSurfaceEntity` → αόρατη. Additive/deployable, μηδέν νέος μηχανισμός (SSoT audit fresh grep):
  - **NEW `systems/topography/topo-surface-perimeter.ts`** (pure SSoT): `topoSurfacePerimeter(surface)` = boundary edges της TIN (ακμές που ανήκουν σε **ΑΚΡΙΒΩΣ 1 triangle** — Civil 3D «Surface Border») → κλειστό/-ά ring(s) μέσω του κοινού `chainUndirectedEdges` (ίδιος walk με ισοϋψείς) → **LOCAL→WORLD μέσω `localToWorld`** (ίδιο origin-offset μονοπάτι με `contour-chainer`· χωρίς αυτό geo-referenced footprint→(0,0)→hit-test σε λάθος σημείο, ADR-635/650 datum trap). Empty surface (0 triangles) → `[]`. Unit: 2×2-τριγώνων quad → 1 ring 4 κορυφών (πετά το shared diagonal) + origin offset (3 tests πράσινα).
  - **NEW `systems/topography/topo-surface-entity.ts`** (SSoT builder — ΕΝΑ construction site για producer ΚΑΙ regenerate): `buildTopoSurfaceEntity(surfaceId, layerId)` = perimeter → **display-frame projection** μέσω του ΙΔΙΟΥ `getActiveWorldToDisplayProjector` (ADR-650 M10· sibling του `projectContoursToLocal`· identity/unset→no-op) → `TopoSurfaceEntity` με σταθερό deterministic id (`topo-surface-<id>`, ΟΧΙ Firestore doc→N.6 άσχετο). Layer `TOPO-SURFACE` + χρώμα olive (structural config, εκτός i18n όπως `TOPO_CONTOUR_*`). Null σε empty footprint.
  - **NEW `systems/topography/useTopoSurfaceEntity.ts`** (interactive producer, mirror `useTopoContours`): ensure-layer (`ensure-topo-layer`) → `buildTopoSurfaceEntity` → **idempotent-replace** σε ΕΝΑ ατομικό `CompoundCommand` (delete-old-same-id + create → ΕΝΑ undo, ποτέ διπλότυπο). Derived entity → απευθείας `CreateEntityCommand` (ADR-057 SSoT create) αντί `completeEntities`, ώστε να ΜΗΝ κληρονομεί quick-style/tool-persistence/overlay-persistence side effects (footprint = recompute, όχι ζωγραφιά).
  - **`persistence/regenerate-topo.ts` (edit)**: durable back-seat — το ΙΔΙΟ `buildTopoSurfaceEntity('existing', …)` (re)build στο load/level-switch/geo-ref (silent origin, όχι undo — όπως ισοϋψείς)· TOPO-SURFACE layer προστέθηκε στα `LAYER_SPECS`· το drop-set περιλαμβάνει πλέον το surface layer (idempotent cleanup)· το footprint μπαίνει **backmost** στο `fresh` (πίσω από ισοϋψείς, που είναι πίσω από κάτοψη).
  - **Trigger (ΕΝΑ σημείο)**: `app/topo-ribbon-actions.ts` `topo.contours.generate` → καλεί ΚΑΙ `deps.surface.generate()` (self-guards σε empty)· `TopoRibbonHost` mount `useTopoSurfaceEntity` + `TopoRibbonDeps.surface`.
  - **N.18** jscpd:diff καθαρό (5 files, μηδέν sibling-clone). **ΕΚΚΡΕΜΕΙ Stage C**: object-bound Properties (reuse `Terrain3DSection`/`TopoPointLabelsSection`) + «Τοπογραφική Επιφάνεια» contextual tab.
- **2026-07-16 — Φάση 2β (Δρόμος Γ) Stage C ΟΛΟΚΛΗΡΩΘΗΚΕ → Δρόμος Γ ΟΛΟΚΛΗΡΩΘΗΚΕ: object-bound Properties + «Τοπογραφική Επιφάνεια» contextual tab**. Επιλογή επιφάνειας → contextual tab (ενέργειες) + αριστερό Properties palette (ιδιότητες εμφάνισης). Big-player-faithful & object-bound (Revit Toposolid «Type Properties» / Civil 3D «Surface Properties» / ArchiCAD Mesh Settings / C4D Attribute Manager / Figma right-panel — **όλα selection-driven**· κανένας δεν βάζει terrain display σε document-level panel χωρίς επιλέξιμο αντικείμενο· το document-level topo tab ξανα-απορρίφθηκε ως anti-pattern). Additive/deployable, μηδέν νέος μηχανισμός/store (fresh SSoT grep audit — mirror του image/hatch precedent):
  - **NEW `ui/ribbon/data/contextual-topo-surface-tab.ts`** (mirror `contextual-image-tab.ts`): `TOPO_SURFACE_CONTEXTUAL_TRIGGER = 'topo-surface-selected'` + `CONTEXTUAL_TOPO_SURFACE_TAB` — **actions-only** (Επιλογή via SSoT `buildSelectPanel` + «Αναδημιουργία ισοϋψών» reuse `topo.contours.generate` [Stage B: (re)build ΚΑΙ το footprint] + «Ετικέτες σημείων» reuse `topo.pointLabels.generate`). ΚΑΜΙΑ δήλωση «Κλείσιμο» (το `withStandardClose` κεντρικά)· reuse των υπαρχόντων command labels (`ribbon.commands.topo.generate/pointLabels.label`) + panel label (`ribbon.panels.topoSurface`) — κανένα νέο command route.
  - **Wiring (+1 γραμμή ανά SSoT)**: export token στο barrel `contextual-triggers.ts` · `ENTITY_CONTEXTUAL_TRIGGER['topo-surface']` στο `resolve-contextual-trigger.ts` (+ import) · `RAW_RIBBON_CONTEXTUAL_TABS` +1 στο `ribbon-contextual-config.ts` (παίρνει αυτόματα `withStandardClose`). Το `'topo-surface'` **βγήκε** από το `NO_SELECTION_TAB_TYPES` του coverage test → πράσινο (12/12).
  - **NEW `ui/wall-advanced-panel/TopoSurfacePropertiesTab.tsx`** (mirror `ImagePropertiesTab.tsx`): resolve της επιφάνειας από το reactive `currentScene` → **reuse markup** `Terrain3DSection` (ανάγλυφο/υψομετρικό + διαφάνειες επιφάνειας/ισοϋψών) + `TopoPointLabelsSection` (ετικέτες Ζ/κωδικός/όριο Χ,Υ), πάνω στα **ΙΔΙΑ persisted stores** (`terrain-3d-store`, `topo-point-label-store`) — ΚΑΝΕΝΑ νέο store, καμία διπλή κατάσταση (τα stores επίτηδες ΔΕΝ ribbon-ίστηκαν στη Φ1b — προορίζονταν γι' αυτό το tab). `BimPropertiesRouter.tsx`: branch `isTopoSurfaceEntity(selected)` ΠΡΙΝ τα generic fallbacks (mirror image/hatch branch· non-BIM → `BimPropertiesRouter` πιάνει απευθείας).
  - **i18n el+en ΠΡΙΝ τη χρήση (N.11)**: `ribbon.tabs.topoSurfaceProperties` («Τοπογραφική Επιφάνεια» / "Topographic Surface") + `topoSurfaceAdvancedPanel.title/emptyState` (dxf-viewer-shell)· οι reused sections κρατούν τα υπάρχοντα `topography.*` keys (dxf-viewer-panels).
  - **N.18** jscpd:diff καθαρό (6 files, μηδέν sibling-clone). **Δρόμος Γ ΟΛΟΚΛΗΡΩΘΗΚΕ** — εκκρεμεί μόνο Φάση 4 (αφαίρεση αριστερού `TopographyPanel`, dual-access → single).
- **2026-07-16 — Φάση 4 ΟΛΟΚΛΗΡΩΘΗΚΕ: απόσυρση αριστερού `TopographyPanel` (dual-access → single, big-player-faithful)**. Το audit έδειξε ότι σκέτο delete = regression: 5 sections ζούσαν ΜΟΝΟ στο panel (QA report / auto-breakline review+approve / cut-fill όγκοι / cloud stats / breakline clear+count) — το ribbon τα έτρεχε fire-and-forget χωρίς επιφάνεια αποτελέσματος. Big-player (Revit «Warnings» dialog / Civil 3D «Panorama» + «Extract Feature Lines» review / ArchiCAD / C4D): «τρέξε → δες σε dialog/palette», ΟΧΙ ribbon-only-toast ούτε μόνιμο mega-panel. Επεκτάθηκε το ΗΔΗ καθιερωμένο **section-in-dialog** SSoT pattern (import/γεωαναφορά/παραδοτέα) στα review sections — μηδέν νέα UI/store, reuse των section components ως έχουν:
  - **`TopoRibbonHost.tsx`**: +4 `<Dialog>` blocks (mirror geoRef/deliverables) με `<TopoQaSection>`/`<TopoAutoBreaklineSection>`/`<TopoCutFillSection>`/`<TopoCloud3DSection>` + 4 openers (`openQa`/`openAutoBreakline`/`openCutFill`/`openCloud`) στο `TopoRibbonDeps`.
  - **`topo-ribbon-actions.ts`**: νέα `.open` cases (`topo.qa.open`/`topo.autoBreakline.open`/`topo.cutFill.open`/`topo.cloud.open`) + `topo.breakline.clear` (→ `setTopoBreaklines([])` + toast). Αφαιρέθηκαν τα πλέον-περιττά fire-and-forget cases (`qa.run/clear`, `autoBreakline.detect`, `cutFill.compute`, `cloud.remove`) + τα dead imports τους — **δεν** αγγίχτηκαν τα stores (`topo-qa-store`/`auto-breakline-store`/`cut-fill-store`, τα κρατά ο AI executor).
  - **`topography-tab.ts`**: τα αντίστοιχα κουμπιά → `.open` actions· νέο «Καθαρισμός ασυνεχειών». Οι quick-toggle widgets (`topo-cloud-visible`, `topo-cutfill-mode`) **μένουν** στο ribbon (Revit-style γρήγορο on/off δίπλα στο πλήρες dialog).
  - **«Νέφος σημείων…» = disabled-capable command (big-player refinement)**: αντί για plain action που θα άνοιγε **κενό** dialog όταν δεν υπάρχει νέφος (το `TopoCloud3DSection` κάνει self-`null`), έγινε **store-subscribed widget** `topo-cloud-manage` (`PointCloud3DManageButton`, `TopoRibbonToggleWidgets.tsx`) που subscribe-άρει το `pointcloud-3d-store` και είναι **greyed + tooltip «γιατί»** όταν `!preview` (Revit/ArchiCAD/Figma: εντολή με ανεκπλήρωτη προϋπόθεση = disabled, ΠΟΤΕ κενό modal). Χρησιμοποιεί `aria-disabled` (ΟΧΙ native `disabled`) ώστε το tooltip να δείχνει τον λόγο (Radix pattern) + **νέο SSoT CSS** `.dxf-ribbon-btn[aria-disabled="true"]` (`ribbon-tokens.css` — για ΟΛΑ τα ribbon buttons, N.3). Registration στο `RibbonPanel.tsx` (mirror των υπόλοιπων topo widgets). i18n `topo.cloud.emptyTip` (el+en). Test `WIDGET_IDS` 9→10.
  - **Retire panel**: `PanelTabs.tsx` (−tab, −`Mountain` icon)· `usePanelContentRenderer.tsx` (−case/−import)· `panel-types.ts` (−`'topography'` από `FloatingPanelType`/`isFloatingPanelType`/`FLOATING_PANEL_TYPES`/`PANEL_METADATA`/`PANEL_LAYOUT.topRow`/iconName union)· **deleted** `ui/panels/topography/TopographyPanel.tsx` (το `.module.css` μένει — κοινό με 12 sections). Persisted `activePanel:'topography'` → graceful default (invalid → «select panel»).
  - **i18n el+en** (N.11, πριν τη χρήση): `topo.qaRun/autoBreakline/cutFill/cloud.dialogTitle` + `topo.cloud.label` + `topo.breakline.clear` + `notify.breaklinesCleared`.
  - **jest** πράσινα: `topography-tab.test.ts` (9 widgets αμετάβλητα· action buttons valid) + `resolve-contextual-trigger-coverage.test.ts`. **N.18** jscpd:diff καθαρό (6 files). **ΟΛΗ η μετάβαση ADR-662 ΟΛΟΚΛΗΡΩΘΗΚΕ** (Φ1/1b/2/2β-Γ/4).
- **2026-07-16 — Φ4 follow-up (discoverability): quick display toggles στο contextual «Τοπογραφική Επιφάνεια» tab (Civil-3D-faithful)**. Ο Giorgio ανέφερε ότι οι εντολές ανάγλυφου/μονόχρωμου/έγχρωμου «δεν φαίνονταν» μετά τη μετακίνηση στο object-bound Properties (εμφανίζονται μόνο με επιλογή επιφάνειας). Civil 3D: το contextual «TIN Surface» ribbon δείχνει **και** τα quick style controls, όχι μόνο το Surface Properties. → Προστέθηκε panel «Εμφάνιση» στο `contextual-topo-surface-tab.ts` με 2 quick toggles: **Ανάγλυφο** (εμφάνιση/απόκρυψη εδάφους 3Δ) + **Χρωματισμός** (υψομετρικό/έγχρωμο ↔ shaded/μονόχρωμο). Νέα `RibbonToggleWidget` configs `TERRAIN_VISIBLE`/`TERRAIN_STYLE` (`TopoRibbonToggleWidgets.tsx`) πάνω στο **ΙΔΙΟ** `terrain-3d-store` SSoT με το πλήρες `Terrain3DSection` (dual access: quick στο contextual ribbon με επιλογή, full + opacity sliders στο Properties). Registration `topo-terrain-visible`/`topo-terrain-style` στο `RibbonPanel.tsx`· i18n el+en (`ribbon.panels.topoSurfaceDisplay` + `topo.terrainVisible/terrainStyle` toggle keys). N.18 jscpd καθαρό.

- **2026-07-16 — Φ4 follow-up #2 (consistency polish): disabled-όταν-δεν-έχει-νόημα για το `topo-cloud-visible` toggle**. Big-player (Revit/Figma/ReCap): εντολή/toggle με ανεκπλήρωτη προϋπόθεση = greyed + λόγος, ΠΟΤΕ ενεργό control σε ανύπαρκτο. Το «Νέφος» show/hide toggle έμενε ενεργό ακόμη κι όταν δεν είχε εισαχθεί νέφος. → Το `RibbonInlineToggleButton` (ADR-599 atom) απέκτησε optional `disabled?: boolean` (default `false`, backward-compatible — ο 2ος consumer `DisciplineVisibilityToggle` αμετάβλητος): `aria-disabled` (ΟΧΙ native `disabled`, ώστε το hover tooltip «γιατί» να δείχνεται — mirror του `PointCloud3DManageButton`) + guard onClick + SSoT greyed look (`PANEL_LAYOUT.OPACITY['50']` + `CURSOR.NOT_ALLOWED`, ίδιο vocabulary με `.dxf-ribbon-btn[aria-disabled]`). Το `RibbonToggleConfig.useToggleState` επιστρέφει προαιρετικά `{ disabled?, disabledReasonKey? }`· το `RibbonToggleWidget` τα περνά στο atom, βάζει τον λόγο σε `aria-label` **και** το τυλίγει σε `RibbonTooltip` (mirror manage button). `CLOUD_VISIBLE` config → `disabled: !preview` + reuse του υπάρχοντος `ribbon.commands.topo.cloud.emptyTip` (κανένα νέο i18n key). **§5 απόφαση — `CUTFILL_MODE` ΔΕΝ έγινε disabled**: το «Αναφορά datum↔surface» είναι display pre-setting, όχι action σε ανύπαρκτα δεδομένα· Civil 3D/Revit greyάρουν το compute/action, ΟΧΙ ένα mode-preference (κανόνας Giorgio: «αν οι μεγάλοι δεν το προτείνουν, μην το κάνεις»). jest `topography-tab.test.ts` 7/7 πράσινα (widget invariants αμετάβλητα)· N.18 jscpd καθαρό.

- **2026-07-16 — Φ5 (layout fix): ομοιογενείς σειρές → κάθετη στοίβα widgets στο «Τοπογραφικό»**. Ο Giorgio ανέφερε (screenshot) ότι το tab **ξεχειλίζει** — οι ομάδες toggles/fields (Νέφος, ισοϋψείς, Κάναβος, Βορράς, Cut/Fill) απλώνονταν οριζόντια και έτρωγαν το πλάτος.
  - **Root cause (ΟΧΙ CSS bug — data bug)**: το `RibbonPanel` γράφει `data-row-size={rowSize(row)}` και το `ribbon-tokens.css` κάνει `flex-direction: column` **μόνο** στο `[data-row-size="small"]`. Το `topography-tab.ts` είχε **μία mixed σειρά ανά panel** (large actions + small widgets μαζί) → `rowSize()` → `'mixed'` → κανένας κανόνας → default row-flow. Ο μηχανισμός κάθετης στοίβας **υπήρχε ήδη** (canonical consumer: `contextual-animation-tab.ts` panel `animation-waypoints` = 3 small σε στοίβα).
  - **Fix (data-only, μηδέν νέο CSS/component)**: split των panels σε **ομοιογενείς** σειρές μέσω τοπικού `row()` helper. Οι σειρές μπαίνουν side-by-side μέσα στο panel body → «large tools │ στοίβα ρυθμίσεων │ large actions» = Revit/Civil 3D panel grammar. `topo-data`: [Εισαγωγή] │ [Νέφος visible + Νέφος σημείων…]· `topo-surface`: [Ασυνέχειες + Καθαρισμός] │ [Ισοδιάσταση + Κύριες ανά + Στυλ] │ [Δημιουργία + Αυτόματες]· `topo-presentation`: [Κάναβος + Βήμα] │ [Αποτύπωμα] │ [Βορράς + Mode] │ [Αποτύπωση + Ετικέτες]· `topo-analysis`: [Όριο] │ [Αναφορά cut/fill] │ [Όγκοι + QA].
  - **Guard**: νέο test «κάθε row είναι ομοιογενής» στο `topography-tab.test.ts` (καμία mixed/κενή σειρά) + `ROW_LAYOUT` σχόλιο στην κεφαλίδα του data file που εξηγεί ΓΙΑΤΙ δεν είναι κοσμητικό. jest 8/8 πράσινα· N.18 jscpd καθαρό.
  - **Αρχεία**: MODIFY `ui/ribbon/data/topography-tab.ts`, `ui/ribbon/data/__tests__/topography-tab.test.ts`. **Μηδέν** αλλαγή σε components/CSS/i18n/stores → **ADR-040 άθικτο**.
- **2026-07-27 — §11 Έλξεις (OSNAP) στο περίγραμμα ΥΛΟΠΟΙΗΘΗΚΕ.** Το `topo-surface` ήταν **αόρατο** στο υποσύστημα έλξεων (`grep -rl "topo-surface" snapping/` → κενό): hover/hit-test δούλευαν, αλλά καμία μηχανή δεν παρήγαγε υποψήφιο σημείο. Πλέον ENDPOINT/MIDPOINT/CENTER/NEAREST/PERPENDICULAR στο περίγραμμα (βλ. §11).
  - **Έρευνα (§11.2)**: Civil 3D = «ό,τι εμφανίζεται, ελκύει» (διακόπτης = ορατότητα/layer)· Revit Toposolid = περιορισμένο snap (χαμηλός πήχης)· AutoCAD `OSOPTIONS` default 7 ⇒ **καταστολή** osnap σε γραμμοσκίαση (συνειδητή απόκλιση — η δική μας γραμμοσκίαση έχει λαβές, ADR-507).
  - **Απόφαση Giorgio**: NEAREST/PERPENDICULAR **και** στη γραμμοσκίαση (ένας type-driven κλάδος, μηδέν φράχτης) — αίρεται η ασυνέπεια «κορυφή ναι, γραμμή όχι».
  - **SSoT (N.18) — ανακαλωδίωση, ΟΧΙ προσθήκη**: νέο `snapping/shared/entity-closed-rings.ts` (ΕΝΑ ερώτημα: «ποια κλειστά rings ορίου;»· `hatch→boundaryPaths`, `topo-surface→footprint`). Οι **5 υπάρχοντες hatch κλάδοι αντικαταστάθηκαν** από ring-driven κλάδο ⇒ το topo μπήκε δωρεάν, διπλότυπα **μειώθηκαν**. Reuse `ringEdgeMidpoints` + `hatchBoundsCenter` + `polyline-perpendicular-feet` — **μηδέν νέα γεωμετρικά μαθηματικά**. `jscpd:diff` **καθαρό**.
  - **Boy-scout (N.0.2)**: το σχόλιο του `TopoSurfaceEntity.footprint` έλεγε «world canonical mm» ενώ ο builder **προβάλλει** σε display frame — διορθώθηκε σε `types/topo-surface.ts` + `TopoSurfaceRenderer.ts`. Το λάθος σχόλιο είχε ήδη παραπλανήσει· η έλξη διαβάζει τα rings **ΩΜΑ**, όπως renderer/hit-test.
  - **Ολοκλήρωση ημιτελούς εξαγωγής**: το `polyline-perpendicular-feet.ts` είχε ιδιωτικό `forEachSegmentFoot` (extraction μετά από CHECK 3.28) **χωρίς** ανακαλωδίωση των δύο δημόσιων συναρτήσεων — ο helper ήταν αχρησιμοποίητος και οι δύο βρόχοι-δίδυμα ζωντανοί. Πλέον και οι δύο περνούν από αυτόν (η διάσχιση ακμών + το modulo της ακμής κλεισίματος ζουν **μία** φορά).
  - **Αρχεία**: NEW `snapping/shared/entity-closed-rings.ts`, `snapping/shared/__tests__/entity-closed-rings.test.ts`. MODIFY `snapping/shared/polyline-perpendicular-feet.ts`, `snapping/shared/GeometricCalculations.ts`, `snapping/engines/NearestSnapEngine.ts`, `snapping/engines/PerpendicularSnapEngine.ts`, `types/topo-surface.ts`, `rendering/entities/TopoSurfaceRenderer.ts`.
  - **Tests**: νέο lock 18 tests (`describe.each` πάνω και στους δύο ring-bounded τύπους — αν κάποιος ξαναγράψει per-type κλάδο και αποκλίνει, σπάει)· το ADR-507 lock της γραμμοσκίασης μένει **άθικτο**. Συνολικά **87 suites / 1014 tests πράσινα** (`snapping/` + `bim/walls` + `bim/slabs`).
  - **ADR-040**: καμία αλλαγή σε orchestrators/leaves/stores — μόνο pure υπολογισμός σημείων εντός των engines. Οι τρεις engines χρησιμοποιούν **spatial index** ⇒ radius query, άρα η πυκνότητα του TIN perimeter **δεν** είναι perf θέμα (§11.4) και δεν μπήκε throttling.
- **2026-07-27 — §12 Ετικέτα Εμβαδού στην τοπογραφική επιφάνεια ΥΛΟΠΟΙΗΘΗΚΕ.** Κλικ στην επιφάνεια → δεύτερο κλικ ρίχνει ετικέτα με **εμβαδόν προβολής + πραγματική επιφάνεια εδάφους**. Απόφαση Giorgio: **γενίκευση** του ADR-649, ΟΧΙ δεύτερο εργαλείο (βλ. §12).
  - **SSoT audit**: το 2-κλικ εργαλείο υπήρχε ήδη (ADR-649) αλλά ήταν hatch-only σε **5 σημεία** — pick, hover, FSM field, κείμενο, entity builder. Πέντε `isTopoSurfaceEntity` κλάδοι = πέντε sibling clones (N.18)· αντ' αυτού **ένας** dispatcher (`entity-area-facts`).
  - **⚠️ Κρίσιμο εύρημα (§12.2)**: τα footprint rings είναι «outer + hole loops» **χωρίς αξιόπιστο προσανατολισμό** (`chainUndirectedEdges` σε μη-προσανατολισμένες ακμές) ⇒ ούτε άθροισμα ούτε outer−rest δίνει σωστό εμβαδόν. Το εμβαδόν βγαίνει από τα **τρίγωνα του TIN** — ακριβές, ανοσοποιημένο σε τρύπες, ίδια πηγή με το Civil 3D.
  - **Δύο εμβαδά (§12.3)**: `plan2DMm2` (νομικό εμβαδόν οικοπέδου) + `surface3DMm2` (πραγματική επιφάνεια κατά μήκος κλίσεων· αυτό τιμολογείται σε εκσκαφή/επένδυση/φύτευση). Επίπεδη οντότητα → `surface3DMm2: null` («δεν υπάρχει η έννοια», **ΟΧΙ** 0) → μία γραμμή αντί για δύο.
  - **Αρχεία**: NEW `systems/topography/topo-surface-area.ts`, `systems/measure/entity-area-facts.ts` + 2 test files. MOVED (git mv, ιστορικό διατηρήθηκε) `bim/hatch/hatch-area-label{,-store}.ts` → `systems/measure/area-label{,-store}.ts`, `hooks/drawing/useHatchAreaLabelTool.ts` → `useAreaLabelTool.ts`. MODIFY `canvas-click-tool-handlers.ts`, `useAutoAreaMouseMove.ts`, `useCanvasClickHandler.ts`, `useSpecialTools-placement-tools.ts`, `contextual-topo-surface-tab.ts`, `tool-definitions.ts`, `ui/toolbar/types.ts`, i18n el+en (namespace `hatchAreaLabel` → `areaLabel` + νέο `surfacePrefix`, N.11).
  - **Δωρεάν από τη §11**: το pick/hover έγινε `pickTopEntityAt(…, hasMeasurableArea)` — το `performDetailedHitTest` δίνει ήδη τη σωστή ανά τύπο σημασιολογία· το όριο για αγκύρωση/μέγεθος το δίνει το `entityClosedRings` της §11. Αγκύρωση = centroid του **μεγαλύτερου** ring (το `rings[0]` είναι αυθαίρετο στο TIN).
  - **Tests**: 2 νέα αρχεία. Το `topo-surface-area.test.ts` κλειδώνει τη σχέση που κάνει τον δεύτερο αριθμό να αξίζει (επίπεδο ⇒ 3D=2D· κλίση 45° ⇒ 3D = 2D×√2) — αν κάποιος «απλοποιήσει» το 3D σε shoelace, κοκκινίζει. Το `area-label.test.ts` τρέχει **και τους δύο** τύπους μέσα από τον ΙΔΙΟ builder (`it.each`) ώστε απόκλιση ανά τύπο να σπάει. Συνολικά **129 suites / 1288 tests πράσινα** (hatch + ribbon + tools + toolbar + topography) + `i18n:audit` καθαρό + `jscpd:diff` καθαρό σε 10/10 αρχεία.
  - **ADR-040**: καμία αλλαγή σε orchestrators/leaves — το εργαλείο είναι event-time (click/hover) πάνω σε vanilla store, μηδέν νέα subscription.

---

### Πηγές (web-research 2026-07-27, §11 έλξεις)
- Autodesk — [OSOPTIONS (System Variable)](https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-Core/files/GUID-0D05BECE-0DC3-454D-999A-208C6DBC3C3E.htm) · default **7** ⇒ bit 1 = suppress osnaps on hatch objects.
- Autodesk — [Object Snap does not work on hatch objects in AutoCAD](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Object-Snap-does-not-work-on-hatch-objects-in-AutoCAD.html)
- WisDOT Civil 3D KB — [Object snaps](https://c3dkb.dot.wi.gov/Content/c3d/acad/acad-objct-snp.htm) · `OSNAPZ` και συμπεριφορά έλξης σε Civil 3D αντικείμενα.
- Autodesk Community — [Snap to Surface](https://forums.autodesk.com/t5/civil-3d-forum/snap-to-surface/td-p/8297659) · η έλξη στο εμφανιζόμενο TIN απενεργοποιείται μέσω **layer**, όχι ρύθμισης έλξης.
- Autodesk — [Is it possible to snap to geometry when adding toposolid points in Revit?](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Is-it-possible-to-snap-to-geometry-when-adding-toposolid-points-in-Revit.html) · περιορισμένο snap· σύσταση βοηθητικών γραμμών/reference planes.

### Πηγές (web-research 2026-07-15)
- Revit Toposolid / Massing & Site / Modify contextual / Properties: [BIM Pure — Toposolid](https://www.bimpure.com/blog/toposolid) · [Micrographics — Excavate](https://mgfx.co.za/blog/building-architectural-design/the-new-revit-2025-massing-and-site-tools-addition-excavate/) · [Autodesk Help — Toposolid Enhancements](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-WhatsNew/files/GUID-50FB6EAF-5308-487B-9BF0-A59C36126B96.htm)
- Civil 3D TIN Surface contextual tab / Toolspace: [Autodesk — Finding tools in Civil 3D](https://www.autodesk.com/learn/ondemand/tutorial/finding-tools-civil-3d) · [Autodesk — ribbon & Toolspace](https://www.autodesk.com/support/technical/article/caas/tsarticles/ts/5aDQNP1NhIIfn92NVJUXwk.html) · [WisDOT C3D KB — Accessing surfaces](https://c3dkb.dot.wi.gov/Content/c3d/srfc/srfc-accs.htm)
- ArchiCAD Mesh tool / Info Box / Settings: [Graphisoft Help — Mesh Tool Settings](https://help.graphisoft.com/AC/29/INT/_AC29_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-7.htm) · [AC Best Practices — Site Modeling](https://acbestpractices.com/member-home/quickstart-course/archicad-basic-training-module-7/quickstart-part-7-2/)
- Cinema 4D Attribute Manager (context-sensitive): [Maxon — How to use the Attribute Manager](https://help.maxon.net/c4d/r25/en-us/Content/html/5822.html) · [Maxon — Selection](https://help.maxon.net/c4d/r25/en-us/Content/html/5823.html)
- Figma Properties panel / toolbar: [Figma Learn — Right sidebar](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) · [Figma Learn — Navigation & left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar)
- **2026-07-17 — Φ2β Stage A: τα ADR-587 capability anchors απαντήθηκαν (ξεχωριστή συνεδρία, UNCOMMITTED).** Το `7f215980` πρόσθεσε `'topo-surface'` στο `RENDERABLE_ENTITY_TYPES` **χωρίς** να απαντήσει στα anchors του ADR-587 → **7 suites / 11 tests κόκκινα στο main**, που επέζησαν ~6 commits (Stage C → Φ4 → Φ5) επειδή **κανένα gate δεν τα έτρεχε** (βλ. ADR-587 §6.1). Δεν ήταν θόρυβος: τα anchors ρωτούν «ο νέος τύπος μετακινείται; περιστρέφεται; εξάγεται; έχει ghost/λαβές;» — ερωτήσεις που το Stage A όντως άφησε αναπάντητες.
  - **Χαρακτηρισμός της ΖΩΝΤΑΝΗΣ συμπεριφοράς** (ΟΧΙ αλλαγή σημασιολογίας — ο χαρακτηρισμός επαληθεύεται από live pins που εκτελούν την πραγματική συνάρτηση): `toDxf` + `toEntityModel` → **golden** (το Stage A έδωσε flat handler + `DxfTopoSurface` variant). `move` / `rotate` / `preview-ghost` / `grips` → **no-op / off-path** με ρητή αιτιολογία: η επιφάνεια είναι **derived** (TIN / point-cloud), άρα η επεξεργασία ανήκει στο topography subsystem, ΟΧΙ σε λαβές πάνω στο footprint outline· γεωαναφερμένη επιφάνεια δεν περιστρέφεται/μετακινείται αυθαίρετα (datum = SSoT, ADR-650).
  - **Export** → `{dxf: 'missing', tek: 'missing'}` στο `ENTITY_EXPORT_COVERAGE`. **ΟΧΙ `drop`**: το DXF **έχει** έννοια για TIN surface (3DFACE / POLYFACE MESH — ό,τι εκπέμπει το Civil 3D), άρα είναι **γνήσιο κενό προς κλείσιμο**, όχι σκόπιμη παράλειψη. Backlog snapshot ADR-648 27→29. Ο Τέκτων μένει `missing` μέχρι να τεκμηριωθεί ότι δεν έχει terrain concept.
  - **⚠️ ΓΙΑ ΤΙΣ ΕΠΟΜΕΝΕΣ ΦΑΣΕΙΣ (αυτο-διορθούμενο συμβόλαιο):** μόλις καλωδιώσετε capability (move/rotate/grips/export) για το `topo-surface`, το αντίστοιχο **no-op live pin θα σκάσει** — αυτό είναι το σχεδιασμένο σήμα, όχι regression. Μετακινήστε τον τύπο στο golden set του seam **στο ίδιο commit**. Πλέον **επιβάλλεται**: το `renderable-entity-type.ts` είναι trigger του **CHECK 5C** (pre-commit + CI `capability-anchors.yml`) → δεν ξαναπερνά αναπάντητο.
