# ADR-175: Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)

**Ημερομηνία:** 2026-02-11
**Κατάσταση:** PHASE_1B_IMPLEMENTED — Types + Services + Cost Engine + Config + UI Layer
**Συγγραφέας:** Claude Opus 4.6 + Γιώργος Παγώνης

---

## 1. Σκοπός

Αρχιτεκτονική αναφορά για την ένταξη συστήματος **επιμετρήσεων** (Quantity Surveying) στην εφαρμογή Nestor. Καλύπτει:

- **Χειρωνακτικές επιμετρήσεις** (Phase 1 — άμεση υλοποίηση)
- **Αυτόματες επιμετρήσεις από DXF** (Phase 2 — μελλοντική υλοποίηση)
- Σύνδεση με Gantt, κοστολόγηση, ιεραρχία κτιρίων/έργων

---

## 2. Ανάλυση Υφιστάμενης Αρχιτεκτονικής

### 2.1 Ιεραρχία Οντοτήτων (τρέχουσα)

```
Company (Εταιρεία)
  └─ Project (Έργο)
       └─ Building (Κτίριο)
            ├─ Floor (Όροφος)
            │    └─ Unit (Μονάδα/Διαμέρισμα)
            ├─ Parking Spot (Θέση Στάθμευσης)
            └─ Storage (Αποθήκη)
```

### 2.2 Σημεία Σύνδεσης

| Σύστημα | Τοποθεσία | Σχέση με Επιμετρήσεις |
|---------|-----------|----------------------|
| **Gantt Chart** | `building-management/` — ανά **κτίριο** | Φάσεις κατασκευής → σύνδεση υλικών/εργασιών |
| **DXF Viewer** | `subapps/dxf-viewer/` | Μελλοντικά: αυτόματη εξαγωγή μετρήσεων |
| **Measurements (DXF)** | `src/types/measurements.ts` | Μετρήσεις αποστάσεων/εμβαδών μέσα στο DXF |
| **Construction Phases** | `construction_phases` collection | Φάσεις: σκυρόδεμα, τοιχοποιία, σοβάδες κλπ |
| **Construction Tasks** | `construction_tasks` collection | Εργασίες ανά φάση |

### 2.3 Γιατί το Gantt είναι στα Κτίρια (και όχι στα Έργα)

Ο Γιώργος αποφάσισε σωστά: ένα **Έργο** μπορεί να περιλαμβάνει πολλά κτίρια σε διαφορετικά στάδια κατασκευής. Κάθε κτίριο έχει τη δική του χρονοδιάγραμμα. Αυτό ευθυγραμμίζεται με τη διεθνή πρακτική (βλ. §4).

---

## 3. Έρευνα Αγοράς — Πώς το Κάνουν οι Μεγάλοι

### 3.1 Μεγάλα Λογισμικά Κατασκευών

| Λογισμικό | Εταιρεία | Ιεραρχία BOQ | Υλικά/Εργασίες | Σύνδεση Gantt |
|-----------|----------|-------------|-----------------|---------------|
| **Revit + Navisworks** | Autodesk | Project → Building → Element → Material | Ξεχωριστά schedules | 4D/5D BIM integration |
| **iTWO** | RIB Software | Project → Structure → WBS → BOQ Item | Unified cost model | Ενσωματωμένο |
| **Vico Office** | Trimble | Project → Location → Task → Resource | Materials + Labor + Equipment | 5D scheduling |
| **PlanSwift** | ConstructConnect | Project → Page → Assembly → Item | Templates ανά trade | Export σε scheduling |
| **CostX** | Exactal | Project → Building → Group → Item | Separate rates | Export |
| **Cubit** | Buildsoft | Project → Trade → BOQ Item | Combined | Όχι ενσωματωμένο |
| **ΕΡΓΟΛΗΠΤΗΣ** | ACE-Hellas | Έργο → ΑΤΟΕ κατηγορίες → Εργασία | ΑΤΟΕ format | Όχι |

### 3.2 Κοινό Μοτίβο — 5D BIM

Η βιομηχανία κινείται προς το **5D BIM**:

```
3D Model (γεωμετρία)
  + 4D = Χρονοπρογραμματισμός (Gantt)
  + 5D = Κοστολόγηση (BOQ + Τιμές)
```

**Βασική αρχή:** Κάθε στοιχείο κατασκευής (element) συνδέεται ταυτόχρονα με:
- Γεωμετρικά δεδομένα (ποσότητες)
- Χρονοδιάγραμμα (πότε κατασκευάζεται)
- Κόστος (υλικά + εργασία + εξοπλισμός)

### 3.3 Ελληνικά Πρότυπα — ΑΤΟΕ

Το **Αναλυτικό Τιμολόγιο Οικοδομικών Εργών (ΑΤΟΕ)** ορίζει τις κατηγορίες εργασιών:

| Κωδ. | Κατηγορία ΑΤΟΕ | Παραδείγματα |
|------|----------------|-------------|
| ΟΙΚ-1 | **Χωματουργικά** | Εκσκαφές, επιχώσεις, μεταφορές |
| ΟΙΚ-2 | **Σκυροδέματα** | Θεμέλια, πλάκες, κολώνες, δοκοί |
| ΟΙΚ-3 | **Τοιχοποιίες** | Τούβλα, μπλόκ, πέτρα |
| ΟΙΚ-4 | **Επιχρίσματα** | Σοβάδες εσωτ./εξωτ., ειδικοί σοβάδες |
| ΟΙΚ-5 | **Πατώματα/Δάπεδα** | Πλακάκια, ξύλο, μάρμαρο, μωσαϊκό |
| ΟΙΚ-6 | **Κουφώματα** | Πόρτες, παράθυρα, ρολά |
| ΟΙΚ-7 | **Χρωματισμοί** | Βαφές εσωτ./εξωτ., βερνίκια |
| ΟΙΚ-8 | **Υδραυλικά** | Σωληνώσεις, είδη υγιεινής, θέρμανση |
| ΟΙΚ-9 | **Ηλεκτρολογικά** | Καλωδιώσεις, πίνακες, φωτισμός |
| ΟΙΚ-10 | **Μονώσεις** | Θερμομόνωση, υγρομόνωση, ηχομόνωση |
| ΟΙΚ-11 | **Σοβατεπί/Ποδιές** | Σοβατεπί δαπέδων, ποδιές παραθύρων |
| ΟΙΚ-12 | **Μεταλλικά** | Κάγκελα, σκάλες, ειδικές κατασκευές |

### 3.4 Διαχωρισμός Υλικών vs Εργασιών

**Διεθνής πρακτική (5D BIM maturity):**

Κάθε BOQ item αναλύεται σε **3 στοιχεία κόστους**:

| Στοιχείο | Περιγραφή | Μονάδα | Παράδειγμα |
|----------|-----------|--------|-----------|
| **Υλικά** (Materials) | Κόστος αγοράς υλικών | €/m², €/m³, €/τεμ | Πλακάκια: 25€/m² |
| **Εργασία** (Labor) | Κόστος εργατοωρών | €/ώρα, €/m² | Τοποθέτηση: 15€/m² |
| **Εξοπλισμός** (Equipment) | Μηχανήματα/εργαλεία | €/ημέρα | Γερανός: 200€/ημέρα |

**Ελληνική πρακτική (ΑΤΟΕ):** Κάθε άρθρο τιμολογίου περιλαμβάνει αναλυτική τιμή που αναλύεται σε υλικά + εργασία + γενικά έξοδα + εργολαβικό κέρδος.

---

## 4. Αρχιτεκτονική Πρόταση

### 4.1 ΑΠΟΦΑΣΗ: Επιμετρήσεις ανά ΚΤΙΡΙΟ (όχι ανά Έργο)

**Αιτιολόγηση:**

| Κριτήριο | Ανά Έργο | Ανά Κτίριο ✅ |
|----------|---------|--------------|
| Ευθυγράμμιση με Gantt | ❌ Gantt είναι ανά κτίριο | ✅ Ίδιο επίπεδο |
| Διαχείριση πολυκτιριακών | ❌ Μπερδεμένο | ✅ Καθαρός διαχωρισμός |
| Ελληνική πρακτική | — | ✅ Επιμέτρηση ανά κτίριο |
| Σύνδεση με μονάδες/ορόφους | ❌ Χάνεται η σχέση | ✅ Άμεση σύνδεση |
| DXF σχέδια | ❌ DXF = 1 κτίριο | ✅ 1:1 αντιστοίχιση |
| Διεθνής πρακτική (Revit/iTWO) | — | ✅ Element-per-building |

**Συμπέρασμα:** Οι επιμετρήσεις μπαίνουν στο **Building level**, ακριβώς δίπλα στο Gantt chart, ως νέο tab στο building management.

**Rollup στο Project:** Αυτόματος υπολογισμός αθροίσματος (project BOQ = Σ building BOQs).

### 4.1.1 ΑΠΟΦΑΣΗ: Dual Scope — Κτίριο ή Μονάδα (Συζήτηση Γιώργου)

Ο χρήστης επιλέγει **ελεύθερα** αν μια εργασία αφορά ολόκληρο το κτίριο ή μεμονωμένη μονάδα:

| Τύπος Εργασίας | Scope | Παράδειγμα |
|----------------|-------|-----------|
| **Δομικά / Κοινά** | `building` | Μπετά, τοιχοποιίες, σκυρόδεμα, μονώσεις, στέγη |
| **Φινιρίσματα / Ατομικά** | `unit` | Πλακάκια, δάπεδα, χρώματα, είδη υγιεινής, κουζίνα |

**Κρίσιμη αρχή — Πλήρης ελευθερία χρήστη:**
- Δεν υπάρχει **κανένας** αυτόματος περιορισμός (π.χ. "μπετά = μόνο κτίριο")
- Αν κάποιος θέλει να βάλει μπετά ανά μονάδα, **μπορεί**
- Αν κάποιος θέλει να βάλει πλακάκια ανά κτίριο (ίδια παντού), **μπορεί**
- Η εφαρμογή είναι **εργαλείο**, δεν επιβάλλει μεθοδολογία

**Data model impact:**
```typescript
scope: 'building' | 'unit';
linkedUnitId?: string | null;  // null αν scope = 'building'
```

### 4.1.2 ΑΠΟΦΑΣΗ: Προϋπολογιστική vs Πραγματική Επιμέτρηση (Variance Analysis)

Κάθε BOQ Item υποστηρίζει **δύο σετ ποσοτήτων**:

| Πεδίο | Σκοπός | Πότε Συμπληρώνεται |
|-------|--------|-------------------|
| `estimatedQuantity` | Προϋπολογιστική εκτίμηση | Πριν την κατασκευή (από σχέδια) |
| `actualQuantity` | Πραγματική ποσότητα | Κατά/μετά την κατασκευή |
| `variance` | Αυτόματη απόκλιση (%) | Computed: `(actual - estimated) / estimated × 100` |

**Παράδειγμα:**

| Εργασία | Εκτίμηση | Πραγματικά | Απόκλιση |
|---------|----------|-----------|----------|
| Πλακάκια δαπέδου | 120 m² | 128 m² | +6.7% |
| Σοβάς εσωτ. | 450 m² | 445 m² | -1.1% |
| Κουφώματα | 12 τεμ | 12 τεμ | 0% |

**Οφέλη:**
- Variance analysis — ξέφυγες ή ήσουν μέσα στον προϋπολογισμό;
- Ιστορικά δεδομένα — με τον καιρό μαθαίνεις ότι "πάντα χρειάζεσαι +7% πλακάκια"
- Πληρωμή υπεργολάβων — βάσει πραγματικών ποσοτήτων

**Data model impact:**
```typescript
estimatedQuantity: number;      // Προϋπολογιστική
actualQuantity?: number | null; // Πραγματική (συμπληρώνεται αργότερα)
// variance υπολογίζεται στο UI, δεν αποθηκεύεται
```

### 4.1.3 ΑΠΟΦΑΣΗ: Κεντρικός Τιμοκατάλογος — 3 Επίπεδα Κληρονομικότητας

Enterprise-class τιμοκατάλογος με **inheritance chain** (όπως Autodesk, RIB iTWO, Trimble Vico):

```
Επίπεδο 1: Master Price List (εταιρείας)
  │  "Βασικές τιμές 2026" — ενημερώνεται 1-2 φορές/χρόνο
  │  Ισχύει για ΟΛΟΥΣ αν δεν γίνει override
  │
  ▼
Επίπεδο 2: Project Override (ανά έργο)
  │  "Σε αυτό το έργο τα πλακάκια +10% λόγω νησιού"
  │  Ισχύει για ΟΛΑ τα κτίρια του έργου αν δεν γίνει override
  │
  ▼
Επίπεδο 3: BOQ Item (τελική τιμή ανά κτίριο/μονάδα)
     "Σε αυτό το συγκεκριμένο item ισχύει αυτή η τιμή"
     Override μόνο αν χρειάζεται — αλλιώς κληρονομεί
```

**Πώς δουλεύει η κληρονομικότητα:**
- Νέο κτίριο → τιμές έρχονται **αυτόματα** από Master
- Ο χρήστης αλλάζει **μόνο ό,τι διαφέρει** (override)
- Αλλαγή τιμής τσιμέντου στην αγορά → αλλάζεις **μία φορά** στο Master → εφαρμόζεται παντού εκτός αν υπάρχει override
- UI δείχνει ξεκάθαρα αν η τιμή είναι **inherited** ή **overridden**

**Χαρακτηριστικά Master Price List:**
- Versioning ανά έτος (τιμοκατάλογος 2025, 2026, 2027...)
- Rate build-up: κάθε εργασία = υλικό + εργασία + εξοπλισμός
- Τιμές ανά περιοχή (προαιρετικά: Αθήνα ≠ Θεσσαλονίκη ≠ νησί)
- Ιστορικό τιμών: "τι πληρώσαμε πέρσι;"

**Firestore:**
```
boq_price_lists           # Master τιμοκατάλογοι (ανά εταιρεία/έτος)
boq_price_items           # Items τιμοκαταλόγου (rate build-ups)
boq_project_overrides     # Overrides ανά έργο (προαιρετικά)
```

**Πρότυπο μεγάλων κατασκευαστικών (ΑΚΤΩΡ, Bouygues, Vinci):**
Όλες διατηρούν εσωτερικό τιμολόγιο που ενημερώνεται περιοδικά, με τιμές ανά περιοχή και ιστορικό. Αυτό ακριβώς υλοποιούμε.

### 4.1.4 ΑΠΟΦΑΣΗ: Αυτόματος Υπολογισμός Φύρας (Waste Factor)

Enterprise-standard: κάθε BOQ item έχει **αυτόματη φύρα** (όπως iTWO, PlanSwift, CostX, Revit).

**Μηχανισμός:**
```
Καθαρή ποσότητα (net) = αυτό που μετράς από σχέδια
Φύρα (waste %) = default από τιμοκατάλογο ή override ανά item
Μικτή ποσότητα (gross) = net × (1 + wasteFactor) → για παραγγελία
```

**Default φύρες ανά κατηγορία (ΑΤΟΕ):**

| Κατηγορία | Default Waste | Αιτιολογία |
|-----------|--------------|-----------|
| Πλακάκια / Δάπεδα | 8% | Κοπή, σπασίματα |
| Σοβάδες / Επιχρίσματα | 5% | Spillage |
| Χρώματα / Βερνίκια | 12% | Στάξιμο, δεύτερο χέρι |
| Σκυρόδεμα | 5% | Spillage, vibrating |
| Σίδηρος οπλισμού | 7% | Κοπή, overlaps |
| Τοιχοποιία | 5% | Σπασίματα τούβλων |
| Μονώσεις | 6% | Κοπή, overlaps |
| Κουφώματα | 0% | Τεμάχια — δεν υπάρχει φύρα |
| Είδη υγιεινής | 0% | Τεμάχια |
| Σωληνώσεις | 5% | Κοπή, σύνδεσμοι |

**Κανόνες:**
- Default waste **κληρονομείται** από τον τιμοκατάλογο
- Ο χρήστης μπορεί να κάνει **override** ανά item
- Η μικτή ποσότητα χρησιμοποιείται για **κοστολόγηση και παραγγελία**
- Η καθαρή ποσότητα χρησιμοποιείται για **μέτρηση προόδου**

**Data model impact:**
```typescript
netQuantity: number;           // Καθαρή ποσότητα (από μέτρηση)
wasteFactor: number;           // 0.08 = 8% (default ή override)
// grossQuantity = netQuantity × (1 + wasteFactor) → computed
// totalCost = grossQuantity × unitCost → computed
```

---

### 4.2 Ιεραρχία Δεδομένων

```
Building (Κτίριο)
  └─ BOQ (Επιμέτρηση Κτιρίου)
       ├─ BOQ Category (ΑΤΟΕ Κατηγορία)
       │    ├─ BOQ Item (Εργασία/Υλικό)
       │    │    ├─ quantity (ποσότητα)
       │    │    ├─ unit (μονάδα: m², m³, m, τεμ, kg)
       │    │    ├─ materialCost (κόστος υλικού)
       │    │    ├─ laborCost (κόστος εργασίας)
       │    │    ├─ equipmentCost (κόστος εξοπλισμού)
       │    │    ├─ source: 'manual' | 'dxf-auto' | 'dxf-verified'
       │    │    └─ linkedPhaseId? (σύνδεση με Gantt phase)
       │    └─ BOQ Item ...
       └─ BOQ Category ...

Project (Έργο) — rollup
  └─ Project BOQ Summary = Σ(Building BOQs)
```

### 4.3 Modular Architecture — 5 Modules

Αρχιτεκτονική 5 ανεξάρτητων modules που μοιράζονται **ένα canonical data model** (BoqItem):

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  MODULE 1: measurements-domain (πυρήνας)                        │
│  Types, validations, cost engine, repository interfaces          │
│  Shared by ALL other modules                                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MODULE 2: measurements-manual-ui                                │
│  Building tab CRUD, filters, templates, inline edit              │
│  Phase A — άμεση υλοποίηση                                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MODULE 3: measurements-gantt-bridge                             │
│  Phase/task linking, phase cost summaries, cash-flow projection  │
│  Phase B — σύνδεση Gantt ↔ BOQ                                   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MODULE 4: measurements-dxf-adapter                              │
│  DXF geometry → normalized BoqItem payloads (source='dxf-auto')  │
│  Phase C — αυτόματη εξαγωγή                                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MODULE 5: measurements-reporting                                │
│  Project rollup, Excel/PDF export, variance reports, dashboards  │
│  Phase D — αναφορές & εξαγωγή                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Κανόνας:** Όλα τα modules γράφουν/διαβάζουν τα **ίδια canonical contracts** (BOQItem, BOQCategory, BOQSummary).

**DXF verification workflow:**
```
dxf-adapter εξάγει → source = 'dxf_auto' (draft)
  │
  ▼
Χρήστης ελέγχει/επιβεβαιώνει → source = 'dxf_verified' (confirmed)
  │
  ▼
Audit trail: ποιος επιβεβαίωσε, πότε, τι άλλαξε
```

### 4.3.1 Risks & Controls

| # | Κίνδυνος | Πιθανότητα | Αντίμετρο |
|---|---------|-----------|----------|
| 1 | **Duplicate models** μεταξύ DXF και BOQ | Μεσαία | Ένα canonical BoqItem contract — κανένα ξεχωριστό model |
| 2 | **Hierarchy chaos** (editing στο project level) | Υψηλή | Building-level ownership + project = read-only rollup |
| 3 | **Schedule/cost disconnect** (Gantt ξεχωριστά) | Μεσαία | Explicit `linkedPhaseId`/`linkedTaskId` foreign keys |
| 4 | **DXF auto-trust** (λάθος αυτόματες μετρήσεις) | Υψηλή | Mandatory verification state: `dxf_auto → dxf_verified` + audit trail |
| 5 | **Τιμοκατάλογος stale** (ξεπερασμένες τιμές) | Μεσαία | Versioning ανά έτος + UI warning αν ο τιμοκατάλογος > 6 μήνες |
| 6 | **Waste factor abuse** (υπερβολική φύρα) | Χαμηλή | Default limits + visual indicator αν > 15% |

### 4.4 Firestore Collections

```
# Νέα collections — BOQ core
boq_categories          # Κατηγορίες ΑΤΟΕ (master data, shared)
boq_items               # Επιμετρήσεις (κύριο entity — ανά κτίριο ή μονάδα)
boq_templates           # Πρότυπα (π.χ. "Τυπική κατοικία 100m²")
boq_price_lists         # Master τιμοκατάλογοι (ανά εταιρεία/έτος)
boq_price_items         # Items τιμοκαταλόγου (rate build-ups)
boq_project_overrides   # Overrides τιμών ανά έργο

# Νέα collections — Gantt integration (§4.5)
boq_task_links          # Many-to-many BOQ↔Phase/Task (with weightPct)
construction_milestones # Ορόσημα ως first-class entity (αντί static)

# Composite indexes needed
boq_items: companyId + projectId + buildingId
boq_items: buildingId + categoryCode + createdAt
boq_items: buildingId + scope + status
boq_items: buildingId + source + status
boq_items: buildingId + linkedPhaseId
boq_price_items: priceListId + categoryCode
boq_task_links: buildingId + boqItemId
boq_task_links: buildingId + phaseId
construction_milestones: buildingId + type + status
```

### 4.4.1 ΑΠΟΦΑΣΗ: Σύνδεση BOQ ↔ Accounting — Bridge Now, UI Later

**Αρχή:** Design for integration NOW, implement UI LATER.

Όλες οι enterprise εταιρείες (iTWO, Primavera, Procore) και κατασκευαστικές (ΑΚΤΩΡ, ΕΛΛΑΚΤΩΡ, Bouygues) συνδέουν BOQ ↔ Λογιστική. Δεν είναι προαιρετικό — είναι βασικό.

**Τι κάνουμε ΤΩΡΑ (Phase 1):**
- Προσθέτουμε τα πεδία σύνδεσης στο BOQItem data model
- Κόστος: μηδενικό (2 nullable πεδία)
- Κέρδος: αποφεύγουμε painful migration αργότερα

```typescript
// Πεδία στο BOQItem — υπάρχουν από Phase 1, χρησιμοποιούνται σε Phase D
linkedInvoiceId: string | null;     // Αντιστοίχιση με τιμολόγιο accounting
linkedContractorId: string | null;  // Ποιος υπεργολάβος αναλαμβάνει
```

**Τι χτίζουμε ΑΡΓΟΤΕΡΑ (Phase D):**
- Budget vs Invoiced dashboard
- "Σοβάδες: budget 7.170€ → τιμολογημένα 7.000€ → υπόλοιπο 170€"
- Αυτόματη αντιστοίχιση τιμολογίων με φάσεις BOQ
- Alerts: "Ο υπεργολάβος ξεπέρασε τον προϋπολογισμό κατά 15%"

**Γιατί bridge now:**
- Αν ΔΕΝ βάλουμε τα πεδία τώρα → retrofit αργότερα = migration + σπάνε δεδομένα
- Αν τα βάλουμε τώρα (null) → σύνδεση αργότερα γίνεται trivially

### 4.4.2 ΑΠΟΦΑΣΗ: UI Strategy — Σχεδιασμός Παράλληλα, Υλοποίηση Μετά τον Πυρήνα

**Απόφαση:** Επιλογή **(Β) Παράλληλα** — wireframes/screens σχεδιάζονται ΤΩΡΑ, implementation ΜΕΤΑ τον πυρήνα.

**Σειρά εκτέλεσης:**
1. Σχεδιασμός screens/flows (κείμενο — αυτή η ενότητα)
2. Υλοποίηση πυρήνα (types, service, repository, cost engine)
3. Υλοποίηση UI (React components βάσει σχεδιασμού)

### 4.4.3 UI Screens & Flows — Σχεδιασμός

#### SCREEN 1: Building Tab "Επιμετρήσεις"
**Τοποθεσία:** Building Detail → νέο tab δίπλα στο "Χρονοδιάγραμμα"
**Περιεχόμενο:**
```
┌──────────────────────────────────────────────────────┐
│ [Summary Cards]                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Υλικά    │ │ Εργασίες │ │ Εξοπλισ. │ │ ΣΥΝΟΛΟ   │ │
│ │ 45.200€  │ │ 28.100€  │ │ 3.400€   │ │ 76.700€  │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                       │
│ [Φίλτρα] Scope: Όλα|Κτίριο|Μονάδα  Status: Όλα|...  │
│                                                       │
│ [Accordion: Κατηγορίες ΑΤΟΕ]                          │
│ ▼ ΟΙΚ-1: Χωματουργικά (3 items — 8.200€)            │
│ ▼ ΟΙΚ-2: Σκυροδέματα (5 items — 22.400€)            │
│ ▶ ΟΙΚ-3: Τοιχοποιίες (4 items — 6.800€)             │
│ ▶ ΟΙΚ-4: Επιχρίσματα (6 items — 12.300€)             │
│ ▶ ΟΙΚ-5: Δάπεδα (8 items — 18.500€)                  │
│ ...                                                   │
│                                                       │
│ [Expanded Category: ΟΙΚ-2 Σκυροδέματα]               │
│ ┌────┬────────────────┬────┬──────┬───────┬──────────┐│
│ │ #  │ Περιγραφή      │ Μον│ Ποσ. │ Φύρα% │ Κόστος   ││
│ ├────┼────────────────┼────┼──────┼───────┼──────────┤│
│ │ 1  │ Θεμέλια C25/30 │ m³ │ 45   │ 5%    │ 6.307€   ││
│ │ 2  │ Πλάκα οροφής   │ m³ │ 38   │ 5%    │ 5.320€   ││
│ │ 3  │ Κολώνες        │ m³ │ 22   │ 5%    │ 3.234€   ││
│ │ +  │ Προσθήκη item  │    │      │       │          ││
│ └────┴────────────────┴────┴──────┴───────┴──────────┘│
│                                                       │
│ [Actions Bar]                                         │
│ [+ Νέο Item] [📥 Import Excel] [📤 Export] [🖨️ PDF]   │
└──────────────────────────────────────────────────────┘
```

#### SCREEN 2: BOQ Item Editor (Modal/Drawer)
**Trigger:** Click σε item ή "+ Νέο Item"
```
┌──────────────────────────────────────────────────────┐
│ Επεξεργασία Εργασίας                          [✕]    │
│                                                       │
│ Κατηγορία:  [ΟΙΚ-2: Σκυροδέματα     ▼]              │
│ Περιγραφή:  [Θεμέλια C25/30              ]            │
│ Προδιαγραφές: [Σκυρόδεμα C25/30, XC2     ]           │
│                                                       │
│ ── Scope ──                                           │
│ (●) Κτίριο  ( ) Μονάδα → [Επιλογή μονάδας ▼]        │
│ Όροφος: [— Προαιρετικό —  ▼]                         │
│ Τύπος χώρου: [— Προαιρετικό — ▼]                     │
│                                                       │
│ ── Ποσότητες ──                                       │
│ Μονάδα:       [m³  ▼]                                 │
│ Εκτίμηση:     [45      ] m³                           │
│ Φύρα:         [5   ] %  (default: 5%)                 │
│ Μικτή:        47.25 m³  (auto)                        │
│ Πραγματική:   [—       ] m³ (συμπληρώνεται αργότερα)  │
│                                                       │
│ ── Κόστος ανά μονάδα ──  [🔗 Από τιμοκατάλογο]       │
│ Υλικό:        [85.00  ] €/m³  ⓘ inherited             │
│ Εργασία:      [35.00  ] €/m³  ⓘ inherited             │
│ Εξοπλισμός:   [13.00  ] €/m³  ✏️ overridden           │
│                                                       │
│ ── Σύνολα (auto) ──                                   │
│ Υλικό:     47.25 × 85.00 = 4.016,25€                 │
│ Εργασία:   47.25 × 35.00 = 1.653,75€                 │
│ Εξοπλισμός: 47.25 × 13.00 = 614,25€                  │
│ ΣΥΝΟΛΟ:     6.284,25€                                 │
│                                                       │
│ ── Συνδέσεις ──                                       │
│ Φάση Gantt:     [PH-002: Σκυροδέματα  ▼]             │
│ Υπεργολάβος:   [— Κανένας —           ▼]             │
│                                                       │
│ Σημειώσεις: [                              ]          │
│ Προέλευση: manual  Status: [draft ▼]                  │
│                                                       │
│            [Ακύρωση]  [💾 Αποθήκευση]                  │
└──────────────────────────────────────────────────────┘
```

#### SCREEN 3: Project Rollup (read-only)
**Τοποθεσία:** Project Detail → Tab/Card "Συγκεντρωτική Επιμέτρηση"
```
┌──────────────────────────────────────────────────────┐
│ Συγκεντρωτική Επιμέτρηση Έργου                       │
│                                                       │
│ [Ανά Κτίριο]                                         │
│ ┌────────────────┬──────────┬──────────┬────────────┐│
│ │ Κτίριο         │ Υλικά    │ Εργασίες │ Σύνολο     ││
│ ├────────────────┼──────────┼──────────┼────────────┤│
│ │ Κτίριο Α       │ 45.200€  │ 28.100€  │ 76.700€    ││
│ │ Κτίριο Β       │ 38.400€  │ 22.800€  │ 64.200€    ││
│ ├────────────────┼──────────┼──────────┼────────────┤│
│ │ ΣΥΝΟΛΟ ΕΡΓΟΥ   │ 83.600€  │ 50.900€  │ 140.900€   ││
│ └────────────────┴──────────┴──────────┴────────────┘│
│                                                       │
│ [Ανά Κατηγορία — cross-building]                      │
│ ┌────────────────────────┬──────────┬────────────────┐│
│ │ Κατηγορία              │ Σύνολο   │ % Προϋπ.       ││
│ ├────────────────────────┼──────────┼────────────────┤│
│ │ ΟΙΚ-2: Σκυροδέματα    │ 32.400€  │ 23%            ││
│ │ ΟΙΚ-5: Δάπεδα         │ 28.500€  │ 20%            ││
│ │ ΟΙΚ-4: Επιχρίσματα    │ 18.200€  │ 13%            ││
│ │ ...                    │          │                ││
│ └────────────────────────┴──────────┴────────────────┘│
│                                                       │
│ [Variance Summary — αν υπάρχουν actual quantities]    │
│ Εκτίμηση: 140.900€  Πραγματικά: 148.200€  +5.2%      │
└──────────────────────────────────────────────────────┘
```

#### SCREEN 4: Τιμοκατάλογος (Master Price List)
**Τοποθεσία:** Settings ή ξεχωριστή σελίδα
```
┌──────────────────────────────────────────────────────┐
│ Τιμοκατάλογος 2026              [+ Νέος Κατάλογος]   │
│                                                       │
│ [Αναζήτηση: _________ ]  [Κατηγορία: Όλες ▼]        │
│                                                       │
│ ┌────┬──────────────────┬────┬───────┬───────┬──────┐│
│ │Κωδ│ Περιγραφή         │Μον │Υλικό  │Εργασ. │Φύρα% ││
│ ├────┼──────────────────┼────┼───────┼───────┼──────┤│
│ │2.1 │ Σκυρόδεμα C20/25 │ m³ │ 80€   │ 30€   │ 5%   ││
│ │2.2 │ Σκυρόδεμα C25/30 │ m³ │ 85€   │ 35€   │ 5%   ││
│ │5.1 │ Πλακάκια 60x60   │ m² │ 25€   │ 15€   │ 8%   ││
│ │5.2 │ Ξύλινο δάπεδο    │ m² │ 45€   │ 20€   │ 6%   ││
│ │ +  │ Προσθήκη item    │    │       │       │      ││
│ └────┴──────────────────┴────┴───────┴───────┴──────┘│
│                                                       │
│ [📥 Import Excel] [📤 Export] [📋 Αντιγραφή→2027]     │
└──────────────────────────────────────────────────────┘
```

#### FLOW 1: Προσθήκη νέου BOQ Item
```
1. Χρήστης → Tab "Επιμετρήσεις" στο κτίριο
2. Click "+ Νέο Item" ή "+" σε κατηγορία
3. Modal editor ανοίγει (Screen 2)
4. Επιλογή κατηγορίας → auto-fill μονάδα + default φύρα
5. Click "Από τιμοκατάλογο" → τιμές auto-fill (inherited)
6. Χρήστης μπορεί να κάνει override τιμές
7. Αποθήκευση → item εμφανίζεται στη λίστα
8. Summary cards ενημερώνονται real-time
```

#### FLOW 2: Import από Excel
```
1. Χρήστης → Click "📥 Import Excel"
2. Upload .xlsx αρχείο
3. Σύστημα validates (στήλες, μονάδες, duplicates)
4. Preview: πίνακας με ✅/❌ ανά γραμμή
5. Χρήστης αποδέχεται ή απορρίπτει
6. Import → items δημιουργούνται ως draft
```

#### FLOW 3: Estimated → Actual (Variance tracking)
```
1. Αρχικά: μόνο estimatedQuantity συμπληρωμένο
2. Κατά τη κατασκευή: χρήστης συμπληρώνει actualQuantity
3. Σύστημα δείχνει: variance % + χρωματική ένδειξη
   • Πράσινο: ≤5% απόκλιση
   • Κίτρινο: 5-15% απόκλιση
   • Κόκκινο: >15% απόκλιση
4. Project rollup δείχνει συνολική απόκλιση
```

### 4.4.5 ΑΠΟΦΑΣΗ: PDF σε Μορφή ΑΤΟΕ + Excel Export

**Απόφαση:** Και τα δύο — **PDF (μορφή ΑΤΟΕ)** + **Excel (.xlsx)**.

Όλες οι μεγάλες εταιρείες (iTWO, CostX, PlanSwift, Procore, ACE-Hellas ΕΡΓΟΛΗΠΤΗΣ) κάνουν export σε τοπικό format. Η επιμέτρηση δεν μένει μόνο στο σύστημα — εκτυπώνεται για:

| Παραλήπτης | Σκοπός |
|-----------|--------|
| Τράπεζες | Δανειοδοτήσεις, αξιολόγηση κόστους |
| Υπεργολάβοι | Τι πρέπει να κάνουν, πόσο θα πληρωθούν |
| Πελάτες | Πόσο θα κοστίσει η κατασκευή |
| Μηχανικοί | Πιστοποιήσεις εργασιών |
| Δημόσιο | Δημόσια έργα, ελεγκτικοί μηχανισμοί |

**PDF Format (μορφή ΑΤΟΕ):**
```
┌──────────────────────────────────────────────────────┐
│ ΑΝΑΛΥΤΙΚΗ ΕΠΙΜΕΤΡΗΣΗ                                 │
│ Κτίριο: Πολυκατοικία Α — Έργο: Παγώνης Α.Ε. #12    │
│ Ημερομηνία: 11/02/2026                               │
├────┬──────┬────────────────┬────┬───────┬──────┬─────┤
│ Α/Α│Άρθρο │ Περιγραφή      │Μον │ Ποσ.  │Τιμή  │Δαπ. │
├────┼──────┼────────────────┼────┼───────┼──────┼─────┤
│    │      │ ΟΙΚ-2: ΣΚΥΡΟΔ. │    │       │      │     │
│ 1  │2.1   │ Θεμέλια C25/30 │ m³ │ 47.25 │133€  │6.284│
│ 2  │2.2   │ Πλάκα οροφής   │ m³ │ 39.90 │140€  │5.586│
│    │      │ Υποσύνολο      │    │       │      │11.87│
├────┼──────┼────────────────┼────┼───────┼──────┼─────┤
│    │      │ ΟΙΚ-5: ΔΑΠΕΔΑ  │    │       │      │     │
│ 3  │5.1   │ Πλακάκια 60x60 │ m² │129.60 │ 40€  │5.184│
│ ...│      │                │    │       │      │     │
├────┴──────┴────────────────┴────┴───────┴──────┴─────┤
│ ΓΕΝΙΚΟ ΣΥΝΟΛΟ:  Υλικά: 45.200€  Εργασία: 28.100€    │
│                 Εξοπλ: 3.400€   ΣΥΝΟΛΟ: 76.700€      │
└──────────────────────────────────────────────────────┘
```

**Excel Format:** 22 στήλες, 3 sheets — spec στο parallel research doc.

**Υλοποίηση:** Επαναχρησιμοποίηση PDF engine από obligations module (`src/components/obligations/pdf.ts`).

### 4.4.8 ΑΠΟΦΑΣΗ: Excel Import + Export — Και τα Δύο από Phase 1

**Απόφαση:** Import **και** Export .xlsx από Phase 1. Δεν αφήνουμε το import για αργότερα.

**Γιατί Phase 1:** Πολλοί Έλληνες μηχανικοί έχουν **ήδη** επιμετρήσεις σε Excel. Αν δεν μπορούν να τις εισάγουν, δεν θα χρησιμοποιήσουν το σύστημα — θα συνεχίσουν στο Excel.

**Import Flow:**
```
1. Χρήστης → Click "📥 Import Excel"
2. Upload .xlsx αρχείο
3. Σύστημα αναγνωρίζει στήλες (smart column mapping)
4. Validation:
   • Μονάδα μέτρησης ✅/❌
   • IFC type compatibility ✅/❌
   • Duplicate detection (key: building + category + description)
   • Τιμές σε σωστό εύρος ✅/❌
5. Preview: πίνακας με ✅/❌ ανά γραμμή
   • Πράσινο: OK, έτοιμη για εισαγωγή
   • Κίτρινο: Warning (π.χ. φύρα > 15%)
   • Κόκκινο: Error (π.χ. λάθος μονάδα)
6. Χρήστης αποδέχεται ή απορρίπτει ανά γραμμή
7. Import → items δημιουργούνται ως status = 'draft'
8. Rejection report (.xlsx) με row-level errors
```

**Export Flow:**
```
1. Χρήστης → Click "📤 Export Excel"
2. Επιλογή scope: Ολόκληρο κτίριο | Κατηγορία | Φίλτρο
3. Export .xlsx με 3 sheets:
   • Sheet 1: BOQ_Items (22 στήλες)
   • Sheet 2: Dictionaries (μονάδες, κατηγορίες, statuses)
   • Sheet 3: Summary (rollup ανά κατηγορία + σύνολα)
```

**Import Normalization Rules** (από OpenAI research):
1. Αν έρθει μόνο περιγραφή χωρίς code → match με `synonymsEl`
2. Αν έρθει code αλλά λάθος unit → hard error
3. Αν λείπει IFC type → derive από category + warning
4. Versioned import batches για audit/rollback

---

### 4.4.4 Ευρήματα από Παράλληλη Έρευνα (OpenAI Codex Agent)

Πηγή: `docs/architecture-review/2026-02-11-boq-parallel-research.md`

**Ενσωματωμένα ευρήματα:**

1. **IFC Quantity Types → BOQItem:** Προστίθεται πεδίο `ifcQuantityType` για διεθνή διαλειτουργικότητα
   - `count` | `length` | `area` | `volume` | `weight` | `time`
   - Αντιστοιχίζεται αυτόματα βάσει κατηγορίας ΑΤΟΕ

2. **ΑΤΟΕ Φύρα:** Επιβεβαιώθηκε ότι **δεν υπάρχει** επίσημος πίνακας φύρας — οι τιμές μας είναι configurable defaults (σωστή προσέγγιση)

3. **Excel Template:** 22 στήλες, 3 sheets (Items, Dictionaries, Rollup) — πλήρης spec στο parallel research doc

4. **DXF Auto Pipeline (Phase 2):** ezdxf → Shapely polygonize → NetworkX cycles → AI room classification (CubiCasa5K dataset)

5. **Σημασιολογία μετρήσεων:** Δεν αρκεί μόνο `m2` — χρειάζεται context: `area_wall_plaster` vs `area_floor_finish`. Αυτό καλύπτεται από τον συνδυασμό `categoryCode + ifcQuantityType + unit`

### 4.4.6 Ευρήματα από Παράλληλη Έρευνα #2 (OpenAI Codex Agent)

Πηγή: `docs/architecture-review/2026-02-11-boq-parallel-research-2.md`

**1. PDF ΑΤΟΕ — Dual Mode:**
- **Tender mode** (δημόσιο συμβατό): τελική τιμή μονάδας + ΓΕ+ΟΕ/Απρόβλεπτα στο τέλος
- **Detailed mode** (εσωτερικό): ανάλυση Υλικά/Εργασία/Εξοπλισμός ανά γραμμή
- Typography: 10-12pt body, A4 portrait, αριθμητικά δεξιά

**2. Subcontractor Pattern (Procore/Oracle/Buildertrend):**
```
Υπεργολάβος → Σύμβαση/Commitment → SOV/BOQ items
  → Progress Certification → Payment Application
  → Retainage/Κρατήσεις → Τελική Εκκαθάριση
```
Contract types: `lump_sum` | `unit_price` | `cost_plus` | `remeasurable`

**3. 5D / EVM — Simplified για Nestor:**
- MVP metrics: `PV, EV, AC, CPI, SPI`
- EV source: **πιστοποιημένες ποσότητες** (όχι subjective %)
- Traffic lights: `CPI/SPI < 0.95` κόκκινο, `0.95-1.05` πράσινο
- S-curve cash-flow projection

**4. Ελληνική Πιστοποίηση — First-Class Entity:**
- Ν.4412/2016: άρθρα 151 (Επιμετρήσεις), 152 (Λογαριασμοί), 153 (Αναθεώρηση), 165 (Υπεργολαβία)
- Λογαριασμοί εργολάβου: 1ος, 2ος, ..., τελικός
- Ανά BOQ line: `EstimatedQty → CertifiedQty_to_date → RemainingQty → CertifiedAmount → Variance`
- Πρέπει να μοντελοποιηθεί ως **first-class entity** (όχι attachment)

### 4.4.7 ΑΠΟΦΑΣΗ: Υπεργολάβοι — CRM Contact + Contractor Layer

**Ερώτηση:** Ξεχωριστό module υπεργολάβων ή χρήση υπαρχόντων contacts;
**Απάντηση:** **Και τα δύο** — layered approach.

**ΚΡΙΣΙΜΟ: Η υπάρχουσα δομή επαφών ΔΕΝ αλλάζει.**

Οι επαφές παραμένουν ακριβώς όπως είναι:
```
Επαφές (contacts — ΑΜΕΤΑΚΙΝΗΤΗ ΔΟΜΗ)
  ├─ Φυσικά Πρόσωπα
  ├─ Νομικά Πρόσωπα
  └─ Δημόσιες Υπηρεσίες
```

Ένας υπεργολάβος **ΔΕΝ** είναι νέος τύπος επαφής. Είναι μια **υπάρχουσα επαφή** (φυσικό ή νομικό πρόσωπο) που **επιπλέον** αποκτά contractor profile. Το profile είναι **role/layer** πάνω στην επαφή — δεν αντικαθιστά τίποτα.

**Παράδειγμα:**
- "Παπαδόπουλος Νίκος" = Φυσικό Πρόσωπο στο CRM (ήδη υπάρχει)
- Ο ίδιος = Υπεργολάβος πλακάδων (contractor profile **πάνω** στην ίδια επαφή)
- Η επαφή δεν αλλάζει, δεν μετακινείται, δεν αλλάζει τύπο

**Αρχιτεκτονική — Layer πάνω σε Contacts:**

```
CRM Contact (ΥΠΑΡΧΕΙ ΗΔΗ — δεν αλλάζει)
  │  id, name, type (physical/legal/public), ΑΦΜ, τηλ, email
  │  Αυτό δεν τροποποιείται σε ΤΙΠΟΤΑ
  │
  ▼
Contractor Profile (ΝΕΟ LAYER — ξεχωριστό collection)
  │  contactId → δείχνει σε υπάρχουσα επαφή
  │  specialty: 'plumber' | 'electrician' | 'tiler' | 'painter' | ...
  │  rating, αξιολόγηση, ιστορικό συνεργασίας
  │  Δεν αλλάζει ούτε 1 γραμμή κώδικα στο CRM
  │
  ▼
Contract/Commitment (ΝΕΟ — Phase D)
  │  contractorProfileId, buildingId
  │  type: 'lump_sum' | 'unit_price' | 'cost_plus' | 'remeasurable'
  │  value, phases, retainage %
  │
  ▼
Progress Certification (ΝΕΟ — Phase D)
  │  Πιστοποιημένες ποσότητες, λογαριασμοί εργολάβου (1ος, 2ος...)
  │  Ν.4412/2016 άρθρα 151-154 compliance
  │
  ▼
Payment (σύνδεση με Accounting subapp)
     Τιμολόγιο, κράτηση εγγύησης, τελική εκκαθάριση
```

**Πρότυπο:** Procore, Oracle — ο vendor/subcontractor είναι **role** πάνω σε contact, δεν είναι ξεχωριστή οντότητα.

**Firestore:**
```
contractor_profiles     # Νέο collection — contactId + specialty + rating
                        # ΔΕΝ τροποποιεί το contacts collection
```

**Τι κάνουμε ΤΩΡΑ (Phase 1):**
- `linkedContractorId` στο BOQItem → δείχνει σε `contacts` collection (απλό linking)
- Δεν χτίζουμε contractor module ακόμα
- Δεν αλλάζουμε τίποτα στο CRM/contacts

**Τι χτίζουμε ΑΡΓΟΤΕΡΑ (Phase D):**
- `contractor_profiles` collection (layer πάνω σε contacts)
- Contract/Commitment management
- Πιστοποιήσεις + Λογαριασμοί εργολάβου
- Retainage tracking

---

### 4.5 Σύνδεση Gantt ↔ BOQ

#### 4.5.1 Many-to-Many Link Model (από Codex integration report)

**Αρχική σχεδίαση:** Απλό `linkedPhaseId` στο BOQ item (1:1).
**Αναθεωρημένη σχεδίαση:** Many-to-many μέσω **link table** `boq_task_links`.

**Γιατί many-to-many:**
- 1 BOQ item μπορεί να εκτείνεται σε πολλές φάσεις (π.χ. σοβάδες ξεκινάνε σε μία φάση, τελειώνουν σε άλλη)
- 1 phase/task μπορεί να περιέχει πολλά BOQ items
- Χρειάζεται `weightPct` για επιμερισμό κόστους ανά task

**Hybrid approach:** Διατηρούνται τα `linkedPhaseId`/`linkedTaskId` στο BOQItem ως **primary link** (quick query), αλλά η `boq_task_links` collection υποστηρίζει **granular many-to-many** για σύνθετα σενάρια.

```typescript
interface BOQTaskLink {
  id: string;
  buildingId: string;
  phaseId: string;
  taskId: string | null;         // null = phase-level link
  boqItemId: string;
  weightPct: number;             // 0-1, default 1.0 (100%)
  createdAt: string;
  createdBy: string;
}
```

#### 4.5.2 Παράδειγμα Σύνδεσης

```
Construction Phase: "Σοβάδες Εσωτερικοί" (PH-004)
  ├─ Gantt: 15 Μαρ → 30 Μαρ 2026
  └─ BOQ Items (linked):
       ├─ Σοβάς εσωτ. τοίχων: 450 m² × (3.50€ υλικό + 8.00€ εργασία)
       ├─ Σοβάς εσωτ. οροφών: 120 m² × (4.00€ υλικό + 10.00€ εργασία)
       └─ Γωνιόκρανα: 85 m × (1.20€ υλικό + 2.50€ εργασία)
       ────────────────────────────────
       Σύνολο φάσης: 450×11.50 + 120×14.00 + 85×3.70 = 7,169.50€
```

Αυτό επιτρέπει:
- **Cash-flow projection** — πότε θα χρειαστούν τα χρήματα
- **Progress tracking** — % ολοκλήρωσης φάσης → % δαπάνης (certifiedQty/estimatedQty)
- **Variance analysis** — σύγκριση planned vs actual κόστος

#### 4.5.3 Επέκταση Τύπων Gantt (Prerequisite)

Πηγή: `docs/architecture-review/2026-02-11-timeline-gantt-measurements-integration-report.md`

Τα υπάρχοντα `ConstructionPhase` / `ConstructionTask` types (`src/types/building/construction.ts`) **δεν έχουν** πεδία κόστους. Πρέπει να προστεθούν:

```typescript
// Προσθήκη στο ConstructionPhase/ConstructionTask:
plannedCost?: number;         // Σύνολο linked BOQ items (cached)
actualCost?: number;          // Σύνολο πληρωμένων ποσών
earnedValue?: number;         // Σ(certifiedQty × unitCost) linked items
linkedBoqCount?: number;      // Πόσα BOQ items συνδέονται
boqCoveragePct?: number;      // % του budget που καλύπτεται από BOQ
```

#### 4.5.4 Milestones ως First-Class Entity

Σήμερα τα milestones είναι **hardcoded** (ημερομηνίες 2006-2009 σε utils.ts). Πρέπει να γίνουν data-driven:

```typescript
interface ConstructionMilestone {
  id: string;
  buildingId: string;
  name: string;
  type: MilestoneType;
  targetDate: string;
  actualDate: string | null;
  status: 'pending' | 'reached' | 'overdue' | 'cancelled';
  linkedPhaseId: string | null;
  linkedTaskId: string | null;
  linkedCertificationId: string | null;
  linkedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

type MilestoneType =
  | 'phase_start'             // Έναρξη φάσης
  | 'phase_complete'          // Ολοκλήρωση φάσης
  | 'measurement_freeze'      // Κλείδωμα ποσοτήτων (before certification)
  | 'certification_cutoff'    // Τελική ημερομηνία πιστοποίησης
  | 'invoice_approved'        // Έγκριση τιμολογίου
  | 'retainage_release'       // Αποδέσμευση κράτησης
  | 'permit'                  // Αδειοδοτικό ορόσημο
  | 'inspection'              // Επιθεώρηση
  | 'handover';               // Παράδοση
```

#### 4.5.5 Progress Rule: Ποσοτικός Υπολογισμός

Η πρόοδος task/phase μπορεί να υπολογίζεται αυτόματα από certified ποσότητες:

```
taskProgress = Σ(certifiedQuantity × unitCost) / Σ(estimatedQuantity × unitCost) × 100
```

Αυτό αντικαθιστά τον subjective progress % με **αντικειμενικό** ποσοτικό δείκτη (πρότυπο iTWO/Primavera).

#### 4.5.6 Technical Debt — Static Cards

**Πριν** τη σύνδεση BOQ↔Gantt, πρέπει να αντιμετωπιστεί τεχνικό χρέος:

| Component | Πρόβλημα | Λύση |
|-----------|---------|------|
| `CompletionForecastCard` | Fixed `delayDays = 5` | Υπολογισμός από SPI + schedule slippage |
| `CriticalPathCard` | Static UI content | Real CPM analysis βάσει dependencies |
| Milestones view | Hardcoded dates (2006-2009) | Δεδομένα από `construction_milestones` collection |

---

## 5. Data Model (TypeScript Types)

### 5.1 IFC Quantity Types (διεθνές standard — buildingSMART IFC4.3)

```typescript
type IfcQuantityType =
  | 'count'    // IfcQuantityCount — τεμάχια (πόρτες, παράθυρα, είδη υγιεινής)
  | 'length'   // IfcQuantityLength — γραμμικά (σωλήνες, σοβατεπί, κάγκελα)
  | 'area'     // IfcQuantityArea — επιφάνειες (δάπεδα, σοβάδες, χρώματα)
  | 'volume'   // IfcQuantityVolume — όγκοι (σκυρόδεμα, εκσκαφές)
  | 'weight'   // IfcQuantityWeight — βάρος (οπλισμός, μέταλλα)
  | 'time';    // IfcQuantityTime — χρόνος (ημερομίσθια, ενοικίαση εξοπλισμού)
```

### 5.2 Governance Status (από gap analysis §5.1)

```typescript
// Αντικαθιστά το απλό 'draft' | 'confirmed' | 'completed'
type BOQItemStatus =
  | 'draft'       // Πρόχειρο — ελεύθερη επεξεργασία
  | 'submitted'   // Υποβλήθηκε για έγκριση
  | 'approved'    // Εγκρίθηκε — κλειδωμένες τιμές (μόνο με change order)
  | 'certified'   // Πιστοποιήθηκε από μηχανικό
  | 'locked';     // Τελικά κλειδωμένο (τελικός λογαριασμός)

// Κανόνας: Όταν status >= 'submitted', μόνο εξουσιοδοτημένοι
// ρόλοι μπορούν να αλλάξουν actualQuantity, unitCost, wasteFactor

type MeasurementMethod =
  | 'manual'      // Χειροκίνητη μέτρηση
  | 'rule'        // Υπολογισμός βάσει κανόνα (π.χ. εμβαδόν × ύψος)
  | 'ai'          // AI-based (DXF recognition)
  | 'hybrid';     // Συνδυασμός
```

### 5.3 Μονάδες Μέτρησης

```typescript
type MeasurementUnit =
  | 'm2'    // τετραγωνικά μέτρα (δάπεδα, σοβάδες, χρώματα)
  | 'm3'    // κυβικά μέτρα (σκυρόδεμα, χωματουργικά)
  | 'm'     // τρέχοντα μέτρα (σοβατεπί, σωλήνες, κάγκελα)
  | 'pcs'   // τεμάχια (πόρτες, παράθυρα, είδη υγιεινής)
  | 'kg'    // χιλιόγραμμα (σίδηρος, μέταλλα)
  | 'lt'    // λίτρα (χρώματα, μονωτικά)
  | 'set'   // σετ (εγκαταστάσεις, λεβητοστάσιο)
  | 'day'   // ημέρα (ενοικίαση εξοπλισμού)
  | 'lump'; // κατ' αποκοπή
```

### 5.2 Κατηγορίες ΑΤΟΕ

```typescript
// 3-level hierarchy: group → category → subcategory
// Πηγή: docs/architecture-review/2026-02-11-boq-categories-normalized-spec.md

type CategoryLevel = 'group' | 'category' | 'subcategory';
type WastePolicy = 'none' | 'optional' | 'required';
type SourceAuthority = 'GGDE' | 'SATE' | 'INTERNAL';

interface BOQCategory {
  id: string;
  code: string;                    // 'EARTHWORKS_DEMOLITIONS', 'OIK-EPI-001'
  legacyCode: string | null;       // Mapping σε επίσημο ΑΤΟΕ κωδικό
  nameEl: string;                  // 'Χωματουργικά και Καθαιρέσεις'
  nameEn: string;                  // 'Earthworks and Demolitions'
  level: CategoryLevel;            // group, category, subcategory
  parentCode: string | null;       // null = root group
  ifcQuantityType: IfcQuantityType;
  defaultUnit: MeasurementUnit;
  allowedUnits: MeasurementUnit[]; // Validation — ποιες μονάδες επιτρέπονται
  defaultWastePct: number;         // 0.08 = 8%
  wastePolicy: WastePolicy;       // none=0 πάντα, optional=default, required=υποχρεωτικό
  active: boolean;
  sortOrder: number;
  tags: string[];                  // ['site', 'excavation']
  synonymsEl: string[];            // Για import matching: ['χωματουργικά', 'εκσκαφές']
  synonymsEn: string[];
  sourceAuthority: SourceAuthority;
  sourceVersion: string;           // 'mapped-v1'
  deprecated: boolean;
  replacementCode: string | null;  // Αν deprecated → νέος κωδικός
  createdAt: string;
  updatedAt: string;
}
```

**12 Top-Level Groups (v1):**

| # | Code | Ελληνικά | IFC Type | Default Unit |
|---|------|----------|----------|-------------|
| 1 | `EARTHWORKS_DEMOLITIONS` | Χωματουργικά/Καθαιρέσεις | volume | m³ |
| 2 | `CONCRETE_REINFORCEMENT` | Σκυροδέματα/Οπλισμοί | volume | m³ |
| 3 | `MASONRY_PARTITIONS` | Τοιχοποιίες/Χωρίσματα | area | m² |
| 4 | `PLASTER_INSULATION` | Επιχρίσματα/Μονώσεις | area | m² |
| 5 | `FLOOR_WALL_FINISHES` | Επενδύσεις/Επιστρώσεις | area | m² |
| 6 | `CARPENTRY_METALWORK` | Ξύλινα/Μεταλλικά | weight | kg |
| 7 | `OPENINGS_FRAMES` | Πόρτες/Παράθυρα/Κουφώματα | count | pcs |
| 8 | `PAINTINGS_COATINGS` | Χρωματισμοί/Επιστρώσεις | area | m² |
| 9 | `PLUMBING_SANITARY` | Υδραυλικά/Είδη Υγιεινής | count | pcs |
| 10 | `ELECTRICAL_LOW_CURRENT` | Ηλεκτρολογικά/Ασθενή | count | pcs |
| 11 | `EXTERNAL_WORKS` | Περιβάλλων Χώρος | area | m² |
| 12 | `TEMPORARY_SITE_COSTS` | Εργοταξιακά/Χρονικές | time | day |

### 5.3 BOQ Item (κεντρικό entity)

```typescript
interface BOQItem {
  id: string;

  // Ιεραρχία (για queries & rollups)
  companyId: string;          // Εταιρεία — απαραίτητο για multi-tenant queries
  projectId: string;          // Έργο — απαραίτητο για project rollup
  buildingId: string;         // Κτίριο — κύριο ownership level

  // Scope (απόφαση §4.1.1)
  scope: 'building' | 'unit';
  linkedUnitId: string | null;  // null αν scope = 'building'

  categoryCode: string;       // 'OIK-5' (Δάπεδα)
  ifcQuantityType: IfcQuantityType; // IFC-compatible classification

  // Περιγραφή
  description: string;        // 'Πλακάκια δαπέδου 60x60'
  specifications: string | null; // 'Πορσελάνη, αντιολισθητικά R10'

  // Ποσότητες (απόφαση §4.1.2 — estimated vs actual)
  estimatedQuantity: number;       // Προϋπολογιστική (από σχέδια)
  actualQuantity: number | null;   // Πραγματική (συμπληρώνεται αργότερα)
  unit: MeasurementUnit;           // 'm2'

  // Φύρα (απόφαση §4.1.4)
  wasteFactor: number;        // 0.08 = 8% (default ή override)
  // grossQuantity = estimatedQuantity × (1 + wasteFactor) → computed

  // Κόστος ανά μονάδα (κληρονομείται από τιμοκατάλογο §4.1.3)
  materialUnitCost: number;   // 25.00 €/m²
  laborUnitCost: number;      // 15.00 €/m²
  equipmentUnitCost: number;  // 0 €/m²
  priceOverridden: boolean;   // true = χρήστης άλλαξε τιμή, false = inherited

  // Υπολογισμένα (computed, δεν αποθηκεύονται)
  // grossQuantity = estimatedQuantity × (1 + wasteFactor)
  // totalMaterialCost = grossQuantity × materialUnitCost
  // totalLaborCost = grossQuantity × laborUnitCost
  // totalEquipmentCost = grossQuantity × equipmentUnitCost
  // totalCost = totalMaterialCost + totalLaborCost + totalEquipmentCost
  // variance = actualQuantity ? ((actualQuantity - estimatedQuantity) / estimatedQuantity × 100) : null

  // Προέλευση
  source: 'manual' | 'dxf-auto' | 'dxf-verified';

  // Σύνδεση με Gantt
  linkedPhaseId: string | null;
  linkedTaskId: string | null;

  // Σύνδεση με χώρο (προαιρετική — επιπλέον του unitId)
  linkedFloorId: string | null;
  linkedRoomType: RoomType | null;

  // Quantity Lifecycle (§5.7 gap analysis — πλήρες lifecycle)
  estimatedNetQuantity: number;          // Καθαρή ποσότητα (από σχέδια)
  // estimatedGrossQuantity = estimatedNet × (1 + wasteFactor) → computed
  orderedQuantity: number | null;        // Ποσότητα παραγγελίας (αργότερα)
  installedQuantity: number | null;      // Ποσότητα εγκατεστημένη (εργοτάξιο)
  certifiedQuantity: number | null;      // Πιστοποιημένη ποσότητα (μηχανικός)
  paidQuantity: number | null;           // Πληρωμένη ποσότητα (λογαριασμός)

  // Catalog versioning
  catalogVersion: string;     // '2026.02.v1' — ποια έκδοση catalog χρησιμοποιήθηκε

  // Baseline / Provenance (§5.2 gap analysis)
  baselineVersion: number;              // 1, 2, 3... — αυξάνει σε κάθε approved baseline
  drawingRevisionId: string | null;     // Ποια αναθεώρηση σχεδίου παρήγαγε την ποσότητα
  measurementMethod: MeasurementMethod; // Πώς υπολογίστηκε

  // Change Order tracking (§5.4 gap analysis — bridge now)
  changeOrderId: string | null;         // Αν προέκυψε από change order
  isOriginalBudget: boolean;            // true = αρχικός budget, false = approved change

  // DXF confidence (§5.6 gap analysis — Phase C bridge)
  confidenceScore: number | null;       // 0-1, μόνο για source='dxf-auto'
  qaStatus: 'pending' | 'accepted' | 'rejected' | null;
  qaReasonCodes: string[];              // ['open_polyline', 'missing_layer', ...]

  // Governance (§5.1 gap analysis — enterprise workflow)
  status: BOQItemStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

type RoomType =
  | 'bathroom'    // Μπάνιο
  | 'kitchen'     // Κουζίνα
  | 'bedroom'     // Υπνοδωμάτιο
  | 'living'      // Σαλόνι
  | 'hallway'     // Διάδρομος
  | 'balcony'     // Μπαλκόνι
  | 'storage'     // Αποθήκη
  | 'common'      // Κοινόχρηστος χώρος
  | 'exterior'    // Εξωτερικός χώρος
  | 'staircase'   // Κλιμακοστάσιο
  | 'parking';    // Στάθμευση
```

### 5.4 BOQ Summary (rollup)

```typescript
interface BOQSummary {
  buildingId: string;
  totalItems: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalCost: number;
  completionPercentage: number;  // % confirmed items
  byCategory: Record<string, {
    categoryCode: string;
    categoryName: string;
    itemCount: number;
    totalCost: number;
  }>;
}
```

---

## 6. Τι Θα Μετράει η Αυτόματη Επιμέτρηση (Phase 2 — DXF)

Αυτό που ζητά ο Γιώργος είναι **αυτόματη αναγνώριση χώρων και εξαγωγή ποσοτήτων** από DXF σχέδιο κάτοψης. Αναλυτικά:

### 6.1 Τι μπορεί να εξάγει

| Μέτρηση | Πώς Υπολογίζεται | Χρήση |
|---------|------------------|-------|
| **Εμβαδόν δαπέδου** (m²) | Polygon area ανά χώρο | Πλακάκια, ξύλο, μάρμαρο |
| **Εμβαδόν οροφής** (m²) | ≈ ίδιο με δάπεδο | Σοβάδες οροφής, χρώματα |
| **Εμβαδόν τοίχων** (m²) | Περίμετρος χώρου × ύψος − κουφώματα | Σοβάδες, χρώματα, πλακάκια τοίχου |
| **Μήκος σοβατεπί** (m) | Περίμετρος χώρου − πόρτες | Σοβατεπί |
| **Αριθμός πορτών** (τεμ) | Αναγνώριση block/symbol | Πόρτες |
| **Αριθμός παραθύρων** (τεμ) | Αναγνώριση block/symbol | Κουφώματα |
| **Είδη υγιεινής** (τεμ) | Αναγνώριση blocks σε μπάνιο/WC | Νιπτήρες, λεκάνες, μπανιέρες |
| **Μήκος σωληνώσεων** (m) | Routing μεταξύ υγρών χώρων | Υδραυλικά |
| **Σημεία ρεύματος** (τεμ) | Αναγνώριση electrical symbols | Πρίζες, φωτιστικά |

### 6.2 Τεχνική Προσέγγιση (AI + Rules)

```
DXF File
  │
  ▼
Layer Analysis (αναγνώριση layers: WALLS, DOORS, WINDOWS, SANITARY...)
  │
  ▼
Room Detection (closed polylines → χώροι)
  │
  ▼
Room Classification (AI: μπάνιο, κουζίνα, υπνοδωμάτιο...)
  │
  ▼
Element Detection (blocks → πόρτες, παράθυρα, είδη υγιεινής)
  │
  ▼
Quantity Calculation (εμβαδά, μήκη, τεμάχια)
  │
  ▼
BOQ Generation (export → ίδιο BOQItem model, source='dxf-auto')
```

### 6.3 Γιατί Modular

Η **ίδια δομή δεδομένων** (BOQItem) χρησιμοποιείται και για χειρωνακτική και για αυτόματη επιμέτρηση. Η μόνη διαφορά είναι το πεδίο `source`:
- `manual` = ο χρήστης την κατάγραψε
- `dxf-auto` = το DXF viewer την εξήγαγε αυτόματα
- `dxf-verified` = αυτόματη + επιβεβαιωμένη από χρήστη

---

## 7. UI Integration — Πού Μπαίνει στην Εφαρμογή

### 7.1 Building Management — Νέο Tab

```
Building Detail Page
  ├─ Tab: Γενικά (υπάρχει)
  ├─ Tab: Μονάδες (υπάρχει)
  ├─ Tab: Χρονοδιάγραμμα / Gantt (υπάρχει)
  ├─ Tab: Επιμετρήσεις ← ΝΕΟ
  │    ├─ Κατηγορίες (accordion ΑΤΟΕ)
  │    ├─ Items ανά κατηγορία (table + inline edit)
  │    ├─ Summary cards (Υλικά / Εργασίες / Σύνολο)
  │    └─ Σύνδεση με φάσεις Gantt
  ├─ Tab: Χώροι Στάθμευσης (υπάρχει)
  └─ Tab: Αποθήκες (υπάρχει)
```

### 7.2 Project Level — Summary/Rollup

```
Project Detail Page
  └─ Tab/Card: Συγκεντρωτική Επιμέτρηση
       ├─ Ανά κτίριο: σύνολο κόστους
       ├─ Ανά κατηγορία: cross-building σύνολα
       └─ Grand total: Υλικά + Εργασίες + Εξοπλισμός
```

---

## 8. Σύνδεση BOQ ↔ Gantt (5D Concept)

### 8.1 Μοντέλο Σύνδεσης

```
Construction Phase (PH-004: "Σοβάδες")
  ├─ startDate: 2026-03-15
  ├─ endDate: 2026-03-30
  ├─ progress: 60%
  └─ linkedBOQItems: [
       { boqItemId: "boq_001", estimatedCost: 5,175€ },
       { boqItemId: "boq_002", estimatedCost: 1,680€ },
       { boqItemId: "boq_003", estimatedCost: 314.50€ }
     ]
     ──────────────
     Phase Cost: 7,169.50€
     Spent so far (60%): ≈ 4,301.70€
```

### 8.2 Τι Κερδίζουμε

- **Cash-flow timeline:** Ξέρεις πότε θα χρειαστείς πόσα χρήματα
- **Progress = Cost:** Η πρόοδος κατασκευής = πρόοδος δαπάνης
- **Variance alerts:** Αν η πραγματική δαπάνη ξεπεράσει την εκτίμηση

---

## 9. Σύγκριση με Ανταγωνισμό

| Feature | Nestor (Πρόταση) | PlanSwift | CostX | iTWO |
|---------|-----------------|-----------|-------|------|
| Χειρωνακτική BOQ | ✅ Phase 1 | ✅ | ✅ | ✅ |
| Αυτόματη από DXF | ✅ Phase 2 | ✅ (PDF/CAD) | ✅ (PDF) | ✅ (BIM) |
| ΑΤΟΕ κατηγορίες | ✅ Ελληνικό standard | ❌ | ❌ | ❌ |
| Gantt integration | ✅ Phase 3 | ❌ | ❌ | ✅ |
| Υλικά + Εργασίες | ✅ 3-way split | ✅ | ✅ | ✅ |
| Per-building hierarchy | ✅ | ❌ (per-project) | ✅ | ✅ |
| Ελληνικά | ✅ | ❌ | ❌ | ❌ |
| Web-based | ✅ | ❌ (desktop) | ❌ (desktop) | ✅ |

**Competitive advantage:** Nestor θα είναι η **μόνη ελληνική web-based εφαρμογή** που συνδυάζει BOQ + Gantt + DXF + ΑΤΟΕ σε ένα.

---

## 10. File Structure (Proposed)

```
src/
  services/
    measurements/
      index.ts                    # Barrel exports
      boq-service.ts              # CRUD operations
      boq-repository.ts           # Firestore access
      cost-engine.ts              # Υπολογισμοί κόστους
      boq-templates.ts            # Πρότυπα ΑΤΟΕ
  types/
    measurements/
      boq.ts                      # BOQItem, BOQCategory, BOQSummary
      cost.ts                     # CostBreakdown, PriceListItem
      units.ts                    # MeasurementUnit, conversions
  components/
    building-management/
      tabs/
        MeasurementsTabContent.tsx # Κύριο tab component
      measurements/
        BOQCategoryAccordion.tsx   # Κατηγορίες ΑΤΟΕ
        BOQItemRow.tsx             # Inline edit row
        BOQSummaryCards.tsx        # Σύνοψη κόστους
        BOQGanttLink.tsx           # Σύνδεση με φάσεις
        BOQImportExport.tsx        # Excel import/export
  config/
    boq-categories.ts             # ΑΤΟΕ κατηγορίες (master data)
  i18n/
    locales/
      el/measurements.json        # Ελληνικά
      en/measurements.json        # English
```

---

## 11. Πηγές Έρευνας

- [RIB Software — Bill of Quantities](https://www.rib-software.com/en/blogs/bill-of-quantities)
- [5D Cost Estimation Guide 2026](https://conwize.io/articles/5d-cost-estimation-what-is-it-and-how-does-it-work/)
- [Procore — 5D BIM](https://www.procore.com/library/5d-bim)
- [Best BOQ Software 2026 — Realx ERP](https://realxerp.com/construction-boq-software.php)
- [ACE-Hellas ΕΡΓΟΛΗΠΤΗΣ — Ελληνικό λογισμικό επιμετρήσεων](https://docplayer.gr/474248-Ace-hellas-cad-solutions-h-kalyteri-lysi-diaheirisis-dimosion-ergon-ergoliptis-prokostologisi-epimetriseis-say-fay.html)
- [ΓΓΔΕ — Αναλυτικά Τιμολόγια / Συντελεστές Αναθεώρησης](https://www.ggde.gr/index.php?option=com_docman&task=cat_view&gid=29)
- [ΣΑΤΕ — Τιμολόγια](https://www.sate.gr/html/timologia.aspx)
- [ΕΑΠ — Η τεχνική της επιμέτρησης σε τυπικές κατοικίες](https://apothesis.eap.gr/archive/item/85428)
- [Novatr — 10 Essential Software Tools for QS 2025](https://www.novatr.com/blog/10-essential-software-tools-for-quantity-surveyors)

---

## 12. Gap Analysis — Ευρήματα Ελέγχου

Πηγή: `docs/architecture-review/2026-02-11-adr175-gap-analysis-report.md`

**Κριτική:** Το ADR-175 πρέπει να εξελιχθεί από **BOQ tool** σε **project controls system**.

### 12.1 Ενσωματωμένα στο Data Model (Phase 1)

| Εύρημα | Λύση | Status |
|--------|------|--------|
| Governance states πενιχρά | `draft→submitted→approved→certified→locked` | ✅ Ενσωματώθηκε (§5.2) |
| Quantity lifecycle ελλιπές | 6 πεδία: estimated→ordered→installed→certified→paid | ✅ Ενσωματώθηκε (§5.5 BOQItem) |
| Baseline/provenance λείπει | `baselineVersion`, `drawingRevisionId`, `measurementMethod` | ✅ Ενσωματώθηκε (§5.5 BOQItem) |
| Change Order tracking | `changeOrderId`, `isOriginalBudget` | ✅ Ενσωματώθηκε (§5.5 BOQItem) |
| DXF confidence scoring | `confidenceScore`, `qaStatus`, `qaReasonCodes` | ✅ Ενσωματώθηκε (§5.5 BOQItem) |

### 12.2 Μελλοντικά Modules (Bridge Now, Build Later)

| Module | Entities | Phase |
|--------|---------|-------|
| **Change Orders** | `boq_change_orders` (scope, rate, schedule, mixed) | Phase D |
| **Subcontractor Financial** | `boq_contracts`, `boq_sov_lines`, `boq_payment_applications`, `boq_certifications`, `boq_retainage_ledger` | Phase D |
| **EVM Kernel** | `boq_evm_periods` (PV, EV, AC per month) + computed SPI/CPI | Phase D |
| **Unit Conversions** | kg↔ton, m²↔κουτί coverage, currency escalation | Phase 1C |

### 12.3 Αξιολόγηση

Η αρχική κριτική ήταν σωστή: χωρίς governance, baselines, quantity lifecycle, το σύστημα θα ήταν απλό BOQ tool. Με τις ενσωματώσεις, το data model είναι πλέον **project controls-ready** — ακόμα κι αν η πλήρης υλοποίηση γίνει σταδιακά.

---

## 13. Επόμενα Βήματα (Ενημερωμένα)

| Phase | Τι | Περιλαμβάνει |
|-------|-----|-------------|
| **1A** | Types + Service + Repository | Πλήρες data model (με governance, lifecycle, baseline fields) |
| **1B** | UI Tab + CRUD | Χειρωνακτική επιμέτρηση + governance workflow |
| **1C** | Τιμοκατάλογος + Excel Import/Export | Master price list + 3-level inheritance + import validation |
| **1D** | PDF Export | Dual mode: Tender (ΑΤΟΕ) + Internal (detailed) |
| **B** | Gantt ↔ BOQ link UI | Phase cost summaries, cash-flow projection |
| **C** | DXF Auto Extraction | Room detection, element classification, confidence scoring |
| **D** | Project Controls | Subcontractor financial, change orders, EVM, certifications |

---

## 14. Σύνδεσμοι Ερευνών

| Αρχείο | Περιεχόμενο |
|--------|------------|
| `docs/architecture-review/2026-02-11-measurements-architecture-report.md` | Αρχική αρχιτεκτονική αναφορά (Sonnet) |
| `docs/architecture-review/2026-02-11-boq-parallel-research.md` | Έρευνα #1: ΑΤΟΕ, IFC, DXF, Excel |
| `docs/architecture-review/2026-02-11-boq-categories-normalized-spec.md` | Master catalog spec |
| `docs/architecture-review/2026-02-11-boq-parallel-research-2.md` | Έρευνα #2: PDF, Subcontractors, 5D/EVM, Πιστοποιήσεις |
| `docs/architecture-review/2026-02-11-adr175-gap-analysis-report.md` | Gap analysis + προτάσεις |
| `docs/architecture-review/2026-02-11-timeline-gantt-measurements-integration-report.md` | Gantt integration: milestones, M:N links, EVM, tech debt |

---

## 15. Use Case Documents (Implementation Contracts)

Η εκτέλεση σπάστηκε σε 6 ξεχωριστά UC documents — κάθε UC είναι self-contained implementation contract:

| UC | Τίτλος | Phase | Αρχείο |
|----|--------|-------|--------|
| UC-BOQ-001 | Manual BOQ CRUD | 1A + 1B | `docs/boq/use-cases/UC-BOQ-001-manual-boq-crud.md` |
| UC-BOQ-002 | Price Inheritance + Waste | 1C | `docs/boq/use-cases/UC-BOQ-002-price-inheritance-waste.md` |
| UC-BOQ-003 | Gantt Link + Cashflow/EVM | B + D | `docs/boq/use-cases/UC-BOQ-003-gantt-link-cashflow-evm.md` |
| UC-BOQ-004 | DXF Auto + Verification | C | `docs/boq/use-cases/UC-BOQ-004-dxf-auto-verification.md` |
| UC-BOQ-005 | Subcontractor + Certification + Retainage | D | `docs/boq/use-cases/UC-BOQ-005-subcontractor-certification-retainage.md` |
| UC-BOQ-006 | Excel/PDF Import-Export | 1C + 1D | `docs/boq/use-cases/UC-BOQ-006-excel-pdf-import-export.md` |

**Index:** `docs/boq/use-cases/README.md`

**Dependency chain:** UC-001 → UC-002 → UC-003/005/006 | UC-001 → UC-004

---

*Αυτό το ADR είναι πλήρης αρχιτεκτονική αναφορά ("constitution"). Τα UC documents αποτελούν τα implementation contracts. Η υλοποίηση θα ξεκινήσει μόνο μετά από έγκριση του Γιώργου.*

---

## Changelog

### 2026-02-12 — Phase 1A Implemented
**Status:** `ΕΡΕΥΝΑ` → `PHASE_1A_IMPLEMENTED`

**Νέα αρχεία (9):**
- `src/types/boq/units.ts` — Type literals: BOQMeasurementUnit, IfcQuantityType, BOQItemStatus, etc.
- `src/types/boq/boq.ts` — Core entities: BOQItem (~40 fields), BOQCategory, BOQSummary, inputs, filters
- `src/types/boq/cost.ts` — Computed types: CostBreakdown, PriceResolution, VarianceResult
- `src/types/boq/index.ts` — Barrel exports
- `src/config/boq-categories.ts` — 12 ΑΤΟΕ master categories (bilingual EL+EN)
- `src/services/measurements/contracts.ts` — IBOQRepository + IBOQService interfaces
- `src/services/measurements/cost-engine.ts` — Pure functions: gross qty, item cost, variance, building summary
- `src/services/measurements/boq-repository.ts` — FirestoreBOQRepository (Firestore CRUD)
- `src/services/measurements/boq-service.ts` — BOQService singleton (validation + governance)
- `src/services/measurements/index.ts` — Barrel exports + singleton instance

**Τροποποιημένα αρχεία (3):**
- `src/config/firestore-collections.ts` — +4 entries: BOQ_ITEMS, BOQ_CATEGORIES, BOQ_PRICE_LISTS, BOQ_TEMPLATES
- `src/config/firestore-schema-map.ts` — +2 schemas: boq_items (15 fields), boq_categories (9 fields)
- `docs/centralized-systems/reference/adr-index.md` — +1 row: ADR-175

**Κρίσιμα patterns:**
- Governance: `draft → submitted → approved → certified → locked`
- Waste factor: `grossQuantity = netQuantity × (1 + wasteFactor)` — NEVER stored
- Cost: computed at runtime via `computeItemCost()` — NEVER stored
- Firestore: κάθε optional field → `?? null`
- Zero `any`, zero `as any`, zero `@ts-ignore`

### 2026-02-12 — Phase 1B Implemented (UI Layer)
**Status:** `PHASE_1A_IMPLEMENTED` → `PHASE_1B_IMPLEMENTED`

**Νέα αρχεία (7):**
- `src/hooks/useBOQItems.ts` — Custom hook: data fetching, CRUD, client-side filtering, cost summary
- `src/components/building-management/tabs/MeasurementsTabContent.tsx` — Orchestrator: summary + filters + accordion + editor
- `src/components/building-management/tabs/MeasurementsTabContent/BOQSummaryCards.tsx` — 4 summary cards (Materials, Labor, Equipment, Total)
- `src/components/building-management/tabs/MeasurementsTabContent/BOQFilterBar.tsx` — Scope / Status / Category / Search filters (ADR-001 Radix Select)
- `src/components/building-management/tabs/MeasurementsTabContent/BOQCategoryAccordion.tsx` — ΑΤΟΕ accordion + item tables with status badges & variance
- `src/components/building-management/tabs/MeasurementsTabContent/BOQItemEditor.tsx` — Create/Edit dialog with computed totals, allowed unit logic, governance transitions
- `src/components/building-management/tabs/MeasurementsTabContent/index.ts` — Barrel export

**Τροποποιημένα αρχεία (5):**
- `src/subapps/dxf-viewer/config/modal-select/core/labels/tabs.ts` — +`measurements` key in BuildingTabLabelsConfig
- `src/config/unified-tabs-factory.ts` — +measurements tab (order 11, icon 'ruler')
- `src/components/generic/mappings/buildingMappings.ts` — +MeasurementsTabContent + BuildingMeasurementsTab alias
- `src/i18n/locales/el/building.json` — +tabs.measurements.* (~80 keys EL)
- `src/i18n/locales/en/building.json` — +tabs.measurements.* (~80 keys EN)

**Κρίσιμα patterns:**
- ADR-001 compliance: Radix Select only (zero EnterpriseComboBox)
- Semantic HTML: section, header, nav, fieldset, legend — zero div soup
- Computed costs in BOQSummaryCards update in real-time from items array
- Status badges: Draft=gray, Submitted=blue, Approved=green, Certified=purple, Locked=amber
- Variance indicator: green (≤5%), yellow (5-15%), red (>15%)
- Category accordion: groups by ΑΤΟΕ code, sorted by sortOrder, shows item count + category total
- Editor: auto-computes gross quantity and totals; allowed units change per category
- Zero `any`, zero inline styles, zero `@ts-ignore`

### 2026-03-17 — Enterprise ID Compliance (SOS N.6)
**Change:** `addDoc()` → `setDoc()` + `generateBoqItemId()` from enterprise-id.service.ts
**Files changed:** `boq-repository.ts` (create + duplicate methods)
**Impact:** BOQ items now get `boq_uuid` enterprise IDs instead of Firestore auto-generated IDs
**Ref:** ADR-210 Phase 4, CLAUDE.md SOS N.6
