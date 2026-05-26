# ADR-376 — Opening Tags (Ταμπελάκια Ανοιγμάτων) — Revit-Faithful Pattern

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **PHASE_C3_DONE** 2026-05-26 — Phase A core + Phase B.1 Renumber Openings + Phase B.2 BOQ signature-group aggregation + Phase C.1 draggable tag + γωνιακή leader + Phase C.2 per-project Tag Style + Phase C.3 PDF Schedule Export ALL SHIPPED. ADR-376 COMPLETE. |
| **Date** | 2026-05-25 |
| **Category** | DXF Viewer — BIM / Annotation |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md` |
| **Author** | Claude Sonnet 4.6 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-040 (Preview Canvas Perf), ADR-175 (BOQ), ADR-345 (Ribbon), ADR-362 (Dimensions — pill SSoT), ADR-363 (BIM Drawing Mode — opening source), ADR-366 (3D BIM Viewer), ADR-370 (3D BIM Readonly), ADR-373 (ISO 19650 metadata) |
| **Reference standard** | **Autodesk Revit Door/Window Tag pattern** — adopted faithfully |
| **Greek convention layer** | Θ/Π prefixes (Θύρα/Παράθυρο) — i18n controlled, default = Greek |

---

## Summary

**Homogeneous instance-Mark pattern** στο Nestor DXF Viewer BIM Mode. Αποκλίνει από Revit Type-Mark-for-windows convention (Q3 decision 2026-05-25) — Giorgio mandated ίδιο σύστημα για όλα τα ανοίγματα.

- **Όλα τα ανοίγματα** (door / sliding-door / french-door / window / fixed) → **instance `Mark`** — κάθε άνοιγμα ξεχωριστό auto-incrementing ID.
- **Per-kind prefix** (Q2): `Θ` (door), `Σ` (sliding-door), `ΔΘ` (french-door), `Π` (window), `ΣΥ` (fixed).
- **Floor-prefix hundreds** (Q1): `<prefix>.<floor*100 + seq>` zero-padded σε 3 ψηφία.
- **Σχήμα**: pill (στρογγυλεμένο ορθογώνιο) ομοιόμορφα — `canvas-pill` SSoT (όπως dimension labels ADR-362). Διάκριση μέσω **χρώματος ανά kind** (reuse `KIND_STROKE`: door=πορτοκαλί, sliding=μωβ, french=κεχριμπαρένιο, window=μπλε, fixed=πετρόλ). Q4 decision.

Schedule (πίνακας κουφωμάτων) τροφοδοτείται από BOQ ADR-175, group-by `Mark` με δευτερεύον group-by signature (για να φαίνεται "50 instances of `Π.101..Π.150` με ίδιες διαστάσεις").

Annotation **2D-only**, view-specific (ΔΕΝ εμφανίζεται σε 3D view — ADR-366).

---

## 1. Context

### 1.1 Revit Pattern (faithful adoption)

| Πτυχή | Revit behavior | Nestor adoption |
|---|---|---|
| **Doors numbering** | `Mark` (instance parameter, per-element unique, auto-increment σε placement) | ✅ Adopt — `OpeningParams.mark` για όλα τα κinds (homogeneous) |
| **Windows numbering** | `Type Mark` (type parameter, ίδιο για όλους τους instances του ίδιου type, ΟΧΙ auto-increment) | ❌ REJECTED (Q3, Giorgio 2026-05-25) — windows χρησιμοποιούν instance Mark όπως οι πόρτες, για ομοιόμορφο σύστημα. Schedule group-by signature αντί για Type Mark catalog. |
| **Tag shape doors** | Oval/circle | ❌ REJECTED (Q4 Giorgio 2026-05-25) — uniform pill για όλα τα kinds, διάκριση μέσω χρώματος (reuse `KIND_STROKE`). |
| **Tag shape windows** | Hexagon | ❌ REJECTED (Q4) — uniform pill, χρώμα ανά kind. |
| **Tag content default** | Mόνο το mark (Mark ή Type Mark) — όχι WxH | ✅ Adopt — WxH μόνο σε ribbon contextual panel + Schedule |
| **Sequential placement order** | Auto-increment ως 1, 2, 3, ... κατά την σειρά placement | ✅ Adopt — με Greek prefix `Θ.01`, `Θ.02` (i18n) |
| **Delete behavior** | Δεν renumber αυτόματα. Gaps επιτρεπτά. Manual "Renumber" tool (third-party add-in IMAGINiT). | ✅ Adopt — no auto-renumber. "Renumber Openings" command available (Phase B). |
| **User override** | Mark = free string, duplicates επιτρέπονται με warning | ✅ Adopt — validator warns on duplicate Mark within same floor |
| **Tag visibility** | Tag-on-placement option + view-level toggle | ✅ Default ON σε opening tool. Layer toggle στο Layers panel. |
| **Tag position** | Auto στο centroid του opening, draggable με leader line | ✅ Phase A: auto-centroid με 2D offset normal-to-wall outward. Phase C: draggable. |
| **Size scaling** | Annotation scale (σταθερό size on print, scale-aware on screen) | ✅ Constant screen pixel size (όπως dimension pill ADR-362) μέσω `canvas-pill` SSoT |
| **3D view** | Tags ΔΕΝ εμφανίζονται σε 3D | ✅ Adopt — `OpeningTagRenderer` 2D-only, no 3D counterpart |

### 1.2 Πού διαφέρει το Nestor από το Revit (justified)

| Πτυχή | Revit | Nestor | Λόγος διαφοράς |
|---|---|---|---|
| Prefix locale | Hardcoded number (1, 2, 101A) | `Θ.01`, `Π.A` με i18n (default Greek per CLAUDE.md) | Greek-first project. `T.01`/`W.A` σε en locale. |
| Tag-on-placement default | OFF (user enables) | ON | Απλούστερο UX, λιγότερα clicks. User κάνει layer toggle αν θέλει clean view. |
| Family/Type management | Revit Families (.rfa) με Type Catalog | `OpeningTypeCatalog` Firestore collection — `width`+`height`+`kind`+`glazingPanes` signature → auto-assigned Type Mark (A, B, C, ...) | Δεν έχουμε family editor — type identity = parametric signature. |

---

## 2. Στόχοι (Goals)

| # | Στόχος | Φάση |
|---|--------|------|
| G1 | `OpeningParams.mark?: string` (instance Mark, doors family) | A |
| G2 | `OpeningTypeCatalog` registry + `typeMark` auto-assignment per type signature (windows family) | A |
| G3 | `OpeningTagRenderer` — 2D-only, circle για doors, hexagon για windows, canvas-pill SSoT | A |
| G4 | Auto-numbering on placement: doors increment instance, windows reuse existing type or create new | A |
| G5 | Ribbon contextual tab — input για Mark override (doors) / Type Mark assignment (windows) | A |
| G6 | Layer toggle (Annotations → Opening Tags) — show/hide all | A |
| G7 | Validator — duplicate Mark warning (doors) intra-floor scope | A |
| G8 | Schedule integration BOQ (ADR-175) — group-by Mark/Type Mark | B |
| G9 | Manual "Renumber Openings" command (gaps cleanup) | B |
| G10 | Draggable tag position + leader line | C |

---

## 3. Open Questions

| # | Ερώτηση | Status | Resolution |
|---|---------|--------|------------|
| Q1 | Auto-numbering format & scope | ✅ RESOLVED 2026-05-25 (v3) | **Όλα τα kinds (μετά Q3)**: instance Mark με **floor-prefix hundreds convention** (Γ.3 — industry standard, ArchiCAD default). Format `<prefix>.<floor*100 + seq>` zero-padded 3-digits. Παράδειγμα: ισόγειο `Θ.001..Θ.099`, 1ος όροφος `Θ.101..Θ.199`, 2ος `Θ.201..Θ.299`. Scope μοναδικότητας = per (project, kind, floor) auto-unique by construction. |
| Q2 | Per-kind prefix independence | ✅ RESOLVED 2026-05-25 (v3, Επιλογή Β) | **Διακριτό πρόθεμα ανά kind** (αποκλίνει Revit one-family default, ακολουθεί ελληνική πρακτική). Doors: `Θ` (door), `Σ` (sliding-door), `ΔΘ` (french-door). Windows: `Π` (window), `ΣΥ` (fixed). Per-kind independent counters — `Θ.101` και `Σ.101` συνυπάρχουν. |
| Q3 | Window numbering scheme (Type Mark vs instance Mark) | ✅ RESOLVED 2026-05-25 (v4, αναλογικό με πόρτες) | **Αποκλίνει Revit Type-Mark convention**: παράθυρα χρησιμοποιούν instance Mark όπως οι πόρτες (`Π.001, Π.002, ...` με floor prefix). Schedule (BOQ) κάνει group-by signature on-the-fly. Eliminates `OpeningTypeCatalog` collection — απλούστερη αρχιτεκτονική. |
| Q2 | Tag content | ✅ RESOLVED 2026-05-25 | Μόνο το Mark/Type Mark στο tag. WxH στο ribbon panel + Schedule. Revit default. |
| Q3 | Renumber policy on deletion | ✅ RESOLVED 2026-05-25 | No auto-renumber. Gaps OK (Revit default). Phase B: manual "Renumber Openings" command. |
| Q4 | Visibility default | ✅ RESOLVED 2026-05-25 | ON-by-default on opening tool. Layer toggle "Annotations → Opening Tags" για global hide. |
| Q5 | User override / duplicates | ✅ RESOLVED 2026-05-25 | Free-text Mark, duplicates warned (not blocked) intra-floor. Type Mark auto-assigned αλλά override-able (per type, not per instance). |
| Q6 | Tag shape | ✅ RESOLVED 2026-05-25 (v4, Επιλογή Γ) | **Uniform pill** για όλα τα kinds (`canvas-pill` SSoT, ίδιο με dimension labels ADR-362). Διάκριση μέσω **χρώματος ανά kind** — reuse `KIND_STROKE` palette (door=#c97c2f, sliding=#7c5fa1, french=#b96b2c, window=#2d72b8, fixed=#3d7a6f). |
| Q7 | Tag position | ✅ RESOLVED 2026-05-25 | Phase A: auto-centroid, offset 0.5m normal-to-wall outward (clearance). Phase C: draggable με leader line. |
| Q8 | Size scaling | ✅ RESOLVED 2026-05-25 | Constant screen pixel size (~14px text, ~24px shape) via `canvas-pill` SSoT pattern. Annotation scale-independent. |
| Q9 | 3D view | ✅ RESOLVED 2026-05-25 | NO tags σε 3D (Revit + industry standard). `OpeningTagRenderer` 2D-only. |
| Q10 | Locale (Θ/Π vs D/W) | ✅ RESOLVED 2026-05-25 | i18n via `opening.tag.prefix.door` / `opening.tag.prefix.window`. Default el: `Θ`/`Π`. en: `D`/`W`. Per-project override σε `building.settings.openingTagPrefix`. |

---

## 4. Decisions

### 4.1 Homogeneous per-kind prefix numbering (Greek convention — Q2 + Q3 decisions)

**Giorgio decisions 2026-05-25**:
- Q2: Διακριτό πρόθεμα ανά `OpeningKind` (Επιλογή Β) — αποκλίνει Revit one-family default.
- Q3: Παράθυρα ίδιο pattern με πόρτες (instance Mark + floor-prefix hundreds) — αποκλίνει Revit Type-Mark-for-windows convention.

```
All opening kinds (instance Mark, floor-prefix hundreds)
├── door         → Θ   (Θύρα)
├── sliding-door → Σ   (Συρόμενη)
├── french-door  → ΔΘ  (Δίφυλλη Θύρα / Μπαλκονόπορτα)
├── window       → Π   (Παράθυρο)
└── fixed        → ΣΥ  (Σταθερός Υαλοπίνακας)
```

**Per-kind independence**: κάθε prefix έχει δικό του μετρητή ανά όροφο. Παράδειγμα 1ος όροφος:
- `Θ.101, Θ.102, Θ.103` (κανονικές πόρτες)
- `Σ.101, Σ.102` (συρόμενες)
- `ΔΘ.101` (μπαλκονόπορτα)
- `Π.101, Π.102, Π.103, Π.104` (παράθυρα — κάθε ένα ξεχωριστό ID)
- `ΣΥ.101` (σταθερός υαλοπίνακας)

**Όλα τα openings** (instance Mark, per-kind prefix):
- Κάθε instance έχει μοναδικό `mark` με **floor-prefix hundreds convention** (Γ.3) **ανά prefix**.
- Format για standard floors (`FloorDocument.number ≥ 0`):
  `<kindPrefix>.<number*100 + seq>` zero-padded σε 3 ψηφία.
  - Ισόγειο (number=0): `Θ.001..Θ.099`, `Σ.001..`, `ΔΘ.001..`
  - 1ος όροφος (number=1): `Θ.101..Θ.199`, `Σ.101..`, `ΔΘ.101..`
  - 2ος όροφος (number=2): `Θ.201..`, ...
- Format για υπόγεια (`FloorDocument.number < 0`):
  `<kindPrefix>.<basementPrefix><|number|>.<seq>` zero-padded σε 3 ψηφία.
  - Υπόγειο -1: `Θ.Υ1.001..Θ.Υ1.099` (el) / `D.B1.001..D.B1.099` (en)
  - Υπόγειο -2: `Θ.Υ2.001..Θ.Υ2.099`
- Per-kind independent counters — `Θ.101` και `Σ.101` συνυπάρχουν.
- Auto-increment κατά placement order, sequence reset ανά (floor, kind).
- Floor identification: από `OpeningDoc.floorId` → lookup `floors/{floorId}.number`
  (signed integer, ADR-369). Field renamed από `levelIndex` (μη υπαρκτό) σε
  `number` 2026-05-25 (Phase A implementation discovery).
- Basement prefix: i18n key `opening.tag.basementPrefix` — `Υ` (el) / `B` (en).
- User editable, duplicates warned not blocked (αλλά cross-prefix duplicates επιτρεπτά by design).
- Overflow handling: αν seq > 99 σε ένα (floor, kind) → expand σε 4-digit (`Θ.1100`, ...) με warning.

**Windows** (instance Mark — Q3 Giorgio decision, αποκλίνει Revit Type-Mark convention):
- Ίδιο pattern όπως οι πόρτες: instance Mark με floor-prefix hundreds.
- Per-kind prefix counters: `Π.001..Π.099`, `Π.101..`, ... (windows). `ΣΥ.001..` (fixed).
- Κάθε παράθυρο = ξεχωριστό ID, ακόμα και αν 50 παράθυρα έχουν ίδιες διαστάσεις.
- Schedule (BOQ) κάνει visual grouping by signature αυτόματα — π.χ. "Π.101..Π.150 (50 τμχ, 1200×1400)".

**Windows family** (Family B):
- Νέα Firestore collection `opening_type_catalog`.
- Type signature = `(kind, width, height, glazingPanes, sillHeight)`.
- Auto-Type-Mark σε νέο type: `Π.A`, `Π.B`, ..., `Π.Z`, `Π.AA`, `Π.AB`, ...
- Όλοι οι instances του ίδιου type μοιράζονται το Type Mark.
- Edit Type Mark → update όλους τους instances του type.

### 4.2 ~~OpeningTypeCatalog~~ — REJECTED (Q3 Giorgio 2026-05-25)

Δεν χρειάζεται type catalog collection. Κάθε opening έχει δικό του instance Mark. Schedule (BOQ) κάνει group-by signature on-the-fly για visual aggregation.

Αυτό απλοποιεί σημαντικά την αρχιτεκτονική:
- ΟΧΙ νέα Firestore collection
- ΟΧΙ νέο id-prefix `opt_`
- ΟΧΙ type signature resolution service
- ΟΧΙ Type Mark allocation logic
- ΟΧΙ re-resolution σε edit (αν user αλλάξει διαστάσεις, ο Mark παραμένει — απλώς αλλάζουν τα fields)

### 4.3 OpeningParams extension

```typescript
// opening-types.ts (extension)
export interface OpeningParams {
  // ...existing fields (kind, wallId, offsetFromStart, width, height, sillHeight, etc.)...

  /**
   * Instance Mark — applicable σε ΟΛΑ τα opening kinds (Q3 homogeneous decision).
   * Auto-generated σε placement με per-kind prefix + floor-prefix hundreds
   * (e.g. 'Θ.101', 'Π.001', 'ΣΥ.205'). User override-able.
   */
  readonly mark?: string;

  /** Tag visibility override (undefined → layer default). */
  readonly tagVisible?: boolean;

  /** Tag position offset σε mm από auto-centroid (undefined → auto). Phase C feature. */
  readonly tagOffset?: { readonly dx: number; readonly dy: number };
}
```

### 4.4 OpeningTagRenderer (νέο component)

```typescript
// src/subapps/dxf-viewer/bim/renderers/OpeningTagRenderer.ts
export class OpeningTagRenderer extends BaseEntityRenderer {
  render(entity: OpeningEntity, options: RenderOptions): void {
    if (!this.shouldRenderTag(entity, options)) return;

    const mark = entity.params.mark; // homogeneous instance Mark
    if (!mark) return;

    const center = this.computeTagCenter(entity); // auto-centroid + offset
    const color = KIND_STROKE[entity.kind];        // SSoT — reuse opening stroke palette
    this.drawPillTag(center, mark, color);          // canvas-pill SSoT
  }
}
```

ADR-040 compliant — pure renderer, ZERO subscriptions, μέσω `canvas-pill` SSoT.

### 4.5 Auto-numbering service

```typescript
// src/subapps/dxf-viewer/bim/services/opening-mark-service.ts
export interface OpeningMarkService {
  /**
   * Next instance Mark για συγκεκριμένο (project, floor, kind).
   * Format: `<prefix>.<floor*100 + seq>` zero-padded 3 ψηφία.
   * Παράδειγμα: floor=1, kind='window' → 'Π.101', 'Π.102', ...
   */
  allocateMark(
    projectId: string,
    floorId: string,
    kind: OpeningKind,
  ): Promise<string>;
}
```

Atomicity: Firestore transaction για allocation (avoid race).
Implementation: query existing openings στο (project, floor, kind), find max seq, increment.

### 4.6 Ribbon contextual tab additions (ADR-345 integration)

| Field | All opening kinds (homogeneous) |
|---|---|
| **Mark** | Editable text input (instance), per-kind prefix auto-suggested |
| **Tag visibility** | Toggle checkbox (instance override) |
| **Renumber All** (Phase B) | Button → command, regenerates Mark per (floor, kind) prefix |

### 4.7 Layer integration (ADR-358 layer mgmt)

Νέο reserved layer `__system_opening_tags__`:
- Type: `annotation`
- Default visibility: ON
- Toggle hides ALL opening tags globally.
- Per-opening `tagVisible: false` overrides.

**UI surface (Phase A polish, 2026-05-25)**: `AnnotationsSection` component (`src/subapps/dxf-viewer/ui/components/AnnotationsSection.tsx`) rendered ως ξεχωριστή section μέσα στο `LevelPanel` κάτω από το `LayersSection`. Περιέχει `Switch` (variant=`status`) που καλεί `setOpeningTagLayerVisible()` και διαβάζει state μέσω `useOpeningTagLayerVisible()` (`useSyncExternalStore` SSoT binding). i18n keys: `dxf-viewer-panels.panels.annotations.{title,openingTags.{label,description,toggleAria}}` (el+en).

### 4.8 Validation rules

1. **Duplicate Mark intra-(floor, kind)**: warning, not blocked.
2. **Cross-kind duplicate** (π.χ. `Θ.101` και `Σ.101` συνυπάρχουν): επιτρεπτό by design — διαφορετικό prefix.
3. **Cross-floor duplicate**: αδύνατο by construction — floor*100 πρόθεμα εξασφαλίζει uniqueness.

---

## 5. Data Model (final)

### 5.1 OpeningParams (extension)

Βλ. §4.3. Νέα optional fields: `mark`, `tagVisible`, `tagOffset` (Phase C). Homogeneous σε όλα τα kinds.

### 5.2 ~~New Firestore collection~~

Δεν χρειάζεται (βλ. §4.2). Q3 decision εξάλειψε την ανάγκη για type catalog.

### 5.3 i18n keys

```json
// el/dxf-viewer.json
{
  "opening": {
    "tag": {
      "prefix": {
        "door": "Θ",
        "sliding-door": "Σ",
        "french-door": "ΔΘ",
        "window": "Π",
        "fixed": "ΣΥ"
      },
      "basementPrefix": "Υ",
      "tagVisible": "Εμφάνιση Ταμπελάκι",
      "duplicateWarning": "Το Mark υπάρχει ήδη σε άλλο άνοιγμα του ορόφου.",
      "markLabel": "Mark",
      "layerName": "Ταμπελάκια Ανοιγμάτων"
    }
  }
}
```

```json
// en/dxf-viewer.json
{
  "opening": {
    "tag": {
      "prefix": {
        "door": "D",
        "sliding-door": "SD",
        "french-door": "FD",
        "window": "W",
        "fixed": "FX"
      },
      ...
    }
  }
}
```

---

## 6. Rendering Pipeline

```
DxfRenderer (existing)
├── OpeningRenderer (existing — outline + swing + leaf line)
└── OpeningTagRenderer (NEW)
    ├── shouldRenderTag()  → layer visibility + per-opening tagVisible + zoom threshold
    ├── computeTagCenter() → centroid + normal-to-wall offset
    └── drawPillTag()      → uniform pill via canvas-pill SSoT, color from KIND_STROKE[opening.kind]
```

Render order: tags AFTER opening geometry (z-order top — annotation layer above entities).

Zoom threshold: tag visible μόνο σε zoom ≥ `OPENING_TAG_MIN_ZOOM` (e.g. 0.5x) — avoid clutter σε wide views.

---

## 7. Phases

| Φάση | Περιεχόμενο | Εξάρτηση | Εκτίμηση | Status |
|---|---|---|---|---|
| **A** (core) | `mark` field, `OpeningMarkService` (per floor+kind allocator), `OpeningTagRenderer`, auto-numbering on placement, ribbon inputs, layer toggle, validator, i18n keys (5 prefixes el+en), 2D-only enforcement | All Q1-Q10 resolved | **~6-10h** | ✅ DONE 2026-05-25 |
| **B.1** (renumber) | Manual "Renumber Openings" command + ICommand undo + Dialog modal (scope + kind filter + manual-include toggle) + `markIsManual` tracking on ribbon Mark edits + Annotate ribbon tab global button + contextual quick-action | Phase A | **~3-4h** | ✅ DONE 2026-05-25 |
| **B.2** (BOQ schedule) | BOQ integration (ADR-175): **single aggregated row per signature group** (Mode C — `kind + width + height + sillHeight + openDirection`). Revit Schedule pattern, 6/6 industry convergence (Revit / ArchiCAD / Tekla / Allplan / Bentley / Vectorworks). Scope = **per-floorplan** (matches `OpeningFirestoreService` subscribe scope). 50 ίδια παράθυρα = 1 row με `quantity=50`, marks compacted στο `description` (`Marks: Π.101..Π.150`). **Diverges from multi-layer wall pattern** (Phase 6.1) — openings are atomic, no multi-component layers. | Phase A | **~3-4h** | ✅ DONE 2026-05-26 |
| **C.1** (draggable tag + leader) | Draggable tag position via pointer drag (FSM controller + React hook) με leader line από opening centroid → tag (Revit 2027 + ArchiCAD γωνιακή/elbow pattern). `tagOffset` field (already reserved σε `OpeningParams`) ενεργοποιείται. "Reset Tag Position" command (ribbon contextual + right-click on tag). Auto-leader visibility (hide όταν tag close to anchor). Tag rotation = always horizontal (Q2 industry default 3/3). ADR-040 compliant — pure FSM + leaf-only DOM listeners + RAF-throttled scene patches. | Phase B | **~3-5h** | ✅ DONE 2026-05-26 |
| **C.2** (per-project styling) | Custom tag styling override per project — 6 fields (fontSizePx 7-16, borderWidthPx 0-3, leaderStyle solid/dashed/dotted, pillBgColor, leaderColor, leaderVisible). Persistence: `Project.openingTagStyle?: OpeningTagStyle \| null` (Firestore project doc, 3/3 industry convergence — Revit shared parameters, ArchiCAD .PRF favorites, AutoCAD DIMSTYLE dict). Ribbon Annotate → "Tag Style" button (Palette icon). Modal dialog (Radix) με 6 controls + Reset Defaults. Debounced 200 ms live preview (Figma/Photoshop pattern). | Phase C.1 | **~2-3h** | ✅ DONE 2026-05-26 |
| **C.3** (PDF schedule export) | Standalone PDF export opening schedule — combined 1-PDF με 2 sections (Πίνακας Θυρών + Πίνακας Παραθύρων). jsPDF + jspdf-autotable A4 landscape, mirrors ADR-363 Phase 8 pdf-exporter SSoT. Mark column added to door + window presets (industry standard — Revit/ArchiCAD). Ribbon "Πίνακας PDF" button (ANNOTATE_OPENINGS_PANEL 3rd button, `FileDown` icon). EventBus `bim:opening-schedule-pdf-requested`. `OpeningSchedulePdfHost` headless Suspense leaf. `opening-schedule-pdf-exporter.ts` pure module. 6 new tests PASS. | Phase B.2 | **~2h** | ✅ DONE 2026-05-26 |

**Total Phase A+B.1+B.2 = ~12-18h** — all shipped.
**Total Phase C (split σε 3 sub-phases) = ~7-11h** — ξεχωριστή session ανά sub-phase (Giorgio 2026-05-26 scope decision: split — manageable 2h-window sessions, χαμηλότερο risk per commit, ADR docs καθαρά μεταξύ subphases).

### 4.10 Draggable tag + γωνιακή leader (Phase C.1)

**Industry convergence (web research 2026-05-26)**:
- **Leader geometry (Q1)** → **γωνιακή / elbow**. Revit 2027 + ArchiCAD plan default. Revit 2026 = straight; we adopt the 2027 pattern as forward-looking. Single 90° break point — split-horizontal-first for `|Δx| ≥ |Δy|`, split-vertical-first otherwise.
- **Tag rotation (Q2)** → **πάντα horizontal**. 3/3 convergence (Revit horizontal default + ArchiCAD + AutoCAD). "Rotate with Component" Revit option remains *out of scope* — adds UX complexity without measurable benefit για architectural plan annotation.
- **Reset position (Q4)** → **και τα δύο** UX paths (ribbon button **και** right-click). Vectorworks-style power-user redundancy.

**Three-layer architecture** (ADR-040 compliant — pure FSM + leaf hook + leaf renderer):

```
                              ┌─────────────────────────────────────┐
                              │ OpeningTagDragController (pure FSM) │
                              │ idle ↔ dragging                      │
                              │ - hitTestTag(openings, transform)   │
                              │ - screenDeltaToWorldDelta(...)      │
                              │ - tagWorldCenter(opening)           │
                              └─────────────┬───────────────────────┘
                                            │
                ┌───────────────────────────┴──────────────────────────┐
                │                                                       │
   ┌────────────▼──────────────┐                       ┌────────────────▼──────────┐
   │ use-opening-tag-drag-     │                       │ OpeningTagRenderer.render │
   │ interaction (React hook)  │                       │ - computeTagCenter        │
   │ - pointerdown/move/up     │                       │ - +tagOffset                │
   │ - setPointerCapture       │                       │ - drawLeaderLine (elbow)    │
   │ - RAF coalescing          │                       │ - drawPillTag (horizontal) │
   │ - right-click → reset     │                       └───────────────────────────┘
   │ - UpdateOpeningParamsCmd  │
   └───────────────────────────┘
```

**`tagOffset` semantics** (already reserved σε `OpeningParams.tagOffset`):
- World-mm delta από το auto-centroid (Phase A normal-to-wall outward).
- `undefined` → tag at auto-centroid (no leader drawn).
- `{dx, dy}` → tag at `auto-centroid + (dx, dy)`; leader drawn όταν screen-distance ≥ `LEADER_MIN_DISTANCE_PX` (18 px).
- Pan/zoom invariant — world coordinates, not screen pixels.

**Persistence**:
- Drag-end → `UpdateOpeningParamsCommand` (existing entity command, undoable, auto-save δευτερόλεπτο 500 ms via `useOpeningPersistence` dirty-set).
- Reset (ribbon + right-click) → `UpdateOpeningParamsCommand` με `tagOffset` field stripped (Firestore-friendly — `undefined` field omitted from payload).

**ADR-040 compliance**:
- `OpeningTagDragController` pure module — ZERO React, ZERO Zustand subscriptions.
- React hook mounted only inside `canvas-layer-stack-leaves.tsx` `PreviewCanvasMounts` leaf (μη orchestrator).
- DOM listeners with `setPointerCapture` so the gesture survives cursor leaving the canvas.
- Scene patches during drag throttled via `requestAnimationFrame` — at most one `setLevelScene` call per frame.
- `pointerdown` με `capture: true` ώστε ο tag drag να προπολλαπλασιάζεται έναντι του canvas selection click handler.

**Right-click semantics**:
- Right-click στο tag pill → immediate Reset Position (no menu). Power-user shortcut, redundant with ribbon for discoverability.
- `contextmenu` event suppressed when cursor over a tag pill (καμία browser menu για να μην μπλοκάρει το reset workflow).
- Right-click εκτός tag → propagates κανονικά στο standard canvas context-menu path.

### 4.11 Per-Project Tag Styling Override (Phase C.2)

**Industry convergence (web research 2026-05-26)**:
- **Storage scope (Q1)** → **per-project**. 3/3 convergence: Revit shared parameters (project-scope), ArchiCAD `.PRF` favourites (project file), AutoCAD `DIMSTYLE` (drawing dictionary). Settings travel με το αρχείο, override-able ανά project, χωρίς cross-project bleed.
- **Customisable fields (Q2)** → **όλα τα 6 fields**: `fontSizePx` (7-16, default 9), `borderWidthPx` (0-3, default 1), `leaderStyle` ('solid'|'dashed'|'dotted', default 'solid'), `pillBgColor` (default `rgba(255,255,255,0.88)` από canvas-pill SSoT), `leaderColor` (default `#7a8696`), `leaderVisible` (default `true`).
- **UI surface (Q3)** → **modal dialog** από Annotate ribbon tab → "Tag Style" button (Palette icon). Discoverable next to Renumber Openings.
- **Live preview (Q4)** → **debounced 200 ms** (Figma/Photoshop default). Optimistic state update + canvas re-render fire-and-forget; Firestore write batched in single PATCH per burst.

**Three-layer architecture** (ADR-040 compliant — pure service + leaf host + leaf renderer):

```
                      ┌────────────────────────────────────────────┐
                      │ OpeningTagStyleService (singleton, pure)   │
                      │ - getCurrentStyle(): ResolvedOpeningTagStyle│
                      │ - hydrate(projectId, { openingTagStyle })  │
                      │ - mutateStyle(patch) → debounced 200 ms     │
                      │ - subscribe(listener) → unsubscribe         │
                      │ - setPersister(fn) (DI for testability)     │
                      └─────────────┬───────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────────────┐
            │                                                        │
   ┌────────▼──────────────────┐                ┌────────────────────▼────────────────┐
   │ OpeningTagStyleHost       │                │ OpeningTagRenderer.render            │
   │ - getDoc → hydrate         │                │ - getCurrentOpeningTagStyle() sync  │
   │ - setPersister(updateProj) │                │ - drawPillTag(... , style)           │
   │ - EventBus listener → open │                │ - drawLeaderLine(... , style)        │
   │ - Mounts Dialog            │                └─────────────────────────────────────┘
   └────────┬──────────────────┘
            │
   ┌────────▼──────────────────────────┐
   │ OpeningTagStyleDialog (Radix)     │
   │ - 6 controls (sliders + select +  │
   │   color inputs + Switch)          │
   │ - service.mutateStyle on change   │
   │ - Reset Defaults button → reset() │
   └───────────────────────────────────┘
```

**Persisted shape** — every field optional, undefined stripped on Firestore write:

```typescript
interface OpeningTagStyle {
  readonly fontSizePx?: number;       // clamped [7,16]
  readonly borderWidthPx?: number;    // clamped [0,3]
  readonly leaderStyle?: 'solid' | 'dashed' | 'dotted';
  readonly pillBgColor?: string;      // hex or rgba()
  readonly leaderColor?: string;      // hex
  readonly leaderVisible?: boolean;
}
```

Lives στο `Project.openingTagStyle?: OpeningTagStyle | null` (`src/types/project.ts`). `null` = explicit reset (no overrides, fall back to defaults).

**Resolution semantics**:
- Render path always calls `getCurrentOpeningTagStyle()` → returns a fully-resolved style (every field defined, defaults filled).
- Invalid / out-of-range values silently clamp to range or fall back to default (`resolveOpeningTagStyle()` never throws — corrupted Firestore docs stay renderable).
- Border colour ΔΕΝ είναι customisable — παραμένει `OPENING_KIND_STROKE[kind]` (kind discrimination locked). Μόνο `borderWidthPx` ελέγχεται (`0` → skip stroke entirely).

**ADR-040 compliance**:
- Service is pure (no React, no Zustand). Renderer reads μέσω sync `getCurrentOpeningTagStyle()` — ίδιο pattern με `useDrawingScaleStore.getState()` που ήδη χρησιμοποιεί ο `OpeningRenderer`.
- ZERO `useSyncExternalStore` στον renderer.
- Bitmap cache key ΔΕΝ συμπεριλαμβάνει style values — style change είναι rare event; subscribers (η canvas leaf re-renderer) τραβάνε γενικό RAF redraw όταν εκδίδεται.
- Host mount γίνεται σε `DxfViewerContent` shell (lazy Suspense leaf), όχι σε high-frequency orchestrator. Firestore I/O bounded: 1 `getDoc` ανά projectId change + max 1 write per 200 ms burst.
- `canvas-pill.ts` constants ΠΑΡΑΜΕΝΟΥΝ shared SSoT για column-dim-labels + grip-annotation. Overrides περνάνε ως args ΜΟΝΟ στα helpers του OpeningTagRenderer.

**Validation** — handled in pure `resolveOpeningTagStyle()` helper:

| Field | Validation |
|---|---|
| `fontSizePx` | Number.isFinite + clamp [7, 16] |
| `borderWidthPx` | Number.isFinite + clamp [0, 3] |
| `leaderStyle` | must be one of `'solid'`, `'dashed'`, `'dotted'` (else default) |
| `pillBgColor` / `leaderColor` | non-empty string (else default) |
| `leaderVisible` | strict `typeof === 'boolean'` (else default `true`) |

**Persistence path**:
- `OpeningTagStyleHost.setPersister(async (projectId, style) => updateProjectWithPolicy({ projectId, updates: { openingTagStyle: style } }))`.
- `updateProjectWithPolicy` delegates στο existing `updateProjectClient` → standard tenant-isolated write path (no new Firestore rule needed; covered by `projects/{id}` collection rule).
- `service.reset()` writes `{}` (empty object) — Firestore merges as cleared overrides; effective style = defaults from canvas-pill SSoT.

### 4.9 Manual mark override tracking (Phase B.1)

To honor industry-standard "preserve manual edits" semantics during a renumber pass (5/5 convergence — IMAGINiT Door Mark Update, ArchiCAD Element ID Manager, Tekla locked marks, Bentley AECOsim, Vectorworks), the `OpeningParams` schema gains:

```typescript
readonly markIsManual?: boolean;
```

**Semantics**:
- Undefined / false → mark is auto-allocated. Eligible for renumber.
- true → user typed the Mark via the ribbon. Skipped by default in renumber.

**Set points**:
- `useRibbonOpeningBridge.onComboboxChange` for `commandKey === 'opening.params.mark'` upgrades the next params patch με `markIsManual: true`.
- Auto-allocator (`useOpeningPersistence.allocateAndPersistOpening`) never sets it true.
- `RenumberOpeningsCommand.execute()` resets it to `false` on its in-scope rows so subsequent renumbers stay automatic.

**Modal opt-out**: The "Επανεκκίνηση και των χειροκίνητων αλλαγών" checkbox (default unchecked) flips the renumber filter to `includeManual=true` — wipes manual overrides for the active scope.

---

## 8. Out-of-scope

- Tags σε 3D view (Revit + industry standard — annotation = 2D only).
- Tags σε άλλα BIM entities (walls/slabs/columns/beams). Future ADRs αν χρειαστεί.
- Schedule full PDF export (separate ADR — ήδη μέσω BOQ ADR-175 + Phase C export).
- Section/elevation tags (no section view στο DXF Viewer ακόμη).
- Revit-family editor (no `.rfa` import — Type Catalog auto-derived από parametric signature).
- Tag rotation με opening orientation (Revit όριο επίσης — auto-orientation horizontal default).
- **Blank-canvas mark allocation** (Giorgio decision 2026-05-25, Option D): όταν user σχεδιάζει opening σε άδειο canvas χωρίς wizard / floorId context, ο allocator skip-άρει σιωπηλά (console.warn, `mark = undefined`, opening persists κανονικά). Το mark μπαίνει αργότερα είτε μέσω migration script (`npm run bim:migrate:opening-tags`) όταν αργότερα ο user συνδέσει floor, είτε manually μέσω ribbon Mark field. **Rationale**: blank-canvas placement είναι exploratory/sketch mode — προσπαθούσαμε να επιβάλλουμε proper context έχει UX cost (modal popup ή disabled tool) που υπερβαίνει το όφελος για production scenarios όπου wizard είναι default flow. Defer ή reconsider μόνο αν εμφανιστεί real-world friction.

---

## 9. ADR-040 compliance

- `OpeningTagRenderer` pure class, ZERO `useSyncExternalStore`.
- Type catalog cache: in-memory Map, hydrated από `firestoreQueryService.subscribe` με equality guard (ADR-361).
- Tag rendering μέρος του existing entity render pass — δεν προσθέτει νέο RAF cycle.
- Bitmap cache key: ΔΕΝ συμπεριλαμβάνει mark/typeMark — αλλαγή mark = full re-render του entity (rare event, acceptable).

---

## 10. Migration / Backwards compatibility

- Existing openings WITHOUT `mark`: on first render, **lazy-allocate** instance Mark via `OpeningMarkService.allocateMark(projectId, floorId, kind)`.
- One-shot migration script: `npm run bim:migrate:opening-tags` — walks all openings per project, allocates Marks, persists.
- Rollout flag: `feature.opening_tags` (default ON για new projects, OFF για legacy αν χρειαστεί gradual).

---

## 11. Changelog

- **2026-05-25** — Initial DRAFT (v1). 10 open questions.
- **2026-05-25** (later) — **v2 FULL ENTERPRISE**: Giorgio mandated faithful Revit pattern adoption. All Q1-Q10 resolved per Revit convention. Two-family (instance Mark for doors, Type Mark for windows) architecture locked. `OpeningTypeCatalog` collection introduced. Implementation ready pending Giorgio approval.
- **2026-05-25** (v3) — Renamed ADR-375 → **ADR-376** (collision with ADR-375 line-weight-semantic-system). Q1 refined: doors Mark scope = **floor-prefix hundreds convention** (Γ.3 — Revit best practice + ArchiCAD default). Format `Θ.001/Θ.101/Θ.201` reset per floor. Q1b open για window Type Mark format (alphabetic vs numeric).
- **2026-05-25** (v3, later) — Q2 resolved (Επιλογή Β): **per-kind prefix independence** — αποκλίνει Revit one-family default. Doors: Θ/Σ/ΔΘ, Windows: Π/ΣΥ. Independent counters per kind. i18n keys per kind, en fallback D/SD/FD/W/FX.
- **2026-05-25** (v4) — **MAJOR SIMPLIFICATION**: Q3 resolved αναλογικό-με-πόρτες (Giorgio mandate). Windows αποκτούν instance Mark (όχι Type Mark). `OpeningTypeCatalog` collection ΔΙΑΓΡΑΦΗΚΕ. `typeId` field ΔΙΑΓΡΑΦΗΚΕ. Schedule group-by signature on-the-fly. Phase A εκτίμηση 12-16h → 6-10h (~30% reduction). Αποκλίνει από Revit faithfulness αλλά πιο consistent UX.
- **2026-05-25** (v4, later) — Q4 resolved (Επιλογή Γ): **uniform pill** για όλα τα kinds, διάκριση μέσω χρώματος ανά kind (reuse `KIND_STROKE` palette). Αποκλίνει Revit shape convention (circle/hexagon). Locked defaults για residual decisions: Q5 position=auto-centroid (Phase A) draggable=Phase C, Q7 visibility default=ON, Q8 prefix override per-project=YES (settings field `building.settings.openingTagPrefixOverride`), zoom threshold=0.5x.
- **2026-05-25** (v5 — PHASE_A_DONE) — **Phase A implementation complete**. Two clarifications resolved πριν το coding:
  - Global toggle: Layers panel reserved layer `__system_opening_tags__` (SSoT module `systems/layers/opening-tag-layer.ts`, default ON).
  - Floor field rename: `levelIndex` → `FloorDocument.number` (signed integer per ADR-369). Negative floors → prefix `Υ` (el) / `B` (en) — π.χ. υπόγειο -1 → `Θ.Υ1.001`.
  - Files delivered: `opening-mark-service.ts` (allocator, companyId-scoped query CHECK 3.10), `OpeningTagRenderer.ts` (standalone helper, canvas-pill SSoT), `opening-kind-style.ts` (Boy Scout extraction από `OpeningRenderer:41`), `opening-tag-layer.ts` (layer SSoT + React binding), `scripts/bim/migrate-opening-tags.ts` (one-shot lazy backfill).
  - Modified: `opening-types.ts` (+mark/tagVisible/tagOffset optional fields), `OpeningRenderer.ts` (KIND_STROKE import + tag render call), `useOpeningPersistence.ts` (allocateAndPersistOpening — proactive mark assignment on `drawing:entity-created` με optimistic scene patch), `opening-command-keys.ts` + `contextual-opening-tab.ts` + `useRibbonOpeningBridge.ts` (Mark ribbon field), `dxf-viewer{,-shell}.json` el+en (i18n keys), `package.json` (npm script).
  - Tests: 24 unit assertions (15 για `opening-mark-service.ts`, 9 για `OpeningTagRenderer.ts`).
  - Pending Phase B: blank-canvas non-wizard placement mark allocation (added στο `.claude-rules/pending-ratchet-work.md`).
- **2026-05-25** (v5.1 — Phase A polish) — Layers panel UI toggle: new `AnnotationsSection.tsx` component wired στο `LevelPanel` ως ξεχωριστή section κάτω από το `LayersSection`. `Switch` (variant=`status`) εναλλάσσει global εμφάνιση opening tags μέσω SSoT setters. i18n keys προστέθηκαν σε `dxf-viewer-panels.{el,en}.json`. +9 SSoT unit tests (`__tests__/opening-tag-layer.test.ts`). `.ssot-registry.json` νέο entry `opening-tag-layer` (Tier 3, forbids inline `__system_opening_tags__` literal εκτός SSoT). Πλέον ο user μπορεί να ενεργοποιεί/απενεργοποιεί τα tags χωρίς console. Pending Phase A items closed: 1 (Layers panel UI button DONE), 1 left (manual smoke test με αληθινό DXF — requires browser session).
- **2026-05-25** (v5.2 — Phase A bug fix) — Cross-floor allocator filter fix στο `opening-mark-service.ts:parseMarkSeq`. Pre-existing bug από original Phase A commit `8ecc7b1a`: standard-floor branch δεχόταν seq ∈ [1, 9999] χωρίς per-floor band check → allocator τραβούσε cross-floor max+1 (π.χ. floor=0 με existing `Θ.205` έδινε `Θ.206` αντί `Θ.002`). Fix: seq cap reduced σε [1, 99] per ADR-376 §4.1 floor-prefix hundreds convention (`Θ.001..Θ.099` ground, `Θ.101..Θ.199` first floor κλπ). Test suite green: 20/20 PASS (previously 19/20).
- **2026-05-25** (v5.3 — Blank-canvas decision) — Giorgio resolved pending open question (Option D — defer): silent skip στο blank-canvas / non-wizard placement παραμένει final design. §8 Out-of-scope τεκμηρίωσε την απόφαση + rationale. Pending-ratchet entry «blank-canvas non-wizard placement» CLOSED. Zero code change required.
- **2026-05-26** (v7 — PHASE_B2_DONE) — **Phase B.2 implementation complete** (BOQ signature-group aggregation, Revit Schedule pattern). **Drift fix**: §7 B.2 row originally said "mirroring multi-layer wall pattern" — corrected to **single aggregated row per signature group** (6/6 industry convergence: Revit Door/Window Schedule, ArchiCAD Interactive Schedule, Tekla Component Schedule, Allplan Quantity Takeoff, Bentley AECOsim Component Lists, Vectorworks Worksheets — ALL aggregate by type, never per-instance). Walls Phase 6.1 mirror does not apply because openings are **atomic** (no multi-component layers); 50 ίδια παράθυρα = 1 BOQ row με `quantity=50`, όχι 50 ξεχωριστές γραμμές. Cost-reality alignment: εργολάβος αγοράζει "50 τμχ τύπου Α" = 1 PO + 1 invoice line + 1 contract line.
  - **Scope decision**: per-floorplan aggregation (matches `OpeningFirestoreService.subscribeOpenings` scope + reuses existing composite index on `(companyId, projectId, floorplanId)`). Multi-floorplan building aggregation deferred — BOQ panel can sum visually if needed.
  - **NEW files** (2): `bim/services/opening-boq-grouper.ts` (pure SSoT — `computeOpeningSignature` + `signatureKey` + `signatureGroupBoqId` + `compactMarkRange` Revit-style range collapsing + `groupBySignature` bucket + `buildOpeningGroupPayload` BOQItem factory με enriched title `Κούφωμα παραθύρου (BIM) — 1200×1400 (sill 900)` + description `Marks: Π.101..Π.150`), `bim/services/__tests__/opening-boq-grouper.test.ts` (29 assertions: signature stability 5 + group ID 2 + mark range 9 + group aggregation 4 + payload building 9). Zero Firestore I/O στο grouper — bridge consumer owns fetch+write.
  - **NEW file (post-split, Google SRP N.7.1)**: `bim/services/opening-boq-sync.ts` (192 lines — extracted από BimToBoqBridge ως ξεχωριστό module επειδή ο bridge ξεπέρασε το 500-line cap, 572→401). Owns το opening signature-group lifecycle: exported `upsertOpeningGroupForOpening(opening, prevParams, context)` (old+new signature dual recompute) + `deleteOpeningFromGroup(deletedParams, context)` (post-delete recompute) · internal `recomputeSignatureGroup` (detach guard + delete-when-empty + createdAt preservation) + `fetchOpeningsForSignature` (`(companyId, projectId, floorplanId, kind)` Firestore query + JS-side signature filter για width/height/sillHeight/openDirection). Bridge keeps wall/slab/column/beam focus.
  - **MODIFIED files** (2): `bim/services/BimToBoqBridge.ts` (401 lines· legacy `upsertBoqItemForBim('opening', …)` warns + skips για να μην δημιουργηθούν legacy `boq_bim_<openingId>` rows από out-of-date callers · +`floorplanId` optional στο `BimBoqContext` παραμένει για back-compat shape· opening methods extracted στο `opening-boq-sync.ts`), `hooks/data/useOpeningPersistence.ts` (persist callback captures `prevParams` από `lastSavedParamsRef` πριν την save για old-signature recompute · κάνει direct call στο `upsertOpeningGroupForOpening` + `deleteOpeningFromGroup` από `opening-boq-sync.ts` · delete path passes `lastKnownParams` από ref ή deleted scene entity · legacy `bimToBoqBridge` import αφαιρέθηκε — bridge δεν χρησιμοποιείται πλέον από τη persistence flow για openings).
  - **Tests**: 29/29 PASS new grouper assertions + 106/108 PASS bim/services suite (2 failures pre-existing — `MaterialLibraryService` Firebase auth jsdom issue, unrelated to B.2).
  - **N.7.2 Google-level**: Proactive (bridge runs σε κάθε opening save/delete) + Idempotent (deterministic ID από signature key, recompute always reads fresh Firestore state) + Belt-and-suspenders (bridge + detach guard + per-row exists check) + SSoT (`opening-boq-grouper.ts` owns signature compute + ID generation, `.ssot-registry.json` entry forbids inline duplication) + Lifecycle owner (`BimToBoqBridge`). Race condition: eventual consistency accepted — two concurrent saves σε ίδιο signature → δεύτερο overwrites count από φρέσκο query. Transaction defer αν εμφανιστεί real bug.
  - Pending: Phase C (draggable tag + leader line). Migration: υπάρχοντα `boq_bim_<openingId>` rows από Phase A single-entry path (αν υπάρχουν) ΔΕΝ διαγράφονται αυτόματα — added cleanup TODO στο `pending-ratchet-work.md` αν production data υπάρχει.
- **2026-05-25** (v6 — PHASE_B1_DONE) — **Phase B.1 implementation complete** (Renumber Openings command, IMAGINiT-style). 3 OQs resolved (BOQ grouping Mode C — Phase B.2 scope, ribbon placement = contextual + Annotate tab, override policy = preserve manual via 5/5 industry convergence). Phase 7 expanded with status column + B.1/B.2 split + §4.9 new section "Manual mark override tracking" documenting `markIsManual` flag semantics + renumber reset behavior.
  - NEW files (5): `bim/services/opening-renumber-service.ts` (pure `computeRenumberUpdates()` + Firestore fetch wrapper), `bim/services/__tests__/opening-renumber-service.test.ts` (12 unit assertions), `core/commands/entity-commands/RenumberOpeningsCommand.ts` (ICommand + writeBatch + scene optimistic update + undo), `ui/components/bim-openings/RenumberOpeningsDialog.tsx` (Radix Dialog + scope radio + kind checkbox grid + manual-include toggle + live preview count), `ui/components/bim-openings/RenumberOpeningsHost.tsx` (EventBus listener + companyId/projectId/floorplanId wiring + sceneManager adapter), `ui/ribbon/data/annotate-tab-openings.ts` (new ribbon panel).
  - MODIFIED files (9): `bim/types/opening-types.ts` (+`markIsManual` optional flag), `ui/ribbon/hooks/bridge/opening-command-keys.ts` (+`renumber` action key), `ui/ribbon/data/contextual-opening-tab.ts` (+`opening-renumber` panel button), `ui/ribbon/data/ribbon-default-tabs.ts` (annotate tab uses `ANNOTATE_OPENINGS_PANEL`), `ui/ribbon/hooks/useRibbonOpeningBridge.ts` (+`onAction` renumber emits EventBus event + Mark edits set `markIsManual: true`), `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (+`bim-opening-renumber` icon case using `RefreshCw`), `systems/events/EventBus.ts` (+`bim:opening-renumber-requested` event), `app/DxfViewerContent.tsx` (lazy mount `RenumberOpeningsHost`), `i18n/locales/{el,en}/dxf-viewer-shell.json` (+`ribbon.commands.openingEditor.renumber.*` + panel labels `openingRenumber`/`annotateOpenings`).
  - Tests: 12/12 PASS (current-floor 10 + all-floors 2). Covers: empty rows, single-floor no-gaps, gap filling (1,2,4,7 → 1,2,3,4), per-kind isolation, basement floor, manual preserve, manual wipe, idempotency, out-of-scope skip, kindFilter skip, multi-floor + multi-kind ordering, missing-floorId skip.
  - Industry pattern: 5/5 convergence (IMAGINiT / ArchiCAD / Tekla / Bentley / Vectorworks) — preserve manual overrides by default, opt-in to wipe.
  - Pending: Phase B.2 (BOQ Schedule group-by Mode C signature) + Phase C (draggable tag + leader line).
- **2026-05-26** (v8 — Phase C SPLIT) — Giorgio scope decision: Phase C χωρίστηκε σε **C.1 (draggable tag + leader line, ~3-5h)**, **C.2 (per-project styling, ~2-3h)**, **C.3 (PDF schedule export, ~2-3h)**. Κάθε sub-phase = ξεχωριστή ~2h session με δικό του commit + ADR update — manageable session windows, χαμηλότερο per-commit risk, καθαρά docs μεταξύ subphases. §7 phases table updated με 3 ξεχωριστά rows + dependencies + status. Total Phase C scope unchanged (~7-11h). Zero κώδικας ακόμη — C.1 ξεκινά αμέσως μετά OQ resolution (leader geometry + tag rotation + reset UX).
- **2026-05-26** (v10 — PHASE_C2_DONE) — **Phase C.2 implementation complete** (per-project Tag Style override). 4 OQs resolved με industry research:
  - Q1 storage scope = **per-project** (3/3 — Revit shared parameters, ArchiCAD .PRF, AutoCAD DIMSTYLE drawing dict). Field στο `Project` Firestore doc: `openingTagStyle?: OpeningTagStyle | null`.
  - Q2 fields = **all 6**: `fontSizePx` (7-16, default 9), `borderWidthPx` (0-3, default 1), `leaderStyle` ('solid'/'dashed'/'dotted', default 'solid'), `pillBgColor` (default canvas-pill `PILL_BG_COLOR`), `leaderColor` (default '#7a8696'), `leaderVisible` (default true).
  - Q3 UI = **modal dialog** από Annotate ribbon tab → "Tag Style" button (Palette icon).
  - Q4 preview = **debounced 200 ms** (Figma/Photoshop pattern — optimistic local + batched Firestore write).
  - **NEW files (4)**: `bim/services/opening-tag-style-service.ts` (pure singleton + `resolveOpeningTagStyle()` clamp/fallback + `stripUndefined()` Firestore-safe + debounced 200ms persister + subscribe). `bim/services/__tests__/opening-tag-style-service.test.ts` (22 assertions — pure resolve clamping/fallback 9 + stripUndefined 3 + singleton lifecycle 10). `ui/components/bim-openings/OpeningTagStyleDialog.tsx` (Radix Dialog + 6 controls: 2 sliders + 1 select + 2 color inputs + 1 Switch). `ui/components/bim-openings/OpeningTagStyleHost.tsx` (Suspense leaf, hydrate via `getDoc` on projectId change + `setPersister(updateProjectWithPolicy)` wiring + EventBus listener).
  - **MODIFIED files (8)**: `bim/renderers/OpeningTagRenderer.ts` (drawPillTag + drawLeaderLine accept `ResolvedOpeningTagStyle`, render() calls `getCurrentOpeningTagStyle()` sync, dash pattern map για leader style, border skipped when `borderWidthPx===0`). `ui/ribbon/data/annotate-tab-openings.ts` (+Tag Style button next to Renumber). `ui/ribbon/hooks/bridge/opening-command-keys.ts` (+`openTagStyle` action key). `ui/ribbon/hooks/useRibbonOpeningBridge.ts` (+handler emits `bim:opening-tag-style-requested`). `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (+`bim-opening-tag-style` → Palette icon). `i18n/locales/{el,en}/dxf-viewer-shell.json` (+15 keys: `ribbon.commands.openingEditor.tagStyle.*` + 6 field labels + 3 leader style options + 2 actions). `systems/events/EventBus.ts` (+`bim:opening-tag-style-requested` Record<string,never>). `types/project.ts` (+`openingTagStyle?: OpeningTagStyle | null` + re-export). `app/DxfViewerContent.tsx` (+lazy `OpeningTagStyleHost` mount).
  - **Tests**: 22/22 PASS (service) + 9/9 PASS (renderer regression) = 31 total. Pure helper coverage 100%.
  - **N.7.2 Google-level**: Proactive (service hydrates on first projectId mount via `getDoc`), Idempotent (`mutateStyle` partial merge — same patch twice = no-op via dequal at consumer), Belt-and-suspenders (service defaults + helper-level fallback args), SSoT (`opening-tag-style-service` owns state; renderer pure consumer; `Project.openingTagStyle` Firestore-owned doc), Await (Firestore write awaited via `updateProjectWithPolicy`), Lifecycle owner (`OpeningTagStyleHost` mounts/unmounts hydration + persister per projectId).
  - **ADR-040 compliance**: pure service zero subscriptions, renderer sync-getter pattern, leaf-only host, Firestore I/O bounded (1 getDoc per project + 1 write per 200ms burst), bitmap cache key unchanged.
  - Pending: ~~Phase C.3~~ → **DONE** (see v11).
- **2026-05-26** (v12 — INLINE_RIBBON_FIX) — **Follow-up: inline tag style ribbon + i18n fix**.
  - **UX change**: Giorgio requirement — tag style settings moved from popup dialog to inline contextual ribbon tab (same pattern as Stairs). `contextual-opening-tab.ts` +`opening-tag-style` panel (2 rows: fontSize+borderWidth+leaderStyle / bgColor+leaderColor+leaderVisible).
  - **i18n fix**: JSON flat dot-keys (`"leaderStyle.solid": "..."`) were invalid for i18next (dots = path separators → silent fallback). Replaced with proper nested `bgColorOptions{}` + `leaderColorOptions{}` sibling objects. `ribbon{}` block cleaned (leaderStyleLabel/bgColorLabel/leaderColorLabel/leaderVisibleLabel).
  - **Tag visibility fix**: `TAG_OFFSET_MM=500` world-units → `TAG_INITIAL_SCREEN_PX=40` screen-space. Tags now scale-independent (40px from wall normal regardless of zoom).
  - **Auto-contrast text**: `contrastTextColor(bgColor)` WCAG 1.4.3 in `canvas-pill.ts` SSoT — black/white text auto per background luminance. 14 tests.
  - **Tag clickability**: `OpeningRenderer.hitTestTagPill()` — click on pill selects opening, contextual ribbon tab activates.
  - **Modified files**: `OpeningTagRenderer.ts` + `OpeningRenderer.ts` + `canvas-pill.ts` + `opening-command-keys.ts` + `contextual-opening-tab.ts` + `useRibbonOpeningBridge.ts` + `dxf-viewer-shell.json el+en`.
- **2026-05-26** (v11 — PHASE_C3_DONE) — **Phase C.3 implementation complete** (PDF opening schedule export). ADR-376 now COMPLETE.
  - **Architecture**: client-side PDF (no API route). `downloadOpeningScheduleAsPdf()` pure module — 1 PDF, 2 sections (Πίνακας Θυρών + Πίνακας Παραθύρων). jsPDF + jspdf-autotable A4 landscape, mirrors ADR-363 Phase 8 `pdf-exporter.ts` SSoT pattern. `triggerExportDownload` SSoT for browser download.
  - **Mark column**: Added `mark` to `DOOR_COLUMNS` + `WINDOW_COLUMNS` presets (as first column, before `id`). Industry standard — Revit/ArchiCAD both include Mark/ID as primary identifier in door/window schedules. Affects all exports (CSV + xlsx + PDF).
  - **Ribbon**: 3rd button in `ANNOTATE_OPENINGS_PANEL` ("Πίνακας PDF", `FileDown` icon, `exportSchedulePdf` action key).
  - **EventBus**: `bim:opening-schedule-pdf-requested: Record<string, never>`.
  - **Host**: `OpeningSchedulePdfHost.tsx` — headless Suspense leaf (no dialog), `getEntities` getter prop (called on fire only, no re-render), `levels` prop for floor name resolution. `buildLookupsFromLevels()` builds `ScheduleLookups` from `Level[]`.
  - **NEW files (2)**: `bim/schedule/exporters/opening-schedule-pdf-exporter.ts` + `ui/components/bim-openings/OpeningSchedulePdfHost.tsx`.
  - **MODIFIED files (7)**: `schedule-presets.ts` (+mark col door+window), `EventBus.ts` (+event), `opening-command-keys.ts` (+action), `annotate-tab-openings.ts` (+button), `RibbonButtonIcon.tsx` (+FileDown case), `useRibbonOpeningBridge.ts` (+handler), `DxfViewerContent.tsx` (+lazy+Suspense mount), `i18n el+en dxf-schedule.json` (+col.mark), `i18n el+en dxf-viewer-shell.json` (+scheduleExport keys).
  - **Tests**: 6/6 new PASS + 104/104 existing schedule tests still PASS.
  - **N.7.2 Google-level**: Proactive (builds schedules at click time from live scene), Race (async PDF gen — getEntities getter call-time safe), Idempotent (pure buildSchedule — same entities → same output), Belt-and-suspenders (early return if both schedules empty), SSoT (reuses existing `buildSchedule` + `registerGreekFont` + `triggerExportDownload`), Await (PDF Blob awaited before download trigger), Lifecycle owner (Host EventBus subscription cleaned up on unmount).
  - **ADR-040 compliance**: headless leaf, no canvas subscriptions, no useSyncExternalStore, PDF gen non-blocking async.
- **2026-05-26** (v9 — PHASE_C1_DONE) — **Phase C.1 implementation complete** (draggable tag + γωνιακή leader + Reset Position UX). 3 OQs resolved με industry research:
  - Q1 leader = **γωνιακή/elbow** (Revit 2027 + ArchiCAD forward-looking pattern, single 90° break point με split-axis selection — horizontal-first when `|Δx| ≥ |Δy|`, vertical-first otherwise).
  - Q2 rotation = **πάντα horizontal** (3/3 industry convergence — Revit + ArchiCAD + AutoCAD).
  - Q4 reset UX = **both** ribbon button (contextual `opening-mark` panel) + right-click on tag (immediate, no menu — Vectorworks power-user shortcut).
  - **NEW files (3)**: `bim/services/opening-tag-drag-controller.ts` (pure FSM — idle/dragging states, `hitTestTag` + `tagWorldCenter` + `screenDeltaToWorldDelta` + `getOffsetOrZero` + `isOffsetSignificant` pure helpers + controller class με `startDrag`/`updateDrag`/`endDrag`/`cancelDrag`). `hooks/canvas/use-opening-tag-drag-interaction.ts` (React DOM glue — pointerdown/move/up + setPointerCapture + RAF-coalesced scene patches + `UpdateOpeningParamsCommand` commit + right-click reset). `components/dxf-layout/canvas-layer-stack-opening-tag-drag.tsx` (`OpeningTagDragMount` leaf — wires hook στο `PreviewCanvasMounts` composition).
  - **NEW tests (1)**: `bim/services/__tests__/opening-tag-drag-controller.test.ts` — **28 assertions** (10 pure helpers + 8 hit-test + 10 FSM transitions). PASS 28/28.
  - **MODIFIED files (8)**: `bim/renderers/OpeningTagRenderer.ts` (+`drawLeaderLine` γωνιακή leader, anchor=auto-centroid / pill=anchor+tagOffset, skip leader when distance < 18 px). `ui/ribbon/data/contextual-opening-tab.ts` (+Reset Position simple button στο `opening-mark` panel row). `ui/ribbon/hooks/bridge/opening-command-keys.ts` (+`resetTagPosition` action key). `ui/ribbon/hooks/useRibbonOpeningBridge.ts` (+action handler — strips `tagOffset` field via spread+delete + dispatches `UpdateOpeningParamsCommand`). `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (+`bim-opening-reset-tag` case → `RotateCcw` lucide icon). `i18n/locales/{el,en}/dxf-viewer-shell.json` (+`ribbon.commands.openingEditor.resetTagPosition.{label,tooltip,contextMenu}`). `components/dxf-layout/canvas-layer-stack-leaves.tsx` (+`OpeningTagDragMount` wired into `PreviewCanvasMounts`).
  - **N.7.2 Google-level**: Proactive (hook mounts only inside leaf, RAF-coalesced scene patches), Idempotent (setting same tagOffset = no-op via dequal), Belt-and-suspenders (FSM + hook + persistence — 3 independent guards), SSoT (`opening-tag-drag-controller.ts` owns FSM, `OpeningParams.tagOffset` owns persisted state, `UpdateOpeningParamsCommand` owns undoable mutation), Await (commit awaited via existing command path), Lifecycle owner (React hook, mount/unmount with leaf).
  - **ADR-040 compliance**: pure FSM zero subscriptions, hook only in leaf, RAF-throttled patches, `pointerdown` με `capture: true` ώστε να μην race με canvas selection click, no useSyncExternalStore in orchestrators, bitmap cache key unchanged (tag drag is rare event, full re-render acceptable).
  - Pending: Phase C.2 (per-project styling override) + Phase C.3 (PDF schedule export, possibly merged με ADR-175 BOQ export).

---

## Sources (web research 2026-05-25)

**Revit Mark/Type Mark architecture**:
- [Mark vs. Type Mark in Revit: Complete Guide — BIMTemplate](https://bimtemplate.com/blog/mark-vs-type-mark-revit)
- [Revit Best Practices: "Mark" vs "Type Mark" — Hayne Architects](https://haynearchitects.com/revit-best-practices-mark-vs-type-mark/)
- [Mark and Type Mark Parameters in Revit — BIM Chapters](https://bimchapters.blogspot.com/2018/11/mark-and-type-mark-parameters-in-revit.html)
- [RevitUp: Tag Doors by Type / Tag Windows by Mark](http://revit-up.blogspot.com/2007/11/tag-doors-by-type-tag-windows-by-mark.html)

**Auto-numbering & sequential tagging**:
- [Create Sequential Tags for Doors or Windows — Autodesk help](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-F9B6BB41-CC51-49C8-A17D-DE0F16340E17)
- [IMAGINiT Utilities — Renumber Tools (Door Mark Update)](https://resources.imaginit.com/building-solutions-blog/imaginit-utilities-for-revit-renumber-tools-part-2-door-mark-update)
- ["Mark" instance parameter, auto increment — Revit Forum](https://www.revitforum.org/forum/revit-architecture-forum-rac/architecture-family-creation/19426-mark-instance-parameter-auto-increment)

**Tag shape & 2D plan annotation**:
- [About Window Tags — Autodesk help](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-D317147A-AC24-4983-A578-55F074FDF64A)
- [Annotation Symbols Guide: Revit Drafting Tools — Mashyo](https://mashyo.com/annotation-symbols/)
- [Annotation Families — Modelical](https://www.modelical.com/en/gdocs/annotation-families/)

**Leader line & positioning**:
- [Understanding the location of leaders in tags — LinkedIn Learning](https://www.linkedin.com/learning/revit-tips-tricks-and-troubleshooting/understanding-the-location-of-leaders-in-tags)
- [Positioning tags based on door orientation — Autodesk Community](https://forums.autodesk.com/t5/revit-architecture-forum/positioning-tags-based-on-door-orientation/td-p/8367226)
- [Tag orientation issue — Autodesk](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Tag-orientation-issue-in-Autodesk-Revit.html)

**Cross-tool context**:
- [Door/Window Markers — Graphisoft (ArchiCAD)](https://community.graphisoft.com/t5/Documentation/Door-and-window-markers/td-p/211786)
- [How to tag doors/windows in AutoCAD — ARKANCE](https://ukcommunity.arkance.world/hc/en-us/articles/21549368974354-How-do-you-tag-doors-and-windows-in-AutoCAD)
- [ISO 19650 Drawing Numbering — Bimlead](https://www.bimlead.co.uk/iso-19650-drawing-naming-templates-for-revit-archicad)

## Sources (web research 2026-05-26 — Phase C.1)

**Tag leader geometry (Q1)**:
- [Top 15 Best New Features in Revit 2027 — BIM Pure](https://www.bimpure.com/blog/revit-2027) — elbow leader + clip-icon endpoints + snap to elements.
- [Tag Leader Settings — BIMLOGIQ](https://bimlogiq.com/docs/smart-annotation/docs/tag-leader-settings)
- [Adding Door Tags in Revit — VDCI](https://vdci.edu/learn/revit/adding-door-tags-in-revit-for-room-numbering-and-adjustment)

**Tag rotation (Q2)**:
- [Change the Orientation of a Tag — Autodesk help](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-54136AF5-E395-4FD4-973D-E2A47EF7B284)
- [Revit Tags Rotate with Component — revitIQ](https://revitiq.com/revit-tags-rotate-with-component/)
- [Label or Tag Always Horizontal — Revit Forum](https://www.revitforum.org/forum/revit-architecture-forum-rac/architecture-and-general-revit-questions/448495-label-or-tag-always-horizontal)

**Reset position (Q4)**:
- [Context Menus — Revit API](https://help.autodesk.com/view/RVT/2025/ENU/?guid=Revit_API_Revit_API_Developers_Guide_Advanced_Topics_Context_Menus_html)
- [Manage Revit Projects with Right Click Menu — Ideate](https://support.ideatesoftware.com/support/help/ideate-explorer/ideate-explorer-basics/tools/right-click-menu)
