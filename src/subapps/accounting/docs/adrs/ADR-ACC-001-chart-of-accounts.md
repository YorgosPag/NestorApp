# ADR-ACC-001: Chart of Accounts — Λογιστικό Σχέδιο ΕΛΠ

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Chart of Accounts |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-002: Income/Expense Book |

---

## 1. Context

Η εφαρμογή χρησιμοποιεί **Απλογραφικό σύστημα (Β' Κατηγορίας)** σύμφωνα με τα ΕΛΠ (Ν.4308/2014).

Σε αντίθεση με το Γ' Κατηγορίας (διπλογραφικό), το απλογραφικό **ΔΕΝ** έχει παραδοσιακό λογιστικό σχέδιο με αριθμημένους λογαριασμούς (ομάδες 1-8). Αντ' αυτού, χρειαζόμαστε:

1. **Κατηγοριοποίηση Εσόδων** — τι τύπους εσόδων καταγράφουμε
2. **Κατηγοριοποίηση Εξόδων** — τι τύπους εξόδων καταγράφουμε
3. **Αντιστοίχιση myDATA** — κωδικοί χαρακτηρισμού εσόδων/εξόδων
4. **Αντιστοίχιση Ε3** — κωδικοί φορολογικής δήλωσης
5. **ΦΠΑ χειρισμός** — εκπιπτόμενος vs μη εκπιπτόμενος ΦΠΑ

### Γιατί χρειάζεται αυτό το ADR

Κάθε εγγραφή στο Βιβλίο Εσόδων-Εξόδων πρέπει να φέρει **τετραπλό χαρακτηρισμό**:
1. **Εσωτερική κατηγορία** (app category) → για UI, φίλτρα, αναφορές
2. **myDATA κατηγορία** (category1_x / category2_x) → για ΑΑΔΕ διαβίβαση
3. **Κωδικός Ε3** (561_xxx / 585_xxx) → για φορολογική δήλωση
4. **ΦΠΑ χειρισμός** (rate + deductible flag) → για τριμηνιαία ΦΠΑ δήλωση

---

## 2. Income Categories (Κατηγορίες Εσόδων)

### 2.1 Εσωτερικές Κατηγορίες

| Κωδικός | Κατηγορία | Περιγραφή | ΚΑΔ |
|---------|-----------|-----------|-----|
| `service_income` | Αμοιβές Υπηρεσιών | Μελέτες, ΠΕΑ, άδειες, ρυθμίσεις, επιβλέψεις | 71112000 |
| `construction_income` | Κατασκευαστικά Έσοδα | Εργολαβίες κατασκευής (μη οικιστικά) | 41202003 |
| `construction_res_income` | Κατασκευαστικά Έσοδα (Οικιστικά) | Εργολαβίες κατασκευής (οικιστικά) | 41201001 |
| `asset_sale_income` | Πώληση Παγίου | Πώληση εξοπλισμού, οχήματος | — |
| `other_income` | Λοιπά Έσοδα | Τόκοι, αποζημιώσεις, λοιπά | — |

### 2.2 myDATA Αντιστοίχιση (Χαρακτηρισμός Εσόδων)

| myDATA Κωδικός | Κατηγορία | Αντιστοίχιση App |
|----------------|-----------|------------------|
| `category1_1` | Έσοδα από Πώληση Αγαθών | `construction_income`, `construction_res_income` |
| `category1_3` | Έσοδα από Παροχή Υπηρεσιών | `service_income` |
| `category1_4` | Έσοδα από Πώληση Παγίων | `asset_sale_income` |
| `category1_5` | Λοιπά Έσοδα / Κέρδη | `other_income` |

### 2.3 Ε3 Αντιστοίχιση (Φορολογική Δήλωση)

| Κωδικός Ε3 | Πεδίο | Αντιστοίχιση App |
|-------------|-------|------------------|
| `561_001` | Πωλήσεις αγαθών (κατασκευές) | `construction_income` + `construction_res_income` |
| `561_003` | Παροχή υπηρεσιών | `service_income` |
| `561_005` | Λοιπά συνήθη έσοδα | `other_income` |
| `570_003` | Έσοδα από πώληση παγίων | `asset_sale_income` |

---

## 3. Expense Categories (Κατηγορίες Εξόδων)

### 3.1 Εσωτερικές Κατηγορίες

| Κωδικός | Κατηγορία | Περιγραφή | ΦΠΑ Εκπίπτει; |
|---------|-----------|-----------|----------------|
| `third_party_fees` | Αμοιβές Τρίτων | Λογιστής, δικηγόρος, μηχανικός | ✅ Ναι |
| `rent` | Ενοίκιο Γραφείου | Ενοίκιο επαγγελματικού χώρου | ❌ Όχι (εξαιρείται ΦΠΑ) |
| `utilities` | ΔΕΗ / Νερό / Θέρμανση | Λογαριασμοί ΔΕΚΟ | ✅ Ναι |
| `telecom` | Τηλεφωνία / Internet | Cosmote, Vodafone, ISP | ✅ Ναι (50% αν μικτή χρήση) |
| `fuel` | Καύσιμα | Βενζίνη, diesel | ✅ Ναι (αν επαγγ. χρήση) |
| `vehicle_expenses` | Έξοδα Οχήματος | Ασφάλεια, service, ΚΤΕΟ, τέλη | Μικτά |
| `vehicle_insurance` | Ασφάλεια Οχήματος | Motor insurance | ❌ Όχι (εξαιρείται ΦΠΑ) |
| `office_supplies` | Αναλώσιμα Γραφείου | Χαρτί, μελάνια, γραφική ύλη | ✅ Ναι |
| `software` | Λογισμικό / Subscriptions | CAD, Office 365, hosting | ✅ Ναι |
| `equipment` | Εξοπλισμός (<1.500€) | Μικροέξοδα εξοπλισμού (κάτω του ορίου παγίου) | ✅ Ναι |
| `travel` | Ταξίδια / Μετακινήσεις | Εισιτήρια, διόδια, ξενοδοχεία | ✅ Ναι |
| `training` | Εκπαίδευση / Σεμινάρια | Σεμινάρια, πιστοποιήσεις | ✅ Ναι |
| `advertising` | Διαφήμιση / Marketing | Ιστοσελίδα, social media, εκτυπώσεις | ✅ Ναι |
| `efka` | Εισφορές ΕΦΚΑ | Ασφαλιστικές εισφορές | ❌ Χωρίς ΦΠΑ |
| `professional_tax` | Τέλος Επιτηδεύματος | Ετήσιο τέλος (650€/325€) | ❌ Χωρίς ΦΠΑ |
| `bank_fees` | Τραπεζικά Έξοδα | Προμήθειες, χρεωστικοί τόκοι | ❌ Εξαιρούνται ΦΠΑ |
| `tee_fees` | Εισφορές ΤΕΕ | Ετήσια συνδρομή ΤΕΕ | ❌ Χωρίς ΦΠΑ |
| `depreciation` | Αποσβέσεις | Φορολογικές αποσβέσεις παγίων | ❌ Χωρίς ΦΠΑ |
| `other_expense` | Λοιπά Έξοδα | Μη κατηγοριοποιημένα | Εξαρτάται |

### 3.2 myDATA Αντιστοίχιση (Χαρακτηρισμός Εξόδων)

| myDATA Κωδικός | Κατηγορία | Αντιστοίχιση App |
|----------------|-----------|------------------|
| `category2_1` | Αγορές Εμπορευμάτων | — (δεν αφορά αρχιτέκτονα) |
| `category2_2` | Αγορές Α' Υλών & Υλικών | Κατασκευαστικά υλικά (αν εργολαβία) |
| `category2_3` | Λήψη Υπηρεσιών | `third_party_fees`, `rent` |
| `category2_4` | Γενικά Έξοδα (με δικαίωμα ΦΠΑ) | `utilities`, `telecom` |
| `category2_5` | Λοιπά Έξοδα | `fuel`, `vehicle_expenses`, `travel`, `advertising` |
| `category2_6` | Αμοιβές & Παροχές Προσωπικού | — (μόνο αν έχει υπαλλήλους) |
| `category2_7` | Αγορές Παγίων | `equipment` (>1.500€ → πάγιο) |
| `category2_11` | Αποσβέσεις | `depreciation` |
| `category2_12` | Λοιπές Εκπιπτόμενες Δαπάνες | `efka`, `professional_tax`, `tee_fees`, `bank_fees` |
| `category2_14` | Λοιπά Πληροφοριακά Στοιχεία | `other_expense` |

### 3.3 Ε3 Αντιστοίχιση (Φορολογική Δήλωση)

| Κωδικός Ε3 | Πεδίο | Αντιστοίχιση App |
|-------------|-------|------------------|
| `585_001` | Αμοιβές & Εξ. Τρίτων | `third_party_fees` |
| `585_002` | Παροχές Τρίτων (ενοίκια, ΔΕΚΟ) | `rent`, `utilities`, `telecom` |
| `585_005` | Ασφαλιστικές Εισφορές | `efka` |
| `585_006` | Διάφορα Λειτουργικά Έξοδα | `fuel`, `vehicle_expenses`, `office_supplies`, `software`, `travel`, `training` |
| `585_008` | Τόκοι & Τραπεζικά Έξοδα | `bank_fees` |
| `585_009` | Φόροι - Τέλη | `professional_tax`, `tee_fees` |
| `585_016` | Λοιπά Έξοδα | `advertising`, `other_expense` |
| `587_001` | Αποσβέσεις Ενσώματων Παγίων | `depreciation` |

---

## 4. TypeScript Implementation

### 4.1 Account Category Type

```typescript
/** Κατηγορίες Εσόδων */
type IncomeCategory =
  | 'service_income'           // Αμοιβές υπηρεσιών (ΚΑΔ 71112000)
  | 'construction_income'      // Κατασκευαστικά (ΚΑΔ 41202003)
  | 'construction_res_income'  // Κατασκευαστικά οικιστικά (ΚΑΔ 41201001)
  | 'asset_sale_income'        // Πώληση παγίων
  | 'other_income';            // Λοιπά

/** Κατηγορίες Εξόδων */
type ExpenseCategory =
  | 'third_party_fees'         // Αμοιβές τρίτων
  | 'rent'                     // Ενοίκιο γραφείου
  | 'utilities'                // ΔΕΗ/Νερό/Θέρμανση
  | 'telecom'                  // Τηλεφωνία/Internet
  | 'fuel'                     // Καύσιμα
  | 'vehicle_expenses'         // Έξοδα οχήματος
  | 'vehicle_insurance'        // Ασφάλεια οχήματος
  | 'office_supplies'          // Αναλώσιμα γραφείου
  | 'software'                 // Λογισμικό/Subscriptions
  | 'equipment'                // Εξοπλισμός <1.500€
  | 'travel'                   // Ταξίδια/Μετακινήσεις
  | 'training'                 // Εκπαίδευση/Σεμινάρια
  | 'advertising'              // Διαφήμιση/Marketing
  | 'efka'                     // Εισφορές ΕΦΚΑ
  | 'professional_tax'         // Τέλος επιτηδεύματος
  | 'bank_fees'                // Τραπεζικά έξοδα
  | 'tee_fees'                 // Εισφορές ΤΕΕ
  | 'depreciation'             // Αποσβέσεις
  | 'other_expense';           // Λοιπά

type AccountCategory = IncomeCategory | ExpenseCategory;
```

### 4.2 Category Metadata Registry

```typescript
/** myDATA κωδικοί χαρακτηρισμού εσόδων */
type MyDataIncomeType =
  | 'category1_1'   // Πώληση αγαθών
  | 'category1_3'   // Παροχή υπηρεσιών
  | 'category1_4'   // Πώληση παγίων
  | 'category1_5';  // Λοιπά έσοδα

/** myDATA κωδικοί χαρακτηρισμού εξόδων */
type MyDataExpenseType =
  | 'category2_2'   // Αγορές Α' υλών
  | 'category2_3'   // Λήψη υπηρεσιών
  | 'category2_4'   // Γενικά έξοδα
  | 'category2_5'   // Λοιπά έξοδα
  | 'category2_6'   // Αμοιβές προσωπικού
  | 'category2_7'   // Αγορές παγίων
  | 'category2_11'  // Αποσβέσεις
  | 'category2_12'  // Λοιπές εκπιπτόμενες δαπάνες
  | 'category2_14'; // Πληροφοριακά

interface CategoryDefinition {
  code: AccountCategory;
  type: 'income' | 'expense';
  label: string;                  // Ελληνικό label
  description: string;
  mydataCode: MyDataIncomeType | MyDataExpenseType;
  e3Code: string;                 // Κωδικός Ε3
  defaultVatRate: number;         // 24, 13, 6, ή 0
  vatDeductible: boolean;         // Εκπίπτει ο ΦΠΑ;
  vatDeductiblePercent: number;   // 100, 50, ή 0
  isActive: boolean;              // Ενεργή κατηγορία
  sortOrder: number;              // Σειρά εμφάνισης
  icon: string;                   // Lucide icon name
  kadCode: string | null;         // ΚΑΔ (μόνο για έσοδα)
}
```

### 4.3 Full Registry (Config)

```typescript
const ACCOUNT_CATEGORIES: CategoryDefinition[] = [
  // ═══════════════════════════════════════════
  // ΕΣΟΔΑ
  // ═══════════════════════════════════════════
  {
    code: 'service_income',
    type: 'income',
    label: 'Αμοιβές Υπηρεσιών',
    description: 'Μελέτες, ΠΕΑ, άδειες, ρυθμίσεις, επιβλέψεις',
    mydataCode: 'category1_3',
    e3Code: '561_003',
    defaultVatRate: 24,
    vatDeductible: false,  // N/A — είναι έσοδο
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 1,
    icon: 'Briefcase',
    kadCode: '71112000',
  },
  {
    code: 'construction_income',
    type: 'income',
    label: 'Κατασκευαστικά Έσοδα',
    description: 'Εργολαβίες κατασκευής (μη οικιστικά)',
    mydataCode: 'category1_1',
    e3Code: '561_001',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 2,
    icon: 'Building2',
    kadCode: '41202003',
  },
  {
    code: 'construction_res_income',
    type: 'income',
    label: 'Κατασκευαστικά (Οικιστικά)',
    description: 'Εργολαβίες κατασκευής (οικιστικά)',
    mydataCode: 'category1_1',
    e3Code: '561_001',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 3,
    icon: 'Home',
    kadCode: '41201001',
  },
  {
    code: 'asset_sale_income',
    type: 'income',
    label: 'Πώληση Παγίου',
    description: 'Πώληση εξοπλισμού, οχήματος, H/Y',
    mydataCode: 'category1_4',
    e3Code: '570_003',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 4,
    icon: 'PackageMinus',
    kadCode: null,
  },
  {
    code: 'other_income',
    type: 'income',
    label: 'Λοιπά Έσοδα',
    description: 'Τόκοι, αποζημιώσεις, λοιπά',
    mydataCode: 'category1_5',
    e3Code: '561_005',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 5,
    icon: 'CircleDollarSign',
    kadCode: null,
  },

  // ═══════════════════════════════════════════
  // ΕΞΟΔΑ
  // ═══════════════════════════════════════════
  {
    code: 'third_party_fees',
    type: 'expense',
    label: 'Αμοιβές Τρίτων',
    description: 'Λογιστής, δικηγόρος, μηχανικός, υπεργολάβος',
    mydataCode: 'category2_3',
    e3Code: '585_001',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 10,
    icon: 'Users',
    kadCode: null,
  },
  {
    code: 'rent',
    type: 'expense',
    label: 'Ενοίκιο Γραφείου',
    description: 'Ενοίκιο επαγγελματικού χώρου',
    mydataCode: 'category2_3',
    e3Code: '585_002',
    defaultVatRate: 0,  // Ενοίκια εξαιρούνται ΦΠΑ
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 11,
    icon: 'Building',
    kadCode: null,
  },
  {
    code: 'utilities',
    type: 'expense',
    label: 'ΔΕΗ / Νερό / Θέρμανση',
    description: 'Λογαριασμοί ΔΕΚΟ',
    mydataCode: 'category2_4',
    e3Code: '585_002',
    defaultVatRate: 6,  // ΔΕΗ: 6%, Νερό: 13%
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 12,
    icon: 'Zap',
    kadCode: null,
  },
  {
    code: 'telecom',
    type: 'expense',
    label: 'Τηλεφωνία / Internet',
    description: 'Cosmote, Vodafone, ISP',
    mydataCode: 'category2_4',
    e3Code: '585_002',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 50,  // 50% αν μικτή χρήση (επαγγ. + προσωπική)
    isActive: true,
    sortOrder: 13,
    icon: 'Phone',
    kadCode: null,
  },
  {
    code: 'fuel',
    type: 'expense',
    label: 'Καύσιμα',
    description: 'Βενζίνη, diesel',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,  // Αν αποκλειστικά επαγγελματική χρήση
    isActive: true,
    sortOrder: 14,
    icon: 'Fuel',
    kadCode: null,
  },
  {
    code: 'vehicle_expenses',
    type: 'expense',
    label: 'Έξοδα Οχήματος',
    description: 'Service, ΚΤΕΟ, τέλη κυκλοφορίας, ανταλλακτικά',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 50,  // Μικτή χρήση (επαγγ. + προσωπική)
    isActive: true,
    sortOrder: 15,
    icon: 'Car',
    kadCode: null,
  },
  {
    code: 'vehicle_insurance',
    type: 'expense',
    label: 'Ασφάλεια Οχήματος',
    description: 'Motor insurance',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 0,  // Ασφάλειες εξαιρούνται ΦΠΑ
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 16,
    icon: 'Shield',
    kadCode: null,
  },
  {
    code: 'office_supplies',
    type: 'expense',
    label: 'Αναλώσιμα Γραφείου',
    description: 'Χαρτί, μελάνια, γραφική ύλη',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 17,
    icon: 'Paperclip',
    kadCode: null,
  },
  {
    code: 'software',
    type: 'expense',
    label: 'Λογισμικό / Subscriptions',
    description: 'AutoCAD, Office 365, hosting, cloud services',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 18,
    icon: 'Monitor',
    kadCode: null,
  },
  {
    code: 'equipment',
    type: 'expense',
    label: 'Εξοπλισμός (<1.500€)',
    description: 'Μικροεξοπλισμός (κάτω ορίου παγίου)',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 19,
    icon: 'Wrench',
    kadCode: null,
  },
  {
    code: 'travel',
    type: 'expense',
    label: 'Ταξίδια / Μετακινήσεις',
    description: 'Εισιτήρια, διόδια, ξενοδοχεία, parking',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 20,
    icon: 'Map',
    kadCode: null,
  },
  {
    code: 'training',
    type: 'expense',
    label: 'Εκπαίδευση / Σεμινάρια',
    description: 'Σεμινάρια, πιστοποιήσεις, βιβλία',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 6,  // Εκπαίδευση: 6%
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 21,
    icon: 'GraduationCap',
    kadCode: null,
  },
  {
    code: 'advertising',
    type: 'expense',
    label: 'Διαφήμιση / Marketing',
    description: 'Ιστοσελίδα, social media, εκτυπώσεις',
    mydataCode: 'category2_5',
    e3Code: '585_016',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 22,
    icon: 'Megaphone',
    kadCode: null,
  },
  {
    code: 'efka',
    type: 'expense',
    label: 'Εισφορές ΕΦΚΑ',
    description: 'Ασφαλιστικές εισφορές (ΤΣΜΕΔΕ/ΤΕΕ)',
    mydataCode: 'category2_12',
    e3Code: '585_005',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 23,
    icon: 'HeartPulse',
    kadCode: null,
  },
  {
    code: 'professional_tax',
    type: 'expense',
    label: 'Τέλος Επιτηδεύματος',
    description: 'Ετήσιο τέλος (650€ ή 325€ για <5 ετών)',
    mydataCode: 'category2_12',
    e3Code: '585_009',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 24,
    icon: 'Receipt',
    kadCode: null,
  },
  {
    code: 'bank_fees',
    type: 'expense',
    label: 'Τραπεζικά Έξοδα',
    description: 'Προμήθειες, χρεωστικοί τόκοι',
    mydataCode: 'category2_12',
    e3Code: '585_008',
    defaultVatRate: 0,  // Εξαιρούνται ΦΠΑ
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 25,
    icon: 'Landmark',
    kadCode: null,
  },
  {
    code: 'tee_fees',
    type: 'expense',
    label: 'Εισφορές ΤΕΕ',
    description: 'Ετήσια συνδρομή Τεχνικού Επιμελητηρίου',
    mydataCode: 'category2_12',
    e3Code: '585_009',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 26,
    icon: 'Award',
    kadCode: null,
  },
  {
    code: 'depreciation',
    type: 'expense',
    label: 'Αποσβέσεις',
    description: 'Φορολογικές αποσβέσεις παγίων',
    mydataCode: 'category2_11',
    e3Code: '587_001',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 27,
    icon: 'TrendingDown',
    kadCode: null,
  },
  {
    code: 'other_expense',
    type: 'expense',
    label: 'Λοιπά Έξοδα',
    description: 'Μη κατηγοριοποιημένα',
    mydataCode: 'category2_14',
    e3Code: '585_016',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 28,
    icon: 'MoreHorizontal',
    kadCode: null,
  },
];
```

---

## 5. Journal Entry Schema (Βιβλίο Εσόδων-Εξόδων)

### 5.1 Εγγραφή

```typescript
interface JournalEntry {
  // === Ταυτότητα ===
  entryId: string;                  // Auto-generated (je_XXXXX)
  type: 'income' | 'expense';
  status: 'draft' | 'confirmed' | 'voided';

  // === Ημερομηνία & Περίοδος ===
  date: string;                     // ISO date (ημερομηνία συναλλαγής)
  fiscalYear: number;               // π.χ. 2026
  quarter: 1 | 2 | 3 | 4;          // Αυτόματο από date
  month: number;                    // 1-12 (για μηνιαίες αναφορές)

  // === Κατηγοριοποίηση (τετραπλός χαρακτηρισμός) ===
  category: AccountCategory;        // Εσωτερικός κωδικός
  mydataCode: string;               // myDATA κατηγορία (category1_x / category2_x)
  e3Code: string;                   // Κωδικός Ε3
  kadCode: string | null;           // ΚΑΔ (μόνο για έσοδα)

  // === Ποσά ===
  netAmount: number;                // Καθαρή αξία
  vatRate: number;                  // Συντελεστής ΦΠΑ (0, 6, 13, 24)
  vatAmount: number;                // Ποσό ΦΠΑ
  totalAmount: number;              // Σύνολο (net + vat)

  // === ΦΠΑ Εκπεσιμότητα (μόνο για έξοδα) ===
  vatDeductible: boolean;           // Εκπίπτει;
  vatDeductiblePercent: number;     // Ποσοστό έκπτωσης (100, 50, 0)
  vatDeductibleAmount: number;      // Εκπιπτόμενο ΦΠΑ = vatAmount × %

  // === Παρακράτηση (μόνο για έσοδα) ===
  withholdingRate: number;          // 0, 3, 4, 10, 20
  withholdingAmount: number;        // Ποσό παρακράτησης
  netReceivable: number;            // Πληρωτέο = total - withholding

  // === Περιγραφή ===
  description: string;              // Σύντομη περιγραφή
  notes: string | null;             // Σημειώσεις

  // === Πηγή ===
  sourceType: 'invoice' | 'received_document' | 'manual' | 'efka' | 'bank_import';
  sourceId: string | null;          // invoiceId / receivedDocId / efkaPaymentId

  // === Αντισυμβαλλόμενος ===
  counterpartyName: string | null;  // Επωνυμία
  counterpartyVat: string | null;   // ΑΦΜ
  contactId: string | null;         // → CRM contact (αν υπάρχει)

  // === Τραπεζική Αντιστοίχιση ===
  bankTransactionId: string | null; // → Bank reconciliation
  paymentStatus: 'pending' | 'partial' | 'paid';

  // === AI ===
  aiClassified: boolean;            // Κατηγοριοποιήθηκε αυτόματα;
  aiConfidence: number | null;      // Βαθμός εμπιστοσύνης 0-1

  // === Meta ===
  createdAt: string;
  updatedAt: string;
  createdBy: string;                // userId
}
```

### 5.2 Αυτόματοι Υπολογισμοί

```typescript
interface JournalEntryCalculations {
  /** Υπολογισμός ΦΠΑ */
  calculateVat(netAmount: number, vatRate: number): number;
  // vatAmount = netAmount × (vatRate / 100)
  // totalAmount = netAmount + vatAmount

  /** Εκπιπτόμενο ΦΠΑ (μόνο έξοδα) */
  calculateDeductibleVat(vatAmount: number, category: ExpenseCategory): number;
  // Βρες vatDeductiblePercent από ACCOUNT_CATEGORIES
  // deductible = vatAmount × (percent / 100)

  /** Τρίμηνο από ημερομηνία */
  getQuarter(date: string): 1 | 2 | 3 | 4;
  // Q1: Ιαν-Μαρ, Q2: Απρ-Ιουν, Q3: Ιουλ-Σεπ, Q4: Οκτ-Δεκ

  /** myDATA & E3 auto-fill */
  getClassification(category: AccountCategory): {
    mydataCode: string;
    e3Code: string;
  };
}
```

---

## 6. VAT Summary Structure (ΦΠΑ Περίληψη)

Κάθε τρίμηνο, το σύστημα υπολογίζει:

```typescript
interface VATQuarterSummary {
  year: number;
  quarter: 1 | 2 | 3 | 4;

  // ΦΠΑ ΕΚΡΟΩΝ (output VAT — από τιμολόγια που εκδώσαμε)
  outputVat: {
    totalNet: number;         // Σύνολο καθαρής αξίας εσόδων
    totalVat: number;         // Σύνολο ΦΠΑ εκροών
    byRate: Array<{
      rate: number;           // 24, 13, 6, 0
      net: number;
      vat: number;
    }>;
  };

  // ΦΠΑ ΕΙΣΡΟΩΝ (input VAT — από δαπάνες)
  inputVat: {
    totalNet: number;
    totalVat: number;
    totalDeductible: number;  // Εκπιπτόμενο ΦΠΑ εισροών
    totalNonDeductible: number;
    byRate: Array<{
      rate: number;
      net: number;
      vat: number;
      deductible: number;
    }>;
  };

  // ΑΠΟΤΕΛΕΣΜΑ
  vatPayable: number;         // outputVat.totalVat - inputVat.totalDeductible
  // Αν > 0 → πληρώνουμε ΦΠΑ
  // Αν < 0 → πιστωτικό υπόλοιπο (μεταφέρεται)
  carryForward: number;       // Πιστωτικό από προηγούμενο τρίμηνο
  finalPayable: number;       // vatPayable - carryForward
}
```

---

## 7. Annual Tax Summary (Ε3 — Φορολογική Δήλωση)

```typescript
interface AnnualE3Summary {
  year: number;

  // === ΕΣΟΔΑ ===
  income: {
    e561_001: number;       // Πωλήσεις αγαθών (κατασκευές)
    e561_003: number;       // Παροχή υπηρεσιών
    e561_005: number;       // Λοιπά συνήθη έσοδα
    e570_003: number;       // Πώληση παγίων
    totalIncome: number;    // Σύνολο εσόδων
  };

  // === ΕΞΟΔΑ ===
  expenses: {
    e585_001: number;       // Αμοιβές τρίτων
    e585_002: number;       // Ενοίκια, ΔΕΚΟ, τηλεφωνία
    e585_005: number;       // Ασφαλιστικές εισφορές (ΕΦΚΑ)
    e585_006: number;       // Λειτουργικά έξοδα (καύσιμα, αναλώσιμα, κλπ.)
    e585_008: number;       // Τόκοι & τραπεζικά
    e585_009: number;       // Φόροι-Τέλη (τέλος επιτηδεύματος, ΤΕΕ)
    e585_016: number;       // Λοιπά έξοδα
    e587_001: number;       // Αποσβέσεις
    totalExpenses: number;  // Σύνολο εξόδων
  };

  // === ΑΠΟΤΕΛΕΣΜΑ ===
  netProfit: number;        // totalIncome - totalExpenses

  // === ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ ===
  incomeTax: number;        // Από κλίμακα (9%-44%)
  solidarityTax: number;    // Εισφορά αλληλεγγύης (αν ισχύει)
  prepayment: number;       // Προκαταβολή φόρου (55% ή 100%)
  totalTax: number;
}
```

---

## 8. Firestore Structure

```
accounting/{companyId}/
  ├── settings/
  │   └── chart_of_accounts           ← Custom κατηγορίες (overrides)
  │
  ├── journal_entries/{entryId}        ← Εγγραφές Εσόδων-Εξόδων
  │
  ├── vat_periods/{year_Q1}           ← Τριμηνιαίες περιλήψεις ΦΠΑ
  │
  └── fiscal_years/{year}             ← Ετήσιες περιλήψεις (E3)

accounting/shared/
  ├── chart_of_accounts                ← Default κατηγορίες (ACCOUNT_CATEGORIES)
  ├── vat_rates                        ← Συντελεστές ΦΠΑ
  └── e3_mapping                       ← Αντιστοίχιση κωδικών Ε3
```

### 8.1 Journal Entry Index

Composite indexes για Firestore queries:

```
journal_entries:
  - (fiscalYear ASC, date ASC)           ← Βιβλίο Ε-Ε ανά έτος
  - (fiscalYear ASC, quarter ASC)        ← ΦΠΑ τρίμηνα
  - (type ASC, fiscalYear ASC)           ← Φιλτράρισμα εσόδων/εξόδων
  - (category ASC, fiscalYear ASC)       ← Ανά κατηγορία
  - (status ASC, date ASC)               ← Draft εγγραφές
```

---

## 9. UI: Βιβλίο Εσόδων-Εξόδων

### 9.1 Κύρια Οθόνη (`/accounting/book`)

```
┌─────────────────────────────────────────────────────────────┐
│  Βιβλίο Εσόδων-Εξόδων        2026 │ Τρίμηνο: Q1 ▼        │
│─────────────────────────────────────────────────────────────│
│  [+ Νέα Εγγραφή]  [📤 Import]  [🔍 Φίλτρα]               │
│─────────────────────────────────────────────────────────────│
│  Ημ/νία  │ Τύπος │ Κατηγορία      │ Περιγραφή   │ Ποσό    │
│  15/01   │ 📥    │ Αμ. Υπηρεσιών │ ΤΠΥ Α-042   │ +500,00 │
│  16/01   │ 📤    │ Καύσιμα        │ BP Εθν.Οδός │  -45,00 │
│  20/01   │ 📤    │ ΕΦΚΑ           │ 12/2025     │ -330,37 │
│  22/01   │ 📥    │ Κατασκ. Έσοδα  │ ΤΠ Α-043    │+2.500,00│
│  ...     │       │                │             │         │
│─────────────────────────────────────────────────────────────│
│  ΣΥΝΟΛΑ Q1:  Έσοδα: 12.500,00€  │  Έξοδα: 4.200,00€      │
│              Κέρδος: 8.300,00€   │  ΦΠΑ: 1.992,00€        │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Dashboard Summary Cards

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  📥 ΕΣΟΔΑ    │ │  📤 ΕΞΟΔΑ    │ │  💰 ΚΕΡΔΟΣ   │ │  🏛️ ΦΠΑ     │
│  12.500,00€  │ │   4.200,00€  │ │   8.300,00€  │ │   1.992,00€  │
│  +15% vs Q4  │ │   -8% vs Q4  │ │  +22% vs Q4  │ │  πληρωτέο    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 10. Category Extensibility

### 10.1 Custom Categories

Ο χρήστης μπορεί να προσθέσει custom κατηγορίες:

```typescript
interface CustomCategory extends Omit<CategoryDefinition, 'code'> {
  code: string;               // custom_XXXXX
  isCustom: true;
  parentCategory: ExpenseCategory | null;  // Βασική κατηγορία (για Ε3 mapping)
}
```

**Κανόνες:**
- Custom κατηγορίες πρέπει πάντα να αντιστοιχίζονται σε myDATA & E3 κωδικό
- Δεν μπορούν να αλλάξουν τις built-in κατηγορίες (μόνο deactivation)
- Για Ε3 χρησιμοποιούν τον κωδικό του parentCategory

### 10.2 Layer 3+ Extensions (Διπλογραφικό)

Όταν/αν γίνει upgrade σε Γ' Κατηγορίας:

```
Layer 1 (Απλογραφικό):  Κατηγορίες → Βιβλίο Ε-Ε
Layer 3 (Διπλογραφικό): Λογαριασμοί ΕΓΛΣ → Γενικό Καθολικό + Ισολογισμός
                          Ομάδα 1: Πάγιο ενεργητικό
                          Ομάδα 2: Αποθέματα
                          Ομάδα 3: Απαιτήσεις
                          Ομάδα 4: Κεφάλαια
                          Ομάδα 5: Βραχ. υποχρεώσεις
                          Ομάδα 6: Οργανικά έξοδα
                          Ομάδα 7: Οργανικά έσοδα
                          Ομάδα 8: Αποτελέσματα
```

Η μετάβαση θα γίνει μέσω mapping: `AccountCategory → ΕΓΛΣ account number`

---

## 11. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-001** (Company Setup) | **BLOCKED BY** | Χρειάζεται ΑΦΜ, ΚΑΔ, ΔΟΥ |
| **M-003** (Invoicing) | **FEEDS** | Κάθε τιμολόγιο → εγγραφή εσόδου |
| **M-004** (myDATA) | **READS** | Χρησιμοποιεί mydataCode per entry |
| **M-005** (VAT Engine) | **READS** | Χρησιμοποιεί vatAmount, vatDeductible |
| **M-006** (Expense Tracker) | **FEEDS** | AI κατηγοριοποίηση → εγγραφή εξόδου |
| **M-009** (Bank Reconciliation) | **LINKS** | bankTransactionId → αντιστοίχιση |
| **M-010** (Reports) | **READS** | Αναφορές Ε-Ε, Ε3, ΦΠΑ |

---

## 12. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | Εξοπλισμός: Ποιο ακριβώς όριο για πάγιο; 1.500€ ή αλλιώς; | DEFAULT: 1.500€ |
| 2 | Τηλεφωνία: 50% ΦΠΑ εκπεσιμότητα σωστό; Ή χρειάζεται config; | DEFAULT: 50% (config-driven) |
| 3 | Αυτοκίνητο: Ένα ή πολλαπλά; Ξεχωριστή κατηγορία ανά αυτοκίνητο; | DEFAULT: 1 (modular) |

---

## 13. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Chart of Accounts for απλογραφικό | Γιώργος + Claude Code |
| 2026-02-09 | Τετραπλός χαρακτηρισμός: app category + myDATA + E3 + VAT | Claude Code |
| 2026-02-09 | 5 κατηγορίες εσόδων, 19 κατηγορίες εξόδων (config-driven) | Claude Code |
| 2026-02-09 | Custom categories μέσω parentCategory mapping | Claude Code |
| 2026-02-09 | Layer 3+ extension: mapping σε ΕΓΛΣ αριθμημένους λογαριασμούς | Claude Code |
| 2026-02-09 | **Phase 1 implemented** — types/common.ts, types/journal.ts, types/invoice.ts, types/index.ts, config/account-categories.ts (24 categories registry), firestore-collections.ts updated | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
