# ADR-376 — Opening Tags (Ταμπελάκια Ανοιγμάτων) — Revit-Faithful Pattern

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **PHASE_A_DONE** 2026-05-25 — Core implementation complete. Tags rendered on placement με auto-allocated instance Mark. Phase B (BOQ Schedule + Renumber command) + Phase C (draggable tag) pending. |
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

| Φάση | Περιεχόμενο | Εξάρτηση | Εκτίμηση |
|---|---|---|---|
| **A** (core) | `mark` field, `OpeningMarkService` (per floor+kind allocator), `OpeningTagRenderer`, auto-numbering on placement, ribbon inputs, layer toggle, validator, i18n keys (5 prefixes el+en), 2D-only enforcement | All Q1-Q10 resolved | **~6-10h** (μειωμένο από v2 λόγω Q3) |
| **B** (schedule) | BOQ integration (ADR-175 group-by signature για visual aggregation), "Renumber Openings" command | Phase A | **~4-6h** |
| **C** (polish) | Draggable tag + leader line, custom styling per project, export to PDF schedule | Phase B | **~8-10h** |

**Total Phase A+B = ~10-16h** (ready-to-implement, μειωμένο ~30% λόγω εξάλειψης OpeningTypeCatalog).

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
