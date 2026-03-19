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
| **Field Locking (main endpoint)** | ✅ SOLID | `units/[id]/route.ts` locks 17 fields on sold/rented — works correctly |
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
