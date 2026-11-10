# HANDOFF — ADR-249 §7: το «άδειασμα πεδίου» (`null`) απορρίπτεται από τον server — βρέθηκε στη ζωντανή επαλήθευση

**Ημερομηνία:** 2026-11-10 · **Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Εγκρίθηκε από τον Giorgio:** η διόρθωση παρακάτω (μήνυμα «ΝΑΙ ΕΓΚΡΙΝΩ»). `wt:land` και push **ΜΟΝΟ με δική του εντολή**. Ποτέ commit στο `main`.

## 1. Τι έχει γίνει (στην παραγωγή)

- Commit `70b29d14` — «lock by value change, form sends only changed fields (ADR-249 §7)» — είναι στο `main` και **ζωντανό** (deploy `0876de7` το περιέχει).
- Ουσία: ο ΕΝΑΣ κριτής `src/lib/property/property-field-change.ts` (`samePropertyFieldValue`, `changedPropertyFields`) · κλείδωμα κατά αλλαγή τιμής `judgeLockedFields` (`src/lib/property/property-locked-fields.ts`) · φρουρός server `validatePropertyFieldLockingUnlessRevert(status, body, existing)` (`src/lib/firestore/property-field-locking.ts`) · φίλτρο φόρμας `changedPropertyUpdatesFromForm` (`src/features/property-details/components/property-fields-form-mapper.ts`) · `_v` μέσω `useVersionedSave` (`src/hooks/useGuardedPropertyMutation.tsx`). Τεκμηρίωση: ADR-249 §7.

## 2. Ζωντανή επαλήθευση (nestorconstruct.gr, μονάδα «ΔΟΚΙΜΗ Ε — Πωλημένο», `prop_a0000005-7777-4aaa-8aaa-000000000005`)

| # | Δοκιμή | Αποτέλεσμα |
|---|---|---|
| 1 | Επεξεργασία → Αποθήκευση χωρίς αλλαγή (πουλημένο) | ✅ καμία κλήση δικτύου, η φόρμα κλείνει (πριν: 403) |
| 2 | Κοινόχρηστα 40 → Αποθήκευση | ✅ PATCH 200, σώμα **μόνο** `{"commonCharges":{"monthlyAmount":40,"includes":null}}`, απάντηση `_v: 1` |
| 3 | Άδειασμα κοινοχρήστων → Αποθήκευση | ❌ `POST …/impact-preview` σώμα `{"commonCharges":null}` → **400 Validation failed** → διάλογος «Η αλλαγή ακινήτου μπλοκαρίστηκε» |

⚠️ **Η «ΔΟΚΙΜΗ Ε» έμεινε με κοινόχρηστα 40 €** (πριν ήταν κενά). Καθάρισέ τα μετά τη διόρθωση, από τη φόρμα (= και ζωντανή δοκιμή 3).

## 3. Ρίζα (μετρημένη)

- Το `changedPropertyFields` στέλνει `null` (RFC 7396 «σβήσε») για πεδίο της baseline που λείπει τώρα. Πριν το `70b29d14` το άδειο μπλοκ απλώς **δεν στελνόταν** ⇒ το πρόβλημα το **εισήγαγε** η αλλαγή μας.
- `src/app/api/properties/[id]/property-patch-helpers.ts`, `PropertyPatchSchema` (κοινό σε PATCH **και** `impact-preview`):
  - γρ. ~134 `commonCharges: storedCommonChargesSchema.optional()` — **όχι** nullable
  - γρ. ~142 `energy: storedEnergyCertificateSchema.optional()` — **όχι** nullable ⇒ ίδιο σφάλμα πιθανότατα στο άδειασμα ΠΕΑ (μη δοκιμασμένο)
  - το σχήμα είναι `.passthrough()` ⇒ `areas`, `commercial` κ.ά. περνούν το σχήμα με `null` — **ΑΓΝΩΣΤΟ** τι κάνει ο γραφέας/normalizer με `null` εκεί.

## 4. Επόμενο βήμα (εγκεκριμένο)

1. **SSoT audit (grep) πρώτα**: πώς σβήνει σήμερα πεδία ο γραφέας του PATCH (`FieldValue.delete`; αποθήκευση `null`;) — `property-write-normalizer`, `route.ts` του `properties/[id]`, `applyMultiLevelDefaults`, audit-diff. Ποιοι αναγνώστες (`readCommonCharges`, `readEnergyCertificate`, `mapPropertyDoc`) αντέχουν `null`. Υπάρχει ήδη μηχανισμός «clear» αλλού (π.χ. `floorId: nullable`); επαναχρησιμοποίησέ τον.
2. Πρακτική μεγάλων: Google AIP-134 (field mask: πεδίο στη μάσκα χωρίς τιμή = clear) / RFC 7396 (`null` = remove). Απόφαση: `null` ⇒ **διαγραφή πεδίου** στο έγγραφο (όχι αποθηκευμένο `null`), ένα σημείο μετάφρασης στον server.
3. Σχήμα: `.nullable()` στα `commonCharges` + `energy` (και όσα άλλα ελέγξει το audit ότι η φόρμα μπορεί να αδειάσει: `areas`, `commercial`, …). Προσοχή: το `energy` έχει αξίωση/`energyDeclarationPatch` (ADR-777 §8.94) — το σβήσιμο ΠΕΑ πρέπει να περνά από τον ίδιο κανόνα.
4. Το κλείδωμα: σε πουλημένο το `energy`/`areas` είναι κλειδωμένα ⇒ `null` πάνω σε υπάρχουσα τιμή = αλλαγή ⇒ 403 (σωστό). Το `commonCharges` δεν είναι κλειδωμένο.
5. ADR-249 §7: νέα υποενότητα + γραμμή changelog.
6. Ζωντανή επαλήθευση (μετά από push που θα διατάξει ο Giorgio): άδειασμα κοινοχρήστων στη «ΔΟΚΙΜΗ Ε» → 200 + το πεδίο σβήνεται.

## 5. Ακόμη ανοιχτά (χρειάζονται έγκριση Giorgio)

- Tests: ενημέρωση `property-form-areas.test.ts`, `property-form-commercial.test.ts`, `property-energy-import-chain.test.ts` + όσα καλούν `validatePropertyFieldLockingUnlessRevert` με 2 ορίσματα· νέες άγκυρες για `judgeLockedFields`, `changedPropertyFields` (και για το σβήσιμο). **Κανένα test χωρίς έγκριση.**
- Δεν δοκιμάστηκε ζωντανά η άρνηση αλλαγής κλειδωμένου πεδίου (403).

## 6. ΜΗΝ

- Μην τρέξεις tsc / tests / πύλες χωρίς έγκριση. Μην στείλεις email σε επαφές.
- Μην κάνεις `wt:land` / push χωρίς εντολή. Μην κάνεις commit στο `main`.
- Μην «λύσεις» στέλνοντας ξανά τίποτα για άδειο μπλοκ (επιστροφή στο παλιό σφάλμα: το πεδίο δεν σβηνόταν ποτέ).
