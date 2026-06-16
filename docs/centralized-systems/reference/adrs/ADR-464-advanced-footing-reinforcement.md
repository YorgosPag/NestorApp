# ADR-464 — Advanced Footing Reinforcement & Design (full loads model, Revit-without-Robot)

**Status:** 🟡 Slices 0-1 IMPLEMENTED 2026-06-16 (Opus) — UNCOMMITTED. Slice 0 = doc/types/soil-setting· Slice 1 = loads model + bearing engine (EC7) + bearingInadequate diagnostic (19 jest GREEN). UI input/readouts = Slice 1b. Slices 2-5 PENDING.
**Discipline:** Δομοστατικά / Structural Engineering — Θεμελίωση (substructure)
**Builds on:** ADR-436 (foundation discipline), ADR-456 (στατικά/κανονισμοί), ADR-459 (στατικός οργανισμός), ADR-463 (foundation reinforcement UX).
**Scope:** Οι **προηγμένες περιπτώσεις οπλισμού/σχεδιασμού θεμελίωσης** που λείπουν από το ADR-463: **άνω σχάρα πεδίλου** (top mesh) code-driven, **έκκεντρα πέδιλα**, **κοιτοστρώσεις/raft parity**, **εδαφικές συνθήκες** (σ_allow) — με ένα πραγματικό **loads model + design engine** (bearing/flexure/punching) όπως οι μεγάλοι παίκτες (Revit). FULL ENTERPRISE + FULL SSoT.

---

## 1. Context & Problem

Το ADR-463 έδωσε το πλήρες **UX/render/PDF/auto-reinforce** chain οπλισμού θεμελίωσης, αλλά ο **suggester** δίνει **ελάχιστο detailing** (slab-like ρ_min) — όχι load-driven σχεδιασμό:

- **Pad** → ΜΟΝΟ κάτω δι-διευθυντική σχάρα (`bottomMeshX/Y`). **ΠΟΤΕ `topMesh`**, παρότι ο τύπος `PadReinforcement.topMesh?` + compute/2Δ/3Δ/detail/panel **υπάρχουν ήδη** (απλώς δεν προτείνονται).
- **Καμία διαστασιολόγηση** από φορτία: ούτε έλεγχος έδρασης (bearing), ούτε κάμψη από πίεση εδάφους, ούτε διάτρηση (punching).
- **Καμία εδαφική παράμετρος** (σ_allow).
- Η εκκεντρότητα (κολώνα εκτός κέντρου πεδίλου) δεν αναγνωρίζεται, παρότι είναι **παράγωγη** από τον στατικό οργανισμό (FK κολώνα→πέδιλο, ADR-459).

**Η raft/κοιτόστρωση** (`SlabEntity` kind foundation/ground) **έχει ήδη** top+bottom σχάρα (`suggestSlabFoundationReinforcementFrom`, ADR-459 Φ4e/E3) — χρειάζεται μόνο parity/ανάδειξη.

### 1.1 Το κομβικό εμπόδιο — από πού έρχονται τα φορτία;
Δεν υπάρχει FEM/analysis engine (ADR-459 Phase 5 DEFERRED). **Όπως ο Revit χωρίς Robot**, τα φορτία δεν παράγονται από FEM — έρχονται από:
1. **Manual analytical loads** — ο μηχανικός ορίζει χαρακτηριστικά (service) G/Q φορτία ανά μέλος (persisted).
2. **Tributary-area load takedown** — N = επιφάνεια ευθύνης κολόνας × Σ(ορόφων) × επιφανειακά φορτία (G/Q) + ίδιο βάρος. Καθαρά γεωμετρικό + building settings (DERIVED).

Πλήρες FEM = **ξεχωριστό μελλοντικό ADR** (DEFER). Όλοι οι τύποι εδώ (bearing/flexure/punching) είναι πραγματικοί EC2/EC7/EC0 — μόνο η **πηγή** των φορτίων είναι FEM-free.

---

## 2. Architecture — ένα SSoT ανά concern (μηδέν duplicate, N.0.2)

Έρευνα 2026-06-16: **μηδέν** υπάρχων κώδικας loads/tributary/bearing/punching/load-combination στο `src/subapps/dxf-viewer` → καθαρό πεδίο, fresh SSoT υποσυστήματα.

### 2.1 Reuse map (ΧΡΗΣΙΜΟΠΟΙΟΥΜΕ ως έχει)
- **Codes:** `codes/structural-code-types.ts` (provider abstraction) + `eurocode-provider.ts` + `greek-legacy-provider.ts` (επεκτείνονται με design factors).
- **Suggester:** `codes/suggest-reinforcement.ts` (`suggestFootingReinforcementFrom` pad branch + `resolveMatMesh` SSoT) — επεκτείνεται με top-mesh rule.
- **Materials:** `concrete-grades.ts` (`concreteFcdMpa`, `GAMMA_C`, `fckMpa`, density), `rebar-catalog.ts` (fyd/B500C, διάμετροι).
- **Types/compute/render:** `reinforcement/footing-reinforcement-types.ts` (`PadReinforcement.topMesh?` ΥΠΑΡΧΕΙ) + `footing-reinforcement-compute.ts` (top→secondary ΥΠΑΡΧΕΙ) + `footing-rebar-2d/-3d` + `footing-detail-*` (δείχνουν ήδη top).
- **Section-context:** `section-context.ts` (`buildFootingSectionContext`, `buildReinforcePatch`) — επεκτείνεται με εκκεντρότητα.
- **Organism:** `organism/structural-organism-types.ts` (`StructuralNode.footingId` FK + `footprint`) + `organism/reinforcement-checks.ts` (diagnostics framework: `StructuralDiagnostic` + `runReinforcementChecks` + codes union) — επεκτείνεται με design checks.
- **Settings:** `structural-settings.ts` + `structural-settings-store.ts` + `structural-settings.service.ts` (building-level persist pattern) — +σ_allow.
- **UI:** `ui/foundation-advanced-panel/foundation-property-fields.ts` (kind-aware descriptor) + `ColumnPropertyRow` + foundation bridge.

### 2.2 Νέα modules
- **`bim/structural/loads/`** (FEM-free loads model):
  - `structural-loads-types.ts` — `MemberLoad` (G/Q components), `AppliedMemberLoad` (persisted manual), `AreaLoadSettings`, `CombinedLoad`.
  - `load-combinations.ts` — EN1990 ULS (1.35G+1.5Q) / SLS (char) — factors ανά provider.
  - `load-takedown.ts` — tributary area (column adjacency) × storeys × area loads + self-weight → DERIVED `MemberLoad`.
- **`bim/structural/footing-design/`** (pure, DERIVED, ΠΟΤΕ persisted — geometry-is-SSoT):
  - `footing-design-types.ts` — `FootingDesignInput`, `FootingDesignResult` (`bearing`/`flexure`/`punching`), `DesignCheck`.
  - `footing-bearing.ts` — EC7: A_req=N/σ_allow, p_max/p_min, e=M/N, kern (uplift e>L/6).
  - `footing-flexure.ts` — EC2 §9.8.2: M στην παρειά → As κάτω· hogging → As άνω.
  - `footing-punching.ts` — EC2 §6.4: v_Ed vs v_Rd,c.
  - `footing-design.ts` — orchestrator → `FootingDesignResult`.

### 2.3 Extensions
| Αρχείο | Αλλαγή |
|---|---|
| `structural-code-types.ts` + 2 providers | `footingDesignFactors()` (load/punching/bearing γ) |
| `structural-settings.ts` | `soilBearingCapacityKpa?` (**Slice 0 DONE**) |
| `suggest-reinforcement.ts` | pad top-mesh rule (real hogging As ή γεωμετρικό kern/skin fallback) |
| `structural-organism-types.ts` + `reinforcement-checks.ts` | codes `bearingInadequate`/`punchingInadequate`/`padEccentricHogging`/`oneWayShearInadequate` |
| `foundation-types.ts` / `column-types.ts` | `appliedLoad?` (persisted, absent→engine αδρανές) |
| `foundation-advanced-panel` | loads input + design readouts |
| `useStructuralAutoReinforce` | threads graph + loads |

---

## 3. Slices

| Slice | Περιεχόμενο | Status |
|---|---|---|
| **0** | ADR + types + `soilBearingCapacityKpa` setting + resolver + jest | 🟢 **DONE** (UNCOMMITTED) |
| **1** | Loads model (`loads/`) + bearing engine (EC7, `footing-design/`) + provider `footingDesignFactors()` + `ColumnParams.appliedLoad?` + `bearingInadequate` diagnostic (wired στο `useStructuralOrganism`) + jest | 🟢 **DONE** (UNCOMMITTED) |
| **1b** | UI: σ_allow building setting input + column `appliedLoad` input fields + bearing readouts στο foundation panel | PENDING |
| **2** | Flexure + ενοποιημένος top-mesh κανόνας + `padEccentricHogging` + auto top-mesh | PENDING |
| **3** | Punching + one-way shear + diagnostics | PENDING |
| **4** | Tributary load takedown + load combinations (auto loads) | PENDING |
| **5** | Raft bearing parity + detail-sheet design summary | PENDING |

### Top-mesh ενεργοποίηση (Slices 2) — code-driven, γεωμετρικό fallback
- **Με φορτία:** hogging As > 0 (e=M/N εκτός kern) → άνω σχάρα διαστασιολογημένη.
- **Χωρίς φορτία:** (α) `thickness ≥ padTopMeshMinThicknessMm` (skin/shrinkage, EC2 §9.7/§7.3), **ή** (β) γεωμετρική εκκεντρότητα `e/L > 1/6` (kern, από organism FK κολόνας) → ελάχιστη άνω σχάρα (mirror raft).
- **Default 1.5×1.5×0.5 πέδιλο, concentric → καμία άνω σχάρα** (μηδέν regression).

---

## 4. Honesty / DEFER
- bearing/flexure/punching = πραγματικοί EC2/EC7 τύποι· φορτία = manual + tributary takedown (**FEM-free**).
- **DEFER:** πλήρες FEM analysis engine (ξεχωριστό ADR)· σεισμικά φορτία/συνδυασμοί EC8 πέραν του στατικού· settlement/consolidation εδάφους.

---

## 5. Changelog
- **2026-06-16 (Opus) — Slice 1:** Loads model `bim/structural/loads/` (`structural-loads-types` [AppliedMemberLoad/MemberLoad/CombinedLoad + resolvers] + `load-combinations` [EN1990 ULS/SLS]) + footing-design engine `bim/structural/footing-design/` (`footing-design-types` + `footing-bearing` [EC7 rigid-footing pressure: concentric/εντός-kern ακριβές, μονοαξονική αποκόλληση ακριβής τριγωνική, διαξονική συντηρητική] + `footing-design` orchestrator + `footing-design-checks` runner). Provider `footingDesignFactors()` (interface + EC + ΕΚΩΣ). `ColumnParams.appliedLoad?` (persisted manual analytical load). Diagnostic `bearingInadequate` (error) wired στο `useStructuralOrganism` (αδρανές χωρίς σ_allow/φορτίο) + i18n el/en. Store `structural-settings-store` μεταφέρει σ_allow (round-trip). 19 jest (bearing+combinations+resolver) GREEN. UNCOMMITTED.
- **2026-06-16 (Opus) — Slice 0:** ADR δημιουργήθηκε. `StructuralSettings.soilBearingCapacityKpa?` + `resolveStructuralSettings` validation (omit-when-invalid, Firestore-safe) + jest (`__tests__/structural-settings.test.ts`). Μηδέν behavior change. UNCOMMITTED.
