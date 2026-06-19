# ADR-503 — Two-way auto-size + safety-gated lock (μηδέν σπατάλη + μηδέν ανασφαλές κλείδωμα)

**Status:** 🟡 Slice 1 DONE (two-way column section + ν-floor) — UNCOMMITTED 2026-06-19 · Slice 2 (safety-gated lock) + Slice 3 (organism-wide) = ΕΠΟΜΕΝΗ ΣΥΝΕΔΡΙΑ
**Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §4 (live αυτο-διόρθωση) + §5 (δυναμική επανα-διαστασιολόγηση) + §8.4 (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί)
**Σχετικά:** ADR-499 (auto-correcting organism / column sizing B2), ADR-502 (live reaction-aware takedown), ADR-475 (auto member sizing)

---

## 1. Πρόβλημα (Giorgio)

Η εφαρμογή πρέπει να είναι «έξυπνη»: ο αρχιτέκτονας βάζει κολώνα στον καμβά **χωρίς να ξέρει στατικά** — την παίρνει ως **default 400×400** από την παλέτα. Άρα το σύστημα πρέπει να διαστασιολογεί **διατομή + οπλισμό** αυτόματα ώστε:
- να μην υπάρχει **υποδιαστασιολόγηση** (ανασφαλές), ΚΑΙ
- να μην υπάρχει **υπερδιαστασιολόγηση** (σπατάλη υλικού/χρήματος).

**Δύο κενά (confirmed grep 2026-06-19):**
1. Ο `suggestColumnSection` (ADR-499) ήταν **grow-only** (`Math.max(params.width, s)`) → η υπερδιαστασιολόγηση ΔΕΝ διορθωνόταν → **σπατάλη**.
2. **Δεν υπήρχε πουθενά** έλεγχος ανηγμένου αξονικού `ν = N_Ed/(A_c·f_cd)` (EC8). Άσχετο για grow-only (μεγάλες διατομές τον περνούν), αλλά **κρίσιμο για shrink**.

**Απόφαση Giorgio (2026-06-19):** (Q1) two-way auto-size· (Q2) όταν ο μηχανικός κλειδώνει υποδιαστασιολογημένη διατομή → **μπλοκάρεται** (μένει AUTO ώσπου να γίνει ασφαλής). Invariant: καμία persisted οντότητα ποτέ κάτω από το επαρκές.

## 2. Slice 1 — Two-way column section + ν-floor (DONE)

**Αρχείο:** `bim/structural/sizing/column-sizing.ts`.

- `suggestColumnSection` → **two-way**: επιστρέφει το **ελάχιστο επαρκές** `s×s` (μεγαλώνει Ή μικραίνει), αφαιρώντας το grow-only `Math.max(params.width, s)`.
- NEW `MAX_AXIAL_LOAD_RATIO = 0.65` (EC8 §5.4.3.2.1, DCM). Το `columnSectionFits` ελέγχει τώρα **τετράγωνη trial `s×s`** + δύο πύλες: **(α) ν ≤ 0.65** (η πύλη που κάνει το shrink ασφαλές, reuse `concreteFcdMpa`) **(β) οπλισμός `As,req ≤ ρ_max·A_c`**. Floor = `max(height/30 λυγηρότητα, MIN_COLUMN_DIMENSION_MM=250)`.
- **Scope two-way v1:** ΜΟΝΟ τετράγωνες (`width===depth`, default παλέτας). Μη-τετράγωνες (ρητή αρχιτεκτονική πρόθεση) → **grow-only** (διατηρεί aspect· proportional shrink = DEFER).
- Ο **οπλισμός** ήταν ήδη two-way (derived, recompute κάθε φορά) → ρέει αυτόματα.

**Convergence-safe:** στο ντετερμινιστικό takedown η ζήτηση κολώνας ΔΕΝ εξαρτάται από τη δική της δυσκαμψία — μόνο γεωμετρία + ίδιο βάρος (μικρό κλάσμα) → μονότονη σύγκλιση, μηδέν ταλάντωση. Το 50mm quantization + `columnSectionMateriallyDiffers` κλείνει τον βρόχο.

**Επαλήθευση live μοντέλου (Firestore proj_12788b6a):** κολώνα 400×400, appliedLoad dead=430.09 + live=105.65 (ULS ≈ 739 kN) → two-way προτείνει **300×300** (ν=0.49 ✓· εξοικονόμηση ~44% διατομής). Χωρίς το ν-floor θα πήγαινε ανασφαλώς σε 250×250 (ν=0.71 > 0.65, EC8 παραβίαση). Jest το επιβεβαιώνει.

## 3. Slice 2 — Safety-gated lock (ΕΠΟΜΕΝΗ ΣΥΝΕΔΡΙΑ)

Σήμερα το `autoSized:false` (lock) μπαίνει **μόνο στα δοκάρια** (manual section grip → `grip-parametric-commits.ts:333`)· στις κολώνες ο μηχανισμός lock ουσιαστικά δεν υπάρχει. Σχέδιο:
- NEW pure `isSectionAdequate(params, designMoment)` (reuse `columnSectionFits`/`suggestColumnSection`).
- Στο σημείο manual section edit (grip/panel): manual ≥ επαρκές → lock OK (`autoSized:false`)· manual < επαρκές → **ΜΠΛΟΚ** (μένει AUTO, σύστημα κρατά ελάχιστο επαρκές + μήνυμα i18n el+en).

## 4. Slice 3 — Organism-wide (ΕΠΟΜΕΝΗ ΣΥΝΕΔΡΙΑ)

Ίδιο two-way + lock-gate σε δοκό (`member-sizing`) / πλάκα (`slab-sizing`) / πέδιλο. Κοινός helper.

## 5. Tests (από repo ROOT)

`sizing/__tests__/column-sizing.test.ts` (11, +3 ADR-503): τετράγωνη χωρίς φορτίο→250 (shrink)· live 400×400→300 (ν-governed proof)· ν monotonic· idempotent· μη-τετράγωνη→grow-only. `column-size-patch.test.ts` updated (400×400→patch 250). Πλήρες structural+commands: 1104 pass / 7 pre-existing fails (6 raft ADR-476 `maxFreeSpanM` + 1 AssignWallTypeCommand — confirmed stash baseline, ΟΧΙ δικά μου).

## 6. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία + Slice 1.** Two-way `suggestColumnSection` (shrink+grow στο ελάχιστο επαρκές) + NEW ν-floor `MAX_AXIAL_LOAD_RATIO=0.65` (EC8) στο `columnSectionFits` (η πύλη ασφαλείας του shrink). Square-only v1· μη-τετράγωνες grow-only. Live-model verified (400×400→300×300). Slice 2 (safety-gated lock) + Slice 3 (organism-wide) = handoff. UNCOMMITTED. |
