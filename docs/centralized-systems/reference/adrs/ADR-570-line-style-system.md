# ADR-570 — Line Style System (named «Στυλ Γραμμής» + πλήρες contextual tab, big-player-grade)

> **Status:** 🟡 IN PROGRESS — **Φ1 (Named Style SSoT) υλοποιήθηκε** 2026-07-04 (βλ. §8 changelog).
> Οι φάσεις Φ2–ΦF παραμένουν PROPOSED. Εγκρίθηκε το πλάνο τεκμηρίωσης από τον Giorgio 2026-07-04.
> **Date:** 2026-07-04
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-510 (Line Creation System — contextual line tab), ADR-362 (DIMSTYLE registry —
> pattern προς καθρέφτη), ADR-375/377 (BIM Object Styles — **ρητά ξεχωριστά**), ADR-345 (Home Modify
> panel), ADR-001 (Select component), ADR-040 (canvas performance), N.6/N.11/N.12 (enterprise IDs /
> i18n / SSoT ratchet)

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio παρατήρησε στο DXF Viewer ότι το contextual tab **«Στυλ Γραμμής»** (εμφανίζεται όταν είναι
ενεργό το εργαλείο Γραμμή ή επιλεγμένη γραμμή) δείχνει μόνο **εμφάνιση**: Χρώμα · Επίπεδο · Διαφάνεια ·
Τύπος Γραμμής · Πάχος · Κλίμακα · Πλάτος. Ρώτησε: **αρκούν αυτά; Τι προσθέτουν οι μεγάλοι παίκτες;**

Έγινε **βαθιά έρευνα web** (AutoCAD, BricsCAD, Revit, ARCHICAD, Figma — επίσημη τεκμηρίωση) +
**χαρτογράφηση κώδικα**. Στόχος: big-player-grade tab, **full enterprise + full SSoT**, ευθυγραμμισμένο
με την πρακτική των μεγάλων (εντολή Giorgio: «όπως οι μεγάλοι· αν δεν το προτείνουν, ακολουθούμε αυτούς»).

### 1.1 Τι υπάρχει ΗΔΗ στον κώδικά μας (χαρτογράφηση)

| Δυνατότητα | Κατάσταση | Πηγή |
|---|---|---|
| Panel **Γενικά** (Χρώμα/Επίπεδο/Διαφάνεια) | ✅ Υπάρχει | `contextual-line-tool-tab.ts` → `line-general` |
| Panel **Εμφάνιση** (Τύπος/Πάχος/Κλίμακα/Πλάτος) | ✅ Υπάρχει | `line-appearance` |
| Panel **Γεωμετρία** editable (Μήκος/Γωνία/Αρχή/Τέλος/Δ) | ✅ Υπάρχει | `line-geometry` (self-hides όταν δεν υπάρχει επιλεγμένη γραμμή) |
| Κλίμακα τύπου γραμμής per-object (CELTSCALE) | ✅ Υπάρχει | `line-appearance` + `QuickStyleStore.ltscale` |
| Εντολές Move/Copy/Rotate/Mirror/Scale/Stretch/Trim/Extend/Array | ✅ Λειτουργούν | `home-tab-modify.ts` + `core/commands/entity-commands/*` |
| Εντολή **Join** | ✅ Υπάρχει | `JoinEntityCommand.ts`, `useEntityJoin.ts` |
| BIM Object Styles (projection/cut pen ανά **δομική κατηγορία**) | ✅ Υπάρχει | `config/bim-object-styles.ts` (ADR-375/377) |
| DIMSTYLE registry (named styles, template pattern) | ✅ Υπάρχει | `systems/dimensions/dim-style-registry.ts` (ADR-362) |
| named **«Στυλ Γραμμής» picker** (ByStyle) για απλές γραμμές | ❌ Δεν υπάρχει | — |
| Ομάδα **«Ενέργειες»** πάνω στο contextual tab | ❌ Δεν εκτίθεται εκεί | — |
| **Offset / Fillet / Chamfer** | ⏳ `comingSoon` | `home-tab-modify.ts` |
| **Αντιγραφή Ιδιοτήτων (Match Properties)** | ❌ Δεν υπάρχει | — |
| BIM **κατηγορία γραμμής** (Σχεδ./Τομής) για draft lines | ⚠️ Μερικώς (subcategory system BIM-only) | `config/bim-subcategories.ts` |
| **Βέλη (arrowheads)** για γραμμές (leaders) | ❌ Μόνο για dimensions | `contextual-dimension-tab.ts` |
| Plot style / Thickness 3D / Hyperlink | ❌ Δεν υπάρχουν | — |

> **Κρίσιμη διόρθωση:** Η αρχική εντύπωση («λείπει η editable γεωμετρία») ήταν **λανθασμένη** — το panel
> Γεωμετρία υπάρχει ήδη (ADR-510 Φ4)· απλώς αυτο-αποκρύπτεται όταν δεν υπάρχει επιλεγμένη γραμμή, γι' αυτό
> δεν φαινόταν στο screenshot. Οι ιδιότητες + η γεωμετρία είναι **πλήρεις σε επίπεδο AutoCAD**.

### 1.2 Τι κάνουν οι μεγάλοι (deep web dive)

| Παίκτης | Μοντέλο named line style |
|---|---|
| **Revit** | Named **Line Styles** = subcategories της κατηγορίας «Lines», σε **ξεχωριστό dialog** (Manage ▸ Additional Settings ▸ Line Styles), **ΞΕΧΩΡΙΣΤΑ** από τα δομικά Object Styles. Κάθε style ορίζει **πάχος + χρώμα + pattern**. |
| **Figma** | Reusable named **style tokens** — ένα shared registry· το αντικείμενο «δείχνει» στο token. |
| **AutoCAD** | **ΔΕΝ** έχει named line styles — όλα ByLayer (Layer + Linetype + Lineweight) + per-object overrides + editable Geometry (Start/End/Delta/Length/Angle). Contextual ribbon = ιδιότητες **και** εντολές (Trim/Extend/Offset/Fillet/Join/**Match Properties**). |
| **BricsCAD** | Ίδιο με AutoCAD (Properties: General + Geometry editable — Length/Angle αλλάζουν τη γραμμή). |
| **ARCHICAD** | Line Types + Pens + **Line Categories** (Σχεδιαστική / Τομής / Διαχωριστική) + **βέλη** (style/height/pen/marker). |

**Συμπέρασμα (τεκμηριωμένο):** Revit + Figma **συγκλίνουν** σε **ξεχωριστό, named, reusable registry**
που ορίζει weight+color+pattern. Η Revit **ρητά** κρατά τα Line Styles **χωριστά** από τα δομικά Object
Styles. → Η σωστή, big-player-aligned λύση = **νέο `line-style-registry.ts`**, ΞΕΧΩΡΙΣΤΟ από το ADR-375.

---

## 2. Απόφαση / Decision

1. **Νέο SSoT `LineStyleRegistry`** (καθρέφτης του `DimStyleRegistry`, ADR-362) — named draft-line
   styles, **ξεχωριστό** από τα δομικά BIM Object Styles (ADR-375), όπως η Revit.
2. **ByStyle resolution** στο contextual tab: picker «Στυλ Γραμμής ▾»· επιλογή style ⇒ ByStyle
   (χρώμα/τύπος/πάχος από το style)· τα per-property πεδία γίνονται **overrides** (AutoCAD-λογική
   ByLayer→override). Σειρά προτεραιότητας: **per-object override → ByStyle → ByLayer**.
3. **Match Properties = AutoCAD paintbrush** (διάλεξε πηγή → κέρσορας «πινέλο» → κλικ σε πολλούς στόχους).
4. **Reuse** για βέλη γραμμών το υπάρχον **dimension arrowhead SSoT** (ΟΧΙ νέο).
5. **Εύρος = πλήρες**: 5 panels (Στυλ&Γενικά / Εμφάνιση / Γεωμετρία / Ενέργειες / Προχωρημένα).

---

## 3. Data Model

```ts
// src/subapps/dxf-viewer/systems/line-styles/line-style-registry.ts (νέο — mirror dim-style-registry)
export interface LineStyle {
  readonly id: string;               // deterministic slug (built-in) | generateLineStyleId() (custom, N.6)
  readonly name: string;             // user-visible (Ελληνικά)
  readonly penColor: string;         // ByStyle color
  readonly lineweight: number;       // mm (-2 = ByLayer)
  readonly pattern: LinePatternKey;  // reuse linetype-iso-catalog SSoT
  readonly category: 'drafting' | 'cut';
  readonly isBuiltIn: boolean;
}
```

- **Default κατάλογος** (Revit-style, καθαρά Ελληνικά — N.11, ΟΧΙ hardcoded στον κώδικα):
  **Λεπτή · Μεσαία · Χοντρή · Κρυφή · Κεντρική (Άξονας) · Τομής · Όψης · Πρόχειρη**.
- Built-in = deterministic slugs· custom = `generateLineStyleId()` (νέος generator στο
  `enterprise-id.service.ts`, N.6).
- `BaseEntity` δέχεται προαιρετικό `lineStyleId?: string` (ByStyle pointer)· απουσία ⇒ ByLayer/override
  (backward-compatible· Firestore `?? null`, ΠΟΤΕ explicit undefined).
- Registry pattern **ίδιο** με `DimStyleRegistry`: built-in seed + CRUD custom + `duplicateStyle` +
  `subscribe/notify` + `cachedSnapshot` (για `useSyncExternalStore`) + session singleton + test setter.

---

## 4. Ribbon δομή (τελική)

| Panel | Πεδία | Κατάσταση |
|---|---|---|
| **Στυλ & Γενικά** | `Στυλ Γραμμής ▾` (ByStyle) · Χρώμα · Επίπεδο · Διαφάνεια | Στυλ = **νέο**· υπόλοιπα ✅ |
| **Εμφάνιση** | Τύπος · Πάχος · Κλίμακα · Πλάτος | ✅ Υπάρχει |
| **Γεωμετρία** | Μήκος · Γωνία · Αρχή Χ/Υ · Τέλος Χ/Υ · ΔΧ/ΔΥ | ✅ Υπάρχει |
| **Ενέργειες** | Trim · Extend · Move · Rotate · Mirror · Scale · Join · Array *(surface)* · **Offset · Fillet · Chamfer · Αντιγραφή Ιδιοτήτων** *(νέα)* | Μικτό |
| **Προχωρημένα** | Κατηγορία (Σχεδ./Τομής) · Βέλη · Plot style · Thickness 3D · Hyperlink | **Νέα** |

---

## 5. Φάσεις υλοποίησης (τεκμηριωμένες — ΟΧΙ υλοποιημένες)

- **Φ1 — Named Style SSoT:** ✅ **ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-04** (§8). `line-style-registry.ts` (mirror `dim-style-registry.ts`) +
  `generateLineStyleId()` + picker «Στυλ Γραμμής ▾» στο `line-general` + ByStyle resolver στο
  `useEntityStyles.ts` (override → ByStyle → ByLayer) + default κατάλογος (locale keys el+en).
- **Φ2 — Ενέργειες + Match Properties:** ομάδα «Ενέργειες» στο contextual tab (surface υπαρχόντων
  command keys από `home-tab-modify.ts`) + **Match Properties** (νέο command + paintbrush tool-state +
  cursor· αντιγράφει color/linetype/lineweight/transparency/lineStyleId).
- **Φ3 — Νέες εντολές γεωμετρίας:** **Offset / Fillet / Chamfer** (νέα `*EntityCommand` + previews +
  undo/redo· αφαίρεση `comingSoon` από `home-tab-modify.ts`).
- **Φ4 — BIM κατηγορία + Βέλη + Προχωρημένα:** πεδίο Κατηγορία (drafting/cut) + Βέλη (reuse dimension
  arrowhead SSoT) + Plot style / Thickness 3D / Hyperlink.
- **ΦF — Persistence:** registry per-company (Firestore + enterprise IDs + `companyId` immutable).

> Κάθε φάση είναι δυνητικά orchestrator-scale (N.8) — εκτίμηση εκτέλεσης ανά φάση πριν την υλοποίηση.

---

## 6. SSoT / i18n / Ποιότητα (κανόνες)

- **N.11:** κάθε νέο πεδίο/εντολή/όνομα style → keys σε `src/i18n/locales/el/*.json` **ΚΑΙ** `en/*.json`
  ΠΡΙΝ τη χρήση· καμία hardcoded συμβολοσειρά, καμία `defaultValue` με κείμενο.
- **N.12:** το `line-style-registry` module → εγγραφή στο `.ssot-registry.json` + `npm run ssot:baseline`
  όταν υλοποιηθεί.
- **N.6:** `generateLineStyleId()` — ΟΧΙ `addDoc`/`crypto.randomUUID` inline.
- **N.7.1:** αρχεία ≤500 γρ., functions ≤40 γρ. — split όπου χρειάζεται.
- **Reuse-first:** linetype patterns από `linetype-iso-catalog`· βέλη από dimension arrowhead SSoT·
  modify commands από `core/commands/entity-commands/*`. **Μηδέν διπλότυπα.**

---

## 7. Εναλλακτικές που απορρίφθηκαν

- **Merge στο BIM Object Styles (ADR-375):** απορρίφθηκε — η Revit **ρητά** κρατά τα Line Styles
  ξεχωριστά· το να ανακατέψεις draft lines με δομικές κατηγορίες (τοίχος/κολόνα) είναι λιγότερο καθαρό.
- **AutoCAD-style «χωρίς named styles» (μόνο ByLayer):** απορρίφθηκε ως λιγότερο πλήρες από Revit/Figma
  — ο Giorgio ζήτησε full enterprise + full SSoT.
- **Match Properties ως απλό copy-from-selection:** απορρίφθηκε υπέρ του paintbrush (βιομηχανικό standard).

---

## 8. Changelog

- **2026-07-04 (Φ1b impl)** — **Thumbnails στο dropdown «Στυλ Γραμμής» (Revit/Figma-grade preview).** Enhancement του Φ1
  chooser (μέρος του ADR-510 Φ4g reorg — αίτημα Giorgio: το dropdown έδειχνε μόνο κείμενα). Big-player: Figma/Revit style
  pickers δείχνουν οπτικό preview (μοτίβο+πάχος+χρώμα) δίπλα στο όνομα. **FULL SSoT:** νέος builder
  `systems/line-styles/line-style-thumbnail.ts` (`buildLineStyleThumbnail`) που **κάνει reuse το `buildLinetypeThumbnail`**
  (Unified Linetype SSoT) για το dash — μηδέν δεύτερη dash math — και το εμπλουτίζει με lineweight→px stroke + penColor
  (hex, ή `null`=ByLayer → `currentColor`, theme-correct N.3). Ο `RibbonComboboxThumbnailDescriptor` (`ribbon-types.ts`)
  επεκτάθηκε με `kind:'line-style'` (pattern/lineweight/penColor)· ο `RibbonComboboxThumbnail` απέκτησε `LineStyleThumb`
  branch (mirror του `LinetypeThumb`)· το `buildLineStyleRibbonOptions` προσαρτά `thumbnail` ανά στυλ (έχει ήδη όλο το
  `LineStyle`). Render path υπήρχε ήδη (`RibbonCombobox` ζωγραφίζει `opt.thumbnail`). **Tests:** `line-style-thumbnail.test.ts`
  (7 jest ✅ — solid/dashed/color/ByLayer/lineweight clamp). tsc SKIP (N.17)· browser-verify + commit → Giorgio.
- **2026-07-04 (Φ1 impl)** — **Named Style SSoT υλοποιήθηκε.** Νέα αρχεία στο
  `systems/line-styles/`: `line-style-types.ts` (interface `LineStyle` + sentinels +
  `LinePatternKey` = catalog linetype name, reuse ADR-358), `line-style-templates.ts`
  (8 built-ins: Λεπτή/Μεσαία/Χοντρή/Κρυφή/Κεντρική/Τομής/Όψης/Πρόχειρη — ονόματα ως
  i18n keys, N.11), `line-style-registry.ts` (mirror `DimStyleRegistry`: seed + CRUD +
  `duplicateStyle` + `subscribe`/`cachedSnapshot` + session singleton + module-level
  `getLineStyleSnapshot`/`subscribeLineStyles` + `__set…ForTests`), `line-style-resolver.ts`
  (pure `resolveLineStyle`: **override → ByStyle → ByLayer**), `__tests__/…` (18 jest ✅).
  Νέος generator `generateLineStyleId()` (prefix `linestyle`, N.6, 4 σημεία enterprise-id).
  `BaseEntity.lineStyleId?` (Firestore `?? null`). Ribbon: picker «Στυλ Γραμμής ▾» στο
  `line-general` panel (`line-style-ribbon-options.ts`) + `LINE_TOOL_RIBBON_KEYS.lineStyle`
  + bridge cases στο `useRibbonLineToolBridge` (get value/options· pick ⇒ `byStylePatch`
  εφαρμόζει linetype/lineweight/color + αποθηκεύει pointer, undoable· draw-defaults ⇒
  active style + QuickStyle seed). Locale keys el+en (`quickStyle.lineStyle` +
  `lineStyleNames.*`).
  - **Απόκλιση από το σχέδιο (CODE = SOURCE OF TRUTH, N.0.1):** ο ByStyle resolver ΔΕΝ μπήκε
    στο `hooks/useEntityStyles.ts` (deprecated legacy wrapper για mode-based settings), αλλά ως
    **pure module** `line-style-resolver.ts` — πιστός καθρέφτης του `dim-style-resolver.ts`.
  - **Εκκρεμεί (πριν/κατά το commit):** (α) εγγραφή του `line-style-registry` module στο
    `.ssot-registry.json` + `npm run ssot:baseline` (N.12) — αφέθηκε στον Giorgio ώστε να μη
    διαταραχθεί το κοινό working tree άλλου agent· (β) δυναμικό render-time ByStyle
    re-resolution (κατανάλωση του resolver στο render pipeline) → επόμενη φάση.
- **2026-07-04 (proposed)** — Αρχική σύνταξη (PROPOSED). Deep web dive (AutoCAD/BricsCAD/Revit/
  ARCHICAD/Figma) + χαρτογράφηση κώδικα. Απόφαση: ξεχωριστό `LineStyleRegistry` (mirror ADR-362),
  5-panel tab, Match Properties paintbrush, reuse arrowhead SSoT. Εύρος πλήρες, 5 φάσεις.

---

## Πηγές (web)

- AutoCAD General/Properties Palette — help.autodesk.com (GUID-99AFB412 / GUID-94C065AB).
- BricsCAD Properties Bar (geometry editable) — developer.bricsys.com.
- Revit Line Styles vs Object Styles — engipedia.com/revit-line-styles, revitforum.org, help.autodesk.com (Custom Line Styles GUID-1F4FD579).
- ARCHICAD Line Tool Settings — help.graphisoft.com (AC25 Tool Settings).
