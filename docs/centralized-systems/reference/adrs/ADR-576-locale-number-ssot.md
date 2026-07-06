# ADR-576 — Locale-aware currency/decimal parsing SSoT (`src/lib/number/`)

**Status:** ✅ IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-07-06
**Domain:** App-wide · Currency/Decimal parsing SSoT · Property · Accounting · Procurement · Building-code
**Related:** ADR-397/513 (DXF `comma-normalize` guard — separate domain), `.ssot-registry.json` module `comma-normalize`

---

## Context

Το app-level `parseGreekDecimal` (`src/lib/number/greek-decimal.ts`) υπήρχε & χρησιμοποιούνταν, αλλά **4 consumers hand-roll**-αραν comma/decimal idioms inline (6 σημεία), πιασμένα από το `comma-normalize` ratchet guard και baseline-frozen. **Δεν ήταν ταυτόσημα διπλότυπα** — τυφλή «όλα → parseGreekDecimal» θα έσπαγε financial production:

| # | Consumer | Παλιά σύμβαση |
|---|----------|--------------|
| 1 | `features/property-details/.../PropertyCommercialPriceFields.tsx` (×2) | string→string controlled input· `.`=ΠΑΝΤΑ χιλιάδες («12.5»→«125», «125500.50»→«12550050» ❌) |
| 2 | `subapps/accounting/services/external/csv-import-service.ts` (`parseBankDecimal`/`parseAutoAmount`) | multi-locale bank parser (Greek + US auto-detect) |
| 3 | `subapps/procurement/utils/quote-search.ts` (`parseNumeric`) | →number, αφαιρεί `$`/`€` |
| 4 | `components/projects/building-code/BuildingCodeForm.tsx` (`parseNumber`) | →number, `Number(replace(',','.'))` |

## Decision

**Locale-aware building blocks** στο `src/lib/number/locale-number.ts` (big-player: Google Sheets/Excel/Figma), ώστε κάθε consumer + το `parseGreekDecimal` να γίνουν thin consumers.

### Σημασιολογία (επιβεβαιωμένη με τον product owner)
- **Input:** ΕΝΑ διαχωριστικό (τελεία **ή** κόμμα) = **υποδιαστολή**. Ο χρήστης ΠΟΤΕ δεν πληκτρολογεί τελεία για χιλιάδες — το σύστημα κάνει render το grouping.
- **Και τα δύο παρόντα:** το **τελευταίο** = υποδιαστολή, το άλλο = χιλιάδες («1.200,50»→1200.5, «1,200.50»→1200.5).
- **Ίδιο επαναλαμβανόμενο:** χιλιάδες («1.200.000»→1200000).
- **Fixed-locale mode** (`decimalSeparator` option): για γνωστά formats (bank CSV column) όπου το μη-decimal separator είναι αναμφισβήτητα thousands.

### API
```ts
export type DecimalSeparator = '.' | ',';
export interface LocaleNumberOptions { decimalSeparator?: DecimalSeparator; }
export function normalizeDecimalString(raw: string, opts?: LocaleNumberOptions): string; // string→canonical machine string
export function parseLocaleNumber(raw: string, opts?: LocaleNumberOptions): number | null; // strips currency/garbage, →number|null
```
`parseGreekDecimal` → **thin wrapper** `parseLocaleNumber(input)`. `formatEuro` αμετάβλητο. API minimal (2 exports).

### Consumers
- **#2 accounting:** `parseBankDecimal` → `parseLocaleNumber(value, { decimalSeparator }) ?? 0`· `parseAutoAmount` → `parseLocaleNumber(raw)`. Multi-locale/auto-detect **διατηρείται** (parity fixtures: Greek/US/fixed).
- **#3 procurement:** `parseNumeric` → `parseLocaleNumber(query) ?? NaN` (generic garbage-strip αφαιρεί `$`/`€`/spaces).
- **#4 building-code:** `parseNumber` → `parseLocaleNumber(raw) ?? 0` (single dot=decimal = ίδιο με πριν).
- **#1 property:** **format-on-blur** (extracted `PriceInputField`) — focus→raw el-GR (comma, no grouping, αδιαμφισβήτητη υποδιαστολή)· blur→«125.500,50»· onChange→`normalizeDecimalString`. Λύνει το αμφίσημο single-dot (grouping vs decimal) χωρίς να καταστρέφει υπάρχουσες τιμές (π.χ. 150000). **Αλλαγή συμπεριφοράς:** «125500.50» πλέον → 125.500,50 (πριν → 12550050 ❌).

## Guard
`.ssot-registry.json` module `comma-normalize`: allowlist += `src/lib/number/locale-number.ts`· description updated (οι 4 consumers migrated, όχι πια «pending»). Μετά τη migration τα 6 inline sites → 0 violations. `npm run ssot:baseline` + commit = Giorgio.

## Tests
`src/lib/number/__tests__/locale-number.test.ts` — 23 tests: auto-detect (Greek/US/dual/multi-dot/partial/negative), fixed Greek vs US mode, currency strip, empty/garbage/lone-`-`→null, legacy parity fixtures, `parseGreekDecimal` regression. **23/23 GREEN.**

## Consequences
- ✅ ΕΝΑ locale-number SSoT· κάθε consumer thin· μηδέν hand-rolled currency idioms.
- ✅ Property input τώρα σωστό & αδιαμφισβήτητο (format-on-blur).
- ⚠️ `parseGreekDecimal('1.200.000')` → 1200000 αντί null (πιο σωστό· κανείς consumer δεν τρέφει multi-dot).

## Changelog
- **2026-07-06:** Δημιουργία. Building blocks + thin wrapper + 4 consumers migrated + guard + 23 tests.
