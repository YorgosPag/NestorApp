# ADR-156: Centralization Gap Audit — Εκκρεμείς Κεντρικοποιήσεις

| Field | Value |
|-------|-------|
| **Status** | APPROVED — Audit Complete, Remediation Pending |
| **Date** | 2026-03-12 |
| **Category** | Architecture / Code Quality |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Source** | `local_ΑΝΑΦΟΡΑ_1.txt` — Initial gap identification |
| **Related ADRs** | ADR-207 (collection-utils), ADR-208 (formatDate bridge), ADR-210 (ID generation) |

---

## 1. Σκοπός

Πλήρης αξιολόγηση **7 κατηγοριών κεντρικοποίησης** που αναγνωρίστηκαν ως εκκρεμείς. Για κάθε μία: τι centralized system υπάρχει, πόσα inline violations υπάρχουν, και τι effort χρειάζεται.

---

## 2. Συνοπτικός Πίνακας

| # | Κεντρικοποίηση | Centralized System | Inline Violations | Adoption | Κατάσταση |
|---|---------------|-------------------|-------------------|----------|-----------|
| 1 | **formatCurrency** | `src/lib/intl-utils.ts` | 13 αρχεία | 0% | ❌ ΔΕΝ ΕΧΕΙ ΓΙΝΕΙ |
| 2 | **Status color mapping** | `BadgeFactory` + `StatusConstants` | 109 patterns | 45% | 🟡 ΜΕΡΙΚΩΣ |
| 3 | **Array groupBy/countBy** | `src/utils/collection-utils.ts` | 280+ `.reduce()` | 6% (19 αρχεία) | 🟡 ΜΕΡΙΚΩΣ |
| 4 | **Modal state** | ❌ Δεν υπάρχει | 11 σε 8 αρχεία | — | ⚪ ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ |
| 5 | **Permission/role checks** | `src/lib/auth/permissions.ts` | 32 inline checks | ~60% | 🟡 ΜΕΡΙΚΩΣ |
| 6 | **Search state** | `src/lib/search/search.ts` | 209 σε 75 αρχεία | 6% (12 αρχεία) | ❌ ΔΕΝ ΕΧΕΙ ΓΙΝΕΙ |
| 7 | **Firestore queries** | ❌ Δεν υπάρχει (→ ADR-214) | 400+ queries σε 85+ αρχεία | — | 🔵 ΣΤΑΔΙΑΚΗ ΥΛΟΠΟΙΗΣΗ (ADR-214, 11 φάσεις) |

---

## 3. Λεπτομερής Ανάλυση ανά Κατηγορία

### 3.1 formatCurrency — ❌ 0% ADOPTION

**Centralized System**: `src/lib/intl-utils.ts`

| Export | Περιγραφή | Format |
|--------|-----------|--------|
| `formatCurrency(amount, currency, options)` | Πλήρης μορφοποίηση | `€12.500,00` |
| `formatCurrencyWhole(amount)` | Χωρίς δεκαδικά, null guard | `€12.500` ή `—` |
| `formatCurrencyCompact(value)` | Compact notation | `€500K`, `€1.2M` |
| `formatPriceWithUnit(price, unit, currency)` | Τιμή με μονάδα | `€1.200/month` |

**Πρόβλημα**: ΚΑΝΕΝΑ αρχείο δεν χρησιμοποιεί τις centralized functions. Όλα γράφουν inline.

**Inline Patterns (13 αρχεία):**

| Pattern | Count | Παράδειγμα |
|---------|-------|-----------|
| `.toLocaleString()` χωρίς locale | 4 | `` €${unit.price.toLocaleString()} `` |
| `.toLocaleString('el-GR')` | 5 | `` €${Math.round(value).toLocaleString('el-GR')} `` |
| `.toFixed(N)` + `€` prefix | 7 | `` €${(value/1000).toFixed(0)}K `` |

**Αρχεία που χρειάζονται migration:**

| Αρχείο | Inline patterns |
|--------|----------------|
| `src/app/sales/available-apartments/page.tsx` | 3 |
| `src/app/sales/available-parking/page.tsx` | 2 |
| `src/app/sales/available-storage/page.tsx` | 2 |
| `src/components/building-management/tabs/UnitsTabContent.tsx` | 3 |
| `src/components/building-management/tabs/ParkingTabContent.tsx` | 3 |
| `src/components/building-management/StorageTab.tsx` | 2 |
| `src/components/admin/SoldUnitsPreview.tsx` | 1 |
| `src/components/compositions/PropertyCard/PropertyCard.tsx` | 1 |
| `src/features/property-grid/components/PropertyCard.tsx` | 1 |
| `src/subapps/accounting/components/invoices/details/InvoiceDetails.tsx` | 2 |
| `src/app/spaces/parking/page.tsx` | 1 |
| `src/app/spaces/storage/page.tsx` | 1 |
| `src/components/sales/tabs/SaleInfoContent.tsx` | 1 |

**Inconsistency risk**: Κάποια αρχεία χρησιμοποιούν `'el-GR'` locale, άλλα browser default — ασυνέπεια στη μορφοποίηση.

**Effort**: **Small** — Απλή αντικατάσταση, migrate-on-touch

---

### 3.2 Status Color Mapping — 🟡 45% Centralized

**Centralized Systems (λειτουργούν ήδη):**

| Αρχείο | Ρόλος |
|--------|-------|
| `src/core/badges/BadgeFactory.ts` | Factory pattern με DI, 7 domain types |
| `src/core/status/StatusConstants.ts` | Dynamic badge generation, full i18n |
| `src/design-system/color-bridge.ts` | Core semantic color mapping |
| `src/ui-adapters/react/useSemanticColors.ts` | React hook (new architecture) |
| `src/hooks/useSemanticColors.ts` | Legacy proxy (DEPRECATED, Strangler Fig) |

**Adoption**: 88+ αρχεία χρησιμοποιούν `useSemanticColors` ✅

**Πρόβλημα**: 109 αρχεία ακόμα με inline status→color patterns:

| Pattern | Count | Παράδειγμα |
|---------|-------|-----------|
| Nested ternary (3+ levels) | ~20 | `status === 'available' ? 'bg-green-100' : status === 'reserved' ? 'bg-purple-100' : 'bg-red-100'` |
| Switch χωρίς DI | ~15 | `case 'active': return 'bg-green-500'` |
| Hard-coded Tailwind classes | ~20 | `'text-green-600'`, `'border-red-300'` |
| Switch με colors DI (OK-ish) | ~15 | `case 'active': return \`${colors.text.success}\`` |

**Top violators:**

| Αρχείο | Πρόβλημα |
|--------|---------|
| `src/app/sales/available-storage/page.tsx` | Nested ternary 3 levels, hard-coded colors |
| `src/app/sales/available-parking/page.tsx` | Ίδιο pattern |
| `src/components/compositions/UserCard/UserCard.tsx` | Inline ternary χωρίς semantic colors |
| `src/components/compositions/TaskCard/TaskCard.tsx` | Inline ternary χωρίς semantic colors |
| `src/components/crm/inbox/ReplyComposer.tsx` | Ternary για attachment status |

**Confusion factor**: 2 implementations του `useSemanticColors` (legacy + new bridge) — developers δεν ξέρουν ποιο να χρησιμοποιήσουν.

**Effort**: **Medium** — Χρειάζεται αντικατάσταση inline ternaries → BadgeFactory/useSemanticColors

---

### 3.3 Array groupBy/countBy — 🟡 6% ADOPTION

**Centralized System**: `src/utils/collection-utils.ts` (ADR-207)

| Export | Περιγραφή | Παράδειγμα |
|--------|-----------|-----------|
| `groupByKey(items, keyFn)` | Ομαδοποίηση σε arrays | `groupByKey(tasks, t => t.status)` |
| `tallyBy(items, keyFn)` | Count ανά key → `Record<string, number>` | `tallyBy(units, u => u.type)` |
| `sumByKey(items, keyFn, valueFn)` | Weighted sum ανά key | `sumByKey(items, i => i.cat, i => i.price)` |
| `sumBy(items, accessor)` | Απλό άθροισμα | `sumBy(units, u => u.area)` |
| `countBy(items, predicate)` | Count με condition | `countBy(units, u => u.status === 'sold')` |
| `rate(num, denom)` | Ποσοστό 0-100 | `rate(sold, total)` |
| `avg(total, count)` | Μέσος όρος | `avg(sumBy(...), items.length)` |
| `avgRounded(total, count)` | Στρογγυλευμένος μέσος | `avgRounded(totalArea, count)` |

**Re-exported** μέσω: `src/hooks/useEntityStats.ts` (React Hook)

**Adoption**: 19 αρχεία χρησιμοποιούν ✅ — 280+ inline `.reduce()` ❌

**Breakdown των inline reduces:**

| Τύπος | Count | Αντικατάσταση |
|-------|-------|--------------|
| Sum operations | ~120 | `sumBy()` |
| Group operations | ~40 | `groupByKey()` |
| Tally operations | ~30 | `tallyBy()` |
| Averaging | ~60 | `avg()` / `avgRounded()` |
| Complex custom logic | ~50 | Case-by-case (δεν αντικαθίσταται) |

**Top violators (10+ reduces ανά αρχείο):**

| Αρχείο | Count |
|--------|-------|
| `geo-canvas/cloud/enterprise/utils/resource-calculator.ts` | 15 |
| `geo-canvas/profiling/PerformanceProfiler.ts` | 14 |
| `components/projects/structure-tab/utils/selectors.ts` | 14 |
| `dxf-viewer/__tests__/visual-metrics.test.ts` | 8 |
| `geo-canvas/services/performance/AdminBoundariesPerformanceAnalytics.ts` | 8 |
| `geo-canvas/optimization/BundleOptimizer.ts` | 8 |

**Missing helpers** (δεν υπάρχουν ακόμα):
- `varianceBy(items, valueFn, mean?)` — statistical calculations
- `countDistinct(items, keyFn)` — unique counts

**Effort**: **Medium-Large** — 280+ σημεία, migrate-on-touch strategy

---

### 3.4 Modal State — ⚪ ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ

**Centralized System**: ❌ Δεν υπάρχει

**Inline patterns**: 11 σε 8 αρχεία — `const [isOpen, setIsOpen] = useState<boolean>(false)`

**Αρχεία:**
- `src/subapps/geo-canvas/components/AddressSearchPanel.tsx` (2)
- `src/subapps/geo-canvas/components/CitizenDrawingInterface.tsx` (2)
- `src/features/floorplan-canvas/FloorPlanCanvas.tsx` (1)
- `src/components/shared/files/hooks/useEntityFiles.ts` (1)
- `src/subapps/dxf-viewer/snapping/context/SnapContext.tsx` (1)

**Συμπέρασμα**: Trivial pattern, πολύ χαμηλό benefit vs effort. **ΔΕΝ ΑΞΙΖΕΙ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ.**

---

### 3.5 Permission/Role Checks — 🟡 ~60% Centralized

**Centralized System**: `src/lib/auth/permissions.ts` (492 γραμμές)

| Export | Περιγραφή |
|--------|-----------|
| `checkPermission(ctx, permission, options?, cache?)` | Returns `PermissionCheckResult` |
| `hasPermission(ctx, permission, options?, cache?)` | Returns `boolean` |
| `requirePermission(ctx, permission, options?, cache?)` | Throws on denial |
| `hasAllPermissions()` | Όλα τα required |
| `hasAnyPermission()` | Οποιοδήποτε required |
| `createPermissionCache()` | Request-scoped cache (serverless-safe) |

**Features**: RFC v6, 3-level hierarchy (global role → project membership → unit grant), MFA support, denial reasons

**Πρόβλημα**: 32 αρχεία κάνουν inline checks:
```typescript
// ❌ Inline (32 αρχεία)
if (globalRole === 'super_admin') { ... }

// ✅ Centralized
if (hasPermission(ctx, 'manage:users')) { ... }
```

**Σημείωση**: Τα περισσότερα inline checks είναι σε server-side routes που χρησιμοποιούν ήδη `withAuth({ requiredGlobalRoles })`. Το πρόβλημα εστιάζεται κυρίως σε client-side components.

**Effort**: **Medium**

---

### 3.6 Search State — ❌ 6% ADOPTION

**Centralized System**: `src/lib/search/search.ts`

| Export | Περιγραφή |
|--------|-----------|
| `matchesSearchTerm(itemFields, term)` | Greek-friendly multi-field search |
| `normalizeSearchText(value)` | Diacritics normalization, ς→σ, handles all types |

**Features**:
- Ελληνικά diacritics normalization (τόνοι, τελικό σίγμα)
- Handles: string, number, boolean, Date, null, undefined
- Empty term → returns true (show all)
- Test coverage: `src/lib/search/search.test.ts`

**Adoption**: 12 αρχεία μόνο ✅ — 75 αρχεία (209 occurrences) inline ❌

```typescript
// ❌ Inline (75 αρχεία — ΔΕΝ χειρίζεται ελληνικά σωστά)
items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))

// ✅ Centralized (χειρίζεται τόνους, τελικό σίγμα κλπ)
items.filter(item => matchesSearchTerm([item.name, item.email], searchTerm))
```

**Κρίσιμο**: Τα inline patterns **ΔΕΝ** κάνουν Greek normalization — αν ψάξεις "ΛΑΓΚΑΔΑ" δεν θα βρεις "Λαγκαδά" (τόνοι). Η centralized function το χειρίζεται.

**Effort**: **Medium** — Migrate-on-touch

---

### 3.7 Firestore Queries — ⚪ ΤΕΡΑΣΤΙΟ SCOPE

241 αρχεία χρησιμοποιούν απευθείας Firestore queries (`collection()`, `query()`, `where()`, `getDocs()`).

**Δεν υπάρχει** centralized query abstraction layer.

**Συμπέρασμα**: Χρειάζεται αρχιτεκτονικό design πρώτα (repository pattern, query builder, caching layer). **Δεν είναι migrate-on-touch task. ΑΝΑΒΟΛΗ μέχρι νέας απόφασης.**

---

## 4. Προτεραιοποίηση Remediation

| Priority | Κεντρικοποίηση | Effort | Impact | Στρατηγική |
|----------|---------------|--------|--------|------------|
| 🔴 **P1** | **formatCurrency** (13 αρχεία) | S | High — 0% adoption, inconsistent €€ | Migrate-on-touch |
| 🔴 **P1** | **Search state** (75 αρχεία) | M | High — Greek bugs, 6% adoption | Migrate-on-touch |
| 🟠 **P2** | **Array groupBy** (280+ reduces) | M-L | Medium — code duplication | Migrate-on-touch |
| 🟠 **P2** | **Status colors** (109 patterns) | M | Medium — BadgeFactory underused | Migrate-on-touch |
| 🟡 **P3** | **Permission checks** (32 αρχεία) | M | Low-Med — server mostly OK | Migrate-on-touch |
| ⚪ **Skip** | **Modal state** (8 αρχεία) | — | — | **ΜΗΝ ΓΙΝΕΙ** — trivial pattern |
| ⚪ **Skip** | **Firestore queries** (241 αρχεία) | XL | — | **ΑΝΑΒΟΛΗ** — χρειάζεται architectural design |

---

## 5. Verification Commands

```bash
# formatCurrency: Εύρεση inline patterns (πρέπει να μειώνεται)
grep -rn "toLocaleString\|\.toFixed" src/ --include="*.tsx" | grep -i "€\|price\|cost\|value\|amount" | grep -v "intl-utils\|node_modules" | wc -l

# Search: Εύρεση inline filtering (πρέπει να μειώνεται)
grep -rn "\.toLowerCase()\.includes" src/ --include="*.ts" --include="*.tsx" | grep -v "search\.ts\|node_modules" | wc -l

# Array reduce: Εύρεση inline reduces (πρέπει να μειώνεται)
grep -rn "\.reduce(" src/ --include="*.ts" --include="*.tsx" | grep -v "collection-utils\|node_modules" | wc -l

# matchesSearchTerm adoption (πρέπει να αυξάνεται)
grep -rn "matchesSearchTerm" src/ --include="*.ts" --include="*.tsx" | wc -l

# formatCurrency adoption (πρέπει να αυξάνεται)
grep -rn "formatCurrency\|formatCurrencyWhole\|formatCurrencyCompact" src/ --include="*.ts" --include="*.tsx" | grep -v "intl-utils" | wc -l
```

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-12 | Initial audit — 7 categories analyzed, prioritization complete | Claude Code (Anthropic AI) |
