# BASELINE (live Firestore) — ΠΡΙΝ τη διαγραφή δοκαριών (verify ADR-401 detach-on-delete)

**Ημ/νία:** 2026-06-19 · **Πηγή:** Firestore live · project `proj_12788b6a-…-a340e6bacaab`,
όροφος «Ισόγειο» `floorId/floorplanId = flr_215e39f3-d958-4f97-ac59-6639131767d1`,
level `lvl_21982f3b-…`. · **updatedAt baseline (όλα): `_seconds: 1781894940`**.

---

## 0. ΣΥΝΟΨΗ — 4 κολώνες, 4 δοκάρια, 0 τοίχοι

**Κολώνες (`floorplan_columns`)** — όλες 250×250, height 3000, `topBinding:"attached"`, `topOffset:0`,
`baseBinding:"storey-floor"`, autoSized, load dead **134.73** / live **32.40** kN (takedown):

| col id | center (x,y) | **attachTopToIds** | footingId |
|---|---|---|---|
| col_b18165a9 | 16120, **12360** | **`beam_71316804`** (👻 ghost) | fnd_93269ee3 |
| col_c944e5b5 | 16120, 16850 | **`beam_71316804`** (👻 ghost) | fnd_d5b29b2a |
| col_d4856d44 | 11310, 16850 | **`beam_71895cba`** (👻 ghost) | fnd_b86f7e22 |
| col_f2447ae6 | 11310, **12360** | **`beam_71895cba`** (👻 ghost) | fnd_8a5c9622 |

**Δοκάρια (`floorplan_beams`)** — όλα 250×400, topElevation 3000, simple, autoSized:

| beam id | άξονας | πλευρά | μήκος |
|---|---|---|---|
| beam_1c52f8e5 | (11435,16850)→(15995,16850) | ΒΟΡΡΑΣ | 4.56 m |
| beam_ed1c9601 | (11435,12360)→(15995,12360) | ΝΟΤΟΣ | 4.56 m |
| beam_68d5c2ad | (16120,12485)→(16120,16725) | ΑΝΑΤΟΛΗ | 4.24 m |
| beam_d7913b0c | (11310,12485)→(11310,16725) | ΔΥΣΗ | 4.24 m |

---

## 1. 🚨 ΚΡΙΣΙΜΟ — οι κολώνες ΔΕΝ δείχνουν στα 4 πραγματικά δοκάρια

Τα `attachTopToIds` των κολωνών δείχνουν σε **2 ΔΙΑΓΡΑΜΜΕΝΑ δοκάρια-φαντάσματα**
(`beam_71316804`, `beam_71895cba`) — **ΟΧΙ** στα 4 υπαρκτά (`1c52f8e5`/`ed1c9601`/`68d5c2ad`/`d7913b0c`).
Αυτό ΕΙΝΑΙ ακριβώς το bug που διορθώνει το ADR-401 fix (το re-link δεν είχε τρέξει — finding D παλιού baseline).

### Συνέπεια για το test:
Το **detach-on-delete** ψάχνει αντίστροφα: «ποια κολώνα δείχνει στο διαγραμμένο beam-id;».
Αν διαγράψεις τα **4 πραγματικά** δοκάρια → καμία κολώνα δεν τα αναφέρει → **κανένα detach** (σωστό!).
Σκέτη διαγραφή ΔΕΝ θα δείξει αλλαγή στις κολώνες — **μην το διαβάσεις ως αποτυχία του fix.**

---

## 2. ✅ ΣΩΣΤΟ ΠΡΩΤΟΚΟΛΛΟ TEST (σειρά)

> ⚠️ **Προϋπόθεση:** η εφαρμογή πρέπει να τρέχει με τον **uncommitted κώδικά μου** (`npm run dev` τοπικά).
> Στο production Vercel ΔΕΝ υπάρχει ακόμα το fix.

**Βήμα 1 — RE-LINK (Κ2 stale-eligibility):** Με τα 4 δοκάρια να υπάρχουν ήδη, τρέξε το auto-attach
(π.χ. «Δοκοί από κάναβο» ξανά, ή μικρο-edit/move ενός δοκαριού ώστε να ξανατρέξει ο coordinator).
**Αναμενόμενο:** κάθε κολώνα `attachTopToIds` αλλάζει **👻ghost → πραγματικό beam-id** (η δυτική πλευρά
→ `d7913b0c`, ανατολική → `68d5c2ad`, κ.λπ.), `topBinding` μένει `attached`, νέο `updatedAt`.

**Βήμα 2 — DETACH-ON-DELETE (Κ1):** *Αφού* οι κολώνες δείχνουν πλέον σε πραγματικά δοκάρια,
**διάγραψε ένα (ή όλα) τα δοκάρια.**
**Αναμενόμενο ανά επηρεαζόμενη κολώνα:** `topBinding: "attached" → "storey-ceiling"`,
`attachTopToIds` → **διαγράφεται** (undefined), νέο `updatedAt`.

**Βήμα 3 — UNDO:** Ctrl+Z → το δοκάρι επανέρχεται ΚΑΙ η κολώνα re-attach-άρει (ΕΝΑ undo entry).

> Εναλλακτικά (αν θες ΜΟΝΟ Κ1 γρήγορα): πες μου να κάνω εγώ το re-link στη βάση (set `attachTopToIds`
> στα 4 πραγματικά beam-ids), μετά διάγραψε δοκάρι → καθαρό test του detach.

---

## 3. Πώς θα κάνω τη σύγκριση
Μετά από κάθε βήμα, ξαναρωτάω `floorplan_columns` + `floorplan_beams` (live) και δίνω diff:
`attachTopToIds` (ghost→real→cleared), `topBinding`, `height/topOffset`, `updatedAt` (επιβεβαιώνει write),
count δοκαριών. Baseline αναφοράς = §0/§1 αυτού του αρχείου (updatedAt 1781894940).
