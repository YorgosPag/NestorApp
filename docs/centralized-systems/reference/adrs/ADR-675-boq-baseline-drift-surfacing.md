# ADR-675 — BOQ Baseline-Drift Surfacing (variance «το σχέδιο ξέφυγε από το υπογεγραμμένο»)

**Status:** **ΥΛΟΠΟΙΗΜΕΝΟ** — code + tests + UI + i18n· εκκρεμεί commit από τον Giorgio
**Ημερομηνία:** 2026-07-17
**Σχετικά:** ADR-673 §7 (frozen-baseline guard — η ΑΜΕΣΗ αφορμή), ADR-634 (`syncManagedBoqRow` SSoT),
ADR-376 (opening BOQ signature-group sync), ADR-363 (BimToBoqBridge), ADR-329 / ADR-252 (BOQ governance/status),
ADR-175 (BOQ data model), CLAUDE.md N.0 / N.7.2 / N.11 / N.18

---

## 1. Η αφορμή

> «Ο auto-sync σταμάτησε να αγγίζει τα κλειδωμένα BOQ rows (σωστά). Αλλά τώρα, όταν το ζωντανό σχέδιο
> ξεφεύγει από την υπογεγραμμένη ποσότητα, κανείς δεν το βλέπει. Θέλω ένδειξη variance: “υπέγραψες 10,
> το σχέδιο δείχνει 7, Δ = −3”, ώστε ο μηχανικός να αποφασίσει revision. Η baseline ΠΟΤΕ δεν αλλάζει αυτόματα.»
> — Giorgio, 2026-07-17

Το ADR-673 §7 πρόσθεσε τον **frozen-baseline guard**: ο BIM→BOQ auto-sync ΔΕΝ αγγίζει BOQ rows σε
`status ∈ {approved, certified, locked}` (υπογεγραμμένα συμβατικά baselines). Σωστό — αλλά όταν ο guard κάνει
skip, το ζωντανό μοντέλο μπορεί να έχει ξεφύγει από τη σφραγισμένη ποσότητα **χωρίς καμία ορατή ένδειξη**.

## 2. Το εύρημα (SSoT audit — grep, κώδικας = SSoT, ΠΡΙΝ κώδικα)

1. **Υπάρχει ήδη `computeVariance`** (`src/services/measurements/cost-engine.ts`) — αλλά **άλλος άξονας**:
   `estimatedQuantity` (εκτίμηση) vs `actualQuantity` (as-built, χειροκίνητη). Ήδη αποδίδεται badge στο
   `BOQFloorGroup.tsx`. Το ζητούμενο είναι **frozen baseline vs live BIM μοντέλο** — δεύτερος, διακριτός άξονας
   (design drift, όχι execution variance). → **επεκτείνουμε το pattern, δεν φτιάχνουμε διπλότυπο**.
2. **Ο frozen-baseline guard ήταν opening-ONLY.** Το `isBoqAutoManagedStatus` υπήρχε μόνο στο
   `opening-boq-sync.ts`. Το γενικό SSoT write primitive `syncManagedBoqRow` (`boq-firestore-sync.ts`, ADR-634 —
   το χρησιμοποιούν `stair-boq-sync` + `envelope-boq-sync`) και το `BimToBoqBridge` (wall/slab/column/beam) είχαν
   **μόνο detach guard**. Δηλαδή certified wall/stair rows **ακόμα overwrite-άρονταν** (ίδιο bug που το ADR-673
   έλυσε μόνο για openings). Ο handoff έλεγε «ο guard είναι γενικός» — **δεν ήταν** στον κώδικα (ADR-vs-code, N.0.1).
3. **Το UI panel είναι Firestore-driven, αποσυνδεδεμένο από τη live BIM σκηνή** (`MeasurementsTabContent`,
   building-management). Δεν έχει πρόσβαση στη σκηνή του DXF viewer (συχνά ούτε στον ίδιο όροφο). → **on-the-fly
   compare στο panel = αδύνατο** χωρίς να ξαναγραφεί όλη η quantity-derivation κάθε discipline στο read path
   (τεράστιο duplication, anti-SSoT).
4. **Firestore rules το επιτρέπουν.** Το `boq_items` update rule (γρ. ~2997-3012): για non-draft rows immutable
   είναι **μόνο** scope/linkedFloorId/linkedUnitId/linkedUnitIds/costAllocationMethod/customAllocations. Νέα πεδία
   σε certified row μέσω **merge write** → επιτρέπονται **χωρίς αλλαγή rules**.

## 3. Απόφαση

**Persisted live-quantity metadata + γενικός SSoT μηχανισμός** (πρακτική μεγάλων — 5D-BIM cost: CostX/iTWO/Vico,
Revit/ArchiCAD schedules): η υπογεγραμμένη ποσότητα (baseline) μένει **αμετάβλητη**, η ζωντανή ποσότητα μοντέλου
παρακολουθείται **ξεχωριστά**, η διαφορά (Δ) εμφανίζεται για ανθρώπινο revision. **Ποτέ σιωπηλή μεταβολή· ποτέ
κρυφή απόκλιση.**

- Στα σημεία που ο guard εντοπίζει **frozen row με live ≠ baseline**, αντί για σκέτο `return`, γίνεται
  **merge write ΜΟΝΟ** `{ liveQuantity, liveQuantitySyncedAt }` — **ποτέ** `estimatedQuantity`, ποτέ delete.
- Το UI υπολογίζει την απόκλιση on-the-fly (`liveQuantity − estimatedQuantity`) και δείχνει badge.

Απορρίφθηκαν: **on-the-fly compare** (αδύνατο, §2.3) και **ξεχωριστό `boq_variance` collection** (νέα rules +
subscription + join = βαρύτερο, χωρίς όφελος αφού τα rules ήδη επιτρέπουν το πεδίο).

## 4. Αρχιτεκτονική (FULL SSoT)

| Layer | Αρχείο | Αλλαγή |
|-------|--------|--------|
| Types | `src/types/boq/boq.ts` | `BOQItem`: +`liveQuantity?: number \| null`, +`liveQuantitySyncedAt?: string \| null` (δίπλα στο `detached`) |
| Types | `src/types/boq/cost.ts` (+`index.ts`) | +`BaselineDriftResult` (baseline/live/delta/percent/syncedAt) |
| Compute | `src/services/measurements/cost-engine.ts` (+`index.ts`) | +`computeBaselineDrift(item)` — pure· null αν δεν υπάρχει `liveQuantity` ΟΥΤΕ απόκλιση (live===baseline) |
| **SSoT write** | `src/subapps/dxf-viewer/bim/services/boq-firestore-sync.ts` | +`recordBaselineDrift(ref, existing, liveQuantity, ...)` — idempotent merge-write· ενσωμάτωση frozen-guard στο `syncManagedBoqRow` (ΜΕΤΑ detach, ΠΡΙΝ zero-cleanup) → **καλύπτει stair + envelope** |
| Write site | `bim/services/opening-boq-sync.ts` | `writeSignatureGroup`: silent-skip → `recordBaselineDrift(…, members.length)` |
| Write site | `bim/services/BimToBoqBridge.ts` | `RowFetchResult.raw`· frozen-guard + drift σε `upsertBoqRow` (multi-layer/finish) + `upsertSingleEntry` |
| UI | `MeasurementsTabContent/BOQFloorGroup.tsx` | `computeBaselineDrift(item)` + compact badge (mirror υπάρχοντος `variance`, ίδιο `getVarianceClass`) |
| i18n | `locales/{el,en}/building-tabs.json` | `tabs.measurements.drift.summary` (ICU single-brace `{baseline}`/`{live}`/`{delta}`) |

**`recordBaselineDrift` — idempotency (Google-level, χωρίς περιττά writes):**
- `live === baseline` (re-converged) → καθάρισε το badge αν υπήρχε drift (`liveQuantity: null`), αλλιώς no-op.
- `live` αμετάβλητο από την προηγούμενη καταγραφή → no-op.
- αλλιώς → merge-write το νέο drift + ISO timestamp.

**Predicate (κρίσιμη λεπτομέρεια):** ο frozen-guard χρησιμοποιεί **`isFrozenBaselineStatus(status)`**
(`src/types/boq/units.ts` — ρητά `approved`/`certified`/`locked`), **ΟΧΙ** `!isBoqAutoManagedStatus`. Τα δύο
διαφέρουν ΜΟΝΟ σε `undefined`/άγνωστο status: το `!isBoqAutoManagedStatus(undefined) === true` θα θεωρούσε
**κάθε row χωρίς status** ως frozen → μπλόκαρε normal upsert + orphan-cleanup των sibling syncs (παλινδρόμηση:
6 tests σε stair/envelope/bridge). Ένα row χωρίς ρητό signed status **δεν** είναι baseline → παραμένει auto-managed.

**Baseline immutability (και στα 4 write sites):** το merge-write προσθέτει ΜΟΝΟ `liveQuantity`/`liveQuantitySyncedAt`.
Το `estimatedQuantity` (και κάθε άλλο baseline/scope field) δεν αγγίζεται ποτέ → 5D-BIM αρχή + Firestore update rule
ικανοποιημένα.

## 5. Firestore rules

**Καμία αλλαγή.** Το υπάρχον `boq_items` update rule επιτρέπει νέα πεδία σε non-draft rows όσο scope/floor/unit/
allocation μένουν ίδια — το merge-write τα διατηρεί (αγγίζει μόνο 2 νέα πεδία). Επιβεβαιωμένο, `firestore.rules` §boq_items.

## 6. Tests (jest — N.17: όχι tsc)

- `__tests__/opening-boq-sync-frozen-baseline.test.ts` — ενημερώθηκε: πλέον επαληθεύει ότι frozen row **καταγράφει
  drift** (merge `{liveQuantity}`), ΠΟΤΕ delete/overwrite baseline (5/5 πράσινα).
- `services/measurements/__tests__/cost-engine-baseline-drift.test.ts` — νέο: `computeBaselineDrift` null/αρνητική/
  θετική/baseline=0 (5/5 πράσινα).
- `jscpd:diff` καθαρό (εξήχθη κοινό `BOQRowActions` interface στο `BOQFloorGroup.tsx` — Boy Scout, N.18).

## 7. Changelog

- **2026-07-17** — Δημιουργία. Persisted live-quantity metadata· γενικός frozen-guard + `recordBaselineDrift` SSoT
  στο `syncManagedBoqRow` (καλύπτει opening/stair/envelope/wall/slab/column/beam)· `computeBaselineDrift` +
  UI badge· i18n el+en· 10 tests. Baseline ποτέ δεν μεταβάλλεται αυτόματα. Εκκρεμεί commit από τον Giorgio.
