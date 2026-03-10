# ADR-193: Εμφάνιση Πεδίων ανά Domain — Χώροι vs Πωλήσεις

## Status
**IMPLEMENTED** | 2026-03-10

## Κατηγορία
UI / Domain Architecture / Field Display Strategy

---

## 1. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΕΦΑΡΜΟΓΗΣ

### 1.1 Δομή Sidebar

```
Χώροι (/spaces)
├─ Μονάδες (/spaces/apartments)
├─ Αποθήκες (/spaces/storage)
├─ Θέσεις Στάθμευσης (/spaces/parking)
└─ Κοινόχρηστοι Χώροι (/spaces/common)

Πωλήσεις (/sales)
├─ Διαθέσιμα Διαμερίσματα (/sales/available-apartments)
├─ Διαθέσιμες Αποθήκες (/sales/available-storage)
├─ Διαθέσιμες Θέσεις Στάθμευσης (/sales/available-parking)
└─ Πωληθέντα (/sales/sold)
```

### 1.2 Πεδία που εμφανίζονται ΣΗΜΕΡΑ στους Χώρους

#### Αποθήκες (StorageGeneralTab) — 12 πεδία
| Πεδίο | Τύπος | Domain |
|-------|-------|--------|
| Όνομα | text | Ταυτότητα |
| Τύπος | select | Ταυτότητα |
| Κατάσταση | select | **ΜΙΚΤΟ** (available/maintenance = λειτουργικό, sold/reserved = εμπορικό) |
| Εμβαδόν | number | Φυσικό |
| Κτίριο | read-only | Τοποθεσία |
| Όροφος | text | Τοποθεσία |
| **Τιμή** | number | **ΕΜΠΟΡΙΚΟ** |
| **Τιμή/m²** | calculated | **ΕΜΠΟΡΙΚΟ** |
| **Project ID** | read-only | **ΕΜΠΟΡΙΚΟ** |
| Περιγραφή | textarea | Γενικό |
| Σημειώσεις | textarea | Γενικό |
| Τελ. ενημέρωση / Κάτοχος | read-only | Μεταδεδομένα |

#### Θέσεις Στάθμευσης (ParkingGeneralTab) — 11 πεδία
| Πεδίο | Τύπος | Domain |
|-------|-------|--------|
| Κωδικός (P-001) | text | Ταυτότητα |
| Τύπος | select | Ταυτότητα |
| Κατάσταση | select | **ΜΙΚΤΟ** |
| Εμβαδόν | number | Φυσικό |
| Όροφος | text | Τοποθεσία |
| Θέση/Τοποθεσία | text | Τοποθεσία |
| Building ID | read-only | Τοποθεσία |
| **Project ID** | read-only | **ΕΜΠΟΡΙΚΟ** |
| **Τιμή** | number | **ΕΜΠΟΡΙΚΟ** |
| **Τιμή/m²** | calculated | **ΕΜΠΟΡΙΚΟ** |
| Σημειώσεις | textarea | Γενικό |

#### Μονάδες (UnitFieldsBlock + PropertyMeta) — 32+ πεδία
| Κατηγορία | Πεδία | Domain |
|-----------|-------|--------|
| Ταυτότητα | Όνομα, Περιγραφή, Τύπος | Ταυτότητα |
| Τοποθεσία | Κτίριο, Όροφος, Έργο | Τοποθεσία |
| Διάταξη | Υπνοδωμάτια, Μπάνια, WC | Φυσικό |
| Εμβαδά | Μικτό, Καθαρό, Μπαλκόνι, Βεράντα, Κήπος | Φυσικό |
| Προσανατολισμός | 8 κατευθύνσεις multi-select | Φυσικό |
| Κατάσταση/Ενέργεια | Condition, Energy Class | Φυσικό |
| Συστήματα | Θέρμανση, Ψύξη | Φυσικό |
| Φινιρίσματα | Δάπεδα, Κουφώματα, Υαλοπίνακες | Φυσικό |
| Χαρακτηριστικά | Interior Features, Security Features | Φυσικό |
| **Εμπορικά** | **Status (sold/reserved), Price, SoldTo** | **ΕΜΠΟΡΙΚΟ (ήδη DEPRECATED)** |

**Σημείωση:** Στις Μονάδες τα εμπορικά πεδία (price, soldTo, saleDate) είναι **ήδη DEPRECATED** στον κώδικα και σχεδιάζεται μεταφορά σε SalesAsset type.

### 1.3 Πρόβλημα

Τα εμπορικά πεδία (τιμή, τιμή/m², project) **αναμειγνύονται** με τα φυσικά/λειτουργικά στην ενότητα Χώροι. Ο μηχανικός εργοταξίου που βλέπει μια αποθήκη δεν χρειάζεται να ξέρει πόσο κοστίζει — χρειάζεται εμβαδόν, όροφο, κατάσταση.

---

## 2. ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΕΣ ΕΤΑΙΡΕΙΕΣ

### 2.1 Κατασκευαστικές Εταιρείες Τεχνικών Έργων

#### SAP Real Estate (RE-FX) — Vinci, Bouygues, Skanska
- **Property Management Module**: Φυσικά χαρακτηριστικά (εμβαδόν, όροφος, κατάσταση, συντήρηση)
- **Commercial Management Module**: Τιμές, μισθώσεις, πωλήσεις, συμβόλαια
- **ΞΕΧΩΡΙΣΤΑ modules** — ο ίδιος χώρος εμφανίζεται ΔΙΑΦΟΡΕΤΙΚΑ σε κάθε module

#### Oracle Primavera + Unifier — Bechtel, Fluor
- **Asset Register**: Κωδικός, τύπος, τοποθεσία, κατάσταση (physical)
- **Cost Management**: Τιμές, αξία, budget, transactions
- **ΞΕΧΩΡΙΣΤΑ views** ανά ρόλο χρήστη

#### Procore — Turner Construction, Skanska USA
- **Project Financials**: Budget, contracts, change orders
- **Drawings & Models**: Σχέδια, κατόψεις, 3D models
- **Τα οικονομικά ΔΕΝ εμφανίζονται** στις σελίδες σχεδίων

### 2.2 Εταιρείες Λογισμικού

#### Google Workspace / Google Cloud
- **Resource Management**: Πόροι (servers, instances) — physical specs
- **Billing Console**: Κόστος, τιμολόγηση — ΞΕΧΩΡΙΣΤΗ εφαρμογή
- **ΠΟΤΕ δεν αναμειγνύουν** specs με billing στο ίδιο view

#### Salesforce
- **Account Record**: Ταυτότητα πελάτη, στοιχεία επικοινωνίας
- **Opportunity Record**: Τιμή, στάδιο πώλησης, ημερομηνίες
- **ΞΕΧΩΡΙΣΤΑ objects** — σύνδεση μέσω relationships, όχι μέσα στο ίδιο form

#### SAP S/4HANA — Siemens, BMW
- **Material Master → Basic View**: Τεχνικά χαρακτηριστικά
- **Material Master → Sales View**: Τιμολόγηση, κανάλια πωλήσεων
- **Material Master → Accounting View**: Κοστολόγηση
- **ΙΔΙΟ entity, ΔΙΑΦΟΡΕΤΙΚΑ views** ανά organizational area

### 2.3 Enterprise Pattern: Domain-Driven Views

```
┌─────────────────────────────────────────────────┐
│              MASTER ENTITY RECORD                │
│  (Unit / Storage / Parking)                      │
│  Firestore: units / storage_units / parking_spots│
└──────────┬──────────────────────┬────────────────┘
           │                      │
    ┌──────▼──────┐      ┌───────▼───────┐
    │  ΧΩΡΟΙ VIEW │      │ ΠΩΛΗΣΕΙΣ VIEW │
    │  (Physical) │      │ (Commercial)  │
    ├─────────────┤      ├───────────────┤
    │ Ταυτότητα   │      │ Τιμή          │
    │ Τοποθεσία   │      │ Τιμή/m²       │
    │ Εμβαδόν     │      │ Κατάσταση     │
    │ Όροφος      │      │  Πώλησης      │
    │ Κατάσταση   │      │ Αγοραστής     │
    │  (λειτουργ.)│      │ Ημ. Πώλησης   │
    │ Τεχνικά     │      │ Συμβόλαιο     │
    │ Σημειώσεις  │      │ Έργο          │
    └─────────────┘      └───────────────┘
```

---

## 3. ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΟΥΜΕ

### 3.1 Κανόνας: Domain Separation

**Στους ΧΩΡΟΥΣ εμφανίζονται ΜΟΝΟ:**
- Ταυτότητα (όνομα, κωδικός, τύπος)
- Φυσικά χαρακτηριστικά (εμβαδόν, διαστάσεις)
- Τοποθεσία (κτίριο, όροφος, ζώνη)
- Λειτουργική κατάσταση (available, maintenance, occupied — ΟΧΙ sold/reserved)
- Τεχνικά (μόνο μονάδες: διάταξη, ενέργεια, συστήματα, φινιρίσματα)
- Σημειώσεις / Περιγραφή
- Μεταδεδομένα (ημερομηνίες, δημιουργός)

**Στις ΠΩΛΗΣΕΙΣ εμφανίζονται ΜΟΝΟ:**
- Ταυτότητα (σύνοψη — όνομα, τύπος, εμβαδόν)
- Τιμή & Τιμή/m²
- Εμπορική κατάσταση (for-sale, sold, reserved)
- Αγοραστής / Πελάτης
- Ημερομηνία πώλησης
- Έργο (context)
- Συνδεδεμένοι χώροι (αποθήκη/parking που πάει μαζί)

### 3.2 Αλλαγές στα Πεδία

#### StorageGeneralTab — Αφαίρεση εμπορικών
| Πριν | Μετά | Λόγος |
|------|------|-------|
| Τιμή (€) | **ΑΦΑΙΡΕΣΗ** | Εμπορικό → Πωλήσεις |
| Τιμή/m² | **ΑΦΑΙΡΕΣΗ** | Εμπορικό → Πωλήσεις |
| Project ID | **ΑΦΑΙΡΕΣΗ** | Εμπορικό context |
| Financial Card ολόκληρο | **ΑΦΑΙΡΕΣΗ** | Δεν ανήκει στους Χώρους |

**Πεδία που ΜΕΝΟΥΝ:** Όνομα, Τύπος, Κατάσταση, Εμβαδόν, Κτίριο, Όροφος, Περιγραφή, Σημειώσεις, Μεταδεδομένα = **9 πεδία**

#### ParkingGeneralTab — Αφαίρεση εμπορικών
| Πριν | Μετά | Λόγος |
|------|------|-------|
| Τιμή (€) | **ΑΦΑΙΡΕΣΗ** | Εμπορικό → Πωλήσεις |
| Τιμή/m² | **ΑΦΑΙΡΕΣΗ** | Εμπορικό → Πωλήσεις |
| Project ID | **ΑΦΑΙΡΕΣΗ** | Εμπορικό context |
| Financial Card ολόκληρο | **ΑΦΑΙΡΕΣΗ** | Δεν ανήκει στους Χώρους |

**Πεδία που ΜΕΝΟΥΝ:** Κωδικός, Τύπος, Κατάσταση, Εμβαδόν, Όροφος, Θέση, Building ID, Σημειώσεις, Μεταδεδομένα = **9 πεδία**

#### UnitFieldsBlock — Ήδη σωστό
Τα εμπορικά πεδία (price, soldTo, saleDate) είναι **ήδη DEPRECATED** και δεν εμφανίζονται στο UnitFieldsBlock. Η PropertyMeta επίσης δεν δείχνει τιμή. **Κανένα πρόβλημα.**

### 3.3 Μελλοντικά (Πωλήσεις)
Οι σελίδες `/sales/available-storage` και `/sales/available-parking` θα πρέπει να δείχνουν:
- Κωδικός + Τύπος + Εμβαδόν (σύνοψη)
- **Τιμή**, **Τιμή/m²**
- **Εμπορική κατάσταση** (for-sale, sold, reserved)
- **Αγοραστής** (αν υπάρχει)

Αυτό είναι Phase 2 — απαιτεί SalesAsset type (βλ. Unit type deprecation notes).

---

## 4. ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΖΟΥΝ

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 1 | `StorageGeneralTab.tsx` | Αφαίρεση Financial Card (price, price/m², project) |
| 2 | `ParkingGeneralTab.tsx` | Αφαίρεση Financial Card (price, price/m², project) |

**ΔΕΝ αλλάζουν:** UnitFieldsBlock (ήδη σωστό), API routes (τα πεδία παραμένουν στο Firestore), types (δεν αφαιρούμε πεδία από interfaces)

## 5. INDUSTRY REFERENCES

| Εταιρεία | ERP/Software | Pattern |
|----------|-------------|---------|
| Vinci / Bouygues | SAP RE-FX | Property Mgmt ≠ Commercial Mgmt |
| Bechtel / Fluor | Oracle Primavera | Asset Register ≠ Cost Management |
| Skanska / Turner | Procore | Drawings ≠ Financials |
| Google | Cloud Console vs Billing | Specs ≠ Pricing |
| Salesforce | Account vs Opportunity | Identity ≠ Sales Pipeline |
| SAP | Material Master Views | Same entity, domain-specific views |

## 6. DECISION

Αφαίρεση των εμπορικών πεδίων (τιμή, τιμή/m², project) από τα StorageGeneralTab και ParkingGeneralTab στην ενότητα Χώρους. Τα πεδία αυτά θα εμφανίζονται μόνο στις σελίδες Πωλήσεων (μελλοντική Phase 2).
