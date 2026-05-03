# ADR-186: Building Code Module — Modular Κανονισμός Δόμησης (ΝΟΚ)

> **Status**: PARTIAL — Phase 1 Engines Ported (2026-05-02)
> **Date**: 2026-02-17 (initial), 2026-05-02 (Phase 1 implementation)
> **Category**: AI Architecture / Building Regulations / DXF Viewer
> **Parent ADR**: [ADR-185](./ADR-185-ai-powered-dxf-drawing-assistant.md)

---

## 1. Context

Κατά τη συζήτηση για το ADR-185 (AI Drawing Assistant), αναδείχθηκε η ανάγκη για **modular αρχιτεκτονική κανονισμών δόμησης**. Η πολεοδομική νομοθεσία στην Ελλάδα (ΝΟΚ) είναι εξαιρετικά περίπλοκη:

- Κάθε οικόπεδο μπορεί να έχει **διαφορετικούς όρους δόμησης**
- Ειδικά Προεδρικά Διατάγματα (ΠΔ) τροποποιούν τους γενικούς κανόνες
- ΓΠΣ/ΣΧΟΟΑΠ κάθε Δήμου ορίζει ειδικούς όρους
- Χρήσεις γης, ζώνες, ειδικές ρυθμίσεις

**ΚΡΙΣΙΜΗ ΑΠΟΦΑΣΗ (Q-10, ADR-185)**: Ο κανονισμός δόμησης είναι **ΑΠΑΡΑΙΤΗΤΟΣ εξαρχής** αλλά ως **modular plugin**, όχι hardcoded.

---

## 2. Βασικές Αρχές

### 2.1 Modular Architecture (Building Code Provider Pattern)

```
┌───────────────────────────────────────────────────┐
│              AI Drawing Assistant                  │
│                                                    │
│  ┌────────────────────────────────────────────┐    │
│  │       Building Code Provider Interface      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │ ΝΟΚ      │ │ Γερμανι- │ │ Κυπρια-  │   │    │
│  │  │ Ελλάδας  │ │ κός      │ │ κός      │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘   │    │
│  │  ┌──────────┐                              │    │
│  │  │ "Κανένας" │ (ελεύθερη σχεδίαση)        │    │
│  │  └──────────┘                              │    │
│  └────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

### 2.2 Ο χρήστης επιλέγει

| Λειτουργία | Περιγραφή |
|-----------|-----------|
| **"Σχεδιάζω με κανονισμό"** | Η AI εφαρμόζει constraints (ΣΔ, κάλυψη, ύψος, αποστάσεις) |
| **"Σχεδιάζω ελεύθερα"** | Η AI σχεδιάζει χωρίς περιορισμούς |
| **"Σχεδιάζω ελεύθερα + έλεγχος"** | Σχεδιάζει ελεύθερα αλλά στο τέλος ελέγχει compliance |

### 2.3 Κανονισμός ΔΕΝ είναι hardcoded

- Κάθε κανονισμός = ξεχωριστό module
- Αύριο πουλάμε σε Κύπρο → φορτώνουμε Κυπριακό module
- Αύριο πουλάμε σε Γερμανία → φορτώνουμε Γερμανικό module
- **Pattern**: Ίδιο με AI Provider (OpenAI σήμερα, Claude αύριο)

---

## 3. Παράμετροι Κανονισμού (ΝΟΚ Ελλάδας)

### 3.1 Βασικοί Όροι Δόμησης

| Παράμετρος | Περιγραφή | Τύπος | Παράδειγμα |
|-----------|-----------|-------|-----------|
| **ΣΔ** (Συντελεστής Δόμησης) | Μέγιστη δομήσιμη επιφάνεια / εμβαδόν οικοπέδου | number | 0.8, 1.2, 2.4 |
| **Κάλυψη** | Ποσοστό κάλυψης οικοπέδου | percentage | 60%, 70% |
| **Μέγιστο ύψος** | Μέγιστο επιτρεπόμενο ύψος κτιρίου | meters | 10.5m, 17.5m |
| **Δ** (Πρόσωπο) | Ελάχιστη απόσταση από δρόμο | meters | 0m (σε Ο.Τ.), 4m |
| **δ** (Πλάγιες αποστάσεις) | Ελάχιστη απόσταση από πλάγια όρια | meters | 2.5m, 3m |
| **δ'** (Οπίσθια απόσταση) | Ελάχιστη απόσταση από πίσω όριο | meters | 2.5m, 3m |
| **Μέγιστοι όροφοι** | Μέγιστος αριθμός ορόφων | integer | 2, 4, 6 |
| **Χρήση γης** | Επιτρεπόμενη χρήση | enum | Κατοικία, Μικτή, Εμπορική |

### 3.2 Ειδικές Παράμετροι

| Παράμετρος | Περιγραφή |
|-----------|-----------|
| Εξωστέδες (μπαλκόνια) | Μέγιστη εξοχή, ελάχιστο ύψος |
| Υπόγειο | Επιτρεπόμενο ύψος, χρήσεις |
| Pilotis | Απαίτηση ή όχι, ελεύθερο ύψος |
| Στέγη | Μέγιστη κλίση, ύψος κορφιά |
| Ημιυπαίθριοι χώροι | Ποσοστό, μέγιστο εμβαδόν |
| Φωτοβολταϊκά / Ηλιακοί | Κανονισμοί τοποθέτησης |

---

## 4. Πηγές Δεδομένων Κανονισμού

### 4.1 Πολλαπλές πηγές (ranked by reliability)

| Πηγή | Αξιοπιστία | Τρόπος εισαγωγής |
|------|-----------|-----------------|
| **Χειροκίνητη εισαγωγή** | Υψηλή (ο μηχανικός ξέρει) | Form UI: ΣΔ, κάλυψη, ύψος, αποστάσεις |
| **Upload διατάγματος** | Μεσαία-Υψηλή | PDF/σκαν → AI Vision API → extraction |
| **AI web search** | Μεσαία | AI ψάχνει βάσει συντεταγμένων/περιοχής |
| **Αυτόματα (geodata.gov.gr)** | Υψηλή αν υπάρχει API | REST API integration (μελλοντικό) |

### 4.2 Override & Correction

- Ο χρήστης μπορεί **ΠΑΝΤΑ** να κάνει override: "Λάθος ΣΔ, είναι 0.8 όχι 1.2"
- Η AI διορθώνει αμέσως και εφαρμόζει τη νέα τιμή
- Η AI μπορεί να ζητήσει **re-search** αν ο χρήστης αμφιβάλλει

---

## 5. Αρχιτεκτονική (Planned)

### 5.1 Building Code Provider Interface

```typescript
interface BuildingCodeProvider {
  /** Unique identifier */
  id: string;  // 'nok-greece', 'bauordnung-germany', 'none'

  /** Display name */
  name: string;  // 'ΝΟΚ Ελλάδας', 'Bauordnung', 'Κανένας'

  /** Get constraints for a specific plot */
  getConstraints(plotData: PlotData): BuildingConstraints;

  /** Validate a design against constraints */
  validateDesign(design: DesignData, constraints: BuildingConstraints): ValidationResult;

  /** Get available parameters for UI form */
  getParameterDefinitions(): ParameterDefinition[];
}

interface BuildingConstraints {
  maxBuildingCoefficient: number;    // ΣΔ
  maxCoveragePercent: number;        // Κάλυψη
  maxHeight: number;                  // Μέγιστο ύψος (m)
  setbacks: {
    front: number;   // Δ
    side: number;    // δ
    rear: number;    // δ'
  };
  maxFloors: number;
  landUse: LandUseType;
  specialConditions?: string[];       // Ειδικοί όροι (ΠΔ κλπ)
}

interface ValidationResult {
  isCompliant: boolean;
  violations: Violation[];
  warnings: Warning[];
  suggestions: string[];
}
```

### 5.2 File Structure

#### Phase 1 — IMPLEMENTED (2026-05-02)

Pure ΝΟΚ engines + types + constants, ported from genarc. Zero React, zero Firestore, zero AI.

```
src/services/building-code/
├── types/
│   ├── site.types.ts                 — PlotSite, PlotFrontage, PlotType, AreaRegime, ...
│   ├── setback.types.ts              — EdgeRole, EdgeSetback, SetbackResult
│   ├── zone.types.ts                 — ZoneParameters, ZoneArtiotita
│   ├── bonus.types.ts                — BonusId, A1Scenario, A3Tier, BonusResult
│   └── gate.types.ts                 — GateStatus, GateCheck, GateResult
├── constants/
│   ├── zones.commercial.constants.ts — Γ2, ΓΠ, ΕΚΤ, ΖΟΕ-Α/Β, Κ
│   ├── zones.residential.constants.ts— Α, Β, Β1, Β2, Γ, Γ1
│   ├── zones.constants.ts            — Barrel: ZONE_PARAMETERS
│   ├── setback.constants.ts          — DEFAULT_DELTA_MIN_M, MIN_BUILDABLE_SIDE_M
│   └── bonuses.constants.ts          — BONUS_A1_COVERAGE_REDUCTION, NZEB_SD_*
├── utils/
│   └── geometry.ts                   — inwardNormal, shoelaceArea, polyEdgeLabel
├── engines/
│   ├── site-calculator.ts            — calcSyntEfarm, deriveSiteValues
│   ├── setback-calculator.ts         — classifyEdges, computeSetbackResult
│   ├── bonus-calculator.ts           — calcA1/A3/A5, applyBonuses
│   ├── zone-resolver.ts              — normalizeZoneId, lookupZone
│   ├── gate-checker.ts               — runGate0/3/5/22, runAllGates
│   ├── gate-bonuses.ts               — runGateBonuses
│   └── gate-setback.ts               — runGateSetback
├── __tests__/
│   ├── setback-calculator.test.ts    — 23 test cases (Jest)
│   └── bonus-calculator.test.ts      — 23 test cases (Jest)
└── index.ts                          — Barrel public API
```

**Exclusions Phase 1** (deferred to Phase 2):
- `runGateBrief` — depends on `BriefData` type not yet ported
- `ideaToStereoCalculator` — 3D building envelope, depends on Three.js viewer
- Zustand store — Nestor uses Firestore (Phase 2)
- React panels — UI rendering (Phase 2)

#### Phase 2 — PLANNED

Provider Pattern + persistence + UI:

```
src/services/building-code/
├── (Phase 1 files above)
├── providers/
│   ├── nok-greece-provider.ts        — Wraps Phase 1 engines as Provider
│   ├── none-provider.ts              — "Ελεύθερη σχεδίαση"
│   └── building-code-registry.ts     — Registry of available providers
├── parameter-extractor.ts            — AI Vision PDF/scan → JSON
└── persistence/
    └── building-code.firestore.ts    — Read/write project.buildingCode
```

---

## 5b. Πολυπλοκότητα ΝΟΚ — AI ως "Σύμμαχος Μηχανικού"

> Καταγράφηκε κατά τη συζήτηση (2026-02-17). Ο ΝΟΚ είναι πολύ πιο σύνθετος από βασικούς αριθμούς.

**Πρόβλημα**: Ο ΝΟΚ δεν είναι απλά "ΣΔ 0.8, κάλυψη 60%". Περιλαμβάνει εκατοντάδες αλληλεπιδρώντες κανόνες:

| Κατηγορία | Παραδείγματα |
|-----------|-------------|
| **Τι ΔΕΝ μετράει στον ΣΔ** | Κλιμακοστάσια (μέχρι ένα εύρος), εξωτερικές μονώσεις, θερμομονωτικές τοιχοπληρώσεις, ορισμένα πατάρια, αποθήκες ορισμένων διαστάσεων, ενεργειακές αναβαθμίσεις |
| **Μπόνους ΣΔ** | Παραχώρηση οικοπέδου σε Δήμο (κοινόχρηστα), παροχή θέσεων στάθμευσης |
| **Εξώστες** | Μέγιστη προβολή από σκελετό, συνολικό εμβαδόν εξωστών ανά όροφο/κτίριο |
| **Ημιυπαίθριοι** | Ποσοστό, μέγιστο εμβαδόν, κλείσιμο σε μετέπειτα φάση |
| **Εξαιρέσεις** | Γωνιακά οικόπεδα, διατηρητέα, εκτός σχεδίου, παρεκκλίσεις |
| **Εγκύκλιοι** | Διευκρινιστικές, αναιρετικές, ερμηνευτικές — αλληλοαναιρούνται |

**Στρατηγική AI**:
- Η AI φορτώνεται με **ολόκληρο τον ΝΟΚ + εγκυκλίους** στο Knowledge Base
- Ο μηχανικός ρωτάει: "Η αποθήκη 8τμ μετράει στον ΣΔ;" → η AI απαντά με αναφορά άρθρου
- Η AI **προτείνει**, ο μηχανικός **αποφασίζει** — η ευθύνη παραμένει πάντα στον μηχανικό
- **Στόχος**: Η AI γίνεται ο πιο ισχυρός σύμμαχος του μηχανικού στην ερμηνεία του ΝΟΚ

---

## 6. Ερωτήσεις Ανοιχτές [ΠΡΟΣ ΣΥΖΗΤΗΣΗ]

> Ερωτήσεις 1-6 δημιουργήθηκαν κατά τη συζήτηση. Ερωτήσεις 7-10 εντοπίστηκαν κατά τον γραμμή-γραμμή έλεγχο (2026-02-17).

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | **Φόρμα παραμέτρων**: Και τα δύο — εισαγωγή στο Project Settings (μόνιμα), εμφάνιση/επεξεργασία και στο DXF Viewer (γρήγορη αλλαγή). Μία αποθήκευση, δύο σημεία πρόσβασης. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 2 | **Firestore αποθήκευση**: Ναι, μέσα στο project document ως `buildingCode` object (provider, enabled, params, source, lastUpdated). Δεν χρειάζεται ξεχωριστό collection. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 3 | **AI extraction PDF**: Upload PDF → Vision API (gpt-4o) → structured JSON πρόταση → ο χρήστης επιβεβαιώνει/διορθώνει → αποθήκευση. Phase 3 (Vision). | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 4 | **Visual setback lines**: Ναι, σε ξεχωριστό layer "Setbacks" (διακεκομμένη μπλε). Δομήσιμη ζώνη ημιδιαφανές πράσινο. Phase 2. Ο χρήστης ανοίγει/κλείνει layers. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 5 | **Εξαιρέσεις ΝΟΚ**: Δύο επίπεδα — (1) checkboxes για βασικά (γωνιακό, διατηρητέο, εκτός σχεδίου), (2) AI-powered deep knowledge ολόκληρου ΝΟΚ + εγκυκλίων για σύνθετες ερμηνείες. AI προτείνει, μηχανικός αποφασίζει. Knowledge Base φορτωμένο με ΝΟΚ, εγκυκλίους, παρεκκλίσεις. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 6 | **ΚΕΝΑΚ**: Ξεχωριστό module, ΟΧΙ Phase 1. Ο ΚΕΝΑΚ αφορά ενεργειακές απαιτήσεις (U-values, θερμομόνωση, ενεργειακή κλάση) — εντελώς διαφορετικά δεδομένα από τον ΝΟΚ. Η αρχιτεκτονική μας (Provider Pattern) ήδη το προβλέπει. Phase 1-2 = μόνο ΝΟΚ, Phase 3+ = ΚΕΝΑΚ ως ξεχωριστός provider. Μελλοντικά: Πυροπροστασία, Προσβασιμότητα ΑμΕΑ κλπ ως επιπλέον providers. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 7 | **Χρονισμός εισαγωγής**: Και τα δύο. Σενάριο Α: Πρώτα setup στο Project Settings → η AI ξέρει ήδη. Σενάριο Β: Αν ο χρήστης ξεκινήσει χωρίς setup, η AI ρωτάει "θέλεις ελεύθερη σχεδίαση ή πες μου ΣΔ/κάλυψη;" — δεν μπλοκάρει. Σενάριο Γ: Αλλαγή κατά τη σχεδίαση — ο χρήστης λέει "τελικά ΣΔ 1.2" → η AI ενημερώνει + ελέγχει τρέχουσα σχεδίαση. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 8 | **Σύνδεση με Project**: Αυτόματα από το context. Ο DXF Viewer ήδη γνωρίζει το `projectId` (URL/context) → φέρνει το `buildingCode` object από Firestore αυτόματα → η AI εφαρμόζει τους κανόνες χωρίς καμία ενέργεια του χρήστη. Αν δεν υπάρχουν παράμετροι, η AI ρωτάει (σενάριο Β, ερώτηση #7). | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 9 | **Hard vs Soft constraints**: ΜΑΛΑΚΟΙ — πάντα προειδοποίηση, ποτέ μπλόκο. Η AI σχεδιάζει ΚΑΙ ενημερώνει. Ο μηχανικός αποφασίζει (μπορεί να έχει παρέκκλιση). Τρία επίπεδα: ℹ️ Info (>80% ορίου), ⚠️ Warning (ξεπέρασες), 🔴 Critical (>20% υπέρβαση). Σε κανένα επίπεδο δεν μπλοκάρει — AI = σύμμαχος, όχι αφεντικό. | ✅ ΑΠΑΝΤΗΘΗΚΕ |
| 10 | **Versioning κανονισμών**: Phase 1 = μόνο τρέχων ΝΟΚ (τελευταία ισχύουσα έκδοση). Πεδίο `codeVersion: '2024'` στο `buildingCode` object. Όταν βγαίνει τροποποίηση → ενημερώνεται το Knowledge Base. Phase 3+ = πολλαπλές εκδόσεις αν χρειαστεί (παλιές οικοδομικές άδειες). Το 95% των projects χρησιμοποιεί τον τρέχοντα ΝΟΚ. | ✅ ΑΠΑΝΤΗΘΗΚΕ |

---

## 7. Phase 1 Implementation Notes (2026-05-02)

### 7.1 What was ported

21 files from `C:\genarc\src\` → `C:\Nestor_Pagonis\src\services\building-code\`:
- 7 engines (pure functions, zero side effects)
- 5 types files
- 5 constants files (15 ΝΟΚ zones: Α/Β/Β1/Β2/Γ/Γ1/Γ2/ΓΠ/ΓΠ-1..3/ΕΚΤ/ΖΟΕ-Α/Β/Κ)
- 1 geometry utils file (`inwardNormal`, `shoelaceArea`, `polyEdgeLabel`)
- 2 Jest test files (46 test cases, all passing)
- 1 barrel `index.ts` (public API)

### 7.2 Functional coverage

| Capability | Function | Notes |
|-----------|----------|-------|
| ΣΔ_εφαρμοστέος (weighted) | `calcSyntEfarm` | Multi-frontage, multi-zone plots |
| Max coverage m² | `calcMaxCoverageM2` | area × pct/100 |
| Mandatory open m² | `calcMandatoryOpenM2` | Υποχρεωτικός Ακάλυπτος |
| Max buildable m² | `calcMaxBuildableM2` | syntEfarm × area |
| Per-edge setback | `computeSetbackResult` | Δ rear ≠ δ lateral, polygon inset, 9m rule |
| Bonus A1 (α–δ) | `calcA1Bonus` | Πολεοδομικά κίνητρα +ΣΔ / −coverage |
| Bonus A3 (nZEB) | `calcA3Bonus` | +5% / +10% ΣΔ |
| Bonus A5 (120 m²) | `calcA5Bonus` | Auto-applied min coverage floor |
| Combo bonuses | `applyBonuses` | C1 separate base, C6 protection zone block |
| Zone lookup | `lookupZone` | 15 canonical zones + aliases |
| Gate 0 (αρτιότητα) | `runGate0` | Min area / frontage / elevation |
| Gate 3 (ΡΓ/ΟΓ/Πρασιά) | `runGate3` | Per-frontage prassia check |
| Gate 5 (όροι δόμησης) | `runGate5` | ΣΔ / κάλυψη / ύψος display |
| Gate 22 (ιδεατό στερεό) | `runGate22` | Per-frontage H ≤ max(1.5×Π, 7.5m) |
| Gate Bonuses | `runGateBonuses` | Eligibility + summary |
| Gate Setback | `runGateSetback` | Buildable footprint check |

### 7.3 Architectural decisions

- **Path alias `@/...`** — Used throughout, matches Nestor convention (`tsconfig.base.json` paths + `jest.config.js` moduleNameMapper)
- **Function size ≤40 lines** — `applyBonuses`, `runGate0`, `runGate22` refactored with internal helpers (`applyA1`, `applyA3`, `aggregate`, `buildG0AreaCheck`, `buildG0FrontageCheck`, `buildG0ElevationCheck`, `buildG22FrontageCheck`)
- **File size ≤500 lines** — All files well under limit (max: gate-checker 250 lines)
- **Zero `any`, zero `as any`, zero `@ts-ignore`** — Enterprise TypeScript throughout
- **Test framework**: Jest (Nestor SSoT). Original genarc tests used vitest — migrated by removing `import { describe, it, expect } from 'vitest'` (Jest provides as globals)

### 7.4 What CANNOT be done yet

The Phase 1 module exposes pure functions. Until Phase 2:
- No data is persisted — every call is stateless
- No UI surfaces these computations (no Project Settings panel, no DXF Viewer overlay)
- No cross-country support — only ΝΟΚ Ελλάδας (Provider Pattern not yet wired)
- AI Vision PDF extraction not implemented

### 7.5 How to use (Phase 1)

```typescript
import {
  deriveSiteValues,
  runAllGates,
  lookupZone,
  type PlotSite,
} from '@/services/building-code';

// 1. Look up a zone
const zone = lookupZone('Β2'); // { SD: 1.2, coverage_pct: 60, ... }

// 2. Build a PlotSite (manually, or from form/Firestore in Phase 2)
const partial = { /* ... non-derived fields ... */ };
const derived = deriveSiteValues(partial);
const site: PlotSite = { ...partial, ...derived };

// 3. Run all gates
const gates = runAllGates(site);
// [{ gateId: 'gate0', status: 'pass', checks: [...] }, ...]
```

---

## 8. Phase 2 Decisions (Kickoff 2026-05-02)

> Live decisions during Phase 2 kickoff. Each Q is asked one-at-a-time in Greek with everyday metaphors per `feedback_adr_questions_style.md`. ADR is updated immediately after each answer, BEFORE the next question.

### Q1 — Σχέση με υπάρχον tab `building-data`

**Απόφαση**: **(β) Coexistence — δύο tabs παράλληλα**.

- Το παλιό tab `building-data` (BuildingDataTab.tsx + useBuildingData.ts) **παραμένει ως έχει** για τώρα.
- Δημιουργείται **νέα ξεχωριστή καρτέλα** για τα στοιχεία ΝΟΚ της Phase 1 module (ζώνη, πρόσωπα, setbacks Δ/δ, bonuses, gates).
- Αργότερα (μελλοντική φάση) η παλιά καρτέλα **θα κρυφτεί** (όχι deleted, αλλά `enabled: false` ή hide-by-flag) όταν το νέο tab καλύψει όλη τη λειτουργικότητα.
- **Σημασία**: Δύο διαφορετικά concepts — παλιό = "πραγματικά κτισμένα μεγέθη + λίγοι όροι σε memory only", νέο = "όροι δόμησης από πολεοδομία, persistent στη Firestore".

**Implications**:
- Νέο component (όνομα προς συζήτηση Q2+).
- Νέα entry στο `PROJECT_TABS` array (`src/config/project-tabs-config.ts`).
- Δεν αγγίζουμε το `useBuildingData.ts` ούτε το `BuildingDataTab.tsx` σε αυτή τη φάση.
- Migration / hide της παλιάς = **out of scope Phase 2**, ξεχωριστό ticket αργότερα.

---

### Q2 — Επίπεδο δεδομένων: project ή building;

**Απόφαση**: **(α) Project-level** — ένα σετ όρων ΝΟΚ ανά έργο.

- Όλα τα κτίρια ενός έργου χρησιμοποιούν τους **ίδιους όρους δόμησης** (ΣΔ, κάλυψη, ύψος, αποστάσεις, ζώνη).
- Αποθήκευση: `project.buildingCode` object **στο Project document** (επιβεβαιώνει την αρχική απόφαση Q2 από 2026-02-17).
- **Καλύπτει σενάρια Α + Β** (1 οικόπεδο, 1 ή πολλά κτίρια). Σενάριο Γ (2 οικόπεδα διαφορετικής ζώνης) = εξαιρετικά σπάνιο, **out of scope**.
- Αν κάποτε προκύψει σενάριο Γ, ο μηχανικός φτιάχνει **2 ξεχωριστά projects** στο Nestor. Καθαρή λύση χωρίς πολυπλοκότητα data model.

**Implications**:
- `Project` interface (`src/types/project.ts`) θα αποκτήσει νέο πεδίο `buildingCode?: ProjectBuildingCode | null`.
- Νέος τύπος `ProjectBuildingCode` με `provider`, `enabled`, `params: PlotSite (ή subset)`, `source`, `lastUpdated`.
- Δεν χρειάζεται override mechanism per-building, δεν χρειάζεται hybrid resolver.
- DXF Viewer (μελλοντικά) διαβάζει `project.buildingCode` αυτόματα από `projectId` context.

---

### Q3 — Τρόπος εισαγωγής ζώνης + αριθμών

**Απόφαση**: **(γ) Hybrid + provenance tracking + reset-to-default + audit + visual badge**.

Πατέρν εμπνευσμένο από SAP Construction, Primavera P6, Procore, Autodesk Revit, Google Material — όλα τα enterprise συστήματα κάνουν το ίδιο.

**Λειτουργικότητα**:

1. **Optional zone dropdown** — 15 τυπικές ζώνες ΝΟΚ (Α/Β/Β1/Β2/Γ/Γ1/Γ2/ΓΠ/ΓΠ-1..3/ΕΚΤ/ΖΟΕ-Α/Β/Κ) + "—" (none/custom). Πηγή: `ZONE_PARAMETERS` (Phase 1).
2. **Auto-fill on zone select** — Διαλέγοντας ζώνη, τα πεδία ΣΔ/κάλυψη/ύψος/Δ/δ προγεμίζονται από τα defaults της ζώνης.
3. **User override anywhere** — Κάθε πεδίο editable. Override = το ξέρει το σύστημα.
4. **Provenance tracking** — Κάθε πεδίο έχει `{value: number, source: 'zone' | 'user' | 'default'}`. Provenance object χωριστά (πιο clean): `provenance: { sd: 'zone', coverage: 'user', ... }`.
5. **Reset to default** — Κουμπί ↺ ανά πεδίο: επαναφέρει την τιμή της επιλεγμένης ζώνης, αλλάζει provenance σε `'zone'`.
6. **Visual badge** — UI δείχνει 🟢 "από ζώνη Β2" ή 🟡 "user override" ή ⚪ "default ΝΟΚ" δίπλα σε κάθε πεδίο.
7. **Audit trail** — Κάθε change περνάει από `EntityAuditService.recordChange()` (ADR-195) — ποιος/πότε/τι.
8. **Free input mode** — Αν dropdown ζώνης = "—" (κενό), ο χρήστης γράφει σκέτους αριθμούς, provenance = `'user'` παντού. Δεν μπλοκάρει.

**Implications**:
- Νέος τύπος `ProjectBuildingCodeProvenance` (provenance map).
- Αλλαγή στο πώς αποθηκεύουμε `params` — όχι μόνο `PlotSite`, αλλά `{ params: PlotSite, provenance: Record<keyof PlotSite, 'zone' | 'user' | 'default'> }`.
- UI components: `ProvenanceBadge`, `ResetToDefaultButton`, `ZoneSelector` (optional dropdown).
- Audit hook: ADR-195 `useEntityAudit`.

**Παράδειγμα UI**:
```
Ζώνη ΝΟΚ: [Β2 ▼]  ← optional dropdown

ΣΔ:        [1.2] 🟢 από ζώνη Β2          [↺ reset]
Κάλυψη %:  [55]  🟡 user override (ήταν 60) [↺ reset]
Ύψος (m):  [13.5] 🟢 από ζώνη Β2          [↺ reset]
Δ (m):     [2.5] 🟢 από ζώνη Β2          [↺ reset]
```

---

### Q4 — Δήλωση τύπου οικοπέδου & αριθμού προσώπων

**Απόφαση**: **(γ) Hybrid — type dropdown + auto-sync αριθμού + ±buttons + provenance**.

Πατέρν εμπνευσμένο από SAP Real Estate, Primavera P6 CBS, Procore Project Templates, Autodesk Revit Family Types, Google Maps Place Types, **ESRI ArcGIS Parcel Fabric** (το πιο σχετικό για γεωμηχανική).

**ΕΠΕΚΤΑΣΗ τύπων οικοπέδου** — η Phase 1 `PlotType` έχει **3 τύπους**, διευρύνεται σε **5**:

| Τύπος | Κωδικός | Πρόσωπα | Περιγραφή |
|-------|---------|---------|-----------|
| Μεσαίο | `mesaio` | 1 | Δρόμος μόνο μπροστά |
| Γωνιακό | `goniako` | 2 | Δύο δρόμοι σε γωνία (π.χ. Πατησίων + Στουρνάρα) |
| **Δισγωνιαίο** ⭐ NEW | `disgoniaio` | 3 | **Σχήμα "Π" δρόμων** — τρεις δρόμοι γύρω από οικόπεδο σε σχήμα Π |
| **Τεσσάρων πλευρών** ⭐ NEW | `four_sided` | 4 | Νησιωτικό (block) — δρόμοι και στις 4 πλευρές |
| Διαμπερές | `diamperes` | 2 | Δύο δρόμοι σε αντικριστές πλευρές (μπροστά + πίσω) |

**Λειτουργικότητα**:

1. **Type dropdown πρώτος** — επιλογή για 95% των περιπτώσεων.
2. **Auto-fill expected count** — γωνιακό = 2 πρόσωπα έτοιμα, δισγωνιαίο = 3, τέσσερις πλευρές = 4.
3. **"+ Προσθήκη προσώπου" κουμπί** για σπάνιες περιπτώσεις (γωνιακό+διαμπερές, παράξενη γεωμετρία).
4. **"× Διαγραφή" ανά πρόσωπο** — αν έγινε λάθος ή άλλαξε γεωμετρία.
5. **Type ↔ count consistency check** — αν διαγράψεις/προσθέσεις πρόσωπα και ο αριθμός δεν ταιριάζει με τον τύπο → warning + dropdown γίνεται "παράξενο/προσαρμοσμένο" (νέος τύπος `custom`).
6. **Provenance ανά πρόσωπο** — `{source: 'type-default' | 'user-added'}`.

**Implications (κώδικας)**:
- `src/services/building-code/types/site.types.ts` line 21: επέκταση `PlotType` union → `'mesaio' | 'goniako' | 'disgoniaio' | 'four_sided' | 'diamperes' | 'custom'`.
- Update `gate-checker.ts` αν έχει switch/case σε PlotType (TBD).
- Νέο type `PlotFrontageProvenance` με `source` field.
- Νέοι i18n keys: `nestor.buildingCode.plotType.disgoniaio`, `nestor.buildingCode.plotType.fourSided`, etc. (el + en).
- Helper function `expectedFrontagesForPlotType(type): number`.
- Validation: αν actual count ≠ expected → emit warning, γίνε `custom`.

**Παράδειγμα UI**:
```
Τύπος οικοπέδου: [Γωνιακό ▼]  ← drives default count

▼ Πρόσωπο 1 (Πατησίων)         🟢 από τύπο "γωνιακό"  [×]
   [Π, στάθμη, μήκος, πρασιά, RG=OG, ...]

▼ Πρόσωπο 2 (Στουρνάρα)        🟢 από τύπο "γωνιακό"  [×]
   [...]

[+ Προσθήκη προσώπου]   ← για σπάνιο 3-4
```

---

### Q5 — ΝΟΚ Bonuses (Α1/Α3/Α5) στη φόρμα

**Απόφαση**: **OUT-OF-SCOPE Phase 2**. Δεν εμφανίζονται καθόλου στη φόρμα.

- Τα Phase 1 engines (`calcA1Bonus`, `calcA3Bonus`, `calcA5Bonus`, `applyBonuses`) **παραμένουν** στον κώδικα — έτοιμα για μελλοντική φάση.
- Το πεδίο `PlotSite.bonuses?: BonusSelections` **παραμένει optional στο data model** — όταν προστεθεί UI θα αποθηκεύεται κανονικά.
- Στη φόρμα Phase 2 **δεν εμφανίζονται καθόλου** Α1/Α3/Α5 fields — ούτε checkboxes, ούτε collapsed sections.
- `BonusResult` derived field σε `PlotSite` παραμένει — υπολογίζεται με κενά defaults (`{appliedSD: 0, appliedCoverageReduction: 0, lineItems: []}`) όταν δεν υπάρχουν user selections.

**Implications**:
- Καθαρή φόρμα Phase 2 — λιγότερα πεδία, πιο γρήγορη υλοποίηση.
- Future ticket: "Phase 2.5 — Add Bonuses UI to building-code form" (ξεχωριστό από Phase 2).
- Δεν αγγίζουμε bonuses-related types (`BonusSelections`, `BonusResult`, `BonusLineItem`).
- AI Drawing Assistant (Phase 3) μπορεί να χρειαστεί τα bonuses — θα προστεθούν τότε.

---

### Q6 — Σκοπός Phase 2 form (final scope)

**Απόφαση**: **Σενάριο (β) — 6 πεδία στη φόρμα**. Ultra-minimal CRUD form.

**ΦΟΡΜΑ Phase 2 — μόνο 6 πεδία**:

| # | Πεδίο | Type | Provenance |
|---|-------|------|------------|
| 1 | Τύπος οικοπέδου | enum (5 + custom) | — |
| 2 | Αριθμός προσώπων | integer (1-4) — auto-sync με τύπο, ±buttons | — |
| 3 | Ζώνη ΝΟΚ (optional) | enum dropdown (15 ζώνες + κενό) | — |
| 4 | ΣΔ | number | `'zone' \| 'user'` |
| 5 | Κάλυψη % | number (0-100) | `'zone' \| 'user'` |
| 6 | Μέγιστο ύψος (m) | number | `'zone' \| 'user'` |

**OUT OF SCOPE Phase 2** (όλα μένουν στον κώδικα Phase 1, αλλά **καμία UI**):
- Δ (απόσταση πίσω) και δ (πλάγια απόσταση)
- Bonuses Α1/Α3/Α5
- ΚΑΕΚ, διεύθυνση, δήμος, νομός
- Αρτιότητα (rules), βάρη (encumbrances), ρυμοτομία (expropriation)
- ΣΦΕ, ΟΣΕ, κλίση εδάφους
- Όμορα κτίρια
- Πολύγωνο/συντεταγμένες (DXF data)
- Λεπτομέρειες προσώπου: όνομα δρόμου, πλάτος δρόμου (Π), στάθμη κρασπέδου, πλάτος πεζοδρομίου, μήκος προσώπου, πρασιά, οπίσθια πρασιά, RG=OG
- Allowed uses, area regime, syntOverride per frontage

**Πρόσωπα — απλοποιημένη μορφή Phase 2**:
- Κάθε πρόσωπο = **απλώς ένα label** ("Πρόσωπο 1", "Πρόσωπο 2"...) χωρίς εσωτερικά πεδία.
- Ο αριθμός προσώπων είναι αυτόνομος integer (1-4), driven από τον τύπο οικοπέδου με override.
- Future ticket: "Phase 2.5 — Add frontage details (street width, prassia, etc.)".

**Implications (κρίσιμες)**:
- Phase 2 = **καθαρή CRUD φόρμα** — **καθόλου engines runtime**, καθόλου gate computations, καθόλου `runAllGates()`. Απλώς save/read.
- Δεν χρειάζεται `deriveSiteValues()` calls στη Phase 2 — οι derived τιμές (`syntEfarm`, `maxBuildableM2`, etc.) θα υπολογιστούν σε Phase 3 όταν πάμε σε DXF Viewer/AI integration.
- **Το data model `PlotSite` είναι υπερβολικά πλούσιο** για τη Phase 2 φόρμα. Χρειαζόμαστε νέο **Phase 2 partial type** που είναι Pick όλων των 6 πεδίων + provenance.
- Νέος τύπος `ProjectBuildingCodePhase2` ή `BuildingCodeFormData`:
  ```typescript
  interface ProjectBuildingCodePhase2 {
    plotType: PlotType;
    frontagesCount: number; // 1-4
    zoneId: string | null;  // null = no zone selected, free input
    sd: number;
    coveragePct: number;
    maxHeight: number;
    provenance: {
      sd: 'zone' | 'user';
      coveragePct: 'zone' | 'user';
      maxHeight: 'zone' | 'user';
    };
    enabled: boolean;
    lastUpdated: string;  // ISO
  }
  ```
- Όταν έρθει Phase 3, μετατρέπουμε `ProjectBuildingCodePhase2` → full `PlotSite` με sane defaults για όλα τα missing.

**WHY Ultra-minimal**:
- Γρήγορο shipping (~3-5 ημέρες implementation εκτιμώμενο).
- Καμία αμφιβολία τι σώζουμε στη Firestore.
- Μηδέν runtime computation — μηδέν race conditions, μηδέν χρόνος loading.
- Επόμενες ομάδες πεδίων = ξεχωριστά tickets με δικές τους ερωτήσεις/απαντήσεις.

---

### Q7 — Validation παράλογων τιμών

**Απόφαση**: **(δ) Hybrid validation** — hard block για αδύνατα + soft warning για ασυνήθιστα + audit log overrides + inline feedback.

Πατέρν εμπνευσμένο από SAP 3-tier validation, Procore confidence indicators, TurboTax outlier warnings, Autodesk Revit Code Checker, Snowflake/DataDog anomaly detection.

**Συγκεκριμένα όρια για ΝΟΚ**:

| Πεδίο | Hard block | Soft warning |
|-------|-----------|--------------|
| ΣΔ | <0 ή >10 | >5 ("ασυνήθιστα μεγάλο"), <0.4 ("ασυνήθιστα μικρό") |
| Κάλυψη % | <0 ή >100 | >85 ("ασυνήθιστα μεγάλη") |
| Ύψος (m) | <0 ή >100 | >30 ("ασυνήθιστα ψηλό κτίριο") |
| Πρόσωπα count | <1 ή >4 | =3 ("πρέπει να είναι δισγωνιαίο;"), =4 ("νησιωτικό;") |

**Λειτουργικότητα**:

1. **Hard block** — Αν τιμή εκτός hard range, save button γίνεται disabled + inline error message δίπλα στο πεδίο. Δεν περνάει στη Firestore.
2. **Soft warning** — Αν τιμή εκτός soft range αλλά εντός hard, εμφανίζεται "⚠️" badge + tooltip ("ΣΔ=6.0 ασυνήθιστα μεγάλο, συνήθως 0.4-5"). Save επιτρέπεται.
3. **Override logging** — Αν αποθηκεύσεις soft-warned τιμή, καταγράφεται στο audit trail μέσω `EntityAuditService.recordChange()` με `metadata: { hadSoftWarning: true, threshold: 'sd>5', originalValue: 6.0 }`. Future analysts μπορούν να δουν πόσες φορές ξεπεράστηκαν τα όρια.
4. **Inline feedback** — Όλα τα errors/warnings ΔΙΠΛΑ στο πεδίο (όχι popup, όχι top banner, όχι block ολόκληρης φόρμας). Pattern Material Design.
5. **Configurable thresholds** — Όρια σε νέο `src/services/building-code/constants/validation.constants.ts`:
   ```typescript
   export const PHASE2_VALIDATION_LIMITS = {
     sd:           { hardMin: 0, hardMax: 10, softMin: 0.4, softMax: 5 },
     coveragePct:  { hardMin: 0, hardMax: 100, softMin: 0, softMax: 85 },
     maxHeight:    { hardMin: 0, hardMax: 100, softMin: 0, softMax: 30 },
     frontagesCount: { hardMin: 1, hardMax: 4 },
   } as const;
   ```

**Implications**:
- Νέο file `src/services/building-code/constants/validation.constants.ts`.
- Νέο utility `validateBuildingCodePhase2(data): { errors: ValidationError[], warnings: ValidationWarning[] }`.
- Form hook χρησιμοποιεί validator on every change → blocks/flags accordingly.
- Audit hook (ADR-195) εμπλουτισμένο με `metadata.hadSoftWarning`.
- i18n keys: `validation.sd.tooLarge`, `validation.coverage.outOfRange`, etc. (el + en).

---

## 8b. Phase 2 Implementation Plan (consolidated post-kickoff)

Βάσει των αποφάσεων Q1-Q7, η Phase 2 έχει συγκεκριμένο, κλειστό scope:

### Files to create

```
src/
├── types/
│   └── project-building-code.ts          — ProjectBuildingCodePhase2, Provenance
├── services/building-code/
│   ├── constants/
│   │   └── validation.constants.ts       — PHASE2_VALIDATION_LIMITS
│   └── validation/
│       └── validate-phase2.ts            — validateBuildingCodePhase2()
├── components/projects/building-code/    — νέα καρτέλα (separate from old building-data)
│   ├── BuildingCodeTab.tsx               — Container component
│   ├── BuildingCodeForm.tsx              — Form με 6 πεδία
│   ├── ZoneSelector.tsx                  — Optional 15-zone dropdown
│   ├── PlotTypeSelector.tsx              — 5+custom dropdown
│   ├── FrontagesCounter.tsx              — Counter with ±buttons
│   ├── ProvenanceBadge.tsx               — 🟢/🟡/⚪ visual badge
│   ├── ResetToDefaultButton.tsx          — ↺ button per field
│   └── BuildingCodeValidationDisplay.tsx — Inline errors/warnings
├── hooks/
│   └── useProjectBuildingCode.ts         — CRUD + provenance + validation
└── i18n/locales/
    ├── el/buildingCode.json              — Greek labels (FIRST)
    └── en/buildingCode.json              — English labels
```

### Files to modify

- `src/types/project.ts` — `Project.buildingCode?: ProjectBuildingCodePhase2 | null`
- `src/services/building-code/types/site.types.ts` — extend `PlotType` union (Q4)
- `src/config/project-tabs-config.ts` — register new tab (παράλληλα με `building-data`)
- `src/constants/property-statuses-enterprise.ts` — `PROJECT_TAB_LABELS.BUILDING_CODE`, etc.

### Φόρμα — 6 πεδία τελικά

```
┌─────────────────────────────────────────────────┐
│  Όροι Δόμησης (ΝΟΚ)                             │
├─────────────────────────────────────────────────┤
│                                                  │
│  Τύπος οικοπέδου: [Γωνιακό ▼]                   │
│  Πρόσωπα: [2] [+] [−]                            │
│                                                  │
│  Ζώνη ΝΟΚ: [Β2 ▼]  (optional)                   │
│                                                  │
│  ΣΔ:        [1.20]  🟢 από ζώνη Β2  [↺]         │
│  Κάλυψη %:  [60]    🟢 από ζώνη Β2  [↺]         │
│  Ύψος (m):  [13.5]  🟢 από ζώνη Β2  [↺]         │
│                                                  │
│                            [Ακύρωση]  [Αποθήκευση] │
└─────────────────────────────────────────────────┘
```

### Permissions

Standard project edit permissions — **όποιος μπορεί να επεξεργαστεί το έργο μπορεί να αλλάξει buildingCode**. Όχι ξεχωριστό RBAC role. Audit μέσω `EntityAuditService` (ADR-195).

### Out-of-scope (future tickets)

- **Phase 2.5** — Add Δ/δ setbacks, frontage details (street, prassia, etc.)
- **Phase 2.6** — Add Bonuses Α1/Α3/Α5 UI
- **Phase 2.7** — Add identity (KAEK), legal (αρτιότητα/βάρη/ρυμοτομία), terrain
- **Phase 3** — DXF Viewer integration, polygon coordinates, gates runtime, AI Drawing Assistant
- **Phase 3.5** — Hide παλιό `building-data` tab (μόλις νέος καλύπτει χρήση)
- **Phase 4** — Provider Pattern (multi-country: Γερμανία, Κύπρος)

---

## 9. Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-02-17 | Initial draft — Modular architecture, ΝΟΚ parameters, provider interface | Claude + Γιώργος |
| 2026-02-17 | Έλεγχος γραμμή-γραμμή: 4 νέες ερωτήσεις (#7-#10) | Claude |
| 2026-05-02 | **Phase 1 IMPLEMENTED** — ported 21 files (engines + types + constants + tests) from genarc. Status: DRAFT → PARTIAL. 46/46 tests passing. Refactored `applyBonuses` + `runGate0` + `runGate22` to comply with ≤40-line function rule. | Claude + Γιώργος |
| 2026-05-02 | **Phase 2 Kickoff Q1**: Coexistence — νέο tab παράλληλα με παλιό `building-data`. Hide παλιού = ξεχωριστό ticket αργότερα. | Claude + Γιώργος |
| 2026-05-02 | **Phase 2 Kickoff Q2**: Project-level data — `project.buildingCode` object στο Project document. Σενάρια Α+Β covered, Γ out-of-scope (split projects). | Claude + Γιώργος |
| 2026-05-02 | **Phase 2 Kickoff Q3**: Hybrid input mode — optional zone dropdown + auto-fill + user override + provenance tracking + reset-to-default + audit + visual badge. Enterprise pattern (SAP/Primavera/Procore/Revit/Google). | Claude + Γιώργος |
| 2026-05-03 | **Phase 2 Kickoff Q4**: Hybrid plot-type dropdown + auto-sync count + ±buttons + provenance. **PlotType union ΕΠΕΚΤΑΘΗΚΕ**: 3 → 5 τύποι (`mesaio` "Μεσαίο", `goniako` "Γωνιακό", **`disgoniaio` "Δισγωνιαίο" (Π-shape, 3 πρόσωπα)**, **`four_sided` "Τεσσάρων πλευρών" (νησιωτικό, 4 πρόσωπα)**, `diamperes` "Διαμπερές") + `custom` fallback. Απαιτείται type extension στο `site.types.ts`. | Claude + Γιώργος |
| 2026-05-03 | **Phase 2 Kickoff Q5**: Bonuses Α1/Α3/Α5 **OUT-OF-SCOPE** Phase 2. Engines παραμένουν, types παραμένουν, αλλά **καμία UI για bonuses**. Future ticket: Phase 2.5. | Claude + Γιώργος |
| 2026-05-03 | **Phase 2 Kickoff Q6**: ULTRA-MINIMAL form scope — **6 πεδία ΜΟΝΟ** (τύπος οικοπέδου, αριθμός προσώπων, ζώνη, ΣΔ, κάλυψη%, ύψος). Καθαρή CRUD φόρμα, καθόλου engines runtime, καθόλου setbacks (Δ/δ), καθόλου legal/terrain/identity/adjacent/polygon. Νέος τύπος `ProjectBuildingCodePhase2`. | Claude + Γιώργος |
| 2026-05-03 | **Phase 2 Kickoff Q7**: Hybrid validation — hard block για αδύνατα (ΣΔ<0,>10, κάλυψη<0,>100, ύψος<0,>100, count<1,>4) + soft warning για ασυνήθιστα (ΣΔ>5, κάλυψη>85, ύψος>30) + audit log overrides + inline feedback. Νέο `validation.constants.ts`. Enterprise pattern (SAP/Procore/TurboTax/Revit). | Claude + Γιώργος |
| 2026-05-03 | **Phase 2 Kickoff CLOSED** — 7 αποφάσεις, implementation plan consolidated σε §8b. Έτοιμο για coding (Sonnet 4.6 για implementation). | Claude + Γιώργος |
