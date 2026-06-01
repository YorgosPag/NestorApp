# ADR-405 — BIM Discipline Taxonomy & MEP Foundation (Step 1)

| Field | Value |
|---|---|
| Status | ✅ **ACCEPTED** — Step 1 + §4 (discipline visibility filter) εγκεκριμένα από Giorgio (2026-06-02). Full enterprise + full SSoT, industry-faithful. Αναμένει επιλογή execution mode (N.8) πριν την υλοποίηση |
| Date | 2026-06-02 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | ADR-358 (AEC layer category taxonomy — **reuse SSoT**), ADR-375 (V/G + Phase C.8 «Μόνο DXF» toggle — **γενικεύεται εδώ**), ADR-382 (visibility resolver SSoT — **επεκτείνεται**), ADR-363 (hosted-opening cascade — πρόδρομος του ΗΜ hosting), ADR-377 (BIM-native type-driven styling) |

---

## Context

Η εφαρμογή υποστηρίζει σήμερα **δομικά/αρχιτεκτονικά** BIM στοιχεία (`wall`, `column`,
`beam`, `slab`, `opening`, `slab-opening`, `stair`, `roof`, `ceiling`, `envelope`) πάνω σε
εισαγμένο DXF. Ο Giorgio θέλει να προχωρήσουμε **σταδιακά** προς **ΗΜ εγκαταστάσεις (MEP —
Mechanical / Electrical / Plumbing)**: αεραγωγοί, σωληνώσεις, καλωδιώσεις, φωτιστικά,
μηχανήματα κ.λπ.

**Ερώτημα που απαντά αυτό το ADR:** _ποια είναι η **πρώτη πέτρα** που πρέπει να στηθεί ώστε
να χτίσουμε ΗΜ χωρίς μελλοντικό rewrite;_

### Πώς το λύνουν οι μεγάλοι (industry convergence)

| Παίκτης | Μηχανισμός |
|---|---|
| **Revit (MEP)** | Κάθε **View** έχει **«View Discipline»** (Architectural/Structural/Mechanical/Electrical/Plumbing/Coordination). Η μη-ενεργή πειθαρχία γίνεται halftone/φόντο. Τα ΗΜ ανήκουν σε **Systems** (γράφος συνδεσιμότητας) με **Connectors**. |
| **ArchiCAD + MEP Modeler** | Disciplines + MEP Systems + Graphic Override Rules ανά σύστημα. |
| **Bentley OpenBuildings/OpenMEP** | Discipline-based catalogs + connectivity. |
| **IFC / buildingSMART** | `IfcDistributionSystem` (το σύστημα) + `IfcFlowSegment/Fitting/Terminal/Controller` + `IfcRelConnectsPorts`. |

**Κοινός παρονομαστής:** η **Πειθαρχία (Discipline)** είναι το **ανώτερο επίπεδο ταξινόμησης**
— πάνω από την κατηγορία και τον τύπο. Όλη η τοποθέτηση, η ορατότητα, το federation και το
clash detection κρεμιούνται από αυτήν.

---

## RECOGNITION findings (κώδικας = source of truth, 2026-06-02)

1. **Entity model** (`types/base-entity.ts`): ενιαίο `EntityType` union (DXF + BIM types) +
   `BaseEntity`. **ΔΕΝ υπάρχει** πεδίο `discipline` στις οντότητες.
2. **✅ Υπάρχει ήδη discipline taxonomy** — `AecLayerCategory` (`types/scene-types.ts:22`,
   ADR-358 §5.3.quinquies):
   ```ts
   export type AecLayerCategory =
     | 'architectural' | 'structural' | 'electrical' | 'mechanical'
     | 'plumbing' | 'fire' | 'civil' | 'telecom' | 'interior' | 'general';
   ```
   **Layer-level** (AIA prefix per category). Ζωντανό: 13 consumers (layer picker, layer
   manager, smart filters, i18n el+en). → **ΔΕΝ φτιάχνουμε δεύτερη taxonomy** (SSoT violation).
   Αυτή είναι ήδη η canonical AEC discipline taxonomy· λείπει μόνο η **entity→discipline** γέφυρα.
3. **Category SSoT** (`config/bim-object-styles.ts`): `BimCategory` (13 categories) +
   `BIM_CATEGORIES` + (νέο, ADR-375 C.8) `STRUCTURAL_BIM_CATEGORIES` (10 model categories —
   εξαιρεί dimension/hatch/grip). **Σημ.:** το όνομα `STRUCTURAL_BIM_CATEGORIES` είναι ελαφρώς
   misnomer — περιέχει ΚΑΙ architectural ΚΑΙ structural· σωστότερα «**MODEL** BIM categories».
4. **Visibility SSoT** (`bim/visibility/visibility-resolver.ts`, ADR-382): `resolveIsEntityVisible`
   με 4 sources (V/G category · layer · floor · building), ANY-hides-wins. Καθαρή συνάρτηση,
   event-time, ADR-040-compliant. → **εδώ προστίθεται 5η source: discipline**.
5. **«Μόνο DXF» toggle** (ADR-375 C.8): batch hide των model categories. → **ειδική περίπτωση**
   του γενικού discipline filter που ορίζει αυτό το ADR.

---

## Decision

**Η πρώτη πέτρα = Discipline ως πρώτης τάξης διάσταση στο entity model**, ευθυγραμμισμένη με
την υπάρχουσα `AecLayerCategory`. Additive, μη-καταστροφικό, type-driven (BIM-native).

### Ιεραρχία-στόχος

```
Discipline   (architectural | structural | mechanical | electrical | plumbing | …)
  └── Category   (wall, column, duct, pipe, fixture, …)        ← BimCategory (επεκτείνεται μελλοντικά)
        └── Type   (συγκεκριμένος τύπος — Wall Type, Duct Type) ← μελλοντικό
              └── Instance   (το αντικείμενο στον καμβά)        ← BaseEntity
```

### §1 — Discipline taxonomy SSoT (ΜΙΑ κανονική αλήθεια, industry naming)

**Απόφαση Giorgio (Q4):** full enterprise + full SSoT, όπως οι μεγάλοι παίκτες.

- Νέο module `bim/discipline/bim-discipline.ts` = **canonical SSoT** που ορίζει το `Discipline`
  union (industry term — Revit/ArchiCAD/IFC «Discipline»):
  ```ts
  export type Discipline =
    | 'architectural' | 'structural' | 'electrical' | 'mechanical'
    | 'plumbing' | 'fire' | 'civil' | 'telecom' | 'interior' | 'general';
  ```
- `types/scene-types.ts` `AecLayerCategory` γίνεται **alias** → `export type AecLayerCategory = Discipline`
  (ΜΙΑ αλήθεια — οι 13 υπάρχοντες consumers του ADR-358 συνεχίζουν αμετάβλητοι, μηδέν churn).
- **Annotation διαχωρισμός (Q2 — industry-faithful, Revit «Model vs Annotation Categories»):**
  οι `dimension`/`hatch`/`grip` + DXF primitives δεν είναι model elements → ρητή τιμή
  `'annotation'` (ξεχωριστό filtering, όχι σιωπηρό null).

### §2 — Entity → Discipline mapping (type-driven, BIM-native)

`DISCIPLINE_BY_CATEGORY: Record<BimCategory, Discipline | 'annotation'>`:

| Discipline | Categories (σημερινές) |
|---|---|
| `architectural` | wall, opening, slab-opening, roof, ceiling, envelope |
| `structural` | column, beam, **slab** (Q1: φέρον στοιχείο, per-instance override), stair |
| `mechanical` | _(μελλοντικά: duct, equipment…)_ |
| `electrical` | _(μελλοντικά: cableTray, fixture, panel…)_ |
| `plumbing` | _(μελλοντικά: pipe, fitting…)_ |
| `annotation` | dimension, hatch, grip |

- **Resolver** `resolveEntityDiscipline(entity)`: (1) explicit `entity.discipline` αν υπάρχει
  → (2) `DISCIPLINE_BY_CATEGORY[category]` (type-derived default) → (3) layer `aecCategory`
  fallback → (4) `null` για DXF primitives. Priority: explicit > type > layer.
- **`BaseEntity.discipline?: Discipline`** — optional override (Firestore-persisted), absent
  ⇒ type-derived. Μη-καταστροφικό: όλες οι υπάρχουσες οντότητες παίρνουν σωστή discipline
  χωρίς migration.

### §3 — Inverse map + refactor υπάρχοντος

- `CATEGORIES_BY_DISCIPLINE: Record<Discipline, BimCategory[]>` (inverse του §2).
- `MODEL_BIM_CATEGORIES` = νέο canonical όνομα· `STRUCTURAL_BIM_CATEGORIES` → deprecated alias
  (re-export) για zero-break στο ADR-375 C.8 toggle.

### §4 — Discipline visibility filter (γενίκευση ADR-375 C.8)

- Επέκταση `VisibilityContext` + `resolveIsEntityVisible` με 5η source:
  `disciplineVisibility?: Partial<Record<Discipline, boolean>>` (ANY-hides-wins, ίδιο pattern).
- Store: `disciplineVisibility` state + `setDisciplineVisibility(discipline, visible)` batch action
  (mirror του `setBimObjectsVisibility`, ίδιο debounce/snapshot pattern).
- UI: το σημερινό «Μόνο DXF» κουμπί **γενικεύεται** σε discipline multi-toggle
  («Architectural / Structural / Mechanical / Electrical / Plumbing») — Revit «View Discipline».
- **Zero νέο render plumbing** — όλοι οι renderers ήδη καλούν `resolveIsEntityVisible`.

---

## Roadmap (σταδιακά — αυτό το ADR υλοποιεί ΜΟΝΟ το Step 1)

| Step | Τι | Scope ADR | Αξία |
|---|---|---|---|
| **1️⃣ (ΕΔΩ)** | Discipline taxonomy SSoT + entity→discipline mapping + inverse map | **ADR-405** | Θεμέλιο· μηδέν ρίσκο (additive) |
| **2️⃣** | Discipline visibility filter (γενίκευση «Μόνο DXF») | ADR-405 §4 ή follow-up | Ορατή αξία, reuse 100% |
| **3️⃣** | 1ο ΗΜ στοιχείο (vertical slice) — point-based fixture (φωτιστικό/στόμιο): place→2D/3D→visibility→persist | νέο ADR | Αποδεικνύει αρχιτεκτονική end-to-end |
| **4️⃣** | Systems + Connectors (γράφος συνδεσιμότητας) | νέο ADR | Το «μυαλό» των ΗΜ |
| **5️⃣** | Routing / View Filters (rule-based) / color-by-system | νέο ADR | Πλήρης λειτουργικότητα |

> Αρχή: **smallest stable foundation → thin vertical slice** (όπως Revit/ArchiCAD). Το Step 1
> είναι μικρό (1-2 config αρχεία + derive helper + tests), αλλά ξεκλειδώνει όλα τα υπόλοιπα.

---

## Locked decisions (Giorgio, 2026-06-02)

1. **Slab discipline** → ✅ **`structural`** (φέρον στοιχείο) με per-instance override.
2. **Annotation** → ✅ **`'annotation'`** ρητή τιμή (industry-faithful, Revit Model vs
   Annotation Categories).
3. **Scope** → ✅ **Step 1 + §4 μαζί** (taxonomy + discipline visibility filter — άμεσα ορατό/δοκιμάσιμο).
4. **Naming / SSoT** → ✅ **`Discipline` = canonical** (industry term)· `AecLayerCategory`
   γίνεται alias → ΜΙΑ αλήθεια, full SSoT, μηδέν churn στους 13 consumers.

---

## Συνέπειες

**Θετικά:** Καθαρό θεμέλιο για ΗΜ· industry-standard (Revit View Discipline)· μηδέν duplication
(reuse ADR-358 taxonomy)· additive/μη-καταστροφικό· γενικεύει το ADR-375 C.8.
**Trade-offs:** Προσθέτει optional πεδίο στο `BaseEntity`· το `STRUCTURAL_BIM_CATEGORIES`
μετονομάζεται (με alias για συμβατότητα).

---

## Changelog

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-06-02 | 0.1 — PROPOSED (Step 1 σχεδιασμός) | Discipline taxonomy SSoT (reuse `AecLayerCategory`) + entity→discipline mapping + inverse map + discipline visibility filter (γενίκευση ADR-375 C.8) + 5-step MEP roadmap. Αναμένει έγκριση Giorgio + απαντήσεις στα 4 open questions πριν την υλοποίηση. | Claude (Opus 4.8) |
| 2026-06-02 | 0.2 — ACCEPTED (decisions locked) | Giorgio απαντήσεις: slab=structural· annotation='annotation' ρητό· scope=Step 1 + §4 μαζί· naming=`Discipline` canonical + `AecLayerCategory` alias (full SSoT, industry-faithful). Αναμένει επιλογή execution mode (N.8) πριν την υλοποίηση. | Claude (Opus 4.8) |
