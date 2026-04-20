# ADR-233: Entity Coding System — Κωδικοποίηση Οντοτήτων

| Field | Value |
|-------|-------|
| **ID** | ADR-233 |
| **Status** | ✅ ACCEPTED |
| **Created** | 2026-03-15 |
| **Author** | Γιώργος Παγώνης |
| **Category** | Entity Systems |

---

## 1. Σκοπός

Ορισμός ενιαίου συστήματος κωδικοποίησης για **όλες τις οντότητες** της εφαρμογής (ακίνητα, κτίρια, έργα, μονάδες, χώροι στάθμευσης, αποθήκες κ.λπ.).

Στόχος: κάθε οντότητα να έχει μοναδικό, αναγνώσιμο κωδικό που να επικοινωνεί τη φύση και τη θέση της.

---

## 2. Υπάρχουσα Πρακτική (Legacy — Προηγούμενη Εφαρμογή)

### Format: `{Κτίριο}_{Τύπος}{Όροφος}.{Αρίθμηση}`

| Κωδικός | Ανάλυση |
|---------|---------|
| `A_D1.1` | Κτίριο Α, **Δ**ιαμέρισμα, 1ος όροφος, 1η μονάδα |
| `A_D1.2` | Κτίριο Α, **Δ**ιαμέρισμα, 1ος όροφος, 2η μονάδα |
| `A_P1.1` | Κτίριο Α, **P**arking, 1ος όροφος, θέση 1 (αντιστοιχεί στο Δ1.1) |
| `A_A1.1` | Κτίριο Α, **Α**ποθήκη, 1ος όροφος, αποθήκη 1 (αντιστοιχεί στο Δ1.1) |

### Σύνδεση: Parking & Αποθήκη → Μονάδα

Ο τελευταίος αριθμός (μετά την τελεία) δηλώνει **σε ποια μονάδα ανήκει**:
- `A_D1.1` → Διαμέρισμα
- `A_P1.1` → Το parking **αυτού** του διαμερίσματος
- `A_A1.1` → Η αποθήκη **αυτού** του διαμερίσματος

### Περιορισμοί Legacy Συστήματος

- ❌ Δεν ξεχώριζε **τύπο μονάδας** (διαμέρισμα vs μεζονέτα vs στούντιο vs γκαρσονιέρα)
- ❌ Δεν ξεχώριζε **κατάστημα** από κατοικία
- ❌ Δεν ξεχώριζε **υπαίθριο parking** από κλειστό parking
- ❌ Μόνο ένα γράμμα τύπου → σύγκρουση (π.χ. Α = Αποθήκη ή Α = Apartment;)

---

## 3. Αποφάσεις (Confirmed)

### 3.1 Κωδικός τύπου: 2 χαρακτήρες (ΑΠΟΦΑΣΗ)

2-χαρακτήρα κωδικός τύπου αντί 1-χαρακτήρα. Με 1 χαρακτήρα δημιουργούνται συγκρούσεις. Με 2 χαρακτήρες κάθε τύπος είναι μοναδικός, αυτονόητος, και επεκτάσιμος.

### 3.2 Μοναδικότητα: Ανά Έργο, ΟΧΙ globally (ΑΠΟΦΑΣΗ)

Ο κωδικός **ΔΕΝ** περιέχει ένδειξη έργου. Είναι μοναδικός εντός του έργου. Η μοναδικότητα εξασφαλίζεται από το context (Google pattern). Όταν χρειάζεται full reference εκτός εφαρμογής: `"Κηφισιά Residence — A-DI-1.01"`.

### 3.3 Πυλωτή: Εντάσσεται στο PY, ΟΧΙ ξεχωριστός τύπος (ΑΠΟΦΑΣΗ)

Η πυλωτή δεν είναι τύπος ακινήτου — είναι τοποθεσία. Θέση στάθμευσης σε πυλωτή = `PY` (υπαίθριο parking). Αν η θέση είναι μισή πυλωτή / μισή πρασιά, παραμένει μία θέση `PY` — η λεπτομέρεια στα notes.

### 3.4 Χαρακτήρες: Λατινικοί, εμπνευσμένοι από ελληνικές λέξεις (ΑΠΟΦΑΣΗ)

Κάθε κωδικός είναι τα **αρχικά της ελληνικής λέξης**, γραμμένα με τον **αντίστοιχο λατινικό χαρακτήρα**. Έτσι:
- Ο Έλληνας διαβάζει το ελληνικό νόημα (ΔΙ = Διαμέρισμα)
- Ο ξένος διαβάζει λατινικούς χαρακτήρες (DI)

Αντιστοίχιση: Δ→D, Γ→G, Σ→S, Μ→M, Κ→K, Τ→T, Α→A, Π→P, Υ→Y, Ε→E, Ρ→R, Ζ→Z, Ι→I, Β→B, Λ→L, Ο→O

### 3.5 Υπόγεια: Prefix `Y` (ΑΠΟΦΑΣΗ)

Τα υπόγεια κωδικοποιούνται με prefix `Y` (= **Υ**πόγειο) αντί αρνητικού αριθμού. Αποφεύγεται η διπλή παύλα (`--1`) που μπερδεύει.

```
A-PK-Y1.01    1ο Υπόγειο
A-PK-Y2.01    2ο Υπόγειο
A-PK-Y3.01    3ο Υπόγειο
```

---

## 4. Τελικό Σύστημα Κωδικοποίησης (v2)

### Format: `{Κτίριο}-{Τύπος}-{Όροφος}.{ΑΑ}`

### 4.1 Πλήρης Πίνακας Κωδικών Τύπου (14 τύποι)

#### Κατοικίες (8 τύποι)

| Κωδικός | Τύπος | Ελληνικά Αρχικά |
|---------|-------|-----------------|
| `DI` | Διαμέρισμα | **Δ**ιαμέρ**ι**σμα |
| `GK` | Γκαρσονιέρα | **Γ**(**κ**)αρσονιέρα |
| `ST` | Στούντιο | **Σ**(**τ**)ούντιο |
| `ME` | Μεζονέτα | **Μ**(**ε**)ζονέτα |
| `RE` | Ρετιρέ | **Ρ**(**ε**)τιρέ |
| `LO` | Loft | **Λο**φτ |
| `MO` | Μονοκατοικία | **Μο**νοκατοικία |
| `BI` | Βίλα | **Βί**λα |

#### Εμπορικά (3 τύποι)

| Κωδικός | Τύπος | Ελληνικά Αρχικά |
|---------|-------|-----------------|
| `KA` | Κατάστημα | **Κα**τάστημα |
| `GR` | Γραφείο | **Γρ**αφείο |
| `AI` | Αίθουσα | **Αί**θουσα |

#### Βοηθητικά (3 τύποι)

| Κωδικός | Τύπος | Ελληνικά Αρχικά |
|---------|-------|-----------------|
| `AP` | Αποθήκη | **Απ**οθήκη |
| `PK` | Κλειστό Parking | **Π**άρ**κ**ινγκ (κλειστό) |
| `PY` | Υπαίθριο Parking | **Π**άρκινγκ **Υ**παίθριο (+ πυλωτή) |

### 4.2 Κωδικοποίηση Ορόφων

| Κωδικός | Σημασία |
|---------|---------|
| `0` | Ισόγειο |
| `1, 2, 3...` | Κανονικοί όροφοι |
| `Y1, Y2, Y3...` | 1ο, 2ο, 3ο Υπόγειο |
| `H` | Ημιόροφος (αν χρειαστεί) |
| `R` | Δώμα / Rooftop (αν χρειαστεί) |

### 4.3 Αρίθμηση

- Zero-padded: `.01`, `.02`, ... `.10`, `.99`
- Αύξων αριθμός μονάδας **ανά τύπο ανά όροφο**

---

## 5. Παραδείγματα

### 5.1 Πίνακας Παραδειγμάτων

| Κωδικός | Ανάλυση |
|---------|---------|
| `A-DI-1.01` | Κτίριο Α, Διαμέρισμα, 1ος όροφος, μονάδα 1 |
| `A-DI-1.02` | Κτίριο Α, Διαμέρισμα, 1ος όροφος, μονάδα 2 |
| `A-GK-1.01` | Κτίριο Α, Γκαρσονιέρα, 1ος όροφος |
| `A-ST-0.01` | Κτίριο Α, Στούντιο, Ισόγειο |
| `A-ME-1.01` | Κτίριο Α, Μεζονέτα, 1ος-2ος όροφος |
| `A-RE-5.01` | Κτίριο Α, Ρετιρέ, 5ος (τελευταίος) |
| `A-LO-3.01` | Κτίριο Α, Loft, 3ος όροφος |
| `A-MO-0.01` | Κτίριο Α, Μονοκατοικία |
| `A-BI-0.01` | Κτίριο Α, Βίλα |
| `A-KA-0.01` | Κτίριο Α, Κατάστημα, Ισόγειο |
| `A-GR-2.01` | Κτίριο Α, Γραφείο, 2ος όροφος |
| `A-AI-0.01` | Κτίριο Α, Αίθουσα, Ισόγειο |
| `A-AP-Y1.01` | Κτίριο Α, Αποθήκη, 1ο Υπόγειο |
| `A-AP-Y2.01` | Κτίριο Α, Αποθήκη, 2ο Υπόγειο |
| `A-AP-0.01` | Κτίριο Α, Αποθήκη, Ισόγειο |
| `A-PK-Y1.01` | Κτίριο Α, Κλειστό Parking, 1ο Υπόγειο, θέση 1 |
| `A-PK-Y2.03` | Κτίριο Α, Κλειστό Parking, 2ο Υπόγειο, θέση 3 |
| `A-PK-Y3.01` | Κτίριο Α, Κλειστό Parking, 3ο Υπόγειο, θέση 1 |
| `A-PY-0.01` | Κτίριο Α, Υπαίθριο Parking (πυλωτή), θέση 1 |
| `A-PY-0.02` | Κτίριο Α, Υπαίθριο Parking (πρασιά), θέση 2 |

### 5.2 Πλήρες Παράδειγμα Έργου

```
Έργο: "Κηφισιά Residence"

Κτίριο Α:
  3ο Υπόγειο (Y3):
    A-PK-Y3.01   Κλειστό Parking, θέση 1
    A-PK-Y3.02   Κλειστό Parking, θέση 2

  2ο Υπόγειο (Y2):
    A-PK-Y2.01   Κλειστό Parking, θέση 1
    A-PK-Y2.02   Κλειστό Parking, θέση 2
    A-AP-Y2.01   Αποθήκη 1

  1ο Υπόγειο (Y1):
    A-PK-Y1.01   Κλειστό Parking, θέση 1
    A-PK-Y1.02   Κλειστό Parking, θέση 2
    A-AP-Y1.01   Αποθήκη 1
    A-AP-Y1.02   Αποθήκη 2

  Ισόγειο (0):
    A-KA-0.01    Κατάστημα 1
    A-KA-0.02    Κατάστημα 2
    A-PY-0.01    Υπαίθριο Parking (πυλωτή), θέση 1
    A-PY-0.02    Υπαίθριο Parking (πρασιά), θέση 2
    A-AP-0.01    Αποθήκη (ισόγειο)

  1ος Όροφος:
    A-DI-1.01    Διαμέρισμα 2-υπνο
    A-DI-1.02    Διαμέρισμα 3-υπνο
    A-GK-1.01    Γκαρσονιέρα

  2ος Όροφος:
    A-DI-2.01    Διαμέρισμα 2-υπνο
    A-ME-2.01    Μεζονέτα (2ος-3ος)

  3ος Όροφος:
    A-DI-3.01    Διαμέρισμα 1-υπνο
    A-LO-3.01    Loft

  4ος Όροφος (τελευταίος):
    A-RE-4.01    Ρετιρέ

Κτίριο Β:
  Ισόγειο:
    B-AI-0.01    Αίθουσα (showroom)
  1ος Όροφος:
    B-ST-1.01    Στούντιο 1
    B-ST-1.02    Στούντιο 2
    B-GR-1.01    Γραφείο 1
```

---

## 6. Επιπλέον Αποφάσεις (Confirmed)

### 6.1 Separator: Παύλα `-` (ΑΠΟΦΑΣΗ)

```
A-DI-1.01    ✅ (παύλα)
A_DI_1.01    ❌ (underscore — απορρίφθηκε)
```

Η παύλα είναι πιο ευανάγνωστη, URL-safe, standard σε κωδικούς παγκοσμίως.

### 6.2 Αυτόματη δημιουργία κωδικού: ΝΑΙ (ΑΠΟΦΑΣΗ)

Η εφαρμογή **προτείνει αυτόματα** τον κωδικό βάσει κτιρίου + τύπου + ορόφου. Αυτόματο auto-increment (`.01`, `.02`, `.03`). Ο χρήστης δεν χρειάζεται να θυμάται τους κωδικούς τύπων.

### 6.3 Override: ΝΑΙ, επιτρέπεται (ΑΠΟΦΑΣΗ)

Η εφαρμογή **προτείνει** κωδικό, αλλά ο χρήστης μπορεί να τον **αλλάξει** αν θέλει. Αν ο κωδικός δεν ακολουθεί το format → **informational warning** (όχι blocking).

### 6.4 Σύνδεση Parking/Αποθήκης: Explicit Linking (ΑΠΟΦΑΣΗ)

Parking και αποθήκες έχουν **ανεξάρτητους κωδικούς**. Η σύνδεση με μονάδα γίνεται στη **βάση δεδομένων**, ΟΧΙ μέσω σύμβασης αριθμού.

```
A-DI-1.01     Διαμέρισμα
A-PK-Y1.03    Parking (ανεξάρτητος κωδικός)
A-AP-Y1.07    Αποθήκη (ανεξάρτητος κωδικός)
→ Σύνδεση: Firestore linked spaces (ήδη υποστηρίζεται)
```

**Γιατί:** Ένα διαμέρισμα μπορεί να έχει 0, 1, 2, ή 3 parking/αποθήκες. Η σύμβαση αριθμού (legacy) δεν το υποστηρίζει.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-15 | Initial DRAFT — καταγραφή legacy κωδικοποίησης |
| 2026-03-15 | Απόφαση: 2-χαρακτήρα τύπος, μοναδικότητα ανά έργο |
| 2026-03-15 | Απόφαση: Πυλωτή → PY (υπαίθριο), ΟΧΙ ξεχωριστός τύπος |
| 2026-03-15 | Προσθήκη: Ρετιρέ, Loft, Μονοκατοικία, Βίλα, Αίθουσα |
| 2026-03-15 | Απόφαση: Υπόγεια με prefix Y (Υπόγειο) αντί αρνητικού |
| 2026-03-15 | Οριστικοποίηση 14 κωδικών τύπου — λατινικοί χαρακτήρες, ελληνικά αρχικά |
| 2026-03-15 | Αποφάσεις: separator παύλα, αυτόματη δημιουργία, override, explicit linking |
| 2026-03-15 | **ΟΛΕΣ ΟΙ ΑΠΟΦΑΣΕΙΣ CONFIRMED** — ADR έτοιμο για υλοποίηση |
| 2026-03-15 | **IMPLEMENTATION COMPLETE** — Config, Service, API, Hook, UI (AddUnit + Parking), server-side fallback |
| 2026-04-15 | **SSoT SEALED** — `useEntityCodeSuggestion` sealed inside `EntityCodeField` (sole consumer). Property edit form migrated from custom `<Input>` to `EntityCodeField`. All 3 entity types (property/storage/parking) now use identical code path. `parseFloorLevel` used at all call-sites. `entity-code-field` SSoT module added to `.ssot-registry.json` — pre-commit blocks new direct hook imports. |
| 2026-04-20 | **BUG FIX** — `prevCodeInputsRef` in `PropertyFieldsBlock` now normalizes initial values with `?? ''` / `?? 0` (matching `codeBuildingId` / `codeFloorLevel` computation). Raw `null`/`undefined` values caused false `changed = true` on mount → code cleared → suggestion auto-applied → spurious code change in ImpactDialog when only `commercialStatus` was modified. |
| 2026-04-20 | **BUG FIX (ImpactGuard × code auto-save)** — Two root causes fixed: (1) `buildPropertyUpdatesFromForm` no longer accepts `suggestedCode` param — uses `property.code` as fallback instead of `latestSuggestion`, preventing spurious A-ST-2.01→A-ST-2.02 in manual-save payload. (2) `PropertyDetailsContent` adds `directSaveFields` callback that calls `updatePropertyWithPolicy` directly (bypasses ImpactGuard); `onAutoSaveFields` routes code-only updates (`isCodeOnlyUpdate` check) through `directSaveFields` — ImpactDialog no longer opens on dropdown interaction triggered by mid-edit code auto-save. Floor/level saves still route through `safeOnUpdateProperty` (ImpactGuard retained). |
| 2026-04-20 | **BUG FIX (code auto-apply on Edit entry)** — `PropertyFieldsBlock` now gates `codeBuildingId` prop with `!formData.code`: `codeBuildingId` is passed to `EntityCodeField` only when `isCreatingNewUnit OR formData.code=''`. When an existing code is present, `codeBuildingId=''` → `useEntityCodeSuggestion` skips fetch (buildingId required) → no suggestion → no auto-apply. Prevents spurious code change every time user clicks Edit on an existing property. Suggestion still fetches correctly when code is cleared (by building/floor/type change or manual clear). |
| 2026-04-20 | **BUG FIX (Google-pattern: no silent code auto-save)** — Removed `directSaveFields` and its code-only routing from `PropertyDetailsContent`. `handleCodeAutoApply` in `PropertyFieldsBlock` no longer calls `onAutoSaveFields`; instead sets `codeAutoAppliedRef.current = true`. `handleSave` now includes `formData.code` when `codeAutoAppliedRef` or `codeEditedByUserRef` is true, falling back to `property.code` only when neither is set. SSoT: auto-suggested codes are applied to the form visually and persisted only on explicit user Save — eliminating the silent auto-increment bug (code: null → A-DI-1.10 → A-DI-1.11 per each Edit press). |

---

## 7. Implementation Details (v1.0)

### 7.1 Files Created

| File | Purpose |
|------|---------|
| `src/config/entity-code-config.ts` | Type mappings (UnitType→code, ParkingZone→code), building letter extraction |
| `src/services/entity-code.service.ts` | Pure functions: format, parse, validate, build codes |
| `src/app/api/entity-code/suggest/route.ts` | GET API — suggests next code based on existing entities |
| `src/hooks/useEntityCodeSuggestion.ts` | Debounced client hook for auto-suggest in forms |

### 7.2 Files Modified

| File | Change |
|------|--------|
| `src/types/unit.ts` | +5 UnitType values: penthouse, loft, detached_house, villa, hall |
| `src/components/units/dialogs/AddUnitDialog.tsx` | Auto-suggest integration, codeOverridden flag, format warning |
| `src/features/property-details/components/UnitFieldsBlock.tsx` | +5 unit types in options, updated placeholder |
| `src/components/space-management/ParkingPage/AddParkingDialog.tsx` | Auto-suggest integration for parking number |
| `src/app/api/units/create/route.ts` | Server-side fallback: auto-generates code if client doesn't provide one |
| `src/app/api/parking/route.ts` | Server-side fallback: auto-generates ADR-233 code for new parking spots |
| `src/i18n/locales/el/units.json` | +5 type labels, entityCode section, updated placeholders |
| `src/i18n/locales/en/units.json` | +5 type labels, entityCode section, updated placeholders |
| `docs/centralized-systems/reference/adr-index.md` | Added ADR-233 entry |

### 7.3 Architecture

```
Client (AddUnitDialog)           Server (API)
  │                                │
  ├─ User selects building         │
  ├─ User selects floor            │
  ├─ User selects type             │
  │                                │
  ├─ useEntityCodeSuggestion ──→  GET /api/entity-code/suggest
  │   (debounced 400ms)            │  ├─ Resolve building letter
  │                                │  ├─ Resolve type code
  │                                │  ├─ Scan existing entities
  │                                │  └─ Return next sequence
  │                                │
  ├─ Auto-populate code field  ←──┘
  │  (user can override)
  │
  ├─ Submit form ──────────────→  POST /api/units/create
  │                                │  ├─ If no code → auto-generate
  │                                │  └─ Store in Firestore
  └──────────────────────────────┘
```

---

## 8. Changelog

### 2026-03-27: Dedicated `code` field for Storage + Parking

**Changes:**
- Added `code?: string` field to `Storage` and `ParkingSpot` interfaces
- Changed `codeField` from `'name'`→`'code'` (storage) and `'number'`→`'code'` (parking) in ENTITY_REGISTRY
- Updated API suggest route to check `code` field with fallback to legacy `name`/`number`
- Added `code` to create/update API schemas for both storage and parking
- Added `EntityCodeField` shared component (`src/components/shared/EntityCodeField.tsx`)
- Added entity code UI to StorageGeneralTab and ParkingGeneralTab detail forms
- Updated AddStorageDialog and AddParkingDialog to use separate `code` field
- Updated cascade propagation to prefer `code` over legacy fields

**Affected files:** types/storage/contracts.ts, types/parking.ts, firestore-mappers.ts, entity-creation.types.ts, entity-code/suggest/route.ts, storages/route.ts, storages/[id]/route.ts, parking/route.ts, parking/[id]/route.ts, StorageGeneralTab.tsx, ParkingGeneralTab.tsx, AddStorageDialog.tsx, AddParkingDialog.tsx, EntityCodeField.tsx, i18n (el/en storage + parking)

### 2026-04-04: Code regeneration on building/floor/type change + prerequisite validation

**Problem:** Ο κωδικός δημιουργούνταν μόνο μία φορά (κατά την πρώτη δήλωση κτιρίου). Αλλαγή ορόφου, κτιρίου ή τύπου δεν ενημέρωνε τον κωδικό. Επίσης, αν δεν είχε δηλωθεί ρητά όροφος, ο κωδικός δημιουργούνταν με floor=0 (default ισόγειο).

**Fix 1 — Regeneration:** Όταν αλλάζει `buildingId`, `floor`, ή `type` σε υπάρχον property, γίνεται reset `codeOverridden` + καθαρισμός code → νέα πρόταση κωδικού αυτόματα.

**Fix 2 — Prerequisite validation:** Πρόταση κωδικού γίνεται ΜΟΝΟ αν υπάρχουν ΚΑΙ τα τρία: `buildingId` + `type` + `floorId` (ρητή δήλωση ορόφου, όχι default 0).

**Fix 3 — Contextual placeholder:** Αν λείπει κάτι, το πεδίο κωδικού δείχνει τι χρειάζεται: "Δηλώστε κτίριο" / "Δηλώστε τύπο ακινήτου" / "Δηλώστε όροφο".

**Affected files:** PropertyFieldsBlock.tsx, PropertyFieldsEditForm.tsx, property-fields-form-types.ts

### 2026-04-05: Locked building `code` field as source-of-truth for unit code generation

**Problem:** Ο `extractBuildingLetter()` προσπαθούσε να εξάγει το γράμμα του κτηρίου κάνοντας regex parsing πάνω στο ελεύθερο `Building.name` (π.χ. "Κτήριο Α"). Αν ο χρήστης έδινε αυθαίρετο όνομα (π.χ. "TestBuildingOK" ή "Πύργος Νότου"), η εξαγωγή έπεφτε σε fallback (πρώτος χαρακτήρας) και ο αυτόματος κωδικός μονάδας (`T-DI-1.01` αντί `A-DI-1.01`) έβγαινε λάθος.

**Solution — διαχωρισμός σε δύο πεδία (ISO 19650 / BIM pattern):**
- **`Building.code`** (νέο, locked, auto-sequenced): "Κτήριο Α", "Κτήριο Β", "Κτήριο Γ"... — αυτόματη πρόταση ανά project, read-only στο UI, **source-of-truth** για την εξαγωγή γράμματος.
- **`Building.name`** (διατηρείται, free-text): "Κτήριο Γραφείων", "Νότιο Συγκρότημα"... — human-readable label.

**Implementation:**
- Νέοι helpers στο `config/entity-code-config.ts`: `GREEK_UPPERCASE_LETTERS` (24 γράμματα Α..Ω), `BUILDING_CODE_PREFIX`, `getGreekLetterAt()`, `buildBuildingCode()`, `suggestNextBuildingCode()` (gap-filling strategy).
- Το `extractBuildingLetter()` αποδέχεται πλέον `{ code?, name? }` object — προτεραιοποιεί `code`, κάνει fallback στο `name` για προ-migration κτήρια. Διατηρείται backward-compat string signature.
- `AddBuildingDialog`: όταν ο χρήστης επιλέγει project, φορτώνει τους υπάρχοντες κωδικούς κτηρίων (`getBuildingCodesByProject`) και προ-συμπληρώνει read-only πεδίο `code` με το επόμενο διαθέσιμο γράμμα.
- UI display: `BuildingCardTitle`, `BuildingListCard`, `BuildingGridCard`, `BuildingDetailsHeader` δείχνουν `{code}` ως κύριο τίτλο και `{name}` ως υπότιτλο (όταν διαφέρουν).
- Migration endpoint `POST /api/admin/backfill-building-code`: αναθέτει κωδικούς σε υπάρχοντα κτήρια ανά project κατά σειρά `createdAt`, σεβόμενο υπάρχοντα patterns "Κτήριο X" στα legacy `name`.

**Affected files:** types/building/contracts.ts, config/entity-code-config.ts, services/entity-code.service.ts, lib/firestore/entity-creation.service.ts, lib/firestore/entity-creation.types.ts, app/api/entity-code/suggest/route.ts, app/api/buildings/route.ts, app/api/buildings/building-update.handler.ts, app/api/admin/backfill-building-code/route.ts (new), components/building-management/hooks/useBuildingForm.ts, components/building-management/dialogs/AddBuildingDialog.tsx, components/building-management/dialogs/add-building-dialog/AddBuildingDialogTabs.tsx, components/building-management/dialogs/add-building-dialog/add-building-dialog.config.ts, components/building-management/building-services.ts, components/building-management/BuildingCard/BuildingCardContent.tsx, components/building-management/BuildingCard/BuildingCardContent/BuildingCardTitle.tsx, components/building-management/BuildingDetails/BuildingDetailsHeader.tsx, domain/cards/building/BuildingListCard.tsx, domain/cards/building/BuildingGridCard.tsx, i18n/locales/{el,en}/building.json

**✅ PENDING ITEMS — ΟΛΟΚΛΗΡΩΘΗΚΑΝ (follow-up συνεδρία 2026-04-05):**

Τα παρακάτω είχαν προγραμματιστεί στο plan αλλά **δεν υλοποιήθηκαν** στην αρχική pass:

1. **[HIGH] Server-side uniqueness validation στο `code` per project**
   - Θέση: `src/app/api/buildings/route.ts` στο POST handler, πριν το `createEntity()`.
   - Τι χρειάζεται: query `collection(buildings).where(projectId==X).where(code==body.code)` → αν υπάρχει match, throw `ApiError(409, 'Building code already exists in this project')`.
   - Γιατί: race condition protection — αν 2 χρήστες δημιουργούν ταυτόχρονα, θα πάρουν το ίδιο auto-suggested code.
   - Πρέπει επίσης να προστεθεί στο PATCH handler (`building-update.handler.ts`) όταν αλλάζει το `code`.

2. **[MEDIUM] UI display στο `BuildingsList.tsx` (γραμμή 66)**
   - Θέση: `src/components/building-management/BuildingsList.tsx:66`
   - Τι χρειάζεται: αλλαγή από `building.name` σε `building.code && building.name && building.name !== building.code ? \`${building.code} — ${building.name}\` : (building.code || building.name)`.
   - Γιατί: consistency με τα υπόλοιπα building display components (BuildingCardTitle, BuildingListCard, BuildingGridCard, BuildingDetailsHeader).

3. **[LOW] Unit tests για τους νέους helpers**
   - Θέση: νέο αρχείο `src/config/__tests__/entity-code-config.test.ts` (δεν υπάρχει test infra στο module σήμερα).
   - Test cases για `suggestNextBuildingCode()`:
     - `[]` → "Κτήριο Α"
     - `["Κτήριο Α"]` → "Κτήριο Β"
     - `["Κτήριο Α", "Κτήριο Γ"]` → "Κτήριο Β" (gap-filling)
     - `["Κτήριο Α", ..., "Κτήριο Ω"]` (24 entries) → "Κτήριο 25"
   - Test cases για `extractBuildingLetter()` με object signature:
     - `{ code: "Κτήριο Α", name: "Foo" }` → "A" (code wins)
     - `{ name: "Κτήριο Γ" }` → "G" (fallback)
     - `{ name: "TestBuildingOK" }` → "T" (legacy fallback)
     - Backward-compat: `"Κτήριο Α"` (string) → "A"

---

### 2026-04-05 (follow-up): 3 pending items completed

**Implementation:**

1. **[HIGH] ✅ Server-side uniqueness validation** — `src/app/api/buildings/route.ts` POST + `building-update.handler.ts` PATCH:
   - POST: query `buildings.where(projectId==X).where('code'==body.code).limit(1)` → `ApiError(409)` αν υπάρχει conflict.
   - PATCH: τρέχει μόνο όταν αλλάζει το `code`, εξαιρεί το ίδιο το document από το check (conflict detection σε `docs.find(d => d.id !== buildingId)`).
   - Χρησιμοποιεί `normalizeProjectIdForQuery()` για συμβατότητα με ADR-209 (string/number projectId).

2. **[MEDIUM] ✅ BuildingsList search να περιλαμβάνει `code`** — `src/components/building-management/BuildingsList.tsx:63-75`:
   - Προστέθηκε το `building.code` στο search array του `matchesSearchTerm()`. Η οπτική εμφάνιση (title `{code} — {name}`) γίνεται ήδη στο `BuildingListCard`.

3. **[LOW] ✅ Unit tests** — νέο αρχείο `src/config/__tests__/entity-code-config.test.ts` (28 tests, όλα περνούν):
   - `suggestNextBuildingCode()`: empty, sequential, gap-filling, beyond Ω, case-insensitive matching, numeric overflow.
   - `extractBuildingLetter()`: object + string signatures, Greek→Latin conversion, trailing digit extraction, TestBuildingOK fallback (historical regression), null/undefined defense.
   - `buildBuildingCode()` / `getGreekLetterAt()`: full 24-letter coverage, Ω→25 numeric fallback.

**Affected files:** `src/app/api/buildings/route.ts`, `src/app/api/buildings/building-update.handler.ts`, `src/components/building-management/BuildingsList.tsx`, `src/config/__tests__/entity-code-config.test.ts` (new)

### 2026-04-15: AddPropertyDialog sealed — 100% SSoT for `useEntityCodeSuggestion`

**Problem:** `useAddPropertyDialogState.ts` chiamava `useEntityCodeSuggestion` direttamente (3 violazioni SSoT). Era l'unico entry point rimasto fuori dal pattern `EntityCodeField`.

**Fix:**
- `useAddPropertyDialogState.ts`: rimosso `useEntityCodeSuggestion` import + call, `codeOverridden` state, `codeLoading`, `suggestedCode`, e il `useEffect` di auto-apply. Aggiunto `latestSuggestion` state (da `onSuggestionChange`) per fallback nei save payload.
- `AddPropertyDialog.tsx`: sostituito custom `<Input>` + Popover + feedback inline con `<EntityCodeField>` (stesso pattern di `PropertyFieldsEditForm`, `AddStorageDialog`, `AddParkingDialog`). Aggiunto `infoContent` con la rich table dei prefissi.

**Risultato:** `useEntityCodeSuggestion` viene chiamato SOLO da `EntityCodeField`. Zero codice di codificazione disperso. SSoT baseline: 21 violations / 20 file (−3).

**Affected files:** `useAddPropertyDialogState.ts`, `AddPropertyDialog.tsx`, `.ssot-violations-baseline.json`
