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

## 8. Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-02-17 | Initial draft — Modular architecture, ΝΟΚ parameters, provider interface | Claude + Γιώργος |
| 2026-02-17 | Έλεγχος γραμμή-γραμμή: 4 νέες ερωτήσεις (#7-#10) | Claude |
| 2026-05-02 | **Phase 1 IMPLEMENTED** — ported 21 files (engines + types + constants + tests) from genarc. Status: DRAFT → PARTIAL. 46/46 tests passing. Refactored `applyBonuses` + `runGate0` + `runGate22` to comply with ≤40-line function rule. | Claude + Γιώργος |
