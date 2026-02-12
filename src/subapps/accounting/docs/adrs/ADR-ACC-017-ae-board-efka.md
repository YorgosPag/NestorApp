# ADR-ACC-017: AE Board of Directors & EFKA

## Status: IMPLEMENTED (2026-02-12)

## Context

Τα μέλη ΔΣ ΑΕ έχουν **dual-mode ΕΦΚΑ** — η κατηγοριοποίηση εξαρτάται
από: (α) αν λαμβάνουν αμοιβή, (β) ποσοστό μετοχών.

## Decision

### UC-5: Ορισμός ΔΣ
- Board roles: `'president' | 'vice_president' | 'ceo' | 'member'`
- Ελάχιστο ΔΣ: 1 μέλος (μονοπρόσωπη) ή 3+ (κανονική)
- Ενσωματωμένο στο Shareholder record (`isBoardMember` + `boardRole`)

### UC-6: Υπολογισμός ΕΦΚΑ μελών ΔΣ

**ΕΦΚΑ Dual-Mode:**

| Ιδιότητα | Αμοιβή | Μετοχές | ΕΦΚΑ | Κατηγορία |
|---|---|---|---|---|
| Μέλος ΔΣ | ΝΑΙ | <3% | **ΝΑΙ** | Μισθωτός (33,60%) |
| Μέλος ΔΣ | ΝΑΙ | ≥3% | **ΝΑΙ** | Αυτοαπασχολούμενος |
| Μέλος ΔΣ | ΟΧΙ | — | **ΟΧΙ** | — |
| Μέτοχος (μόνο) | — | — | **ΟΧΙ** | — |

**Employee mode (μισθωτός):**
- 33,60% επί αμοιβής (12,47% ασφαλισμένος + 21,13% εργοδότης)
- Ετήσιο: compensation × rates × 12

**Self-employed mode:**
- Χρήση κατηγοριών ΕΦΚΑ (ίδιες με ΕΠΕ managers)
- Reuse `ManagerEFKASummary` type

## Types

```typescript
interface EmployeeBoardMemberEFKA {
  shareholderId: string;
  shareholderName: string;
  monthlyCompensation: number;
  employeeContribution: number;   // 12.47% × comp × 12
  employerContribution: number;   // 21.13% × comp × 12
  totalAnnual: number;
}

interface AEEFKASummary {
  year: number;
  employeeBoardMembers: EmployeeBoardMemberEFKA[];
  selfEmployedBoardMembers: ManagerEFKASummary[];
  totalEmployeeEFKA: number;
  totalSelfEmployedEFKA: number;
  totalAllEFKA: number;
}
```

## EFKA Mode Derivation (auto-calculated)

```typescript
function deriveEfkaMode(shareholder, totalShares): ShareholderEFKAMode {
  if (!isBoardMember || !compensation || compensation <= 0) return 'none';
  const percent = (sharesCount / totalShares) * 100;
  return percent < 3 ? 'employee' : 'self_employed';
}
```

## Files

| File | Change |
|---|---|
| `types/efka.ts` | +EmployeeBoardMemberEFKA, +AEEFKASummary |
| `services/accounting-service.ts` | +getAEEfkaSummary(year) |
| `app/api/accounting/efka/summary/route.ts` | AE dispatch |
| `app/api/accounting/shareholders/route.ts` | EFKA mode auto-derive on PUT |

## Legal References
- Εγκύκλιος ΕΦΚΑ 4/2017 — Ασφάλιση μελών ΔΣ ΑΕ
- Εγκύκλιος ΕΦΚΑ 17/2017 — Ασφαλιστικές κατηγορίες
- Ν.4387/2016, αρ.39 — Εισφορές αυτοαπασχολούμενων
