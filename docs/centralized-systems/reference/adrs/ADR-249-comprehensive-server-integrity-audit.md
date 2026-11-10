# ADR-249: Comprehensive Server-Side Integrity Audit

| Metadata | Value |
|----------|-------|
| **Status** | DOCUMENTED |
| **Date** | 2026-03-19 |
| **Category** | Entity Systems / Data Integrity / Security |
| **Type** | AUDIT (documentation-only) |
| **Trigger** | Follow-up to ADR-247 — systematic scan for all remaining integrity gaps |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Αφορμή

Μετά την επιτυχή υλοποίηση του **ADR-247** (Entity Relationship Integrity Guards), ο Γιώργος ζήτησε **καθολική έρευνα** σε ολόκληρη την εφαρμογή για να εντοπιστούν ΟΛΕΣ οι αντίστοιχες αδυναμίες server-side integrity. Το ADR-247 διόρθωσε 4 συγκεκριμένα findings — αυτό το audit τεκμηριώνει τα **8 νέα ευρήματα** που εντοπίστηκαν πέραν εκείνων.

### Μεθοδολογία

Τρεις παράλληλοι agents σκάναραν ολόκληρο το codebase:

| Agent | Scope | Αρχεία |
|-------|-------|--------|
| **Agent 1** — Denormalized Data | Πεδία που αντιγράφονται μεταξύ entities (names, codes, statuses) | types/, services/, lib/firestore/ |
| **Agent 2** — Client-Only Validation | Business rules μόνο στο client, χωρίς server guard | app/api/, components/, hooks/ |
| **Agent 3** — Cascade Completeness | Ελλιπή cascade paths σε updates/deletes | services/cascade/, entity-linking.service.ts |

### Σχετικά ADRs

| ADR | Τίτλος | Σχέση |
|-----|--------|-------|
| ADR-247 | Entity Relationship Integrity Audit | Πρώτο audit — 4 findings IMPLEMENTED |
| ADR-238 | Linked Spaces Implementation | Μηχανισμός σύνδεσης spaces→units |
| ADR-239 | Entity Linking Centralization | Κεντρικοποιημένο linking service |
| ADR-231 | Cascade Entity Linking | Cascade propagation for IDs |
| ADR-226 | Deletion Guard (Phase 1) | Dependency-based deletion blocking |

### Τι είναι ΗΔΗ διορθωμένο (ADR-247) — ΕΚΤΟΣ SCOPE

- ✅ Same space → multiple units (`validateLinkedSpacesUniqueness`)
- ✅ linkedCompanyId orphaned refs (deletion-registry)
- ✅ allocationCode staleness (`propagateSpaceAllocationCodeChange`)
- ✅ Building reassignment warning (observability log)

---

## 2. Findings

### Σύνοψη

| # | Εύρημα | Severity | Server Guard | Client Guard | Cascade |
|---|--------|----------|-------------|--------------|---------|
| F-1 | buyerName Staleness | CRITICAL | ❌ MISSING | ❌ N/A | ❌ MISSING |
| F-2 | Floor Number Uniqueness | CRITICAL | ❌ MISSING | ⚠️ Possible | N/A |
| F-3 | Invoice Immutability | CRITICAL | ❌ MISSING | ❌ Unknown | N/A |
| F-4 | Unit Alt Endpoints Bypass Field Locking | CRITICAL | ❌ MISSING | N/A | N/A |
| F-5 | Contact Name → Denormalized Copies | HIGH | ❌ MISSING | ❌ N/A | ❌ MISSING |
| F-6 | unitCoverage Boolean Flags Drift | MEDIUM | ❌ MISSING | ❌ Partial | N/A |
| F-7 | Building-Project Cross-Company Linking | MEDIUM | ❌ MISSING | ❌ Unknown | N/A |
| F-8 | Installment POST Sum Validation | LOW | ⚠️ Service-level | ❌ Route-level | N/A |

---

### F-1: buyerName Staleness (CRITICAL)

**Πρόβλημα**: Όταν μετονομάζεται ένα contact, τα denormalized `buyerName` πεδία σε units και payment plans παραμένουν stale.

**Source of truth**: `contacts/{id}` — πεδία `firstName`, `lastName`, `displayName`

**Denormalized σε**:
- `units/{id}.commercial.buyerName` (`types/unit.ts:112`)
- Payment plan records (`types/payment-plan.ts:289`)
- `sales-accounting-bridge.ts:85` — reads buyerName for notifications

**Cascade mechanism**: ❌ ΚΑΝΕΝΑΣ — δεν υπάρχει function που propagates contact name changes σε denormalized copies

**Impact**:
- Λανθασμένα ονόματα σε UI, reports, emails
- Audit trail δεν αντικατοπτρίζει τρέχουσα πραγματικότητα
- Νομικές ειδοποιήσεις/τιμολόγια με λάθος ονόματα

**Recommended Fix**:
```
Δημιουργία propagateContactNameChange() στο cascade-propagation service
που ενημερώνει units.commercial.buyerName + payment_plans.buyerName
κατά το update ενός contact.
```

---

### F-2: Floor Number Uniqueness (CRITICAL)

**Πρόβλημα**: Μπορούν να δημιουργηθούν πολλαπλά floors με **ίδιο number** στο ίδιο building.

**Αρχείο**: `src/app/api/floors/route.ts` — POST handler (line ~256)
- Κάνει `createEntity('floor', ...)` χωρίς duplicate check
- Client πιθανόν ελέγχει, αλλά ο server δεν ελέγχει

**Impact**:
- Duplicate floors → broken floor ordering
- Unit assignment confusion — ποιος «3ος όροφος»;
- Data corruption σε building structure hierarchy

**Recommended Fix**:
```
Πριν το createEntity, query:
  floors WHERE buildingId == X AND number == Y
  → αν υπάρχει, return 409 Conflict
```

---

### F-3: Invoice Immutability (CRITICAL)

**Πρόβλημα**: Finalized/submitted invoices μπορούν να τροποποιηθούν μέσω PATCH.

**Αρχείο**: `src/app/api/accounting/invoices/[id]/route.ts` — PATCH handler (line ~97)
- Καλεί `repository.updateInvoice(id, body)` χωρίς κανέναν status check
- Δεν ελέγχει αν `invoice.status === 'finalized' || 'submitted'`

**Impact**:
- Αλλοίωση τιμολογίων που έχουν υποβληθεί στην ΑΑΔΕ
- Legal/tax compliance violation
- Audit trail corruption — finalized documents should be immutable

**Recommended Fix**:
```
Πριν το updateInvoice:
1. Fetch current invoice
2. If status ∈ ['finalized', 'submitted', 'cancelled'] → return 403
3. Optionally: allow only specific fields (e.g., notes) post-finalization
```

---

### F-4: Unit Alternative Endpoints Bypass Field Locking (CRITICAL)

**Πρόβλημα**: Τα alternative endpoints `real-update/route.ts` και `final-solution/route.ts` ΔΕΝ εφαρμόζουν τα field locking checks που εφαρμόζει το κύριο `units/[id]/route.ts`.

**Αρχεία**:
- `src/app/api/units/real-update/route.ts` (line ~150) — direct update, no commercialStatus check
- `src/app/api/units/final-solution/route.ts` (line ~149) — direct update, no commercialStatus check
- vs `src/app/api/units/[id]/route.ts` (lines 112-130) — **17 locked fields** on sold/rented status

**Impact**:
- Bypass field locking σε sold/rented units
- Legal violations — τροποποίηση πεδίων μετά τη σύναψη πώλησης/μίσθωσης
- Contract integrity broken

**Recommended Fix**:
```
Εξαγωγή του field locking logic σε shared utility:
  validateFieldLocking(unitId, updatePayload) → throws 403 if locked fields touched
Εφαρμογή στα 3 endpoints: [id]/route.ts, real-update, final-solution
```

---

### F-5: Contact Name → Denormalized Copies (HIGH)

**Πρόβλημα**: Γενικευμένη έλλειψη name cascade. Αν αλλάξει contact name, building name, ή project name → denormalized copies παραμένουν stale.

**Denormalized name patterns**:
- `unit.commercial.buyerName` ← contact name (overlap με F-1)
- `payment_plans.buyerName` ← contact name
- Entity associations `contactName` (`types/entity-associations.ts:79`)

**Cascade mechanism**: ❌ ΚΑΝΕΝΑΣ — μόνο ID cascades υπάρχουν (π.χ. `propagateCompanyIdChange`), ΟΧΙ name cascades

**Impact**:
- Stale names παντού στο UI
- Search/filter by name δεν βρίσκει σωστά αποτελέσματα
- Reports/exports με παλιά ονόματα

**Recommended Fix**:
```
Pattern: Για κάθε denormalized name field, δημιούργησε
cascade function που triggers on source entity name change.
Alternatively: eliminate denormalized names, use lookups (tradeoff: performance).
```

---

### F-6: unitCoverage Boolean Flags Drift (MEDIUM)

**Πρόβλημα**: `unit.unitCoverage` (hasPhotos, hasFloorplans, hasDocuments) ενημερώνεται στο upload αλλά **ΟΧΙ** στο delete.

**Αρχείο**: `types/unit.ts:229-238` — `UnitCoverage` interface

**Impact**:
- UI δείχνει ότι υπάρχουν φωτογραφίες/floorplans ενώ έχουν διαγραφεί
- Filter by "has photos" επιστρέφει λάθος αποτελέσματα
- Coverage metrics στα reports είναι inflated

**Recommended Fix**:
```
Στο delete handler για photos/floorplans/documents:
1. After successful delete → recount remaining items
2. If count === 0 → set flag to false
Ή: recalculate flags periodically via batch job
```

---

### F-7: Building-Project Cross-Company Linking (MEDIUM)

**Πρόβλημα**: Δεν υπάρχει explicit check ότι `building.companyId === project.companyId` κατά τη σύνδεση building→project.

**Αρχείο**: `src/lib/firestore/entity-linking.service.ts` + cascade-propagation

**Impact**:
- Cross-company data leakage
- Mixed-company reports — buildings ενός πελάτη εμφανίζονται σε project άλλου
- GDPR/data isolation concerns

**Recommended Fix**:
```
Στο entity-linking.service, πριν κάθε link:
  if (building.companyId !== project.companyId) → throw 400
Exception: αν building.companyId is null (unassigned building)
```

---

### F-8: Installment POST Sum Validation (LOW — defense in depth)

**Πρόβλημα**: Η POST installments route δεν ελέγχει sum στο route level (η validation υπάρχει μόνο στο service layer).

**Αρχείο**: `src/app/api/units/[id]/payment-plan/installments/route.ts`

**Impact**: Χαμηλό — το service layer αποκρούει invalid sums, αλλά defense-in-depth λείπει στο route level

**Recommended Fix**:
```
Early validation στο route handler:
  const totalSum = installments.reduce((sum, i) => sum + i.amount, 0)
  if (Math.abs(totalSum - paymentPlan.totalAmount) > 0.01) → return 400
```

---

## 3. Protected Areas — Τι λειτουργεί σωστά

Η έρευνα εντόπισε επίσης πολλά σημεία που **λειτουργούν σωστά** και δεν χρειάζονται παρέμβαση:

| Σύστημα | Status | Περιγραφή |
|---------|--------|-----------|
| **Cascade ID Propagation** | ✅ SOLID | `propagateCompanyIdChange`, `propagateSpaceAllocationCodeChange` — ID cascades δουλεύουν |
| **Deletion Guards** | ✅ SOLID | `deletion-registry` blocks deletes when dependencies exist (ADR-226) |
| **Field Locking (main endpoint)** | ✅ SOLID | `api/properties/[id]/route.ts` κλειδώνει **21** πεδία σε sold/rented και **3** (`code/type/name`) σε reserved — η ΜΙΑ λίστα στο `lib/property/property-locked-fields.ts`, κρίση κατά **αλλαγή τιμής** (§7). *(Ως 2026-11-10 η γραμμή έγραφε «`units/[id]/route.ts` · 17 πεδία» — μπαγιάτικη και στα δύο.)* |
| **Change Detection** | ✅ SOLID | `detectChanges()` utility correctly identifies field mutations |
| **Linked Spaces Uniqueness** | ✅ FIXED | ADR-247 F-1 — `validateLinkedSpacesUniqueness()` now prevents duplicates |
| **Orphan Reference Cleanup** | ✅ FIXED | ADR-247 F-2 — deletion-registry prevents orphaned linkedCompanyId |
| **Entity Linking Service** | ✅ SOLID | Core `linkEntities`/`unlinkEntities` works correctly for ID references |
| **Enterprise ID Generation** | ✅ SOLID | All document IDs via `enterprise-id.service.ts` — no inline IDs |

---

## 4. Risk Matrix

| Finding | Severity | Probability | Impact | Risk Score | Priority |
|---------|----------|-------------|--------|------------|----------|
| **F-3** Invoice Immutability | CRITICAL | HIGH | CRITICAL (legal) | **P0** | Immediate |
| **F-4** Alt Endpoints Bypass | CRITICAL | HIGH | HIGH (legal) | **P0** | Immediate |
| **F-2** Floor Uniqueness | CRITICAL | MEDIUM | HIGH (data corruption) | **P0** | Immediate |
| **F-1** buyerName Staleness | CRITICAL | HIGH | MEDIUM (display) | **P1** | Short-term |
| **F-5** Name Cascade General | HIGH | HIGH | MEDIUM (display) | **P1** | Short-term |
| **F-7** Cross-Company | MEDIUM | LOW | HIGH (data isolation) | **P1** | Short-term |
| **F-6** unitCoverage Drift | MEDIUM | MEDIUM | LOW (cosmetic) | **P2** | Backlog |
| **F-8** Installment Sum | LOW | LOW | LOW (defense-in-depth) | **P2** | Backlog |

### Scoring Legend
- **P0**: Must fix before production — legal/compliance risk or data corruption
- **P1**: Fix within 2 sprints — data quality issues visible to users
- **P2**: Backlog — defense-in-depth improvements, cosmetic

---

## 5. Implementation Roadmap

### Phase P0 — Critical Fixes (Before Production)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| P0-1 | Invoice immutability guard (F-3) | 1h | `api/accounting/invoices/[id]/route.ts` |
| P0-2 | Field locking in alt endpoints (F-4) | 2h | `api/units/real-update/route.ts`, `api/units/final-solution/route.ts`, shared utility |
| P0-3 | Floor number uniqueness check (F-2) | 1h | `api/floors/route.ts` |

### Phase P1 — Data Quality (2 sprints)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| P1-1 | buyerName cascade propagation (F-1) | 3h | `services/cascade/`, contact update handler |
| P1-2 | General name cascade framework (F-5) | 4h | `services/cascade/`, entity-linking.service |
| P1-3 | Cross-company linking guard (F-7) | 1h | `lib/firestore/entity-linking.service.ts` |

### Phase P2 — Defense in Depth (Backlog)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| P2-1 | unitCoverage recalculation on delete (F-6) | 2h | Upload/delete handlers |
| P2-2 | Installment sum route-level validation (F-8) | 30m | `api/units/[id]/payment-plan/installments/route.ts` |

### Estimated Total Effort: ~14.5 hours

---

## 6. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial audit documentation — 8 findings documented | Claude Code |
| 2026-09-19 | **Έξοδος από συναλλαγή μόνο από τη δική της πράξη** (ADR-777 §8.60.20): το `RESERVED_LOCKED_FIELDS` κλειδώνει μόνο `code/type/name`, άρα ένα PATCH `reserved → for-rent/unavailable` περνούσε με τον αγοραστή γραμμένο. **ΝΕΟ** `validateTransactionExit` στο `property-field-locking.ts` (409), με τα **ίδια** κατηγορήματα με τους χώρους (`isTransactionOwnedCommercialStatus` · `isEditorCommercialStatus`)· καλείται **μετά** το ADR-249 (το `sold` απαντά ακόμη 403) και **μετά** την εξαίρεση ακύρωσης. Άγκυρα `property-transaction-exit.test.ts` + μετάλλαξη M13. | Claude Code |
| 2026-10-02 | **Μία λίστα κλειδωμάτων** (ADR-898 Φ3β-3, N.0.2): τα `SOLD_LOCKED_FIELDS` · `RESERVED_LOCKED_FIELDS` · `REVERT_ALLOWED_FIELDS` ήταν **δύο αντίγραφα** (server `property-field-locking.ts` + πελάτης `property-mutation-gateway.ts`, «keep both in sync»). Μετακόμισαν στο `lib/property/property-locked-fields.ts` (καθαρό) με `lockedFieldsAttempted` · `isFieldLocked`· ο καθένας ρίχνει το δικό του σφάλμα (403 / `PropertyMutationPolicyError`). Νέο κλειδωμένο πεδίο σε πώληση/μίσθωση: `objectiveValueDeclarations` (φυσικά στοιχεία). Άγκυρα `property-locked-fields.test.ts`. | Claude Code |
| 2026-10-19 | 🔴 **Το παλιό κλειδί `status` παρέκαμπτε ΚΑΙ τους δύο φρουρούς** (ADR-777 §8.60.20.12). Το `PATCH { status: 'for-sale' }` σε πουλημένο, ενοικιασμένο ή κρατημένο ακίνητο περνούσε: το `'status'` δεν είναι στο `SOLD_LOCKED_FIELDS`, και το `validateTransactionExit` κοίταζε μόνο το `body.commercialStatus`. Μετά ο `property-write-normalizer` («reverse heal») το έκανε `commercialStatus: 'for-sale'`, και η μονάδα έβγαινε από τη συναλλαγή με τον αγοραστή ακόμη γραμμένο. Θεραπεία: το `validatePropertyFieldLockingUnlessRevert` κρίνει πλέον το σώμα **όπως θα γραφτεί** (`withCanonicalStatusKey`: σκέτο `status` ⇒ `commercialStatus`· αν υπάρχουν και τα δύο, κερδίζει το κανονικό, όπως και στον γραφέα). Άγκυρες Π1–Π4 στο `property-transaction-exit.test.ts`· Π2 = πλήρης ισοδυναμία των δύο κλειδιών (4×4 καταστάσεις). Μετάλλαξη (χωρίς τη μετατροπή): **5 κόκκινα**. | Claude Code |
| 2026-11-10 | **Κλείδωμα κατά ΑΛΛΑΓΗ ΤΙΜΗΣ + η φόρμα στέλνει μόνο ό,τι άλλαξε** (§7, Google AIP-203 · AIP-134 · RFC 7396). Ο φρουρός έκρινε **παρουσία κλειδιού** ενώ η φόρμα ξανάστελνε πάντα `name/code/type/commercialStatus/floor/layout/orientations` ⇒ η «Αποθήκευση» σε κρατημένο/πωλημένο ακίνητο έπαιρνε **πάντα** 403. **ΝΕΟ** `lib/property/property-field-change.ts` — ο ΕΝΑΣ κριτής `samePropertyFieldValue` (ισοδυναμίες τομέα `sameAreas` · `sameEnergyCertificate` · `sameCommonCharges`, αλλιώς `serializeScalar` του `audit-diff`) + `changedPropertyFields` (μερική διόρθωση από δύο καταστάσεις). **ΝΕΟ** `judgeLockedFields` (`document` / `partial`). Server: αμετάβλητα κλειδωμένα **αφαιρούνται** από το σώμα, αλλαγμένα ⇒ 403 με ονόματα. Πελάτης: ο ίδιος κριτής στο gateway· η φόρμα περνά ΕΝΑ φίλτρο `changedPropertyUpdatesFromForm` (αντικαθιστά τα 4 σκόρπια «μόνο όταν άλλαξε»)· άδειασμα ⇒ `null`· τίποτα ⇒ καμία εγγραφή· `_v` μέσω `useVersionedSave` (`runVersionedPropertyUpdate`). Διορθώθηκε και η μπαγιάτικη γραμμή του §3. | Claude Code |
| 2026-11-10 | **Άδειασμα πεδίου: `null` ⇒ διαγραφή** (§7.8, RFC 7396 · AIP-134). Η ζωντανή επαλήθευση του §7 βρήκε 400 στο άδειασμα κοινοχρήστων (`PropertyPatchSchema` χωρίς `null` σε `commonCharges` · `energy` · `description`). Σχήμα `.nullable()` στα τρία· **ΝΕΟ** κλειστό `PROPERTY_CLEARABLE_FIELDS` + `firestoreUpdateOf` (ΕΝΑ σημείο `null → FieldValue.delete()`, μόνο στην εγγραφή) + `propertyAfterUpdate` (η προβολή βλέπει το έγγραφο χωρίς τα σβησμένα). ΠΕΑ: το `null` περνά από το `energyDeclarationPatch` — φεύγει η αξίωση, επιβιώνουν τα legacy πεδία. Δεν άλλαξε η αποθήκευση `null` στα πεδία σύνδεσης (`floorId` · `buildingId` · …). | Claude Code |
| 2026-11-10 | **Κλείσιμο ανοιχτών §7.8** (§7.9). Άγκυρες `property-patch-clearing.test.ts` (Κ1–Κ5, πραγματικός sentinel) + διόρθωση δύο μπαγιάτικων αγκυρών (`null ⇒ ΑΠΟΡΡΙΨΗ`). **ΝΕΟ** κοινό `lib/firestore/merge-patch-deletes.ts` (`withMergePatchDeletes` · `documentAfterMergePatch`) — καταναλωτές: ακίνητο + `common-space-drawn-area.server.ts`. 🔴 Normalizer: σβησμένα `areas` ⇒ `area: null` (πριν ξαναγραφόταν το αποθηκευμένο μικτό). `legality: []` **μένει** (κανονική μορφή «καμία αξίωση»). Tests 103/103 (5 σουίτες). | Claude Code |

---

## 7. Κλείδωμα κατά αλλαγή τιμής — και η φόρμα στέλνει μόνο ό,τι άλλαξε (2026-11-10)

### 7.1 Το πρόβλημα
Ο φρουρός (`validatePropertyFieldLockingUnlessRevert`) ρωτούσε «**υπάρχει** το κλειδί στο σώμα;». Η φόρμα ακινήτου
(`property-fields-form-mapper.ts`) έστελνε σε **κάθε** αποθήκευση `name · code · type · commercialStatus · floor ·
floorId · layout · orientations` — όλα κλειδωμένα σε `sold`/`rented`, τα τρία πρώτα και σε `reserved`. Αποτέλεσμα:
**καμία** αποθήκευση από τη φόρμα δεν περνούσε σε συναλλαγή, ακόμη και όταν άλλαζε μόνο ένα ανοιχτό πεδίο (π.χ. ΠΕΑ).

### 7.2 Τι κάνουν οι μεγάλοι
- **Google AIP-203 (IMMUTABLE)**: «the service should ignore the field if the value matches» — σφάλμα **μόνο** όταν αλλάζει.
- **AIP-134 / RFC 7396**: ο πελάτης στέλνει **μάσκα** / μερική διόρθωση· `null` = «σβήσε το».
- **Figma**: ο πελάτης στέλνει μόνο τις αλλαγμένες ιδιότητες· σύγκρουση = «τελευταία εγγραφή κερδίζει» **ανά ιδιότητα**.
Συναίνεση: **και οι δύο** πλευρές — ο πελάτης στέλνει μόνο ό,τι άλλαξε **και** ο server κρίνει από αλλαγή τιμής.

### 7.3 Ο ΕΝΑΣ κριτής — `lib/property/property-field-change.ts`
`samePropertyFieldValue(field, a, b)` — «ίδια τιμή» σημαίνει ίδια **σημασία**, όχι ίδια bytes:

| Πεδίο | Κριτής | Γιατί |
|-------|--------|-------|
| `areas` | `sameAreas` | `0` ≡ απουσία ≡ «δεν μετρήθηκε» (ADR-777 §8.97) |
| `energy` | `sameEnergyCertificate` ∘ `readEnergyCertificate` | ο αναγνώστης κανονικοποιεί (ADR-777 §8.94) |
| `commonCharges` | `sameCommonCharges` ∘ `readCommonCharges` | ίδιο (ADR-777 §8.93) |
| όλα τα άλλα | `serializeScalar` (`lib/audit/audit-diff.ts`) | το «άλλαξε» του κλειδώματος = το «άλλαξε» του ιστορικού |

Κανένας νέος κανόνας ισότητας: οι τρεις κριτές τομέα **υπήρχαν**· το αρχείο απλώς τους δένει σε ένα σημείο.

### 7.4 Server — `judgeLockedFields(status, updates, { kind: 'document', values: existing })`
Κλειδωμένο πεδίο με ίδια τιμή ⇒ **αφαιρείται** από το `body` πριν από `applyMultiLevelDefaults` /
`normalizePropertyWritePayload` (δεν γράφεται, δεν κρίνεται, δεν βγάζει ίχνος)· με άλλη τιμή ⇒ **403** με τα ονόματα.
Το παλιό `status` αφαιρείται όταν είναι αυτό που κουβαλούσε το αμετάβλητο `commercialStatus`.
Η ακύρωση (`isPropertyRevertTransition`) και το `validateTransactionExit` μένουν **ως έχουν**.
Το `validatePropertyFieldLocking` (παρουσία κλειδιού) μένει **μόνο** για τη μερική διόρθωση της αντικειμενικής — πράξη
ενός πεδίου που πάντα αλλάζει κάτι.

### 7.5 Πελάτης
- **Gateway** (`assertFieldLocking`): ο **ίδιος** κριτής με `kind: 'partial'` — πεδίο που ο καλών δεν έδωσε κρίνεται ως
  αλλαγή (fail-closed)· αλλιώς ένα `null` πάνω σε τιμή που απλώς δεν δόθηκε θα έμοιαζε «ίδιο». Τελικός κριτής ο server.
- **Φόρμα** — ΕΝΑ φίλτρο `changedPropertyUpdatesFromForm`: συγκρίνει τη φόρμα **τώρα** με τη φόρμα **όπως θα
  φορτωνόταν** από το ακίνητο, **μέσα από τον ίδιο χαρτογράφο** ⇒ κάθε διαφορά αναπαράστασης ακυρώνεται. Αντικατέστησε
  τα 4 σκόρπια `sameAreas`/`sameEnergyCertificate`/`sameCommonCharges`/`changedCommercialAmounts`-ως-συνθήκη του mapper
  (το `changedCommercialAmounts` μένει ως **συγχώνευση** ποσών — δεν γράφει `null` σε ποσό που ποτέ δεν δηλώθηκε).
- Ό,τι ο άνθρωπος **άδειασε** φεύγει ως `null` (RFC 7396) — ως τώρα ένα άδειο μπλοκ απλώς δεν στελνόταν και η παλιά τιμή
  έμενε (`condition` · `finishes` · `interiorFeatures` · `securityFeatures` · `systemsOverride` · `description`).
- Τίποτα δεν άλλαξε ⇒ **καμία** εγγραφή, απλή έξοδος από την επεξεργασία.
- Η **δημιουργία** χρησιμοποιεί την πλήρη εικόνα (`buildPropertyUpdatesFromForm`)· τα μπλοκ `areas · energy · commercial
  · commonCharges` εκπέμπονται μόνο όταν δηλώνουν κάτι (ίδιος κριτής) — καμία αλλαγή στο σώμα δημιουργίας.

### 7.6 Έκδοση (`_v`, SPEC-256A)
Η φόρμα στέλνει `_v` μέσω του SSoT `useVersionedSave` (`useGuardedPropertyMutation.runVersionedPropertyUpdate`)· το
`updateProperty` επιστρέφει πλέον το `_v` του PATCH. Σε 409 η επανάληψη χωρίς `_v` (ADR-256) — με σώμα **μόνο αλλαγμένων**
πεδίων αυτό είναι «τελευταία εγγραφή κερδίζει» **ανά πεδίο** (Figma), όχι αντικατάσταση ολόκληρου του εγγράφου.

### 7.7 Ανοιχτά
- Τα tests του mapper (`property-form-areas.test.ts`, `property-form-commercial.test.ts`, `property-energy-import-chain.test.ts`)
  έλεγχαν το «μόνο όταν άλλαξε» **μέσα** στον mapper· πρέπει να κρίνουν πλέον το `changedPropertyUpdatesFromForm`.
  Άγκυρα για `judgeLockedFields` / `changedPropertyFields` — εκκρεμεί (χωρίς έγκριση δεν τρέχουν tests).

### 7.8 Το άδειασμα πεδίου: `null` ⇒ ΔΙΑΓΡΑΦΗ, ένα σημείο μετάφρασης (2026-11-10)

**Πώς βρέθηκε**: ζωντανή επαλήθευση του §7 στο nestorconstruct.gr («ΔΟΚΙΜΗ Ε — Πωλημένο»). Άδειασμα κοινοχρήστων ⇒
`POST …/impact-preview` με σώμα `{"commonCharges":null}` ⇒ **400 Validation failed**. Το εισήγαγε το §7: πριν, το άδειο
μπλοκ απλώς δεν στελνόταν (και η παλιά τιμή **δεν σβηνόταν ποτέ**).

**Ρίζα**: το `PropertyPatchSchema` (κοινό σε PATCH **και** `impact-preview`) δεν δεχόταν `null` στα `commonCharges` ·
`energy` · **`description`** (το τρίτο βρέθηκε στο audit — ίδιο σφάλμα στο άδειασμα περιγραφής). Τα υπόλοιπα
(`condition` · `finishes` · …) περνούσαν λόγω `.passthrough()` και ο `buildUpdateData` **αποθήκευε** `null`.

**Τι κάνουν οι μεγάλοι**: RFC 7396 — `null` σε merge patch = «remove the member»· Google AIP-134 — πεδίο στη μάσκα
χωρίς τιμή = «clear»· Firestore — η αφαίρεση πεδίου είναι `FieldValue.delete()`, όχι αποθηκευμένο `null`.

**SSoT audit**: δεν υπάρχει κεντρικός μεταφραστής `null → FieldValue.delete()`· το μοτίβο ζει **τοπικά**
(`common-space-drawn-area.server.ts`, `opportunity-*.server.ts`, `soft-delete-engine.ts`). Ο γραφέας του ακινήτου
αποθήκευε `null`. Οι αναγνώστες (`readCommonCharges` · `readEnergyCertificate` · `sameAreas`) δίνουν για απουσία ό,τι
και για `null` ⇒ η διαγραφή είναι ασφαλής για αυτούς.

**Λύση** (`app/api/properties/[id]/property-patch-helpers.ts`):
- Σχήμα: `.nullable()` στα `commonCharges` · `energy` · `description` (το `transform` δεν τρέχει σε `null`).
- `PROPERTY_CLEARABLE_FIELDS` — **κλειστό** σύνολο πεδίων-δηλώσεων που η φόρμα μπορεί να αδειάσει: `description ·
  condition · areas · energy · commonCharges · systemsOverride · finishes · interiorFeatures · securityFeatures`.
  ⚠️ **Όχι «κάθε `null`»**: `floor · floorId · buildingId · projectId · area · price` αποθηκεύουν `null` ως
  «αποσυνδέθηκε», και η διαγραφή θα τα έβγαζε από ερωτήματα `where(…, '==', null)`· το `levelData` το κατέχει ο normalizer.
- `firestoreUpdateOf(updateData)` — **το ΕΝΑ σημείο μετάφρασης**, καλείται μόνο στο `withVersionCheck`. Ως εκεί κλείδωμα ·
  ιστορικό (`diffFieldsWithResolution`) · προεπισκόπηση βλέπουν καθαρό `null`, ποτέ το σύμβολο του SDK.
- `propertyAfterUpdate(existing, updateData)` — το έγγραφο όπως θα είναι μετά την εγγραφή (τα σβησμένα λείπουν)· αυτό
  παίρνει πλέον η δημόσια προβολή αντί για `{ ...existing, ...updateData }`.
- **ΠΕΑ** (`property-energy-patch.ts`): το `null` περνά από τον **ίδιο** δρόμο με κάθε δήλωση — `readEnergyCertificate(null)`
  = αδήλωτο ⇒ το `withEnergyPerformanceClaim` αφαιρεί την αυτο-δηλωμένη αξίωση· τα πεδία του παλιού σχήματος
  (`certificateId` · `certificateDate` · `validUntil`) **επιβιώνουν**, αλλιώς `energy: null` ⇒ διαγραφή.
- **Κλείδωμα**: σε πωλημένο το `energy`/`areas` είναι κλειδωμένα ⇒ `null` πάνω σε υπάρχουσα τιμή = αλλαγή ⇒ 403 (σωστό).
  Το `commonCharges` δεν είναι κλειδωμένο ⇒ περνά.

### 7.9 Κλείσιμο των ανοιχτών του §7.8 (2026-11-10)

**Άγκυρες** — `__tests__/property-patch-clearing.test.ts` (Κ1–Κ5) με τον **πραγματικό** `FieldValue.delete()` του Admin
SDK: το κλειστό σύνολο ακριβώς (επέκταση σε `floorId` κ.λπ. ⇒ κόκκινο) · σχήμα με `null` · `firestoreUpdateOf` ·
`propertyAfterUpdate` · `energyDeclarationPatch(…, null, …)` (legacy επιβιώνουν · αξίωση φεύγει · αλλιώς διαγραφή).
🔴 Οι άγκυρες `property-patch-common-charges` / `-energy-certificate` **έλεγαν ακόμη** `null ⇒ ΑΠΟΡΡΙΨΗ` — το συμβόλαιο
πριν το §7.8· δεν τις τρέχει καμία πύλη, γι' αυτό το `a8f2f25f` πέρασε. Διορθώθηκαν (το `null` περνά).

**Κοινή μετάφραση** — `lib/firestore/merge-patch-deletes.ts`: `withMergePatchDeletes(patch, isClearable?)` +
`documentAfterMergePatch(existing, patch, isClearable?)`. Δύο καταναλωτές της **ίδιας** μετάφρασης RFC 7396 → Firestore:
το ακίνητο (κριτής = `PROPERTY_CLEARABLE_FIELDS`, που μένει εδώ) και ο `common-space-drawn-area.server.ts` (ADR-931 Β1,
κάθε `null`). ⚠️ **Δεν** μπήκαν τα `opportunity-*` / `soft-delete-engine` / `thread-writer`: εκεί η διαγραφή είναι
**λίστα πεδίων** μιας μετάβασης, όχι μετάφραση `null` — άλλο σχήμα, όχι διπλότυπο.

**Καθρέφτης `area`** (`property-write-normalizer.ts`, αμετάβλητη 4) — 🔴 ως τώρα το `payload.areas ?? existing.areas`
έπεφτε στο **αποθηκευμένο** μπλοκ όταν η φόρμα το έσβηνε ⇒ ο normalizer **ξαναέγραφε** το παλιό μικτό στο `area`.
Τώρα (υπολογιζόμενη τιμή ακολουθεί την πηγή της, όπως οι υπολογιζόμενες παράμετροι Revit/ArchiCAD):
- σώμα **με** `areas` (τιμή ή `null`) ⇒ `area` = μετρημένο μικτό (`measuredAreaOrNull`, ο ΕΝΑΣ κριτής «μετρήθηκε;» του
  ADR-777 §8.97), αλλιώς `null` — **και στη δημιουργία** (το `area: 0` της φόρμας χωρίς μικτό γίνεται `null`: `0` =
  «δεν μετρήθηκε»)· γράφεται `null`, όχι διαγραφή (το `area` είναι πεδίο αποθηκευμένου `null`)·
- σώμα **χωρίς** `areas` ⇒ μόνο θεραπεία από το αποθηκευμένο μετρημένο μικτό, ποτέ σβήσιμο (όπως πριν)·
- πολυεπίπεδο: το σβησμένο μπλοκ ξαναϋπολογίζεται από τα επίπεδα (αμετάβλητη 3) και ο καθρέφτης ακολουθεί το άθροισμα.
Ερωτήματα Firestore πάνω στο `area` δεν υπάρχουν (μόνο ταξινόμηση πελάτη) ⇒ `null` αντί `0` δεν αλλάζει αποτελέσματα.

**`legality: []` — ΑΠΟΦΑΣΗ: μένει.** Το `legality` **δεν** είναι δήλωση του γραφείου (ο πελάτης δεν μπορεί καν να το
στείλει, `z.undefined()`)· είναι σύνολο αξιώσεων που γράφει μόνο ο server, με κανονική μορφή του «καμία» το `[]`:
`readLegalityClaims` (απουσία ⇒ `[]`) · ο δεύτερος γραφέας `owner-property-energy-certificate.service.ts` (`[]`) · η
δημόσια αγγελία (ADR-838, `legality: []` ρητά). Διαγραφή μόνο εδώ θα έδινε **δύο** μορφές για το ίδιο νόημα· στο proto3
(Google) ο κενός repeated **είναι** η απουσία — καμία υλοποίηση δεν απαιτεί αλλαγή. Κλειδωμένο στο Κ5 της άγκυρας.
