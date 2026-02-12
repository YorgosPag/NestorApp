# ADR-ACC-012: Υποστηριξη OE (Ομορρυθμη Εταιρεια) — Partnership Support

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-10 |
| **Category** | Accounting / Entity Types |
| **Author** | Γιωργος Παγωνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-001: Company Setup / M-010: Reports |

---

## 1. Context

Η εφαρμογη λογιστικης σχεδιαστηκε αρχικα για **ατομικη επιχειρηση** (sole proprietor). Ομως η ΟΕ (Ομορρυθμη Εταιρεια / General Partnership) ειναι η πιο κοινη εταιρικη μορφη στους μηχανικους που συνεργαζονται. Χρειαζεται επεκταση του συστηματος.

### Διαφορες ΟΕ vs Ατομικη

| Παραμετρος | Ατομικη Επιχειρηση | ΟΕ (Ομορρυθμη) |
|-----------|-------------------|----------------|
| Φορολογια | Κλιμακα φυσικων προσωπων (9%-44%) | **Pass-through**: Κερδη μοιραζονται στους εταιρους, φορολογουνται ατομικα |
| ΕΦΚΑ | 1 ασφαλισμενος | **Καθε εταιρος** πληρωνει ξεχωριστα ΕΦΚΑ |
| Τελος Επιτηδευματος | 650€ (πολεις >200.000) | **1.000€** (νομικα προσωπα) |
| ΓΕΜΗ | Δεν απαιτειται | **Υποχρεωτικο** αριθμο ΓΕΜΗ |
| Ευθυνη | Απεριοριστη προσωπικη | Απεριοριστη **αλληλεγγυα** ολων των εταιρων |
| Βιβλια | Β' κατηγοριας (Ε-Ε) | Β' κατηγοριας (Ε-Ε) |
| Κλιμακα φορου | Ιδια (9%-44%) | Ιδια — εφαρμοζεται στο **μεριδιο** καθε εταιρου |

### Προκληση

Το υπαρχον συστημα ειχε:
- `CompanyProfile` με πεδια μονο για ατομικη (efkaCategory, amka)
- `TaxEngine.calculateAnnualTax()` που υπολογιζε φορο για 1 ατομο
- ΕΦΚΑ tracking για 1 ασφαλισμενο
- Τελος επιτηδευματος hardcoded στα 650€

Χρειαζεται **type-safe επεκταση** χωρις breaking changes στα υπαρχοντα δεδομενα.

---

## 2. Decision

Υλοποιηση **discriminated union** `CompanyProfile = SoleProprietorProfile | OECompanyProfile` με runtime migration για backward compatibility. Καθε εταιρος εχει δικο του ΕΦΚΑ config, και ο φορος υπολογιζεται per-partner (pass-through taxation).

---

## 3. Architecture

### 3.1 Discriminated Union — CompanyProfile

```typescript
type EntityType = 'sole_proprietor' | 'oe' | 'epe' | 'ae';

interface BaseCompanyProfile {
  entityType: EntityType;
  companyName: string;
  afm: string;
  doy: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  kladosCode: string;
  invoiceSeriesPrefix: string;
}

interface SoleProprietorProfile extends BaseCompanyProfile {
  entityType: 'sole_proprietor';
  efkaCategory: 1 | 2 | 3 | 4 | 5 | 6;
  amka: string;
}

interface OECompanyProfile extends BaseCompanyProfile {
  entityType: 'oe';
  gemiNumber: string;           // Αριθμος ΓΕΜΗ (υποχρεωτικος)
  partners: Partner[];          // Εταιροι
  profitDistribution: Record<string, number>; // partnerId → ποσοστο (sum = 100)
}

type CompanyProfile = SoleProprietorProfile | OECompanyProfile;
```

### 3.2 Distributive Omit για CompanySetupInput

```typescript
// Preserves discriminant — δεν χανει το entityType narrowing
type DistributiveOmit<T, K extends keyof T> = T extends T
  ? Omit<T, K>
  : never;

type CompanySetupInput = DistributiveOmit<CompanyProfile, 'companyId' | 'createdAt' | 'updatedAt'>;
```

> **Γιατι Distributive Omit;** Ενα κανονικο `Omit<CompanyProfile, K>` θα εχανε τη discriminated union — δεν θα μπορουσες να κανεις narrowing με `if (input.entityType === 'oe')`. Το distributive pattern διατηρει τη δομη.

### 3.3 Partner Type

```typescript
interface Partner {
  partnerId: string;            // 'partner_xxxxx'
  fullName: string;
  afm: string;
  amka: string;
  profitShare: number;          // Ποσοστο κερδων (π.χ. 50)
  efkaConfig: PartnerEFKAConfig;
  isManagingPartner: boolean;   // Διαχειριστης εταιρος
}

interface PartnerEFKAConfig {
  mainCategory: 1 | 2 | 3 | 4 | 5 | 6;
  supplementaryCategory: 1 | 2 | 3;
  lumpSumCategory: 1 | 2 | 3;
  paymentReferenceCode: string | null;  // RF κωδικος (μοναδικος ανα εταιρο)
}
```

### 3.4 Runtime Migration

```typescript
// Στο firestore-accounting-repository.ts
function migrateCompanyProfile(doc: FirebaseFirestore.DocumentData): CompanyProfile {
  // Εγγραφα χωρις entityType → ειναι απο πριν την ΟΕ υποστηριξη
  if (!doc.entityType) {
    return {
      ...doc,
      entityType: 'sole_proprietor' as const,
    } as SoleProprietorProfile;
  }
  return doc as CompanyProfile;
}
```

### 3.5 Config-driven Professional Tax

```typescript
const PROFESSIONAL_TAX_BY_ENTITY: Record<EntityType, number> = {
  sole_proprietor: 650,    // Φυσικο προσωπο, πολη >200.000
  oe: 1000,                // Νομικο προσωπο (ΟΕ/ΕΕ)
  epe: 1000,               // Νομικο προσωπο (ΕΠΕ)
  ae: 1000,                // Νομικο προσωπο (ΑΕ)
};

function getProfessionalTaxForEntity(entityType: EntityType): number {
  return PROFESSIONAL_TAX_BY_ENTITY[entityType];
}
```

---

## 4. Tax Calculation — Pass-through

### 4.1 Λογικη

Στην ΟΕ:
1. Υπολογιζονται **κοινα** εσοδα/εξοδα εταιρειας
2. Τα καθαρα κερδη **μοιραζονται** στους εταιρους βαση ποσοστου
3. **Καθε εταιρος** φορολογειται ξεχωριστα (κλιμακα φυσικων προσωπων)
4. Τελος επιτηδευματος: **1.000€** για την εταιρεια (οχι ανα εταιρο)

### 4.2 Partnership Tax Types

```typescript
interface PartnerTaxResult {
  partnerId: string;
  partnerName: string;
  profitShare: number;              // Ποσοστο (%)
  allocatedIncome: number;          // Μεριδιο καθαρων κερδων
  efkaContributions: number;        // ΕΦΚΑ εταιρου (εκπιπτεται)
  taxableIncome: number;            // allocatedIncome - efka
  incomeTax: number;                // Απο κλιμακα
  taxBreakdown: TaxBracketResult[]; // Αναλυση ανα κλιμακιο
  prepaymentAmount: number;         // Προκαταβολη φορου
  effectiveTaxRate: number;         // Πραγματικος συντελεστης
}

interface PartnershipTaxResult {
  year: number;
  entityType: 'oe';

  // === Εταιρικα Σύνολα ===
  grossIncome: number;              // Ακαθαριστα εσοδα εταιρειας
  deductibleExpenses: number;       // Εκπιπτομενες δαπανες εταιρειας
  netProfit: number;                // Καθαρα κερδη (πριν ΕΦΚΑ εταιρων)

  // === Ανα Εταιρο ===
  partnerResults: PartnerTaxResult[];

  // === Εταιρικα Τελη ===
  professionalTax: number;          // 1.000€ (ΟΕ)
  solidarityTax: number;            // 0 (αναστολη)

  // === Συνολα ===
  totalIncomeTax: number;           // Αθροισμα φορων ολων εταιρων
  totalPrepayment: number;          // Αθροισμα προκαταβολων
  totalPayable: number;             // totalIncomeTax + professionalTax + totalPrepayment
}
```

### 4.3 TaxEngine — Νεα Μεθοδος

```typescript
class TaxEngine implements ITaxEngine {
  // Υπαρχουσα μεθοδος (ατομικη)
  calculateAnnualTax(params: TaxCalculationParams): TaxResult { /* ... */ }

  // ΝΕΑ μεθοδος (ΟΕ)
  calculatePartnershipTax(params: PartnershipTaxParams): PartnershipTaxResult {
    const { year, grossIncome, deductibleExpenses, partners } = params;
    const netProfit = grossIncome - deductibleExpenses;

    const partnerResults = partners.map(partner => {
      const allocatedIncome = netProfit * (partner.profitShare / 100);
      const efka = partner.annualEfka;
      const taxableIncome = Math.max(0, allocatedIncome - efka);

      // Ιδια κλιμακα φυσικων προσωπων
      const { total: incomeTax, breakdown } = this.calculateProgressiveTax(
        taxableIncome, year
      );

      const scale = this.getTaxScale(year);
      const prepayment = incomeTax * scale.prepaymentRate;

      return {
        partnerId: partner.partnerId,
        partnerName: partner.fullName,
        profitShare: partner.profitShare,
        allocatedIncome,
        efkaContributions: efka,
        taxableIncome,
        incomeTax,
        taxBreakdown: breakdown,
        prepaymentAmount: Math.round(prepayment * 100) / 100,
        effectiveTaxRate: taxableIncome > 0
          ? Math.round((incomeTax / taxableIncome) * 10000) / 100
          : 0,
      };
    });

    const professionalTax = getProfessionalTaxForEntity('oe');
    const totalIncomeTax = partnerResults.reduce((s, p) => s + p.incomeTax, 0);
    const totalPrepayment = partnerResults.reduce((s, p) => s + p.prepaymentAmount, 0);

    return {
      year,
      entityType: 'oe',
      grossIncome,
      deductibleExpenses,
      netProfit,
      partnerResults,
      professionalTax,
      solidarityTax: 0,
      totalIncomeTax,
      totalPrepayment,
      totalPayable: totalIncomeTax + professionalTax + totalPrepayment,
    };
  }
}
```

---

## 5. EFKA — Per-Partner Tracking

### 5.1 Αλλαγες στο EFKAPayment

```typescript
interface EFKAPayment {
  // ... υπαρχοντα πεδια ...
  partnerId: string | null;     // null = sole proprietor (backward compatible)
}
```

### 5.2 Partnership EFKA Summary

```typescript
interface PartnerEFKASummary {
  partnerId: string;
  partnerName: string;
  efkaConfig: PartnerEFKAConfig;
  monthlyAmount: number;
  annualAmount: number;
  paidMonths: number;
  totalPaid: number;
  remainingDue: number;
}

interface PartnershipEFKASummary {
  year: number;
  partners: PartnerEFKASummary[];
  grandTotalExpected: number;
  grandTotalPaid: number;
  grandTotalRemaining: number;
}
```

### 5.3 Firestore — Partners CRUD

```typescript
// Στο IAccountingRepository
interface IAccountingRepository {
  // ... υπαρχοντα ...
  getPartners(companyId: string): Promise<Partner[]>;
  savePartners(companyId: string, partners: Partner[]): Promise<void>;
  getPartnerEFKAPayments(companyId: string, year: number, partnerId: string): Promise<EFKAPayment[]>;
}
```

Partners αποθηκευονται σε **single document**: `accounting_settings/partners` — ιδιο pattern με `service_presets` (ADR-ACC-011).

---

## 6. Practical Example

### 6.1 ΟΕ "Παγωνης & Συνεργατες" — 2 Εταιροι

```
ΕΤΑΙΡΟΙ:
  Γιωργος Παγωνης:  50% κερδων, ΕΦΚΑ 1η κατηγορια (338,64€/μηνα)
  Νικος Παπαδοπουλος: 50% κερδων, ΕΦΚΑ 2η κατηγορια (404,42€/μηνα)

ΕΣΟΔΑ ΕΤΑΙΡΕΙΑΣ:
  Αρχιτεκτονικες υπηρεσιες:     80.000€
  Κατασκευαστικα:                20.000€
  ─────────────────────────────────────
  Ακαθαριστα Εσοδα:            100.000€

ΕΞΟΔΑ ΕΤΑΙΡΕΙΑΣ:
  Αμοιβες τριτων:                 5.000€
  Ενοικιο γραφειου:               7.200€
  ΔΕΚΟ + Τηλεφωνο:               3.600€
  Λοιπα εξοδα:                   4.200€
  ─────────────────────────────────────
  Συνολο Εξοδων:                 20.000€

ΚΑΘΑΡΑ ΚΕΡΔΗ ΕΤΑΙΡΕΙΑΣ:
  100.000 - 20.000 = 80.000€

═══════════════════════════════════════
ΕΤΑΙΡΟΣ: Γιωργος (50%)
═══════════════════════════════════════
  Μεριδιο κερδων:               40.000€
  ΕΦΚΑ (1η κατ., 12 μηνες):    -4.064€
  Φορολογητεο εισοδημα:         35.936€

  Φορος κλιμακας:
    0-10.000:     10.000 × 9%  =    900€
    10.001-20.000: 10.000 × 22% =  2.200€
    20.001-30.000: 10.000 × 28% =  2.800€
    30.001-35.936:  5.936 × 36% =  2.137€
    ─────────────────────────────────
    Φορος Γιωργου:               8.037€

  Effective rate:               22,37%
  Προκαταβολη (100%):           8.037€

═══════════════════════════════════════
ΕΤΑΙΡΟΣ: Νικος (50%)
═══════════════════════════════════════
  Μεριδιο κερδων:               40.000€
  ΕΦΚΑ (2η κατ., 12 μηνες):    -4.853€
  Φορολογητεο εισοδημα:         35.147€

  Φορος κλιμακας:
    0-10.000:     10.000 × 9%  =    900€
    10.001-20.000: 10.000 × 22% =  2.200€
    20.001-30.000: 10.000 × 28% =  2.800€
    30.001-35.147:  5.147 × 36% =  1.853€
    ─────────────────────────────────
    Φορος Νικου:                 7.753€

  Effective rate:               22,06%
  Προκαταβολη (100%):           7.753€

═══════════════════════════════════════
ΣΥΝΟΛΑ ΕΤΑΙΡΕΙΑΣ
═══════════════════════════════════════
  Φοροι εταιρων:      8.037 + 7.753 = 15.790€
  Τελος επιτηδευματος:              1.000€ (ΟΕ)
  Προκαταβολες:       8.037 + 7.753 = 15.790€
  ─────────────────────────────────────────
  ΣΥΝΟΛΟ:                          32.580€
```

---

## 7. Files

### 7.1 New Files (9)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/subapps/accounting/types/entity.ts` | `EntityType`, `Partner`, `PartnerEFKAConfig` — core entity types |
| 2 | `src/subapps/accounting/utils/entity-guards.ts` | `isSoleProprietor()`, `isPartnership()` — type guards |
| 3 | `src/subapps/accounting/hooks/usePartners.ts` | Client hook — fetch/save partners |
| 4 | `src/app/api/accounting/partners/route.ts` | `GET` + `PUT` — partners CRUD API with validation |
| 5 | `src/subapps/accounting/components/setup/EntityTypeSelector.tsx` | Radix Select (ADR-001) — επιλογη μορφης εταιρειας |
| 6 | `src/subapps/accounting/components/setup/PartnerManagementSection.tsx` | Partner list management — add/remove/edit |
| 7 | `src/subapps/accounting/components/setup/PartnerRow.tsx` | Single partner editing — inline form row |
| 8 | `src/subapps/accounting/components/tax/PartnerTaxBreakdown.tsx` | Per-partner tax cards — αναλυση φορου ανα εταιρο |
| 9 | `src/subapps/accounting/components/efka/PartnerEFKATabs.tsx` | Per-partner EFKA tabs — ενα tab ανα εταιρο |

### 7.2 Modified Files (16+)

| # | File | Change |
|---|------|--------|
| 1 | `types/company.ts` | Discriminated union: `CompanyProfile = SoleProprietorProfile \| OECompanyProfile` |
| 2 | `types/tax.ts` | +`PartnerTaxResult`, +`PartnershipTaxResult`, +`PartnershipTaxParams` |
| 3 | `types/efka.ts` | +`partnerId` on `EFKAPayment`, +`PartnerEFKASummary`, +`PartnershipEFKASummary` |
| 4 | `types/interfaces.ts` | +`getPartners()`, +`savePartners()`, +`getPartnerEFKAPayments()` |
| 5 | `types/index.ts` | +barrel exports για ολα τα νεα types |
| 6 | `services/config/tax-config.ts` | +`PROFESSIONAL_TAX_BY_ENTITY`, +`getProfessionalTaxForEntity()` |
| 7 | `services/repository/firestore-accounting-repository.ts` | +runtime migration, +partners CRUD (single doc pattern) |
| 8 | `services/engines/tax-engine.ts` | +`calculatePartnershipTax()` — pass-through φορολογια |
| 9 | `services/accounting-service.ts` | +`calculatePartnershipTax()`, +`getPartnershipEfkaSummary()` |
| 10 | `src/app/api/accounting/setup/route.ts` | Discriminated union handling στο PUT |
| 11 | `src/app/api/accounting/tax/estimate/route.ts` | Partnership path — per-partner tax estimate |
| 12 | `hooks/index.ts` | +`usePartners` export |
| 13 | `components/setup/SetupPageContent.tsx` | +`EntityTypeSelector`, +`PartnerManagementSection` (conditional) |
| 14 | `components/setup/FiscalInfoSection.tsx` | Conditional `efkaCategory` — μονο για sole proprietor |
| 15 | `src/i18n/locales/el/accounting.json` | +OE translation keys (entityType, partner, gemiNumber κ.λπ.) |
| 16 | `src/i18n/locales/en/accounting.json` | +OE translation keys (English) |

---

## 8. Architectural Decisions

### 8.1 Discriminated Union για Type-Safe Extensibility

**Αποφαση**: `CompanyProfile = SoleProprietorProfile | OECompanyProfile`

**Γιατι**:
- Type narrowing: `if (profile.entityType === 'oe') { profile.gemiNumber }` — πληρες autocomplete
- Extensibility: Μελλοντικα `| EPECompanyProfile | AECompanyProfile` χωρις breaking changes
- Compile-time safety: Αδυνατο να προσπελασεις `gemiNumber` σε ατομικη
- Exhaustive checks: `switch (profile.entityType)` — ο compiler σε ειδοποιει αν ξεχασεις case

**Εναλλακτικες που απορριφθηκαν**:
- Optional fields σε flat interface → χανεις type safety, ολα `string | undefined`
- Inheritance (class hierarchy) → δεν ταιριαζει με Firestore data, overkill
- Separate collections per entity type → πολυπλοκοτητα, duplicate queries

### 8.2 Runtime Migration για Backward Compatibility

**Αποφαση**: Documents χωρις `entityType` → `'sole_proprietor'`

**Γιατι**:
- Ο Γιωργος εχει ηδη δεδομενα (company profile, invoices, ΕΦΚΑ κ.λπ.)
- Δεν χρειαζεται migration script — η μεταπτωση γινεται on-read
- Zero downtime: Τα παλια δεδομενα λειτουργουν χωρις αλλαγη
- Νεα εγγραφα παντα με explicit `entityType`

### 8.3 Same TaxEngine, New Method

**Αποφαση**: Προσθηκη `calculatePartnershipTax()` στο υπαρχον `TaxEngine`

**Γιατι**:
- Η κλιμακα φορου ειναι **ιδια** (9%-44%) — δεν αλλαζει ο αλγοριθμος
- Μοιραζεται τον `calculateProgressiveTax()` internal method
- Δεν χρειαζεται νεο engine — μονο νεα entry point
- Single Responsibility: Η κλαση παραμενει tax calculation

### 8.4 Partners σε Single Document

**Αποφαση**: `accounting_settings/partners` → Array<Partner>

**Γιατι**:
- Ιδιο pattern με `service_presets` (ADR-ACC-011) — consistency
- ΟΕ εχει 2-5 εταιρους (ρεαλιστικα) — δεν χρειαζεται subcollection
- Atomic read/write ολων των εταιρων — πιο απλο API
- Simpler queries: δεν χρειαζεται composite index

### 8.5 Nullable partnerId στο EFKAPayment

**Αποφαση**: `partnerId: string | null` αντι required field

**Γιατι**:
- Backward compatibility: Υπαρχοντα ΕΦΚΑ payments (ατομικης) δεν εχουν partnerId
- `null` = sole proprietor (μονος ασφαλισμενος)
- `string` = specific εταιρος σε ΟΕ
- Firestore δεχεται `null` (οχι `undefined` — CLAUDE.md memory rule)

### 8.6 Config-driven Professional Tax Lookup

**Αποφαση**: `PROFESSIONAL_TAX_BY_ENTITY` Record + `getProfessionalTaxForEntity()`

**Γιατι**:
- Αποφυγη hardcoded values σε πολλαπλα σημεια
- Μελλοντικα μπορει να αλλαξει (νομοθεσια) → αλλαζεις μονο στο config
- Type-safe: `EntityType` key guarantees coverage
- Reusable: Και στο TaxEngine και στο API response

---

## 9. UI Components

### 9.1 EntityTypeSelector

```
┌─────────────────────────────────────────┐
│  Μορφη Επιχειρησης                      │
│  ┌───────────────────────────────────┐  │
│  │ ▾ Ατομικη Επιχειρηση             │  │
│  ├───────────────────────────────────┤  │
│  │   Ατομικη Επιχειρηση             │  │
│  │   ΟΕ (Ομορρυθμη Εταιρεια)       │  │
│  │   ΕΠΕ (coming soon)              │  │
│  │   ΑΕ (coming soon)               │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

- Radix Select component (ADR-001 compliant)
- ΕΠΕ/ΑΕ disabled με "(coming soon)" — extensibility δειγμα
- Αλλαγη entityType → conditional rendering PartnerManagement

### 9.2 PartnerManagementSection

```
┌─────────────────────────────────────────────────────────┐
│  Εταιροι                                          [+ Νεος] │
│─────────────────────────────────────────────────────────│
│  ┌───────────────────────────────────────────────────┐  │
│  │ Γιωργος Παγωνης                                   │  │
│  │ ΑΦΜ: 123456789  |  Μεριδιο: 50%  |  ΕΦΚΑ: 1η    │  │
│  │ [Διαχειριστης]                            [Επεξ.] │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Νικος Παπαδοπουλος                                │  │
│  │ ΑΦΜ: 987654321  |  Μεριδιο: 50%  |  ΕΦΚΑ: 2η    │  │
│  │                                           [Επεξ.] │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Συνολο μεριδιων: 100% ✅                              │
└─────────────────────────────────────────────────────────┘
```

### 9.3 PartnerTaxBreakdown

```
┌──────────────────────────────────────────────────────────┐
│  Φορολογια Εταιρων — 2026                                │
│──────────────────────────────────────────────────────────│
│                                                          │
│  ┌─────────────────────────┐ ┌─────────────────────────┐ │
│  │ Γιωργος Παγωνης (50%)   │ │ Νικος Παπαδοπ. (50%)   │ │
│  │─────────────────────────│ │─────────────────────────│ │
│  │ Μεριδιο:     40.000€   │ │ Μεριδιο:     40.000€   │ │
│  │ ΕΦΚΑ:        -4.064€   │ │ ΕΦΚΑ:        -4.853€   │ │
│  │ Φορολογητεο: 35.936€   │ │ Φορολογητεο: 35.147€   │ │
│  │─────────────────────────│ │─────────────────────────│ │
│  │ Φορος:        8.037€   │ │ Φορος:        7.753€   │ │
│  │ Eff. rate:    22,37%   │ │ Eff. rate:    22,06%   │ │
│  │ Προκαταβολη:  8.037€   │ │ Προκαταβολη:  7.753€   │ │
│  └─────────────────────────┘ └─────────────────────────┘ │
│                                                          │
│  ΕΤΑΙΡΙΚΑ ΤΕΛΗ                                           │
│  ─────────────                                           │
│  Τελος επιτηδευματος:     1.000€                         │
│  Συνολο φορων εταιρων:   15.790€                         │
│  Συνολο προκαταβολων:    15.790€                         │
│  ════════════════════════════════                         │
│  ΤΕΛΙΚΟ ΠΛΗΡΩΤΕΟ:       32.580€                          │
└──────────────────────────────────────────────────────────┘
```

### 9.4 PartnerEFKATabs

```
┌──────────────────────────────────────────────────────────┐
│  ΕΦΚΑ — Εισφορες 2026                                    │
│  ┌─────────────────┐ ┌─────────────────────┐             │
│  │ Γιωργος (1η)    │ │ Νικος (2η)          │             │
│  └─────────────────┘ └─────────────────────┘             │
│──────────────────────────────────────────────────────────│
│  Εταιρος: Γιωργος Παγωνης                                │
│  Κατηγορια: 1η Κυρια / 1η Επικ. / 1η Εφαπαξ            │
│  Μηνιαια εισφορα: 338,64€                                │
│                                                          │
│  Ιαν │ ✅ Paid    │ 338,64€ │ 28/01/2026                │
│  Φεβ │ ⏳ Due     │ 338,64€ │ Deadline: 28/02/2026      │
│  Μαρ │ Upcoming   │ 338,64€ │ Deadline: 31/03/2026      │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Firestore Structure

```
accounting_settings/
  ├── company_profile              ← CompanyProfile (discriminated union)
  │   {
  │     entityType: 'oe',
  │     companyName: 'Παγωνης & Συνεργατες ΟΕ',
  │     gemiNumber: '123456789000',
  │     ...
  │   }
  │
  ├── partners                     ← Single doc, array pattern (οπως service_presets)
  │   {
  │     partners: [
  │       { partnerId: 'partner_001', fullName: '...', profitShare: 50, efkaConfig: {...} },
  │       { partnerId: 'partner_002', fullName: '...', profitShare: 50, efkaConfig: {...} },
  │     ],
  │     profitDistribution: { partner_001: 50, partner_002: 50 },
  │     updatedAt: '...'
  │   }

accounting/{companyId}/
  ├── efka_payments/{year}_{month}_{partnerId}   ← Per-partner ΕΦΚΑ
  │   {
  │     partnerId: 'partner_001',                ← nullable (null = sole proprietor)
  │     year: 2026,
  │     month: 1,
  │     expectedAmount: 338.64,
  │     ...
  │   }
```

---

## 11. Validation Rules

### 11.1 Partners API Validation

| Rule | Validation | Error |
|------|-----------|-------|
| Profit shares sum | `partners.reduce(sum profitShare) === 100` | "Τα ποσοστα κερδων πρεπει να αθροιζουν 100%" |
| Min partners | `partners.length >= 2` (ΟΕ requires 2+) | "Η ΟΕ απαιτει τουλαχιστον 2 εταιρους" |
| Unique AFM | No duplicate `afm` in partners | "Διπλοτυπο ΑΦΜ εταιρου" |
| Valid EFKA category | main: 1-6, supplementary: 1-3, lumpSum: 1-3 | "Μη εγκυρη κατηγορια ΕΦΚΑ" |
| Managing partner | At least 1 `isManagingPartner === true` | "Απαιτειται τουλαχιστον ενας διαχειριστης" |
| ΓΕΜΗ format | Numeric string, 12 digits | "Μη εγκυρος αριθμος ΓΕΜΗ" |

### 11.2 Setup API — Discriminated Union Handling

```typescript
// PUT /api/accounting/setup
if (body.entityType === 'oe') {
  // Validate OE-specific fields
  if (!body.gemiNumber) return error('ΓΕΜΗ υποχρεωτικο');
  // efkaCategory NOT expected (belongs to partners)
} else if (body.entityType === 'sole_proprietor') {
  // Validate sole proprietor fields
  if (!body.efkaCategory) return error('ΕΦΚΑ κατηγορια υποχρεωτικη');
  // gemiNumber NOT expected
}
```

---

## 12. Dependencies

| Module | Σχεση | Περιγραφη |
|--------|-------|-----------|
| **ADR-ACC-000** (Founding) | **EXTENDS** | Νεος entity type στο core schema |
| **ADR-ACC-006** (EFKA) | **EXTENDS** | Per-partner ΕΦΚΑ tracking, +partnerId |
| **ADR-ACC-009** (Tax Engine) | **EXTENDS** | +`calculatePartnershipTax()`, config-driven professional tax |
| **ADR-ACC-011** (Service Presets) | **PATTERN** | Single doc array pattern for partners storage |
| **ADR-001** (Select) | **USES** | Radix Select for EntityTypeSelector |
| **ADR-ACC-004** (VAT) | **INDEPENDENT** | ΦΠΑ δεν αλλαζει — εταιρικο επιπεδο |
| **ADR-ACC-002** (Invoicing) | **INDEPENDENT** | Τιμολογια εκδιδονται απο εταιρεια, δεν αλλαζει |

---

## 13. Extensibility — Future Entity Types

Η αρχιτεκτονικη (discriminated union) υποστηριζει μελλοντικη προσθηκη:

| Entity Type | Status | ADR | Ιδιαιτεροτητες |
|-------------|--------|-----|----------------|
| `sole_proprietor` | ✅ Implemented | ACC-000 | Baseline — κλίμακα 9%-44%, 1 ΕΦΚΑ |
| `oe` | ✅ Implemented | ACC-012 | Pass-through, ΕΦΚΑ per partner, 1.000€ τέλος |
| `epe` | ✅ **Implemented** | ACC-014 | Εταιρικός φόρος 22%, μερίσματα 5%, manager ΕΦΚΑ |
| `ae` | ✅ **Implemented** | ACC-015/016/017 | Εταιρικός φόρος 22%, μερίσματα 5%, ΔΣ, dual-mode ΕΦΚΑ |

**Ολοκληρώθηκαν τα 4/4 entity types** (2026-02-12):
- `EPECompanyProfile`: members (εταίροι), shareCapital, gemiNumber (ACC-014)
- `AECompanyProfile`: shareholders (μέτοχοι), board of directors, min 25k€ (ACC-015)
- `calculateCorporateTax(entityType)`: generalized, reuse across EPE + AE (ACC-016)
- EFKA dual-mode (AE): employee <3% vs self-employed ≥3% μετοχών (ACC-017)

---

## 14. Open Questions

| # | Ερωτηση | Status |
|---|---------|--------|
| 1 | Υπαρχουν ΟΕ πελατες του Γιωργου που θα χρησιμοποιησουν αμεσα; | PENDING — καθοριζει priority |
| 2 | Εναλλακτικη κατανομη κερδων (π.χ. ωρες αντι ποσοστα); | DEFAULT: Σταθερα ποσοστα |
| 3 | ΕΕ (Ετερορρυθμη) ως ξεχωριστος entity type ή variation της ΟΕ; | DEFAULT: Ξεχωριστος (μελλοντικα) |

---

## 15. Consequences

### Positive

- **Type safety**: Discriminated union εγγυαται compile-time ελεγχο — αδυνατο `profile.gemiNumber` σε ατομικη
- **Backward compatible**: Runtime migration — μηδενικο downtime, τα υπαρχοντα δεδομενα δουλευουν
- **Extensible**: Νεοι entity types (ΕΠΕ, ΑΕ) με απλη προσθηκη στο union
- **Accurate taxation**: Per-partner φοροι + ξεχωριστα ΕΦΚΑ = σωστοι υπολογισμοι
- **Config-driven**: Professional tax, ΕΦΚΑ rates — αλλαζουν χωρις code changes

### Negative

- **Αυξημενη πολυπλοκοτητα**: UI πρεπει να χειριζεται conditional sections (mitigated: type guards)
- **Περισσοτερα Firestore reads**: Per-partner ΕΦΚΑ payments (mitigated: batch reads)
- **Tax estimate API**: Πιο πολυπλοκο response για ΟΕ (mitigated: PartnershipTaxResult type)

---

## 16. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-10 | ADR-ACC-012 created — ΟΕ Partnership Support | Γιωργος + Claude Code |
| 2026-02-10 | Discriminated union: `CompanyProfile = SoleProprietorProfile \| OECompanyProfile` | Claude Code |
| 2026-02-10 | Distributive Omit pattern for CompanySetupInput | Claude Code |
| 2026-02-10 | EntityType: `'sole_proprietor' \| 'oe' \| 'epe' \| 'ae'` (EΠΕ/ΑΕ reserved) | Claude Code |
| 2026-02-10 | Runtime migration: docs without entityType → `'sole_proprietor'` | Claude Code |
| 2026-02-10 | Config-driven professional tax: 650€ (ατομικη) / 1.000€ (ΟΕ) | Claude Code |
| 2026-02-10 | Partners in single doc — same pattern as service_presets (ADR-ACC-011) | Claude Code |
| 2026-02-10 | Nullable `partnerId` on EFKAPayment for backward compatibility | Claude Code |
| 2026-02-10 | `TaxEngine.calculatePartnershipTax()` — pass-through taxation, same scale | Claude Code |
| 2026-02-10 | 9 new files + 16 modified files — Phase 1 OE support implemented | Claude Code |
| 2026-02-10 | Completion: wired PartnerTaxBreakdown + PartnerEFKATabs into pages | Claude Code |
| 2026-02-10 | Hooks: entity-aware returns (useTaxEstimate, useEFKASummary) | Claude Code |
| 2026-02-10 | EFKA route: discriminated response by entityType | Claude Code |
| 2026-02-10 | BUG FIX: useEFKASummary response parsing (data.summary → result.data) | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
