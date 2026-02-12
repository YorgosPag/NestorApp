# ADR-ACC-015: AE Setup & Shareholder Management

## Status: IMPLEMENTED (2026-02-12)

## Context

Η ΑΕ (Ανώνυμη Εταιρεία) είναι η 4η νομική μορφή στο λογιστικό subapp.
Μοιράζεται φορολόγηση με ΕΠΕ (22% flat, 5% μερίσματα, 80% προκαταβολή)
αλλά διαφέρει σε **δομή** (μέτοχοι + ΔΣ) και **ΕΦΚΑ** (dual-mode).

## Decision

### UC-1: Δημιουργία ΑΕ στο σύστημα
- EntityType: `'ae'` (ήδη στο EntityType union)
- Γ' Βιβλία: ΥΠΟΧΡΕΩΤΙΚΑ (auto-set `bookCategory: 'double_entry'`)
- ΓΕΜΗ: Υποχρεωτικό
- Ελάχιστο κεφάλαιο: 25.000€ (Ν.4548/2018)

### UC-2: Διαχείριση μετόχων
- **Ενιαία λίστα** `Shareholder[]` (ΟΧΙ ξεχωριστές shareholders + boardMembers)
- Μέλος ΔΣ χωρίς μετοχές: `sharesCount: 0`
- `isBoardMember` flag + `boardRole` enum
- `efkaMode` derived: employee (<3%) / self_employed (≥3%) / none

## Types

```typescript
interface Shareholder {
  shareholderId: string;       // 'shr_xxxxx'
  fullName: string;
  vatNumber: string;
  taxOffice: string;
  sharesCount: number;
  shareNominalValue: number;
  capitalContribution: number; // auto: count × value
  dividendSharePercent: number;
  isBoardMember: boolean;
  boardRole: BoardRole | null;
  monthlyCompensation: number | null;
  efkaMode: 'employee' | 'self_employed' | 'none'; // derived
  efkaConfig: ShareholderEFKAConfig | null;
  isFirstFiveYears: boolean;
  joinDate: string;
  exitDate: string | null;
  isActive: boolean;
}

type BoardRole = 'president' | 'vice_president' | 'ceo' | 'member';
```

## Files

| File | Change |
|---|---|
| `types/entity.ts` | +Shareholder, +ShareholderEFKAConfig, +BoardRole |
| `types/company.ts` | +AECompanyProfile, +AESetupInput, update union |
| `types/interfaces.ts` | +getShareholders, +saveShareholders |
| `utils/entity-guards.ts` | +isCorporation() |
| `services/repository/firestore-*.ts` | +shareholders CRUD |
| `app/api/accounting/shareholders/route.ts` | GET/PUT |
| `app/api/accounting/setup/route.ts` | AE branch (validate min 25k) |
| `components/setup/ShareholderManagementSection.tsx` | UI |
| `components/setup/ShareholderRow.tsx` | Μέτοχος row |
| `components/setup/SetupPageContent.tsx` | AE section |
| `components/setup/EntityTypeSelector.tsx` | Remove disabled |

## Legal References
- Ν.4548/2018 — Αναμόρφωση δικαίου ΑΕ
- Ελάχιστο μετοχικό κεφάλαιο: 25.000€ (αρ. 15)
