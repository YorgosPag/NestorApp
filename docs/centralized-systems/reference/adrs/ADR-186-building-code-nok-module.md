# ADR-186: Building Code Module — Modular Κανονισμός Δόμησης (ΝΟΚ)

> **Status**: DRAFT — Requirements Gathering
> **Date**: 2026-02-17
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

### 5.2 File Structure (Planned)

```
src/services/building-code/
├── types.ts                          — Interfaces (BuildingCodeProvider, BuildingConstraints)
├── building-code-registry.ts         — Registry of available providers
├── providers/
│   ├── nok-greece-provider.ts        — ΝΟΚ Ελλάδας implementation
│   ├── none-provider.ts              — "Ελεύθερη σχεδίαση" (no constraints)
│   └── [future-providers]/
├── constraint-validator.ts           — Validates design against constraints
└── parameter-extractor.ts            — Extract params from PDFs/web (AI Vision)
```

---

## 6. Ερωτήσεις Ανοιχτές [ΠΡΟΣ ΣΥΖΗΤΗΣΗ]

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | Πώς ακριβώς θα εμφανίζεται η φόρμα παραμέτρων; Στο project settings ή στο DXF Viewer; | ΑΝΟΙΧΤΗ |
| 2 | Θα αποθηκεύονται οι παράμετροι ανά project στο Firestore; | ΑΝΟΙΧΤΗ |
| 3 | Πώς ακριβώς θα λειτουργεί η AI extraction από PDF διατάγματα; | ΑΝΟΙΧΤΗ |
| 4 | Θα δείχνει visually στον canvas τα setback lines (γραμμές αποστάσεων); | ΑΝΟΙΧΤΗ |
| 5 | Πώς θα χειρίζεται τις εξαιρέσεις (π.χ. γωνιακό οικόπεδο = μεγαλύτερη κάλυψη); | ΑΝΟΙΧΤΗ |
| 6 | Θα υποστηρίζει Ενεργειακό Κανονισμό (ΚΕΝΑΚ) εκτός από ΝΟΚ; | ΑΝΟΙΧΤΗ |

---

## 7. Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-02-17 | Initial draft — Modular architecture, ΝΟΚ parameters, provider interface | Claude + Γιώργος |
