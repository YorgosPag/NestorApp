# ADR-662 — Μετάβαση Τοπογραφικού από αριστερό floating panel → Ribbon (μόνιμο tab + contextual + Properties)

| | |
|---|---|
| **Κατάσταση** | 🟢 Φάσεις 1 + 1b + 2 (trim-first) ΥΛΟΠΟΙΗΘΗΚΑΝ (μόνιμο ribbon tab + bridge Host + live toggles/numeric fields + αφαίρεση διπλών display/param sections από το αριστερό panel) · 🟡 Φάση 2β **(Δρόμος Γ — επιφάνεια = first-class selectable entity)** ΞΕΚΙΝΗΣΕ: type foundation (Stage A μερικό)· εκκρεμεί το plumbing (renderer + hit-test + contextual + Properties) · Φάση 4 PROPOSED |
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
| Contextual tab registry | `app/ribbon-contextual-config.ts` (`RAW_RIBBON_CONTEXTUAL_TABS` + `withStandardClose`) | +1 `CONTEXTUAL_TOPO_SURFACE_TAB` |
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

## Changelog
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

---

### Πηγές (web-research 2026-07-15)
- Revit Toposolid / Massing & Site / Modify contextual / Properties: [BIM Pure — Toposolid](https://www.bimpure.com/blog/toposolid) · [Micrographics — Excavate](https://mgfx.co.za/blog/building-architectural-design/the-new-revit-2025-massing-and-site-tools-addition-excavate/) · [Autodesk Help — Toposolid Enhancements](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-WhatsNew/files/GUID-50FB6EAF-5308-487B-9BF0-A59C36126B96.htm)
- Civil 3D TIN Surface contextual tab / Toolspace: [Autodesk — Finding tools in Civil 3D](https://www.autodesk.com/learn/ondemand/tutorial/finding-tools-civil-3d) · [Autodesk — ribbon & Toolspace](https://www.autodesk.com/support/technical/article/caas/tsarticles/ts/5aDQNP1NhIIfn92NVJUXwk.html) · [WisDOT C3D KB — Accessing surfaces](https://c3dkb.dot.wi.gov/Content/c3d/srfc/srfc-accs.htm)
- ArchiCAD Mesh tool / Info Box / Settings: [Graphisoft Help — Mesh Tool Settings](https://help.graphisoft.com/AC/29/INT/_AC29_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-7.htm) · [AC Best Practices — Site Modeling](https://acbestpractices.com/member-home/quickstart-course/archicad-basic-training-module-7/quickstart-part-7-2/)
- Cinema 4D Attribute Manager (context-sensitive): [Maxon — How to use the Attribute Manager](https://help.maxon.net/c4d/r25/en-us/Content/html/5822.html) · [Maxon — Selection](https://help.maxon.net/c4d/r25/en-us/Content/html/5823.html)
- Figma Properties panel / toolbar: [Figma Learn — Right sidebar](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) · [Figma Learn — Navigation & left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar)
