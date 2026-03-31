# ADR-244: Πολλαπλοί Αγοραστές & Συνιδιοκτησία Ακινήτων

**Status**: IN PROGRESS (Phase 3 — Session 3/3 completed, i18n keys pending)
**Date**: 2026-03-21
**Author**: Claude + Γιώργος Παγώνης
**Priority**: CRITICAL — Blockers για production deployment

---

## 1. ΠΡΟΒΛΗΜΑ

Η εφαρμογή σχεδιάστηκε με **single-buyer model** — κάθε ακίνητο μπορεί να ανήκει σε **ένα και μόνο** άτομο. Στην ελληνική πραγματικότητα, αυτό είναι **ανεπαρκές**.

### Σενάρια που ΔΕΝ υποστηρίζονται σήμερα:

| # | Σενάριο | Πρόβλημα |
|---|---------|----------|
| 1 | Ζευγάρι αγοράζει διαμέρισμα (50/50) | Μόνο 1 αγοραστής καταχωρείται |
| 2 | Δύο ξένοι αγοράζουν μαζί (70/30) | Δεν υπάρχει ποσοστό ανά αγοραστή |
| 3 | Οικοπεδούχοι παίρνουν ακίνητο αντιπαροχής | Δεν φαίνεται ποιος οικοπεδούχος πήρε τι |
| 4 | 2 αγοραστές με διαφορετικά πλάνα αποπληρωμής | 1 payment plan ανά ακίνητο μόνο |
| 5 | Εταιρεία + φυσικό πρόσωπο αγοράζουν μαζί | Δεν υποστηρίζεται μικτή ιδιοκτησία |

---

## 2. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ ΕΦΑΡΜΟΓΗΣ (AUDIT)

### 2.1 Τι ΥΠΑΡΧΕΙ

| Σύστημα | Αρχείο | Single/Multiple | Σημαντικά πεδία |
|---------|--------|-----------------|-----------------|
| Unit Commercial | `src/types/unit.ts` γρ. 98-134 | **SINGLE** | `buyerContactId: string \| null` |
| Payment Plan | `src/types/payment-plan.ts` γρ. 282-320 | **SINGLE** | `buyerContactId: string` |
| Ownership Row | `src/types/ownership-table.ts` γρ. 193-211 | **SINGLE** | `buyerContactId: string \| null` |
| Bartex Summary | `src/types/ownership-table.ts` γρ. 217-230 | **MULTIPLE** ✅ | `landowners: LandownerEntry[]` |
| Sales Dialogs | `src/components/sales/dialogs/SalesActionDialogs.tsx` | **SINGLE** | Reserve/Sell → 1 buyer |
| Contact Roles | `src/types/contacts/relationships/` | **ΚΑΝΕΝΑ** | Δεν υπάρχει ρόλος "αγοραστής"/"οικοπεδούχος" |

### 2.2 Τι λειτουργεί ΣΩΣΤΑ

- ✅ `BartexSummary.landowners` — ήδη array `LandownerEntry[]` με `contactId`, `name`, `landOwnershipPct`, `allocatedShares`
- ✅ Ο πίνακας ποσοστών υποστηρίζει πολλαπλούς οικοπεδούχους στο **σύνολο** (Bartex section)

### 2.3 Τι ΛΕΙΠΕΙ

1. **`buyerContactId`** — Παντού `string | null`, πρέπει να γίνει `BuyerEntry[]`
2. **Payment Plan** — Πρέπει split ανά συν-αγοραστή
3. **Contact roles** — Λείπουν ρόλοι `'buyer'`, `'co-buyer'`, `'landowner'`
4. **Sales dialogs** — Reserve/Sell flow δεν υποστηρίζει πολλαπλούς αγοραστές
5. **Ownership table row** — `buyerContactId` single, πρέπει array
6. **Προσύμφωνο/Οριστικό** — 1 αριθμός, αλλά σε joint purchase μπορεί να υπάρχουν 2 συμβόλαια

---

## 3. ΕΛΛΗΝΙΚΗ ΝΟΜΟΘΕΣΙΑ

### 3.1 Συνιδιοκτησία (Αρ. 785-805 ΑΚ)

- **Κοινή κτήση εξ αδιαιρέτου**: Δύο ή περισσότεροι έχουν κυριότητα σε ένα ακίνητο κατ' ιδανικά μερίδια
- **Τεκμήριο ίσων μεριδίων** (Αρ. 785 ΑΚ): Αν δεν ορίζεται διαφορετικά, τα μερίδια θεωρούνται ίσα
- **Διαφορετικά μερίδια**: Μπορεί ο ένας να έχει 70% και ο άλλος 30% — ορίζεται στο συμβόλαιο
- **Κάθε συνιδιοκτήτης**: Δηλώνει στο Ε9 το δικό του ποσοστό επί του ακινήτου

### 3.2 Αντιπαροχή (Ν. 1562/1985)

- **Σύμβαση αντιπαροχής**: Ο οικοπεδούχος δίνει οικόπεδο, ο εργολάβος κατασκευάζει
- **Πολλοί οικοπεδούχοι**: Πολύ συνηθισμένο — κληρονόμοι, συνιδιοκτήτες γης
- **Κατανομή**: Κάθε οικοπεδούχος μπορεί να πάρει διαφορετικά ακίνητα (ή μερίδιο σε ένα)
- **Τεχνικά**: Η σύσταση (Ν. 3741/1929) ορίζει ποιος παίρνει τι

### 3.3 Αγορά από πολλαπλούς αγοραστές

- **Ένα συμβόλαιο**: Μπορεί να αγοράσουν 2+ άτομα μαζί (joint purchase deed)
- **Ξεχωριστά ποσοστά**: π.χ. ο Α αγοράζει 70% και ο Β 30% του ίδιου ακινήτου
- **Ξεχωριστή φορολογία**: Κάθε αγοραστής δηλώνει το δικό του μερίδιο στο Ε9
- **Ξεχωριστός φόρος μεταβίβασης**: Κάθε αγοραστής πληρώνει αναλογικά

### 3.4 Πλάνα αποπληρωμής

- **Κοινό πλάνο**: Ζευγάρι πληρώνει μαζί — ένα πλάνο
- **Ξεχωριστά πλάνα**: Δύο ξένοι — κάθε ένας πληρώνει το μερίδιό του ξεχωριστά
- **Πρακτικά**: Ο εργολάβος εκδίδει ξεχωριστές αποδείξεις/τιμολόγια

---

## 4. ΣΕΝΑΡΙΑ & ΑΝΑΓΚΕΣ

### Σενάριο Α: Ζευγάρι αγοράζει μαζί (50/50)

```
Ακίνητο: ΔΙΑΜΕΡΙΣΜΑ Α1 — 80 τ.μ. — 150.000€
Αγοραστής 1: Γιάννης Παπαδόπουλος — 50% — 75.000€
Αγοραστής 2: Μαρία Παπαδοπούλου — 50% — 75.000€
Πλάνο αποπληρωμής: ΚΟΙΝΟ (1 πλάνο, και οι 2 πληρώνουν)
Προσύμφωνο: 12345/2026 (ένα, και οι 2 υπογράφουν)
Οριστικό: 67890/2026 (ένα, και οι 2 υπογράφουν)
```

**Στον πίνακα ποσοστών**: Εμφανίζονται ΚΑΙ τα 2 ονόματα στη στήλη "Ιδιοκτήτης"

### Σενάριο Β: Δύο ξένοι, διαφορετικά μερίδια (70/30)

```
Ακίνητο: ΔΙΑΜΕΡΙΣΜΑ Β2 — 100 τ.μ. — 200.000€
Αγοραστής 1: Νίκος Γεωργίου — 70% — 140.000€ — Πλάνο Α (12 δόσεις)
Αγοραστής 2: Πέτρος Αλεξίου — 30% — 60.000€ — Πλάνο Β (6 δόσεις)
Προσύμφωνο: 2 ξεχωριστά ή 1 κοινό
```

**Στον πίνακα ποσοστών**: 2 ονόματα + ποσοστά, 2 πλάνα αποπληρωμής

### Σενάριο Γ: Οικοπεδούχοι παίρνουν ακίνητο αντιπαροχής

```
Ακίνητο: ΙΣΟΓΕΙΟ ΔΙΑΜΕΡΙΣΜΑ — 120 τ.μ. — Αντιπαροχή
Οικοπεδούχος 1: Κώστας Δημητρίου — 60% γης — παίρνει 60% ακινήτου
Οικοπεδούχος 2: Ελένη Δημητρίου — 40% γης — παίρνει 40% ακινήτου
Πλάνο: Δεν υπάρχει (αντιπαροχή, ΟΧΙ αγορά)
```

**Στον πίνακα ποσοστών**: Κατανομή = "Οικοπεδούχος", 2 ονόματα + %

### Σενάριο Δ: Εταιρεία + Φυσικό πρόσωπο

```
Ακίνητο: ΚΑΤΑΣΤΗΜΑ Κ1 — 200 τ.μ. — 500.000€
Αγοραστής 1: ΧΥΖ ΑΕ (εταιρεία) — 80% — 400.000€
Αγοραστής 2: Γιώργος Αντωνίου (φυσικό πρόσωπο) — 20% — 100.000€
```

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ

### 5.1 Νέο type: `PropertyOwnerEntry`

```typescript
interface PropertyOwnerEntry {
  contactId: string;           // Contact reference
  name: string;                // Denormalized display name
  ownershipPct: number;        // Ποσοστό ιδιοκτησίας (π.χ. 50, 70, 30)
  role: 'buyer' | 'co-buyer' | 'landowner';
  paymentPlanId: string | null; // Σύνδεση με ξεχωριστό πλάνο αποπληρωμής
}
```

### 5.2 Αλλαγές ανά σύστημα

| Σύστημα | Τρέχον | Πρόταση |
|---------|--------|---------|
| `UnitCommercialData` | `buyerContactId: string` | `owners: PropertyOwnerEntry[]` |
| `OwnershipTableRow` | `buyerContactId: string` | `owners: PropertyOwnerEntry[]` |
| `PaymentPlan` | `buyerContactId: string` | `ownerContactId: string` (1 plan per owner) |
| Contact roles | missing | Πρόσθεσε `'buyer'`, `'co-buyer'`, `'landowner'` |
| Sales dialogs | single buyer | Multi-buyer form (add/remove owners + %) |
| Πίνακας ποσοστών | 1 όνομα | N ονόματα στη στήλη "Ιδιοκτήτης" |

### 5.3 Backward Compatibility

- `buyerContactId` → **KEEP** ως computed field (ο πρώτος owner στο array)
- `buyerName` → **KEEP** ως computed (join ονομάτων)
- Existing data → Migration script: single buyer → `owners: [{ contactId, name, ownershipPct: 100, role: 'buyer' }]`

---

## 6. ΑΡΧΕΙΑ ΠΟΥ ΕΠΗΡΕΑΖΟΝΤΑΙ

### Υψηλή Προτεραιότητα (Domain Model)
1. `src/types/unit.ts` — `UnitCommercialData`
2. `src/types/ownership-table.ts` — `OwnershipTableRow`
3. `src/types/payment-plan.ts` — `PaymentPlan`

### Μεσαία Προτεραιότητα (UI/Services)
4. `src/components/sales/dialogs/SalesActionDialogs.tsx` — Reserve/Sell flow
5. `src/components/projects/tabs/OwnershipTableTab.tsx` — Owner column display
6. `src/components/sales/payments/` — Payment plan creation
7. `src/types/contacts/relationships/core/relationship-types.ts` — Add roles

### Χαμηλή Προτεραιότητα (Reports/Views)
8. PDF export (αν υπάρχει)
9. Dashboard summaries
10. CRM views

---

## 7. ΕΡΩΤΗΣΕΙΣ ΓΙΑ ΣΥΖΗΤΗΣΗ

1. **Πλάνα αποπληρωμής**: ✅ ΑΠΑΝΤΗΣΗ: **ΚΑΙ ΤΑ ΔΥΟ** — ο χρήστης επιλέγει ανά περίπτωση (κοινό πλάνο ή ξεχωριστά πλάνα ανά αγοραστή)
2. **Προσύμφωνο/Οριστικό**: ✅ ΑΠΑΝΤΗΣΗ: **ΚΑΙ ΤΑ ΔΥΟ** — ο χρήστης επιλέγει: κοινό (συνήθης) ή ξεχωριστά ανά αγοραστή (σπάνιο αλλά υπαρκτό)
3. **Ο πίνακας ποσοστών**: ✅ ΑΠΑΝΤΗΣΗ: **ΟΝΟΜΑΤΑ + ΠΟΣΟΣΤΑ** — π.χ. «Γιάννης Π. (70%) — Πέτρος Α. (30%)» στη στήλη Ιδιοκτήτης
4. **Οικοπεδούχοι**: ✅ ΠΡΟΤΑΣΗ GOOGLE-LEVEL: **SSoT στο Project** — νέα καρτέλα "Οικοπεδούχοι" στο project (ορισμός contacts + % γης). Χρήση στον πίνακα ποσοστών + κατανομή μονάδων. Ροή: Project→Οικοπεδούχοι → Μονάδα→Κατανομή → Πίνακας Ποσοστών
5. **Migration**: ✅ ΑΠΑΝΤΗΣΗ (ισχύει ΜΟΝΟ στις 2026-03-21): Τα **τρέχοντα** data στο Firestore είναι δοκιμαστικά — δεν χρειάζεται migration script αυτή τη στιγμή. **⚠️ ΠΡΟΣΟΧΗ: Αν η εφαρμογή έχει ήδη production data κατά την υλοποίηση αυτού του ADR, ΑΠΑΙΤΕΙΤΑΙ migration script. ΜΗΝ ΔΙΑΓΡΑΨΕΤΕ DATA χωρίς να επιβεβαιώσετε με τον Γιώργο ότι είναι ακόμα δοκιμαστικά.**
6. **Κράτηση (Reservation)**: ✅ ΠΡΟΤΑΣΗ GOOGLE-LEVEL: **Πολλαπλοί αγοραστές από την αρχή** — η κράτηση γίνεται σε N ονόματα ταυτόχρονα (π.χ. ζευγάρι κρατάει μαζί). Δεν δημιουργούμε dirty data που πρέπει να "πατσαριστεί" αργότερα.
7. **Αντιπαροχή UI**: ✅ ΠΡΟΤΑΣΗ GOOGLE-LEVEL: **Ίδιο UI pattern** με αγοραστές. Ενιαίο `PropertyOwnerEntry[]` — η μόνη διαφορά είναι ο `role` (`'landowner'` vs `'buyer'`). Στη στήλη "Ιδιοκτήτης": «Κώστας Δ. (60%) — Ελένη Δ. (40%)» — ανεξάρτητα αν είναι αγοραστές ή οικοπεδούχοι. SSoT.

---

## 8. ΕΚΤΙΜΗΣΗ ΕΡΓΑΣΙΑΣ

| Φάση | Εργασία | Εκτίμηση |
|------|---------|----------|
| Phase 1 | Domain model changes (types) | 2-3 ώρες |
| Phase 2 | Service layer updates | 3-4 ώρες |
| Phase 3 | Sales dialogs (multi-buyer form) | 4-6 ώρες |
| Phase 4 | Ownership table display | 2-3 ώρες |
| Phase 5 | Payment plan split | 4-6 ώρες |
| Phase 6 | Data migration script | 2-3 ώρες |
| Phase 7 | Testing & edge cases | 3-4 ώρες |
| **TOTAL** | | **20-29 ώρες** |

---

## CHANGELOG

| Date | Change |
|------|--------|
| 2026-03-21 | ADR Created — Initial proposal |
| 2026-03-21 | 7/7 ερωτήσεις απαντήθηκαν — Αποφάσεις: κοινά+ξεχωριστά πλάνα, κοινά+ξεχωριστά συμβόλαια, ονόματα+% στον πίνακα, SSoT οικοπεδούχοι στο project, πολλαπλοί αγοραστές από κράτηση, ενιαίο owner model |
| 2026-03-21 | FIX: `landowners` + `bartexPercentage` λείπανε από `/api/projects/list` response — δεδομένα αποθηκεύονταν στη Firestore αλλά δεν εμφανίζονταν στο UI μετά refresh |
| 2026-03-21 | SSOT REFACTOR: Κατάργηση 3 duplicate interfaces (ProjectListItem, FirestoreProject x2). Νέο `ProjectSummary = Pick<Project, ...>` στο `src/types/project.ts` — μία πηγή αλήθειας για list/grid views |
| 2026-03-31 | **SPEC-244D Session 1/3**: Αφαίρεση `buyerContactId`/`buyerName` από 6 types + 5 services. `owners[]` = SSoT. Νέο `ownerContactIds[]` flat array για Firestore queries. `buildOwnerFields()` updated. `propagateContactNameChange()` rewritten. `deletion-registry` migrated to `owners`/`ownerContactIds`. |
| 2026-03-31 | **SPEC-244D Session 2/3**: Components + API Routes migration — 14 αρχεία. `commercial?.buyerContactId`/`buyerName` αφαιρέθηκαν πλήρως. Display derives από `getPrimaryBuyerContactId(owners)` + `formatOwnerNames(owners)`. Zod schemas, props (`ownerContactId`/`ownerName`), Firestore writes (`owners`/`ownerContactIds`). SRP splits: `units/[id]/route.ts` → +3 helpers, `notifications/professional-assigned/route.ts` → +hierarchy-resolver. Fix: `brokerage/commissions` + `contracts` routes aligned με `primaryBuyerContactId`. |
| 2026-03-31 | **SPEC-244D Session 3/3**: Report builders + config migration — 8 αρχεία. `domain-defs-financials` (ownerName/ownerContactId/primaryBuyerContactId), `domain-defs-buyers` (ownerContactIds preFilter+sort), `domain-defs-brokerage` (primaryBuyerContactId), `domain-defs-ownership` (ownerName), `domain-definitions` (ownerContactIds), `ai-role-access-matrix` (owners+ownerContactIds), `audit-tracked-fields` (commercial.owners). Tests updated. |
