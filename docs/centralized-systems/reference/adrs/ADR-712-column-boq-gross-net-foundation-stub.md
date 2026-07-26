# ADR-712 — Επιμέτρηση κολώνας gross/net + άρθρο «κοντόστυλου» θεμελίωσης

**Κατάσταση:** Υλοποιημένο (2026-07-26)
**Σχετικά:** ADR-489 §6.1/§7 (στατική συνέχεια κολώνα→πέδιλο) · ADR-449 (σοβάς — ο δίδυμος
children path) · ADR-441 (foundation NET BOQ) · ADR-376/674 (οι 3 διαδρομές BOQ) ·
ADR-459 Φ0/Φ7 (cross-level organism / foundation-level-store)

---

## 1. Πρόβλημα

Το ADR-489 §6.1 έλυσε το «κενό κολώνα ↔ πέδιλο»: η κολώνα **επιμηκύνεται προς τα κάτω**
(`baseDropMm`) ώστε να εδραστεί στην άνω παρειά του πεδίλου της, με την κορυφή σταθερή.

Αυτό όμως ζούσε **μόνο στο 3Δ render** (`bim-three-structural-converters.ts`). Η επιμέτρηση
δεν το ήξερε ποτέ:

| | Τι μετρά σήμερα | Τι λείπει |
|---|---|---|
| Πέδιλο (OIK-2.02) | πλήρες prism | — |
| Κολώνα (OIK-2.03) | από τη **nominal** βάση (FFL) ως την κορυφή | το τμήμα από την άνω παρειά του πεδίλου ως το FFL |

**Δεν υπήρχε διπλομέτρηση — υπήρχε έλλειμμα.** Το ενδιάμεσο «κοντόστυλο» δεν το χρέωνε
κανείς.

**Δύο ανεξάρτητες αιτίες:**

1. **Το feed δεν βλέπει τα πέδιλα.** Το `useColumnPersistence` δίνει στο `columnBoqEntity`
   **μόνο τη σκηνή του ενεργού ορόφου**· τα πέδιλα ζουν στον όροφο Θεμελίωσης.
2. **Ο χάρτης συνέχειας δεν είναι προσβάσιμος.** Μετά το ADR-489 §7 ζει στο `SyncContext`
   του 3Δ multi-floor sync — ένα React data hook δεν τον φτάνει.

---

## 2. Απόφαση

### 2.1 Το όριο: η άνω παρειά του πεδίλου

Πάνω από αυτήν → κολώνα. Μέσα στον όγκο του πεδίλου → πέδιλο. **Ποτέ διπλά.**

Τεκμηρίωση: κανόνας επιμετρητών (*columns measured from the top of the foundation pad to
the underside of the first-floor beam*) · Tekla (η επικάλυψη = ανακρίβεια, ευθύνη του
μοντέλου) · Revit (το join order κόβει το ένα μέλος — σύνολο σωστό, **ανάλυση ανά στοιχείο
λάθος**) · IFC/bSI (κρατά **και τα δύο**: `GrossVolume` + `NetVolume`).

### 2.2 gross/net ανά στοιχείο = ΑΠΑΙΤΗΣΗ, όχι βελτίωση

**Ο Giorgio επιβεβαίωσε (2026-07-26): το ΝΕΤ ΟΙΚ τιμολογεί ΧΩΡΙΣΤΑ σκυρόδεμα θεμελίων από
ανωδομής.** Άρα λάθος απόδοση δεν είναι σφάλμα όγκου — είναι σφάλμα **ΤΙΜΗΣ**. Ένα μόνο
νούμερο ανά στοιχείο δεν αρκεί.

### 2.3 Το σχήμα ποσοτήτων

```
 ┌──────────────── z_top  (κορυφή κολώνας)
 │  NET   → OIK-2.03 «κολώνα ανωδομής»          (z_top − z_nominalBase) × A
 ├──────────────── z_nominalBase  (FFL ορόφου + baseOffset)
 │  STUB  → OIK-2.07 «κοντό υποστύλωμα»  (ΝΕΟ)   baseDropMm × A
 ├──────────────── z_footingTop  (άνω παρειά πεδίλου)
 │  (πέδιλο — ΑΜΕΤΑΒΛΗΤΟ, OIK-2.02)
 └────────────────
      GROSS (IFC GrossVolume) = NET + STUB
```

| Ποσότητα | Άρθρο |
|---|---|
| NET (ανωδομή) | `OIK-2.03` — αμετάβλητο |
| **STUB (κοντόστυλο)** | **`OIK-2.07` — ΝΕΟ** |
| Πέδιλο | `OIK-2.02` — αμετάβλητο |

**Γιατί ξεχωριστό άρθρο και όχι προσαύξηση του OIK-2.03** (απόφαση Giorgio): ρίχνοντας το
κοντόστυλο στην κολώνα, η **ποσότητα** γίνεται σωστή αλλά η **τιμή** λάθος — σκυρόδεμα
θεμελίων χρεωμένο ως ανωδομή.

`OIK-2.07` = ο επόμενος ελεύθερος της ομάδας OIK-2 Σκυροδέματα (2.01 πλάκα · 2.02 θεμελίωση ·
2.03 κολώνα · 2.04 δοκός · 2.05 σκάλα · **2.06 πιασμένο** από το `system-materials-seed`).

Καμία έδραση → `stub = 0` → `gross === net` → **byte-for-byte η προηγούμενη επιμέτρηση**.

---

## 3. Υλοποίηση

| Αρχείο | Ρόλος |
|---|---|
| `bim/geometry/column-foundation-stub.ts` **(NEW)** | Pure SSoT του σχήματος: `(net, area, baseDropMm) → {baseDropMm, stubVolumeM3, netVolumeM3, grossVolumeM3}`. Ίδιο clamp με τον 3Δ πυρήνα → render και επιμέτρηση δεν μπορούν να αποκλίνουν. |
| `bim/config/bim-to-atoe-mapping.ts` | Νέο άρθρο `OIK-2.07` + `resolveColumnFoundationStubMapping()` (έβδομος resolver εκτός kind-πίνακα). |
| `hooks/data/column-continuity-boq-source.ts` **(NEW)** | **Το transport.** `Map<columnId, baseDropMm>` — reuse `buildOrganismScene` → `buildStructuralGraph` → `buildColumnBaseContinuityMap`. Μηδέν νέα λογική ζευγαρώματος, μηδέν νέο store. |
| `hooks/data/column-boq-feed.ts` | 3ο **προαιρετικό** param `baseDropMap`· υπολογίζει gross/net/stub. Το module μένει pure. |
| `bim/services/column-foundation-stub-boq.ts` **(NEW)** | Child payload builder (`boq_bim_<colId>_foundation_stub`). |
| `bim/services/BimToBoqBridge.ts` | `foundationStub` στο `BimEntityForBoq` + **ενοποίηση children pipeline** (§3.2). |
| `bim/services/boq-base-row.ts` | **N.0.2:** νέο `buildGroupChildBoqRow` — το ίδιο μπλοκ ήταν ήδη inline σε `boq-multi-layer-builder` **και** `structural-finish-boq`· το κοντόστυλο θα ήταν το τρίτο αντίγραφο. Και οι τρεις καλούν πλέον το SSoT. |
| `hooks/data/column-schedule-stub-feed.ts` **(NEW)** | Lookup builder για τη 2η διαδρομή (πίνακας Επιμετρήσεων). |
| `bim/schedule/{types,schedule-preset-columns,schedule-preset-mappers}.ts` | `columnFoundationStub` lookup + δύο νέες στήλες. |
| `systems/levels/building-foundation-level.ts` | `activeLevelBearsOnFoundation()` — το §7.1 κριτήριο σε επίπεδο ορόφων (§3.3). |
| `state/foundation-level-store.ts` + `hooks/useFoundationLevelSync.ts` | Το flag `activeLevelBearsOnFoundation` (owner-computed, fail-closed). |

### 3.1 Γιατί το transport ΔΕΝ επαναλαμβάνει το σφάλμα του ADR-489 §7

Το ADR-489 §7 απαγορεύει **global store για cross-floor derived**. Ο κανόνας του:
*«transient global transport είναι έγκυρο μόνο για DERIVED τιμές που καταναλώνονται στο ίδιο
scope που τις παρήγαγε»*.

Εδώ ο κανόνας **τηρείται**: ο χάρτης χτίζεται **on-demand μέσα στην κλήση** και πεθαίνει
μαζί της — καμία δημοσίευση, κανένας store. Παραγωγή και κατανάλωση στο ίδιο scope: η κολώνα
που επιμετράται ανήκει στον ενεργό όροφο.

Αυτό που διαβάζεται από store είναι τα **ΔΕΔΟΜΕΝΑ** (τα entities της Θεμελίωσης, ADR-459 Φ0
`foundation-level-store`), όχι ο derived χάρτης. Η διάκριση είναι ακριβώς αυτή που κάνει ήδη
ο `structural-organism-core`.

### 3.2 Γιατί ΕΝΑ children pipeline και όχι δύο branches

Το `upsertBoqItemForBim` ήταν αλυσίδα `if/else`: multi-layer **ή** finish **ή** single-entry.
Μια κολώνα μπορεί κάλλιστα να έχει **ΚΑΙ** σοβά **ΚΑΙ** κοντόστυλο — με if/else το δεύτερο
έχανε σιωπηλά τη γραμμή του. Πλέον οι πηγές children **συνθέτουν** κάτω από έναν parent (ο
πυρήνας δεν αλλάζει από καμία τους — και οι δύο είναι additive). Κλειδωμένο με test.

### 3.3 ⚠️ Το §7.1 guard — το ακριβό λάθος που αποτρέπεται

Το `footingSupportsColumnBase` (SSoT κριτήριο του graph) είναι **μονόπλευρο**: ρωτά μόνο
*«κάθεται το πέδιλο χαμηλότερα και καλύπτει το plan-centroid;»*, **χωρίς μέγιστη κατακόρυφη
απόσταση**. Επειδή οι κολώνες στοιβάζονται με ίδιο footprint, ένα πέδιλο «στηρίζει» εξίσου
την κολώνα του Ισογείου **ΚΑΙ** του 3ου ορόφου.

Το `buildColumnBaseContinuityMap` το λύνει (ADR-489 §7.1) βλέποντας **όλες** τις κολώνες της
στοίβας — πολυτέλεια που έχει μόνο ο 3Δ multi-floor sync. **Ο επιμετρητικός καταναλωτής
βλέπει έναν όροφο τη φορά.** Χωρίς guard, η κολώνα του 1ου ορόφου θα χρεωνόταν κοντόστυλο
**4m**, του 2ου 7m, κ.ο.κ. — καταστροφικό για τιμολόγιο.

Το ίδιο ερώτημα απαντιέται ένα επίπεδο ψηλότερα: **παρεμβάλλεται όροφος** ανάμεσα στη
Θεμελίωση και τον ενεργό; Αν ναι, παρεμβάλλεται και κολώνα. Μόνο ο owner
(`useFoundationLevelSync`) ξέρει τη λίστα ορόφων, οπότε το απαντά εκεί μία φορά και το
δημοσιεύει ως `activeLevelBearsOnFoundation`.

**Fail-closed by design:** άγνωστη/κενή λίστα ορόφων, ή flag που δεν τέθηκε → **καμία
χρέωση**. Προτιμότερο undercount (η σημερινή συμπεριφορά) παρά λάθος χρέωση 4m.

> **Γνωστός περιορισμός:** αν ο ενδιάμεσος όροφος **δεν** έχει κολώνα σε εκείνη τη στοίβα, το
> κοντόστυλο δεν χρεώνεται (συντηρητική άρνηση). Η πλήρης ακρίβεια απαιτεί πρόσβαση στις
> κολώνες όλου του stack από το persistence layer — δεν υπάρχει σήμερα non-React getter.

### 3.4 Ο πίνακας Επιμετρήσεων: lookup, ΟΧΙ αντικατάσταση γεωμετρίας

Σε αντίθεση με το `applyFoundationGridNet` (ADR-441), εδώ **δεν** αντικαθίσταται η γεωμετρία.
Η στήλη «Όγκος» δείχνει ήδη τον όγκο **ανωδομής** — αυτό ακριβώς πρέπει να συνεχίσει να
δείχνει (είναι η ποσότητα του OIK-2.03). Το κοντόστυλο είναι **επιπλέον** ποσότητα σε άλλο
άρθρο, όχι διόρθωση της υπάρχουσας. Άρα: δύο νέες στήλες από `ScheduleLookups`, **μηδέν**
αλλαγή στο `ColumnGeometry`, **μηδέν** regression στη στήλη «Όγκος».

---

## 4. Ροή (end-to-end)

```
αποθήκευση κολώνας → useColumnPersistence.feedColumnBoq
  → buildColumnBaseDropMap(activeEntities)
      ├ guard §7.1: activeLevelBearsOnFoundation;  όχι → κενός χάρτης (καμία χρέωση)
      └ foundation-level-store → buildOrganismScene → buildStructuralGraph
        → buildColumnBaseContinuityMap → Map<columnId, baseDropMm>
  → columnBoqEntity(entity, scene, baseDropMap)
      → computeColumnFoundationStub → { gross, net, stub }
  → BimToBoqBridge.upsertWithChildren
      ├ parent  boq_bim_<id>                  OIK-2.03  net   (ανωδομή)
      ├ child   boq_bim_<id>_finish_<mat>     OIK-4.xx  m²    (ADR-449, αν υπάρχει σοβάς)
      └ child   boq_bim_<id>_foundation_stub  OIK-2.07  stub  (θεμέλια)

πίνακας Επιμετρήσεων → buildColumnFoundationStubLookup(entities)
  → ScheduleLookups.columnFoundationStub → στήλες grossVolume / foundationStubVolume
```

---

## 5. Tests (jest GREEN)

| Suite | Τι κλειδώνει |
|---|---|
| `column-foundation-stub.test.ts` **(NEW, 6)** | `gross = net + stub`· clamp σε αρνητικό drop· shaped διατομή (ίδιο εμβαδό, όχι bbox)· degenerate NaN/Infinity· `hasFoundationStub`. **Mutation-verified**: αφαίρεση του `Math.max(0, …)` → κόκκινο. |
| `column-boq-feed.test.ts` **(+4, σύνολο 8)** | Identity fast-path χωρίς χάρτη· `geometry.volume` μένει ΑΝΩΔΟΜΗ· stub πάνω σε profile-aware geometry (top-attach 2300mm). |
| `column-continuity-boq-source.test.ts` **(NEW, 7)** | Pure cross-level αλυσίδα (drop 1000)· **§7.1 guard: υπερκείμενος όροφος ΔΕΝ χρεώνεται 4m** — το test επαληθεύει ρητά ότι ο ίδιος graph *θα* έδινε 4000 χωρίς guard· fail-closed default. |
| `BimToBoqBridge.test.ts` **(+4, σύνολο 46)** | Χωρίς stub → single-entry· μόνο stub → parent+1· **σοβάς ΚΑΙ stub → parent+2 (κανένα δεν χάνεται)**· per-row detach guard. **Mutation-verified**: επαναφορά του if/else → κόκκινο. |
| `schedule-preset-mappers.test.ts` **(+3, σύνολο 7)** | Κενά κελιά χωρίς lookup· `volume` **αμετάβλητο** με stub· gross/stub γεμίζουν. |
| `building-foundation-level.test.ts` **(+5)** | Ισόγειο → true· 1ος → false· ίδιος όροφος → false· κενή λίστα → false· ημιώροφος → false. |

Γειτονικό regression: `structural-finish-boq` · `boq-multi-layer-builder` ·
`bim-to-atoe-mapping` · `derive-column-base-continuity` · `column-vertical-profile` ·
`foundation-level-store` → **όλα πράσινα** (η κεντρικοποίηση του child-row δεν άλλαξε
payload). `jscpd:diff` σε 10 αρχεία → **0 νέα clones**.

---

## 6. DEFER

- **Πλήρης §7.1 ακρίβεια στην επιμέτρηση** — απαιτεί πρόσβαση στις κολώνες όλου του stack
  από το persistence layer (σήμερα μόνο ο 3Δ την έχει). Μέχρι τότε: fail-closed άρνηση όταν
  παρεμβάλλεται όροφος (§3.3).
- **Attached-prism path** — το `baseDropMm` δεν εφαρμόζεται εκεί ούτε στο render (ADR-489 §6).
- **Ο analytical `columnNode.baseZmm`** μένει nominal (ADR-489 DEFER) — δεν επηρεάζει BOQ.

---

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-26 | **Δημιουργία + υλοποίηση.** Το `baseDropMm` (ADR-489 §6.1) έφτασε στην επιμέτρηση: gross/net κατά IFC, νέο άρθρο `OIK-2.07` για το κοντόστυλο θεμελίωσης, ενοποίηση του children pipeline στο bridge, δεύτερη διαδρομή (πίνακας Επιμετρήσεων) με δύο νέες στήλες. **§7.1 guard** (`activeLevelBearsOnFoundation`, fail-closed) — χωρίς αυτό κάθε υπερκείμενη κολώνα θα χρεωνόταν κοντόστυλο 4m+. N.0.2: `buildGroupChildBoqRow` κεντρικοποιήθηκε από 2 προϋπάρχοντα αντίγραφα. **29 νέα/επεκταμένα jest GREEN** (256 συνολικά πράσινα στο scope), 2 mutations επαληθευμένα, jscpd καθαρό. |
