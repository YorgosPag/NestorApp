# ADR-ACC-016: AE Corporate Tax & Dividends

## Status: IMPLEMENTED (2026-02-12)

## Context

Η ΑΕ φορολογείται ως νομικό πρόσωπο — **ίδια** φορολόγηση με ΕΠΕ:
- 22% flat rate (Ν.4172/2013, αρ.58)
- 5% φόρος μερισμάτων (Ν.4172/2013, αρ.64)
- 80% προκαταβολή (Ν.4172/2013, αρ.71)
- 1.000€ τέλος επιτηδεύματος

## Decision

### UC-3: Υπολογισμός εταιρικού φόρου
- **Reuse** `calculateCorporateTax()` — γενικεύτηκε με `entityType` parameter
- Κοινοί συντελεστές: 22%, 80%, 1.000€ (ήδη στο tax-config.ts)
- Νέο `calculateAETax()` wrapper → maps shareholders ↔ members internally

### UC-4: Διανομή μερισμάτων
- Ίδιο pattern με ΕΠΕ: `distributionPercent` (default 100%)
- Per-shareholder allocation βάσει `dividendSharePercent`
- `ShareholderDividendResult` (αντί `MemberDividendResult`)

## Types

```typescript
interface AETaxResult {
  corporateTax: CorporateTaxResult;
  profitAfterTax: number;
  distributedDividends: number;
  retainedEarnings: number;
  shareholderDividends: ShareholderDividendResult[];
  totalDividendTax: number;
}

interface ShareholderDividendResult {
  shareholderId: string;
  shareholderName: string;
  dividendSharePercent: number;
  grossDividend: number;
  dividendTaxRate: number;    // 5%
  dividendTaxAmount: number;
  netDividend: number;
}
```

## Files

| File | Change |
|---|---|
| `types/tax.ts` | +AETaxResult, +ShareholderDividendResult |
| `services/engines/tax-engine.ts` | Generalize calculateCorporateTax(+entityType), +calculateAETax() |
| `services/accounting-service.ts` | +calculateAETax(fiscalYear) |
| `app/api/accounting/tax/estimate/route.ts` | AE dispatch |
| `app/api/accounting/tax/dashboard/route.ts` | AE dispatch |

## Architecture Note

`calculateCorporateTax()` τώρα δέχεται `entityType: EntityType = 'epe'` parameter.
Τα rates (`prepaymentRate`, `professionalTax`) ανακτώνται δυναμικά.
Backward compatible: existing EPE calls δεν χρειάζονται αλλαγή.

## Legal References
- Ν.4172/2013, αρ.58 — Εταιρικός φόρος 22%
- Ν.4172/2013, αρ.64 — Φόρος μερισμάτων 5%
- Ν.4172/2013, αρ.71 — Προκαταβολή φόρου 80%
